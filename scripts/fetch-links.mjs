// Asks every link a published project declares whether it still answers, at build time, with no
// token: the way a visitor's browser would. Writes src/generated/links.json as { dead: [url] }; the
// build drops those, so the site never offers a link that is gone. A link into a repository the
// snapshot cannot vouch for is never fetched at all: scripts/links.mjs refuses it from the URL alone.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { linkCandidates, reachAll } from "./links.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/links.json");

mkdirSync(dirname(out), { recursive: true });
const file = JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8"));
const urls = linkCandidates(file);
const reached = await reachAll(urls);
const dead = urls.filter((url) => reached.get(url) === "dead");
const unknown = urls.filter((url) => reached.get(url) === "unknown").length;
writeFileSync(out, `${JSON.stringify({ checkedAt: new Date().toISOString(), dead }, null, 2)}\n`);
for (const url of dead) console.log(`links: dropped, no longer answers: ${url}`);
console.log(`links: ${urls.length} checked, ${dead.length} dead, ${unknown} could not be reached and were kept`);
