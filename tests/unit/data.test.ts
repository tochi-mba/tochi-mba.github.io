import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bySlug, featured, lucyFamily, profile, projects, totals } from "../../src/data";

const raw = JSON.parse(readFileSync(resolve(__dirname, "../../data/projects.json"), "utf8"));

describe("generated site data", () => {
  it("never carries a link for a private project", () => {
    for (const p of projects.filter((p) => p.visibility === "private")) {
      expect(Object.keys(p.links), p.slug).toHaveLength(0);
    }
  });
  it("never includes a project with display false", () => {
    const hidden = raw.projects.filter((p: { display: boolean }) => !p.display).map((p: { slug: string }) => p.slug);
    expect(hidden.length).toBeGreaterThan(0);
    for (const slug of hidden) expect(bySlug.has(slug), slug).toBe(false);
  });
  it("leaves Media-tool out, by its own metadata, not by omission", () => {
    const media = raw.projects.find((p: { repo: string }) => p.repo === "Media-tool");
    expect(media).toBeDefined();
    expect(media.display).toBe(false);
    expect(media.reason).toMatch(/opted out/i);
    expect(bySlug.has("media-tool")).toBe(false);
  });
  it("keeps every repository accounted for in the totals", () => {
    expect(totals.repositories).toBe(raw.projects.length);
    expect(totals.shown + totals.privateCounted + totals.hidden).toBe(totals.repositories);
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
