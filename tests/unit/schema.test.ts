import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Project,
  ProjectFile,
  ProjectsFile,
  projectFileJsonSchema,
  publication,
  SCHEMA_URL,
  // @ts-expect-error plain ESM script without types
} from "../../scripts/schema.mjs";

/** The least a repository can write about itself. */
const file = {
  slug: "thing",
  name: "Thing",
  tagline: "A thing.",
  category: "tool",
  status: "active",
  display: true,
};

/** A published public project, as the snapshot keeps it. */
const entry = {
  repo: "Thing",
  visibility: "public",
  ...file,
  links: { source: "https://github.com/tochi-mba/Thing" },
  year: 2026,
};

describe("ProjectFile: what a repository writes", () => {
  it("accepts a minimal file and fills in the defaults", () => {
    const parsed = ProjectFile.parse(file);
    expect(parsed).toMatchObject({
      description: "",
      highlights: [],
      stack: [],
      featured: false,
      order: 500,
      publicSafe: false,
      links: {},
    });
  });
  it("accepts the $schema line an editor uses, and a reason for opting out", () => {
    expect(ProjectFile.safeParse({ ...file, $schema: SCHEMA_URL, display: false, reason: "Not ready." }).success).toBe(
      true,
    );
  });
  it("refuses the facts only GitHub may state: the repository's name and whether it is private", () => {
    expect(ProjectFile.safeParse({ ...file, repo: "Thing" }).success).toBe(false);
    expect(ProjectFile.safeParse({ ...file, visibility: "public" }).success).toBe(false);
  });
  it("refuses a typo, so a misspelt display cannot quietly publish or hide a project", () => {
    expect(ProjectFile.safeParse({ ...file, dispaly: false }).success).toBe(false);
  });
  it("needs display stated, either way", () => {
    const { display: _display, ...withoutDisplay } = file;
    expect(ProjectFile.safeParse(withoutDisplay).success).toBe(false);
  });
  it("needs a tagline, because every card shows one", () => {
    expect(ProjectFile.safeParse({ ...file, tagline: "" }).success).toBe(false);
  });
  it("refuses a slug with capitals or underscores, and an http:// link", () => {
    expect(ProjectFile.safeParse({ ...file, slug: "Thing_One" }).success).toBe(false);
    expect(ProjectFile.safeParse({ ...file, links: { site: "http://example.com" } }).success).toBe(false);
  });
  it("refuses an unknown kind of link", () => {
    expect(ProjectFile.safeParse({ ...file, links: { blog: "https://example.com" } }).success).toBe(false);
  });
  it("needs a description and highlights before a project can be featured", () => {
    expect(ProjectFile.safeParse({ ...file, featured: true, description: "x" }).success).toBe(false);
    expect(ProjectFile.safeParse({ ...file, featured: true, description: "x", highlights: ["y"] }).success).toBe(true);
  });
});

describe("Project: one published entry", () => {
  it("accepts a public project with its repository and source", () => {
    expect(Project.safeParse(entry).success).toBe(true);
  });
  it("needs a public project's repository name and source link", () => {
    const { repo: _repo, ...withoutRepo } = entry;
    expect(Project.safeParse(withoutRepo).success).toBe(false);
    expect(Project.safeParse({ ...entry, links: {} }).success).toBe(false);
  });
  it("never lets a private project carry its repository's name", () => {
    const privateEntry = { ...entry, visibility: "private", publicSafe: true, links: {} };
    expect(Project.safeParse(privateEntry).success).toBe(false);
    const { repo: _repo, ...anonymous } = privateEntry;
    expect(Project.safeParse(anonymous).success).toBe(true);
  });
  it("needs a year, which the sync fills in from GitHub when the file leaves it out", () => {
    const { year: _year, ...withoutYear } = entry;
    expect(Project.safeParse(withoutYear).success).toBe(false);
  });
});

describe("ProjectsFile: the snapshot", () => {
  const snapshot = (projects: object[], repositories = 5) => ({ version: 1, owner: "o", repositories, projects });

  it("accepts published projects and a count of every repository", () => {
    expect(ProjectsFile.safeParse(snapshot([entry])).success).toBe(true);
  });
  it("refuses duplicate slugs and duplicate repositories", () => {
    expect(ProjectsFile.safeParse(snapshot([entry, { ...entry, repo: "Other" }])).success).toBe(false);
    expect(ProjectsFile.safeParse(snapshot([entry, { ...entry, slug: "other" }])).success).toBe(false);
  });
  it("lets two private projects share an absent repository name", () => {
    const anonymous = (slug: string) => ({
      visibility: "private",
      ...file,
      slug,
      publicSafe: true,
      links: {},
      year: 2026,
    });
    expect(ProjectsFile.safeParse(snapshot([anonymous("a"), anonymous("b")])).success).toBe(true);
  });
  it("refuses anything that may not be published, so a hand edit cannot publish it", () => {
    expect(ProjectsFile.safeParse(snapshot([{ ...entry, display: false }])).success).toBe(false);
    const noConsent = { visibility: "private", ...file, links: {}, year: 2026 };
    expect(ProjectsFile.safeParse(snapshot([noConsent])).success).toBe(false);
  });
  it("refuses more projects than there are repositories", () => {
    expect(ProjectsFile.safeParse(snapshot([entry], 0)).success).toBe(false);
  });
});

describe("publication policy", () => {
  it("hides anything with display false, whatever else is set", () => {
    expect(publication({ ...entry, display: false, publicSafe: true })).toBe("hidden");
  });
  it("shows a public project in full", () => {
    expect(publication(entry)).toBe("full");
  });
  it("only counts a private project that has not consented", () => {
    expect(publication({ ...entry, visibility: "private" })).toBe("counted");
  });
  it("shows a consenting private project in its own words", () => {
    expect(publication({ ...entry, visibility: "private", publicSafe: true })).toBe("name-only");
  });
});

describe("this repository's own metadata", () => {
  it("passes the contract every other repository is held to", () => {
    const own = JSON.parse(readFileSync(resolve(__dirname, "../../.portfolio/project.json"), "utf8"));
    const parsed = ProjectFile.safeParse(own);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(own.$schema).toBe(SCHEMA_URL);
  });
});

describe("the published JSON Schema", () => {
  const schema = projectFileJsonSchema();
  it("is what the code generates, so the copy in public/ is never stale", () => {
    const committed = JSON.parse(readFileSync(resolve(__dirname, "../../public/schema/project.schema.json"), "utf8"));
    expect(committed).toEqual(JSON.parse(JSON.stringify(schema)));
  });
  it("is addressed where every repository's file points", () => {
    expect(schema.$id).toBe(SCHEMA_URL);
    expect(schema.title).toBe("Portfolio project metadata");
  });
  it("describes the file, not the snapshot: no repository name, no visibility", () => {
    expect(Object.keys(schema.properties)).toContain("display");
    expect(Object.keys(schema.properties)).toContain("publicSafe");
    expect(Object.keys(schema.properties)).not.toContain("repo");
    expect(Object.keys(schema.properties)).not.toContain("visibility");
  });
  it("requires only what a file must say", () => {
    expect([...schema.required].sort()).toEqual(["category", "display", "name", "slug", "status", "tagline"]);
  });
});
