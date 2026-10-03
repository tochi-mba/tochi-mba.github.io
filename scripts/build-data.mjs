// Validates data/*.json, applies the publication policy and writes what the site renders.
// The generated file is the only thing the Vue app reads; the other files in src/generated are what
// it is built from, and never reach a visitor. The snapshot it starts from holds only what
// may be published (see scripts/schema.mjs), and the policy is applied again here all the same: a
// hand edit to the snapshot must not be able to publish what the sync would not.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicLinks, repoSets } from "./links.mjs";
import { Profile, ProjectsFile, projectFileJsonSchema, publication } from "./schema.mjs";
import { buildLanes, buildProof, buildShipping, VERSION_IN_PROSE } from "./shipping.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readGenerated(name) {
  const file = resolve(root, "src/generated", name);
  if (!existsSync(file)) return { available: false };
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * The part of the GitHub activity a visitor's browser draws: the calendar, the totals, the language
 * mix and the last pushes. The rest of activity.json (releases, pull requests, commits per
 * repository) is what the shipping log and the proof are built from here, so it stays at build time.
 */
export function activityView(activity) {
  if (!activity.available) return { available: false };
  const { calendar, counts, languages, recent } = activity;
  return { available: true, calendar, counts, languages, recent };
}

/** Versions go stale the day after a release, so prose may not carry one; the site fetches them. */
export function versionsInProse(projects, profile) {
  const found = [];
  for (const p of projects) {
    for (const [field, text] of [
      ["tagline", p.tagline],
      ["description", p.description],
      ...p.highlights.map((h, i) => [`highlights[${i}]`, h]),
    ]) {
      if (VERSION_IN_PROSE.test(text)) found.push(`${p.slug}.${field}: "${text.match(VERSION_IN_PROSE)[0]}"`);
    }
  }
  for (const n of profile.now) {
    if (VERSION_IN_PROSE.test(n.detail)) found.push(`profile.now ${n.slug}: "${n.detail.match(VERSION_IN_PROSE)[0]}"`);
  }
  return found;
}

export async function buildData() {
  const projectsFile = ProjectsFile.parse(JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8")));
  const profile = Profile.parse(JSON.parse(await readFile(resolve(root, "data/profile.json"), "utf8")));

  // A link is published only if a visitor can open it: never one into a private repository, and never
  // one the last link check found gone. That holds for every project; for a private one it is what is
  // left of its links, so its page can still point at a package or a live site, never at its source.
  const repos = repoSets(projectsFile);
  const dead = new Set(readGenerated("links.json").dead ?? []);
  const shown = projectsFile.projects
    .filter((p) => ["full", "name-only"].includes(publication(p)))
    .map((p) => ({ ...p, links: publicLinks(p.links, projectsFile.owner, repos, dead) }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  for (const n of profile.now) {
    if (!shown.some((p) => p.slug === n.slug))
      throw new Error(`profile.now points at unknown or hidden slug ${n.slug}`);
  }
  const stale = versionsInProse(shown, profile);
  if (stale.length) {
    throw new Error(
      `version numbers in prose go stale; remove them, the site fetches versions:\n  ${stale.join("\n  ")}`,
    );
  }

  // A GitHub Pages site found at build time is linked like one written in the metadata.
  const sites = readGenerated("sites.json");
  for (const p of shown) {
    if (p.visibility === "public" && !p.links.site && typeof sites[p.repo] === "string") {
      p.links = { site: sites[p.repo], ...p.links };
    }
  }

  const activity = readGenerated("activity.json");
  const registry = readGenerated("registry.json");
  for (const p of shown) {
    const proof = buildProof({ project: p, activity, registry, projects: shown });
    if (proof) p.proof = proof;
  }
  const shipping = buildShipping({ projects: shown, activity, registry });
  const lanes = buildLanes({ projects: shown, events: shipping });

  const totals = {
    repositories: projectsFile.repositories,
    shown: shown.length,
    public: shown.filter((p) => p.visibility === "public").length,
    private: shown.filter((p) => p.visibility === "private").length,
    products: shown.filter((p) => p.category === "product").length,
    services: shown.filter((p) => p.family === "lucy" && p.category === "service").length,
    languages: [...new Set(shown.flatMap((p) => p.stack))].length,
  };

  const generated = {
    generatedAt: new Date().toISOString(),
    profile,
    totals,
    projects: shown,
    shipping,
    lanes,
    activity: activityView(activity),
  };
  mkdirSync(resolve(root, "src/generated"), { recursive: true });
  writeFileSync(resolve(root, "src/generated/site-data.json"), `${JSON.stringify(generated, null, 2)}\n`);

  // The contract other repositories validate `.portfolio/project.json` against.
  mkdirSync(resolve(root, "public/schema"), { recursive: true });
  writeFileSync(
    resolve(root, "public/schema/project.schema.json"),
    `${JSON.stringify(projectFileJsonSchema(), null, 2)}\n`,
  );
  return generated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const g = await buildData();
  console.log(
    `site data: ${g.totals.shown} of ${g.totals.repositories} repositories shown (${g.totals.private} private); ${g.shipping.length} shipping events in ${g.lanes.length} lanes`,
  );
}
