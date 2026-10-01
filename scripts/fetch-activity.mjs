// Fetches public GitHub activity for the owner at build time and writes src/generated/activity.json.
// With GITHUB_TOKEN (the Pages workflow has one) it asks GraphQL for the contribution calendar and
// the language bytes of every public repository. Without one it writes `available: false` and the
// site renders the activity section from the browser-side fallback instead. Nothing here is ever
// invented: no token means no numbers.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/activity.json");
mkdirSync(dirname(out), { recursive: true });

const projectsFile = JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8"));
const { owner } = projectsFile;
// Archived and early repositories carry vendored libraries from 2024; they would swamp the mix
// with JavaScript that was never written here. The language mix is about current work.
const currentRepos = new Set(
  projectsFile.projects.filter((p) => p.status !== "archived" && p.category !== "early").map((p) => p.repo),
);
const token = process.env.GITHUB_TOKEN;

function write(data) {
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
}

if (!token) {
  write({ available: false, fetchedAt: new Date().toISOString(), reason: "no GITHUB_TOKEN at build time" });
  console.log("activity: no token, wrote placeholder");
  process.exit(0);
}

const query = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
    }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
      totalCount
      nodes {
        name
        pushedAt
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: owner } }),
});
if (!res.ok) {
  write({ available: false, fetchedAt: new Date().toISOString(), reason: `GraphQL ${res.status}` });
  console.error(`activity: GraphQL ${res.status}, wrote placeholder`);
  process.exit(0);
}
const { data, errors } = await res.json();
if (errors || !data?.user) {
  write({ available: false, fetchedAt: new Date().toISOString(), reason: errors?.[0]?.message ?? "no user" });
  console.error("activity: GraphQL errors, wrote placeholder", errors);
  process.exit(0);
}

const cc = data.user.contributionsCollection;
const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays.map((d) => [d.date, d.contributionCount]));

// Language bytes summed across current public repositories, excluding markup/config so the mix says what
// the code is written in rather than how many HTML sites there are.
const skip = new Set([
  "HTML",
  "CSS",
  "Makefile",
  "Dockerfile",
  "Batchfile",
  "Inno Setup",
  "Shell",
  "PowerShell",
  "Hack",
]);
const bytes = new Map();
const colors = new Map();
for (const r of data.user.repositories.nodes) {
  if (!currentRepos.has(r.name)) continue;
  for (const e of r.languages.edges) {
    if (skip.has(e.node.name)) continue;
    bytes.set(e.node.name, (bytes.get(e.node.name) ?? 0) + e.size);
    colors.set(e.node.name, e.node.color);
  }
}
const total = [...bytes.values()].reduce((a, b) => a + b, 0);
const languages = [...bytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([name, size]) => ({ name, share: size / total }));

const recent = data.user.repositories.nodes
  .filter((r) => r.pushedAt)
  .sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1))
  .slice(0, 5)
  .map((r) => ({ name: r.name, pushedAt: r.pushedAt }));

write({
  available: true,
  fetchedAt: new Date().toISOString(),
  calendar: { total: cc.contributionCalendar.totalContributions, days },
  counts: {
    commits: cc.totalCommitContributions,
    pullRequests: cc.totalPullRequestContributions,
    issues: cc.totalIssueContributions,
    repositoriesCreated: cc.totalRepositoryContributions,
    publicRepositories: data.user.repositories.totalCount,
  },
  languages,
  recent,
});
console.log(`activity: ${cc.contributionCalendar.totalContributions} contributions, ${languages.length} languages`);
