import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { shapeCore, shapeRecord } from "../../scripts/fetch-activity.mjs";
// @ts-expect-error plain ESM script without types
import { npmVersions, pypiVersions } from "../../scripts/fetch-registry.mjs";
// @ts-expect-error plain ESM script without types
import { buildLanes, buildProof, buildShipping, normaliseVersion, releaseWords } from "../../scripts/shipping.mjs";

const project = (over: Record<string, unknown>) => ({
  repo: "Thing",
  slug: "thing",
  name: "Thing",
  tagline: "",
  description: "",
  highlights: [],
  stack: [],
  category: "product",
  status: "active",
  order: 1,
  visibility: "public",
  display: true,
  links: { source: "https://github.com/tochi-mba/Thing" },
  year: 2026,
  ...over,
});

const mirror = project({ repo: "Android_Headless_Mirror", slug: "ahm", name: "Mirror", featured: true });
const weft = project({
  repo: "weftai",
  slug: "weftai",
  name: "weftai",
  featured: true,
  family: "lucy",
  role: "runtime",
  packages: { npm: ["weftai", "@weftai/mcp"], pypi: ["weftai"] },
});
const hub = project({
  repo: "LUCY-assistant",
  slug: "lucy",
  name: "LUCY",
  featured: true,
  family: "lucy",
  role: "hub",
});
const keyring = project({
  repo: "Keyring-api",
  slug: "keyring",
  name: "keyring",
  category: "service",
  family: "lucy",
  role: "vault",
});
const bridge = project({ repo: "ai-context-bridge", slug: "bridge", name: "Bridge", category: "tool" });
const secret = project({ repo: "agentic", slug: "agentic", name: "agentic", visibility: "private", links: {} });
const projects = [hub, weft, mirror, keyring, bridge, secret];

const release = (tagName: string, publishedAt: string, extra: Record<string, unknown> = {}) => ({
  tagName,
  name: tagName,
  publishedAt,
  isPrerelease: false,
  isDraft: false,
  url: `https://github.com/tochi-mba/x/releases/tag/${tagName}`,
  assetCount: 4,
  downloads: 10,
  ...extra,
});

const activity = {
  available: true,
  repos: [
    {
      name: "Android_Headless_Mirror",
      pushedAt: "2026-10-01T17:40:00Z",
      commits: 512,
      releaseCount: 23,
      releases: [
        release("v2.3.3", "2026-10-01T17:37:00Z", { name: "v2.3.3: Site and docs foundation" }),
        release("v2.3.2", "2026-10-01T17:01:00Z", { name: "Groundwork for settings" }),
        release("v2.4.0-beta", "2026-10-01T18:00:00Z", { isPrerelease: true }),
        release("v9.9.9", "2026-10-01T19:00:00Z", { isDraft: true, publishedAt: null }),
      ],
    },
    {
      name: "weftai",
      pushedAt: "2026-09-30T22:00:00Z",
      commits: 300,
      releaseCount: 30,
      releases: [release("weftai@0.5.2", "2026-09-30T21:16:00Z"), release("@weftai/mcp@0.5.2", "2026-09-30T21:16:30Z")],
    },
    { name: "LUCY-assistant", pushedAt: "2026-09-29T10:00:00Z", commits: 244, releaseCount: 0, releases: [] },
  ],
  pullRequests: [
    {
      repo: "Keyring-api",
      number: 7,
      title: "Refresh tokens before they expire",
      url: "u7",
      merged: true,
      mergedAt: "2026-09-28T09:00:00Z",
    },
    {
      repo: "ai-context-bridge",
      number: 3,
      title: "TODO tidy",
      url: "u3",
      merged: true,
      mergedAt: "2026-09-27T09:00:00Z",
    },
    { repo: "agentic", number: 1, title: "private work", url: "u1", merged: true, mergedAt: "2026-09-30T09:00:00Z" },
    { repo: "LUCY-assistant", number: 9, title: "open", url: "u9", merged: false, mergedAt: null },
  ],
};

const registry = {
  available: true,
  npm: {
    weftai: {
      name: "weftai",
      version: "0.5.2",
      publishedAt: "2026-09-30T21:18:00Z",
      versions: [
        { version: "0.5.1", at: "2026-09-30T20:55:00Z" },
        { version: "0.5.2", at: "2026-09-30T21:18:00Z" },
      ],
      downloadsMonth: 1356,
      daily: [["2026-09-29", 300]],
      url: "https://www.npmjs.com/package/weftai",
    },
    "@weftai/mcp": {
      name: "@weftai/mcp",
      version: "0.5.2",
      publishedAt: "2026-09-30T21:17:00Z",
      versions: [{ version: "0.5.2", at: "2026-09-30T21:17:00Z" }],
      downloadsMonth: 1216,
      daily: [],
      url: "https://www.npmjs.com/package/@weftai/mcp",
    },
  },
  pypi: {
    weftai: {
      name: "weftai",
      version: "0.5.2",
      publishedAt: "2026-09-30T22:03:00Z",
      versions: [{ version: "0.5.2", at: "2026-09-30T22:03:00Z" }],
      downloadsMonth: 1079,
      url: "https://pypi.org/project/weftai/",
    },
  },
};

