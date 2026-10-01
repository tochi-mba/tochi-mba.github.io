// Pulls `.portfolio/project.json` from every repository the token can see and merges it into
// data/projects.json. A repository's own file wins over the curated entry; a repository with no
// file keeps its curated entry; a new repository is added hidden (display: false) so nothing
// appears on the site before somebody has looked at it. Needs GITHUB_TOKEN with repo read.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, ProjectsFile } from "./schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set; nothing synced.");
  process.exit(2);
}
const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const file = ProjectsFile.parse(JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8")));
const byRepo = new Map(file.projects.map((p) => [p.repo, p]));
const seen = new Set();

for (let page = 1; ; page += 1) {
  const repos = await gh(`/user/repos?affiliation=owner&per_page=100&page=${page}`);
  if (!repos?.length) break;
  for (const r of repos) {
    if (r.owner.login !== file.owner || r.name === "tochi-mba.github.io") continue;
    seen.add(r.name);
    const visibility = r.private ? "private" : "public";
    const meta = await gh(`/repos/${file.owner}/${r.name}/contents/.portfolio/project.json`);
    const existing = byRepo.get(r.name);
    if (meta?.content) {
      const parsed = Project.safeParse(JSON.parse(Buffer.from(meta.content, "base64").toString("utf8")));
      if (!parsed.success) {
        console.error(`${r.name}: .portfolio/project.json invalid, keeping curated entry\n${parsed.error}`);
      } else {
        // Visibility is GitHub's fact, never the file's claim.
        byRepo.set(r.name, { ...parsed.data, repo: r.name, visibility });
        console.log(`${r.name}: synced from repository`);
        continue;
      }
    }
    if (existing) {
      if (existing.visibility !== visibility) {
        console.log(`${r.name}: visibility changed to ${visibility}`);
        byRepo.set(r.name, {
          ...existing,
          visibility,
          publicSafe: visibility === "public" ? existing.publicSafe : false,
        });
      }
      continue;
    }
    byRepo.set(r.name, {
      repo: r.name,
      slug: r.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      name: r.name,
      tagline: r.description ?? "",
      description: "",
      highlights: [],
      stack: r.language ? [r.language] : [],
      category: "tool",
      status: r.archived ? "archived" : "wip",
      order: 999,
      visibility,
      display: false,
      publicSafe: false,
      reason: "Added by sync; not reviewed yet.",
      links: r.private ? {} : { source: r.html_url },
      year: new Date(r.created_at).getUTCFullYear(),
    });
    console.log(`${r.name}: new, added hidden`);
  }
}

for (const name of byRepo.keys()) {
  if (!seen.has(name)) console.warn(`${name}: in data/projects.json but not on GitHub any more`);
}

const merged = ProjectsFile.parse({ ...file, projects: [...byRepo.values()] });
await writeFile(resolve(root, "data/projects.json"), `${JSON.stringify(merged, null, 2)}\n`);
console.log(`wrote ${merged.projects.length} projects`);
