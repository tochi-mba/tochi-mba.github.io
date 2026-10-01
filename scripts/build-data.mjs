// Validates data/*.json, applies the publication policy and writes what the site renders.
// The generated file is the only thing the Vue app reads, so nothing private can leak
// by accident: private repositories without `publicSafe` reach it as a count, not a name.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Profile, Project, ProjectsFile, publication } from "./schema.mjs";
import { buildLanes, buildProof, buildShipping, VERSION_IN_PROSE } from "./shipping.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readGenerated(name) {
  const file = resolve(root, "src/generated", name);
  if (!existsSync(file)) return { available: false };
  return JSON.parse(readFileSync(file, "utf8"));
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

  const shown = [];
  let counted = 0;
  let hidden = 0;
  for (const p of projectsFile.projects) {
    const how = publication(p);
    if (how === "hidden") hidden += 1;
    else if (how === "counted") counted += 1;
    else if (how === "full") shown.push(p);
    // Name-only: everything the owner wrote may show, but no link can point at a private page.
    else shown.push({ ...p, links: {} });
  }
  shown.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

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
    repositories: projectsFile.projects.length,
    public: projectsFile.projects.filter((p) => p.visibility === "public").length,
    private: projectsFile.projects.filter((p) => p.visibility === "private").length,
    shown: shown.length,
    privateCounted: counted,
    hidden,
    products: shown.filter((p) => p.category === "product").length,
    services: shown.filter((p) => p.family === "lucy").length,
    languages: [...new Set(shown.flatMap((p) => p.stack))].length,
  };

  const generated = { generatedAt: new Date().toISOString(), profile, totals, projects: shown, shipping, lanes };
  mkdirSync(resolve(root, "src/generated"), { recursive: true });
  writeFileSync(resolve(root, "src/generated/site-data.json"), `${JSON.stringify(generated, null, 2)}\n`);

  // The contract other repositories validate `.portfolio/project.json` against.
  mkdirSync(resolve(root, "public/schema"), { recursive: true });
  const schema = z.toJSONSchema(Project, { target: "draft-07", io: "input" });
  schema.$id = "https://tochi-mba.github.io/schema/project.schema.json";
  schema.title = "Portfolio project metadata";
  writeFileSync(resolve(root, "public/schema/project.schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
  return generated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const g = await buildData();
  console.log(
    `site data: ${g.totals.shown} shown, ${g.totals.privateCounted} private counted, ${g.totals.hidden} hidden, of ${g.totals.repositories}; ${g.shipping.length} shipping events in ${g.lanes.length} lanes`,
  );
}