describe("normaliseVersion and releaseWords", () => {
  it("strips v and package prefixes, keeps rolling tags", () => {
    expect(normaliseVersion("v2.3.3")).toBe("2.3.3");
    expect(normaliseVersion("weftai@0.5.2")).toBe("0.5.2");
    expect(normaliseVersion("@weftai/mcp@0.5.2")).toBe("0.5.2");
    expect(normaliseVersion("latest-windows")).toBe("latest-windows");
  });
  it("keeps a release's own words and drops names that only repeat a tag", () => {
    expect(releaseWords("v2.3.3: Site and docs foundation", "v2.3.3")).toBe("Site and docs foundation");
    expect(releaseWords("Groundwork for settings", "v2.3.2")).toBe("Groundwork for settings");
    expect(releaseWords("@weftai/mcp@0.5.2", "@weftai/mcp@0.5.2")).toBeNull();
    expect(releaseWords("v1.0.0", "v1.0.0")).toBeNull();
    expect(releaseWords("TODO: write notes", "v1")).toBeNull();
    expect(releaseWords(null, "v1")).toBeNull();
  });
});

describe("buildShipping", () => {
  const events = buildShipping({ projects, activity, registry });

  it("is newest first and never includes drafts", () => {
    const times = events.map((e: { at: string }) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(events.some((e: { label: string }) => e.label === "v9.9.9")).toBe(false);
  });
  it("merges one version across GitHub, npm and PyPI into one event at its earliest time", () => {
    const v = events.filter((e: { id: string }) => e.id === "weftai@0.5.2");
    expect(v).toHaveLength(1);
    expect(v[0].channels.sort()).toEqual(["GitHub", "PyPI", "npm"]);
    expect(v[0].at).toBe("2026-09-30T21:16:00Z");
    expect(v[0].url).toContain("/releases/");
  });
  it("links a registry-only version to the main package", () => {
    const v = events.find((e: { id: string }) => e.id === "weftai@0.5.1");
    expect(v.url).toBe("https://www.npmjs.com/package/weftai");
    expect(v.channels).toEqual(["npm"]);
  });
  it("keeps release words and folds family services into the hub's lane", () => {
    expect(events.find((e: { id: string }) => e.id === "ahm@2.3.3").words).toBe("Site and docs foundation");
    const pr = events.find((e: { id: string }) => e.id === "keyring#7");
    expect(pr.lane).toBe("lucy");
    expect(pr.kind).toBe("pr");
    expect(pr.words).toBe("Refresh tokens before they expire");
  });
  it("puts other repositories in their own lane and hides draft words", () => {
    const pr = events.find((e: { id: string }) => e.id === "bridge#3");
    expect(pr.lane).toBe("other");
    expect(pr.words).toBeNull();
  });
  it("never lets a private repository or an unmerged pull request in", () => {
    expect(events.some((e: { project: string }) => e.project === "agentic")).toBe(false);
    expect(events.some((e: { id: string }) => e.id === "lucy#9")).toBe(false);
  });
  it("respects the limit", () => {
    expect(buildShipping({ projects, activity, registry, limit: 2 })).toHaveLength(2);
  });
  it("still works from the registries alone when GitHub data is missing", () => {
    const fallback = buildShipping({ projects, activity: { available: false }, registry });
    expect(fallback.map((e: { id: string }) => e.id)).toEqual(["weftai@0.5.2", "weftai@0.5.1"]);
  });

  describe("edges", () => {
    const repoWith = (name: string, releases: object[]) => ({ name, releaseCount: releases.length, releases });
    it("keeps the words of the first release of a shared version that says something", () => {
      const monorepo = {
        repos: [
          repoWith("weftai", [
            release("weftai@0.6.0", "2026-10-01T10:00:00Z"),
            release("@weftai/cli@0.6.0", "2026-10-01T10:00:05Z", { name: "@weftai/cli@0.6.0: A faster CLI" }),
            release("@weftai/mcp@0.6.0", "2026-10-01T10:00:09Z", { name: "@weftai/mcp@0.6.0: Something else" }),
          ]),
        ],
      };
      const [event] = buildShipping({ projects, activity: monorepo, registry: { available: false } });
      expect(event).toMatchObject({ id: "weftai@0.6.0", words: "A faster CLI", at: "2026-10-01T10:00:00Z" });
      expect(event.channels).toEqual(["GitHub"]);
    });
    it("labels a rolling tag as itself, without a v", () => {
      const rolling = {
        repos: [repoWith("Android_Headless_Mirror", [release("latest-windows", "2026-10-01T10:00:00Z")])],
      };
      const [event] = buildShipping({ projects, activity: rolling, registry: { available: false } });
      expect(event.label).toBe("latest-windows");
      expect(event.title).toBe("Mirror latest-windows");
    });
    it("ignores a repository the site does not show, a package no registry knows, and a pull request with no title", () => {
      const other = {
        repos: [repoWith("Someone-elses", [release("v1.0.0", "2026-10-01T10:00:00Z")])],
        pullRequests: [
          { repo: "weftai", number: 4, title: null, url: "u4", merged: true, mergedAt: "2026-10-01T09:00:00Z" },
        ],
      };
      const unknownPackage = { ...weft, packages: { npm: ["not-published"], pypi: [] } };
      const events = buildShipping({ projects: [unknownPackage], activity: other, registry });
      expect(events.map((e: { id: string }) => e.id)).toEqual(["weftai#4"]);
      expect(events[0].words).toBeNull();
    });
    it("keeps events of the same moment in the order they were found", () => {
      const same = {
        repos: [
          repoWith("Android_Headless_Mirror", [release("v1.0.0", "2026-10-01T10:00:00Z")]),
          repoWith("weftai", [release("v2.0.0", "2026-10-01T10:00:00Z")]),
        ],
      };
      const events = buildShipping({ projects, activity: same, registry: { available: false } });
      expect(events.map((e: { id: string }) => e.id)).toEqual(["ahm@1.0.0", "weftai@2.0.0"]);
    });
  });
});

describe("buildLanes", () => {
  it("lists featured projects in order, only when they have events, then everything else", () => {
    const events = buildShipping({ projects, activity, registry });
    expect(buildLanes({ projects, events }).map((l: { id: string }) => l.id)).toEqual([
      "lucy",
      "weftai",
      "ahm",
      "other",
    ]);
  });
  it("draws no 'Everything else' lane when every event belongs to a flagship", () => {
    const flagshipOnly = buildShipping({
      projects,
      activity: {
        repos: [
          { name: "Android_Headless_Mirror", releaseCount: 1, releases: [release("v1.0.0", "2026-10-01T10:00:00Z")] },
        ],
      },
      registry: { available: false },
    });
    expect(buildLanes({ projects, events: flagshipOnly }).map((l: { id: string }) => l.id)).toEqual(["ahm"]);
  });
});

describe("buildProof", () => {
  it("prefers the latest full release over a newer pre-release", () => {
    const proof = buildProof({ project: mirror, activity, registry, projects });
    expect(proof.release.tag).toBe("v2.3.3");
    expect(proof.release.count).toBe(23);
    expect(proof.commits).toBe(512);
  });
  it("reads the main package from each registry", () => {
    const proof = buildProof({ project: weft, activity, registry, projects });
    expect(proof.npm).toMatchObject({
      name: "weftai",
      version: "0.5.2",
      versions: 2,
      downloadsMonth: 1356,
      packages: 2,
    });
    expect(proof.pypi).toMatchObject({ name: "weftai", version: "0.5.2", packages: 1 });
  });
  it("counts the hub's services, not its runtime, and leaves private projects without GitHub proof", () => {
    expect(buildProof({ project: hub, activity, registry, projects }).services).toBe(1);
    expect(buildProof({ project: secret, activity, registry, projects })).toBeUndefined();
  });
  it("vouches for nothing it did not fetch", () => {
    expect(
      buildProof({ project: mirror, activity: { available: false }, registry: { available: false }, projects }),
    ).toBeUndefined();
    const noReleases = { repos: [{ name: "Android_Headless_Mirror", releaseCount: 0, releases: [], commits: 3 }] };
    expect(buildProof({ project: mirror, activity: noReleases, registry, projects })).toEqual({ commits: 3 });
    // An empty repository has no default branch, so GitHub has no commit count to give.
    const noCount = {
      repos: [{ name: "Android_Headless_Mirror", releaseCount: 0, releases: [], commits: null, pushedAt: "t" }],
    };
    expect(buildProof({ project: mirror, activity: noCount, registry, projects })).toEqual({ pushedAt: "t" });
  });
});

describe("activity shaping", () => {
  const shown = new Set(["android_headless_mirror", "weftai"]);
  const user = {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: 3,
        weeks: [{ contributionDays: [{ date: "2026-10-01", contributionCount: 3 }] }],
      },
      totalCommitContributions: 2,
      totalPullRequestContributions: 1,
      totalIssueContributions: 0,
      totalRepositoryContributions: 1,
      commitContributionsByRepository: [
        {
          repository: { name: "weftai", isPrivate: false, owner: { login: "tochi-mba" } },
          contributions: { totalCount: 2, nodes: [{ occurredAt: "2026-09-30T00:00:00Z", commitCount: 5 }] },
        },
        {
          repository: { name: "agentic", isPrivate: true, owner: { login: "tochi-mba" } },
          contributions: { totalCount: 1, nodes: [{ occurredAt: "2026-09-30T00:00:00Z", commitCount: 9 }] },
        },
      ],
      pullRequestContributions: {
        nodes: [
          {
            pullRequest: {
              number: 1,
              title: "a",
              url: "u",
              merged: true,
              mergedAt: "t",
              repository: { name: "weftai", isPrivate: false, owner: { login: "tochi-mba" } },
            },
          },
          {
            pullRequest: {
              number: 2,
              title: "b",
              url: "u",
              merged: true,
              mergedAt: "t",
              repository: { name: "vue", isPrivate: false, owner: { login: "vuejs" } },
            },
          },
        ],
      },
    },
    repositories: {
      totalCount: 3,
      nodes: [
        {
          name: "weftai",
          pushedAt: "2026-09-30T22:00:00Z",
          languages: {
            edges: [
              { size: 30, node: { name: "TypeScript" } },
              { size: 70, node: { name: "HTML" } },
            ],
          },
          defaultBranchRef: { target: { history: { totalCount: 300 } } },
          releases: {
            totalCount: 1,
            nodes: [
              {
                tagName: "v1",
                name: "v1",
                publishedAt: "t",
                isPrerelease: false,
                isDraft: false,
                url: "u",
                releaseAssets: { totalCount: 2, nodes: [{ downloadCount: 3 }, { downloadCount: 4 }] },
              },
            ],
          },
        },
        {
          name: "Opted-out-thing",
          pushedAt: "2026-10-01T22:00:00Z",
          languages: { edges: [] },
          defaultBranchRef: null,
          releases: { totalCount: 0, nodes: [] },
        },
        {
          name: "tochi-mba.github.io",
          pushedAt: "2026-09-01T00:00:00Z",
          languages: { edges: [] },
          defaultBranchRef: null,
          releases: { totalCount: 0, nodes: [] },
        },
      ],
    },
  };

  it("keeps hidden repositories out of the last-push list and markup out of the language mix", () => {
    const core = shapeCore(user, { shown, current: new Set(["weftai"]), siteRepo: "tochi-mba.github.io" });
    expect(core.recent.map((r: { name: string }) => r.name)).toEqual(["weftai", "tochi-mba.github.io"]);
    expect(core.languages).toEqual([{ name: "TypeScript", share: 1 }]);
    expect(core.calendar.days).toEqual([["2026-10-01", 3]]);
  });
  it("keeps only owned, public, shown repositories in the record", () => {
    const record = shapeRecord(user, { shown, login: "tochi-mba", pushed: { weftai: "2026-09-30T22:00:00Z" } });
    expect(record.repos.map((r: { name: string }) => r.name)).toEqual(["weftai"]);
    expect(record.repos[0]).toMatchObject({ commits: 300, releaseCount: 1, pushedAt: "2026-09-30T22:00:00Z" });
    expect(record.repos[0].releases[0]).toMatchObject({ assetCount: 2, downloads: 7 });
    expect(record.pullRequests.map((p: { repo: string }) => p.repo)).toEqual(["weftai"]);
    expect(record.commitsByRepo).toEqual([{ repo: "weftai", total: 5, days: [["2026-09-30", 5]] }]);
  });
});

describe("registry shaping", () => {
  it("orders npm versions by publish time and ignores created/modified", () => {
    expect(
      npmVersions({ created: "a", modified: "z", "0.2.0": "2026-09-02", "0.1.0": "2026-09-01" }).map(
        (v: { version: string }) => v.version,
      ),
    ).toEqual(["0.1.0", "0.2.0"]);
  });
  it("dates a PyPI version by its first file and skips versions with no files", () => {
    expect(pypiVersions({ "0.1.0": [{ upload_time_iso_8601: "2026-09-01T00:00:00Z" }], "0.0.1": [] })).toEqual([
      { version: "0.1.0", at: "2026-09-01T00:00:00Z" },
    ]);
  });
});
