// Finds the GitHub Pages site of every public, shown repository that does not name one, at build
// time, with no token: a project site lives at https://<owner>.github.io/<repo>/, or GitHub redirects
// that address to the repository's custom domain. Only an address that answers 200 is recorded, so
// a detected link is never a dead one. Writes src/generated/sites.json as { repo: url }.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publication } from "./schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/sites.json");

/** The live site for a repository, or null. `fetcher` is injectable so the rules are testable. */
export async function findSite(owner, repo, fetcher = fetch) {
  const pages = `https://${owner}.github.io/${repo}/`;
  try {
    const first = await fetcher(pages, { method: "GET", redirect: "manual" });
    if (first.status === 200) return pages;
    const location = first.headers.get("location");
    if (![301, 302, 307, 308].includes(first.status) || !location?.startsWith("https://")) return null;
    const final = await fetcher(location, { method: "GET", redirect: "follow" });
    return final.status === 200 ? location : null;
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  const file = JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8"));
  const candidates = file.projects.filter(
    (p) => publication(p) === "full" && p.visibility === "public" && !p.links.site,
  );
  const sites = {};
  await Promise.all(
    candidates.map(async (p) => {
      const url = await findSite(file.owner, p.repo);
      if (url) sites[p.repo] = url;
    }),
  );
  const sorted = Object.fromEntries(Object.entries(sites).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`sites: ${Object.keys(sorted).length} of ${candidates.length} unlinked repositories have a live site`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
