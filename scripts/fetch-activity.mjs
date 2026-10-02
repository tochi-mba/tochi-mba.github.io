// Fetches public GitHub activity for the owner at build time and writes src/generated/activity.json.
// With GITHUB_TOKEN (the Pages workflow has one) it asks GraphQL for two things:
//   1. the core: contribution calendar, totals, languages and last pushes (fail-closed: if this fails
//      the file says `available: false` and the activity section is not rendered);
//   2. the record: releases, commit counts and merged pull requests per public repository (fail-soft:
//      if this fails the core still ships and the shipping log falls back to the package registries).
// Only repositories the publication policy shows in full can contribute a name or a number, so a
// private or opted-out repository never reaches the generated file. Nothing here is ever invented.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publication } from "./schema.mjs";
import { findToken } from "./token.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/activity.json");

const CORE = `
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

const RECORD = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 25) {
        repository { name isPrivate owner { login } }
        contributions(first: 100) { totalCount nodes { occurredAt commitCount } }
      }
      pullRequestContributions(first: 100) {
        nodes {
          pullRequest { number title url merged mergedAt repository { name isPrivate owner { login } } }
        }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
      nodes {
        name
        defaultBranchRef { target { ... on Commit { history { totalCount } } } }
        releases(first: 25, orderBy: { field: CREATED_AT, direction: DESC }) {
          totalCount
          nodes {
            tagName
            name
            publishedAt
            isPrerelease
            isDraft
            url
            releaseAssets(first: 20) { totalCount nodes { downloadCount } }
          }
        }
      }
    }
  }
}`;

// Archived and early repositories carry vendored libraries from 2024; they would swamp the mix
// with JavaScript that was never written here. The language mix is about current work.
const SKIP_LANGUAGES = new Set([
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

/** Shapes the core response. Exported for tests; `shown` is the set of repositories shown in full. */
export function shapeCore(user, { shown, current, siteRepo }) {
  const cc = user.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) =>
    w.contributionDays.map((d) => [d.date, d.contributionCount]),
  );
  const bytes = new Map();
  for (const r of user.repositories.nodes) {
    if (!current.has(r.name)) continue;
    for (const e of r.languages.edges) {
      if (SKIP_LANGUAGES.has(e.node.name)) continue;
      bytes.set(e.node.name, (bytes.get(e.node.name) ?? 0) + e.size);
    }
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0);
  const languages = [...bytes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, size]) => ({ name, share: total ? size / total : 0 }));
  const recent = user.repositories.nodes
    .filter((r) => r.pushedAt && (shown.has(r.name.toLowerCase()) || r.name === siteRepo))
    .sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1))
    .slice(0, 5)
    .map((r) => ({ name: r.name, pushedAt: r.pushedAt }));
  return {
    calendar: { total: cc.contributionCalendar.totalContributions, days },
    counts: {
      commits: cc.totalCommitContributions,
      pullRequests: cc.totalPullRequestContributions,
      issues: cc.totalIssueContributions,
      repositoriesCreated: cc.totalRepositoryContributions,
      publicRepositories: user.repositories.totalCount,
    },
    languages,
    recent,
    pushed: Object.fromEntries(
      user.repositories.nodes.filter((r) => shown.has(r.name.toLowerCase())).map((r) => [r.name, r.pushedAt]),
    ),
  };
}

/** Shapes the record response, dropping anything outside `shown` (public, displayed, owned). */
export function shapeRecord(user, { shown, login, pushed = {} }) {
  const own = (repo) =>
    repo &&
    !repo.isPrivate &&
    repo.owner?.login?.toLowerCase() === login.toLowerCase() &&
    shown.has(repo.name.toLowerCase());
  const repos = user.repositories.nodes
    .filter((r) => shown.has(r.name.toLowerCase()))
    .map((r) => ({
      name: r.name,
      pushedAt: pushed[r.name] ?? null,
      commits: r.defaultBranchRef?.target?.history?.totalCount ?? null,
      releaseCount: r.releases?.totalCount ?? 0,
      releases: (r.releases?.nodes ?? []).map((x) => ({
        tagName: x.tagName,
        name: x.name,
        publishedAt: x.publishedAt,
        isPrerelease: x.isPrerelease,
        isDraft: x.isDraft,
        url: x.url,
        assetCount: x.releaseAssets?.totalCount ?? 0,
        downloads: (x.releaseAssets?.nodes ?? []).reduce((a, n) => a + (n.downloadCount ?? 0), 0),
      })),
    }));
  const pullRequests = user.contributionsCollection.pullRequestContributions.nodes
    .map((n) => n.pullRequest)
    .filter((pr) => pr && own(pr.repository))
    .map((pr) => ({
      repo: pr.repository.name,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      merged: pr.merged,
      mergedAt: pr.mergedAt,
    }));
  const commitsByRepo = user.contributionsCollection.commitContributionsByRepository
    .filter((c) => own(c.repository))
    .map((c) => ({
      repo: c.repository.name,
      total: c.contributions.nodes.reduce((a, n) => a + n.commitCount, 0),
      days: c.contributions.nodes.map((n) => [n.occurredAt.slice(0, 10), n.commitCount]),
    }));
  return { repos, pullRequests, commitsByRepo };
}

async function graphql(token, query, login) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length || !data?.user) throw new Error(errors?.[0]?.message ?? "no user");
  return data.user;
}

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  const write = (data) => writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  const projectsFile = JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8"));
  const { owner } = projectsFile;
  // Public, published repositories only: a private project carries no repository name to ask about.
  const published = projectsFile.projects.filter((p) => publication(p) === "full");
  const shown = new Set(published.map((p) => p.repo.toLowerCase()));
  const current = new Set(
    published.filter((p) => p.status !== "archived" && p.category !== "early").map((p) => p.repo),
  );
  const fetchedAt = new Date().toISOString();
  // Public data only, so any token will do: the workflow's own, or a developer's CLI sign-in.
  const token = findToken(["GITHUB_TOKEN"])?.token;
  if (!token) {
    write({ available: false, fetchedAt, reason: "no GitHub token at build time" });
    console.log("activity: no token (set GITHUB_TOKEN or sign in with gh auth login), wrote placeholder");
    return;
  }

  let core;
  try {
    core = shapeCore(await graphql(token, CORE, owner), { shown, current, siteRepo: `${owner}.github.io` });
  } catch (error) {
    write({ available: false, fetchedAt, reason: error.message });
    console.error(`activity: core query failed (${error.message}), wrote placeholder`);
    return;
  }

  let record = { repos: [], pullRequests: [], commitsByRepo: [] };
  let recordAvailable = false;
  try {
    record = shapeRecord(await graphql(token, RECORD, owner), { shown, login: owner, pushed: core.pushed });
    recordAvailable = true;
  } catch (error) {
    console.error(`activity: record query failed (${error.message}); shipping log falls back to registries`);
  }

  const { pushed: _pushed, ...rest } = core;
  write({ available: true, recordAvailable, fetchedAt, ...rest, ...record });
  const releases = record.repos.reduce((a, r) => a + r.releases.length, 0);
  console.log(
    `activity: ${core.calendar.total} contributions, ${core.languages.length} languages, ${releases} releases, ${record.pullRequests.length} pull requests`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
