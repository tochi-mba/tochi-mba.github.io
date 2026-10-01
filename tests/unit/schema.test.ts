import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { Project, ProjectsFile, publication } from "../../scripts/schema.mjs";

const base = {
  repo: "Thing",
  slug: "thing",
  name: "Thing",
  tagline: "A thing.",
  description: "",
  highlights: [],
  stack: [],
  category: "tool",
  status: "active",
  order: 1,
  visibility: "public",
  display: true,
  links: { source: "https://github.com/tochi-mba/Thing" },
  year: 2026,
};

describe("Project schema", () => {
  it("accepts a minimal public project", () => {
    expect(Project.safeParse(base).success).toBe(true);
  });
  it("rejects a public project with no source link", () => {
    expect(Project.safeParse({ ...base, links: {} }).success).toBe(false);
  });
  it("rejects a private project that carries links without publicSafe", () => {
    const r = Project.safeParse({ ...base, visibility: "private", links: { site: "https://example.com/x" } });
    expect(r.success).toBe(false);
  });
  it("accepts a private project with no links", () => {
    expect(Project.safeParse({ ...base, visibility: "private", links: {} }).success).toBe(true);
  });
  it("rejects a slug with capitals or underscores", () => {
    expect(Project.safeParse({ ...base, slug: "Thing_One" }).success).toBe(false);
  });
  it("rejects an http:// link", () => {
    expect(Project.safeParse({ ...base, links: { source: "http://github.com/x/y" } }).success).toBe(false);
  });
  it("rejects a featured project with no highlights", () => {
    expect(Project.safeParse({ ...base, featured: true, description: "x" }).success).toBe(false);
  });
  it("rejects unknown fields so typos cannot silently hide a project", () => {
    expect(Project.safeParse({ ...base, dispaly: false }).success).toBe(false);
  });
});

describe("ProjectsFile", () => {
  it("rejects duplicate slugs", () => {
    const r = ProjectsFile.safeParse({ version: 1, owner: "o", projects: [base, { ...base, repo: "Other" }] });
    expect(r.success).toBe(false);
  });
  it("rejects duplicate repos", () => {
    const r = ProjectsFile.safeParse({ version: 1, owner: "o", projects: [base, { ...base, slug: "other" }] });
    expect(r.success).toBe(false);
  });
});

describe("publication policy", () => {
  it("hides anything with display false, whatever else is set", () => {
    expect(publication({ ...base, display: false, publicSafe: true })).toBe("hidden");
  });
  it("shows a public project in full", () => {
    expect(publication(base)).toBe("full");
  });
  it("only counts a private project that is not publicSafe", () => {
    expect(publication({ ...base, visibility: "private" })).toBe("counted");
  });
  it("shows a publicSafe private project by name", () => {
    expect(publication({ ...base, visibility: "private", publicSafe: true })).toBe("name-only");
  });
});
