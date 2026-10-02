// Refreshes data/projects.json from every repository's own `.portfolio/project.json`.
//
//   npm run sync               read GitHub, write the snapshot, say what needs looking at
//   npm run sync -- --strict   and fail when anything does
//
// The token is PORTFOLIO_TOKEN, else GITHUB_TOKEN, else the GitHub CLI's sign-in. A token that sees
// private repositories (the owner's) refreshes everything; one that sees public repositories only
// (a workflow's default) refreshes those and carries private projects over unchanged. When GitHub
// cannot be read at all, the snapshot is left as it was, so a build still has the last good one.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GitHubError, listRepositories } from "./github.mjs";
import { ProjectsFile } from "./schema.mjs";
import { report, summary, syncProjects } from "./sync.mjs";
import { findToken } from "./token.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "data/projects.json");
const OWNER = "tochi-mba";
const strict = process.argv.includes("--strict");

function stop(message) {
  console.error(`sync: ${message}; data/projects.json left as it was.`);
  process.exit(strict ? 1 : 0);
}

const found = findToken(["PORTFOLIO_TOKEN", "GITHUB_TOKEN"]);
if (!found) stop("no token (set PORTFOLIO_TOKEN or GITHUB_TOKEN, or sign in with gh auth login)");
const previous = existsSync(path) ? ProjectsFile.parse(JSON.parse(await readFile(path, "utf8"))) : null;

let repositories;
try {
  repositories = await listRepositories({ owner: OWNER, token: found.token });
} catch (error) {
  if (!(error instanceof GitHubError) && !(error instanceof TypeError)) throw error;
  stop(error.message);
}

const result = syncProjects(previous, repositories, { owner: OWNER });
await writeFile(path, `${JSON.stringify(result.file, null, 2)}\n`);
console.log(`sync: read with ${found.from}.`);
for (const line of report(result.notes)) console.log(`  ${line}`);
console.log(summary(result));
if (strict && result.counts.invalid > 0) process.exit(1);
