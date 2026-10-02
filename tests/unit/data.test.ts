import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { versionsInProse } from "../../scripts/build-data.mjs";
// @ts-expect-error plain ESM script without types
import { findSite } from "../../scripts/fetch-sites.mjs";
// @ts-expect-error plain ESM script without types
import { pointsAtPrivate, repoSets } from "../../scripts/links.mjs";
// @ts-expect-error plain ESM script without types
import { ProjectsFile } from "../../scripts/schema.mjs";
import { bySlug, compact, featured, lanes, lucyFamily, profile, projects, shipping, totals } from "../../src/data";

const raw = JSON.parse(readFileSync(resolve(__dirname, "../../data/projects.json"), "utf8"));

describe("the snapshot and the generated site data", () => {
  it("is a valid snapshot: only what may be published, and a count of every repository", () => {
    const parsed = ProjectsFile.safeParse(raw);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
  it("never carries a link a visitor could not open", () => {
    for (const p of projects) {
      for (const url of Object.values(p.links)) {
        expect(pointsAtPrivate(url, raw.owner, repoSets(raw)), `${p.slug}: ${url}`).toBe(false);
      }
    }
  });
  it("never names a private project's repository", () => {
    for (const p of [...raw.projects, ...projects].filter((x: { visibility: string }) => x.visibility === "private")) {
      expect(p.repo, p.slug).toBeUndefined();
    }
  });
  it("shows exactly what the snapshot publishes, and counts every repository", () => {
    expect(projects.map((p) => p.slug).sort()).toEqual(raw.projects.map((p: { slug: string }) => p.slug).sort());
    expect(totals.repositories).toBe(raw.repositories);
    expect(totals.shown).toBe(projects.length);
    expect(totals.public + totals.private).toBe(totals.shown);
    expect(totals.repositories).toBeGreaterThanOrEqual(totals.shown);
  });
  it("has unique slugs and is sorted by order", () => {
    expect(new Set(projects.map((p) => p.slug)).size).toBe(projects.length);
    const orders = projects.map((p) => p.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
  it("features only projects with a description and highlights", () => {
    expect(featured.length).toBeGreaterThanOrEqual(4);
    for (const p of featured) {
      expect(p.description.length, p.slug).toBeGreaterThan(0);
      expect(p.highlights.length, p.slug).toBeGreaterThan(0);
    }
  });
  it("has exactly one hub and one vault in the LUCY family", () => {
    expect(lucyFamily.filter((p) => p.role === "hub")).toHaveLength(1);
    expect(lucyFamily.filter((p) => p.role === "vault")).toHaveLength(1);
  });
  it("points every 'now' entry at a shown project", () => {
    for (const n of profile.now) expect(bySlug.has(n.slug), n.slug).toBe(true);
  });
  it("uses https for every link", () => {
    for (const p of projects) for (const href of Object.values(p.links)) expect(href).toMatch(/^https:\/\//);
  });
});

describe("shipping log and proof", () => {
  it("only ever names public, shown projects", () => {
    for (const e of shipping) {
      const p = bySlug.get(e.project);
      expect(p, e.id).toBeDefined();
      expect(p!.visibility, e.id).toBe("public");
    }
  });
  it("has a lane for every event and is newest first", () => {
    const ids = new Set(lanes.map((l) => l.id));
    for (const e of shipping) expect(ids.has(e.lane), e.id).toBe(true);
    const times = shipping.map((e) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
  it("gives no private project any fetched proof", () => {
    for (const p of projects.filter((x) => x.visibility === "private")) {
      expect(p.proof?.release, p.slug).toBeUndefined();
      expect(p.proof?.commits, p.slug).toBeUndefined();
    }
  });
  it("keeps version numbers out of prose, because they go stale", () => {
    expect(versionsInProse(projects, profile)).toEqual([]);
    const stale = [{ ...projects[0]!, description: "Version 2.3.1 is out." }];
    expect(versionsInProse(stale, { ...profile, now: [] })).toEqual([`${projects[0]!.slug}.description: "2.3.1"`]);
  });
  it("shortens counts the way the proof line prints them", () => {
    expect(compact(950)).toBe("950");
    expect(compact(1356)).toBe("1.4k");
    expect(compact(2000)).toBe("2k");
    expect(compact(12400)).toBe("12k");
  });
});

describe("GitHub Pages site detection", () => {
  const reply = (status: number, location?: string) =>
    ({ status, headers: new Headers(location ? { location } : {}) }) as Response;
  it("links the project site when it answers", async () => {
    expect(await findSite("o", "r", async () => reply(200))).toBe("https://o.github.io/r/");
  });
  it("follows a redirect to a live custom domain", async () => {
    const fetcher = async (url: string) =>
      url.startsWith("https://o.github.io") ? reply(301, "https://r.example/") : reply(200);
    expect(await findSite("o", "r", fetcher)).toBe("https://r.example/");
  });
  it("links nothing that does not answer, redirects to http, or fails", async () => {
    expect(await findSite("o", "r", async () => reply(404))).toBeNull();
    expect(await findSite("o", "r", async () => reply(301, "http://r.example/"))).toBeNull();
    const deadDomain = async (url: string) =>
      url.startsWith("https://o.github.io") ? reply(301, "https://r.example/") : reply(503);
    expect(await findSite("o", "r", deadDomain)).toBeNull();
    expect(
      await findSite("o", "r", async () => {
        throw new Error("offline");
      }),
    ).toBeNull();
  });
});
