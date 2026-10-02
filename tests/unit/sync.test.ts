import { describe, expect, it } from "vitest";
import {
  entryFor,
  readProjectFile,
  report,
  summary,
  syncProjects,
  // @ts-expect-error plain ESM script without types
} from "../../scripts/sync.mjs";

const OWNER = "tochi-mba";

interface Listed {
  name: string;
  private: boolean;
  archived: boolean;
  description: string;
  url: string;
  language: string | null;
  year: number;
  metadata: string | null;
}

/** One repository as GitHub lists it, with its metadata file written from `file` (or none). */
function repo(name: string, file: object | string | null, isPrivate = false): Listed {
  return {
    name,
    private: isPrivate,
    archived: false,
    description: "",
    url: `https://github.com/${OWNER}/${name}`,
    language: "TypeScript",
    year: 2025,
    metadata: file === null ? null : typeof file === "string" ? file : JSON.stringify(file),
  };
}

const meta = (slug: string, extra: object = {}) => ({
  slug,
  name: slug.toUpperCase(),
  tagline: `What ${slug} is.`,
  category: "tool",
  status: "active",
  display: true,
  ...extra,
});

const run = (repositories: Listed[], previous: unknown = null) =>
  syncProjects(previous, repositories, { owner: OWNER });

describe("readProjectFile", () => {
  it("reads a valid file", () => {
    expect(readProjectFile(JSON.stringify(meta("a"))).file.slug).toBe("a");
  });
  it("says why a file that is not JSON cannot be used", () => {
    expect(readProjectFile("{ not json").problem).toMatch(/not valid JSON/);
  });
  it("names every field that breaks the contract", () => {
    const { problem } = readProjectFile(JSON.stringify({ ...meta("a"), slug: "Bad_Slug", dispaly: true }));
    expect(problem).toMatch(/slug/);
    expect(problem).toMatch(/dispaly/);
  });
});

describe("entryFor", () => {
  const seen = { publicRepos: new Set(["a", "open"]), privateRepos: new Set(["secret"]) };
  const read = (extra: object = {}) => readProjectFile(JSON.stringify(meta("a", extra))).file;

  it("publishes a public repository with its name and its own source link", () => {
    const result = entryFor(repo("A", null), read(), { owner: OWNER, seen });
    expect(result.outcome).toBe("published");
    expect(result.entry).toMatchObject({ repo: "A", visibility: "public", year: 2025 });
    expect(result.entry.links.source).toBe(`https://github.com/${OWNER}/A`);
  });
  it("keeps a source link the file states itself", () => {
    const own = read({ links: { source: "https://github.com/tochi-mba/open" } });
    expect(entryFor(repo("A", null), own, { owner: OWNER, seen }).entry.links.source).toBe(
      "https://github.com/tochi-mba/open",
    );
  });
  it("lets the file's year win over the year the repository was created", () => {
    expect(entryFor(repo("A", null), read({ year: 2024 }), { owner: OWNER, seen }).entry.year).toBe(2024);
  });
  it("publishes nothing when display is false", () => {
    expect(entryFor(repo("A", null), read({ display: false }), { owner: OWNER, seen }).outcome).toBe("opted-out");
  });
  it("needs a private repository's consent", () => {
    expect(entryFor(repo("S", null, true), read(), { owner: OWNER, seen }).outcome).toBe("no-consent");
  });
  it("publishes a consenting private repository by its own words, without its name or its source", () => {
    const result = entryFor(repo("Secret", null, true), read({ publicSafe: true }), { owner: OWNER, seen });
    expect(result.outcome).toBe("published");
    expect(result.entry.repo).toBeUndefined();
    expect(result.entry.visibility).toBe("private");
    expect(result.entry.links).toEqual({});
  });
  it("drops a link into a private repository and counts it, keeping the rest", () => {
    const file = read({
      publicSafe: true,
      links: { source: "https://github.com/tochi-mba/Secret", package: "https://pypi.org/project/x/" },
    });
    const result = entryFor(repo("Secret", null, true), file, { owner: OWNER, seen });
    expect(result.entry.links).toEqual({ package: "https://pypi.org/project/x/" });
    expect(result.dropped).toBe(1);
  });
  it("refuses text that points into a private repository rather than publish it", () => {
    const file = read({ description: "See https://github.com/tochi-mba/secret/blob/main/x.md" });
    const result = entryFor(repo("A", null), file, { owner: OWNER, seen });
    expect(result.outcome).toBe("invalid");
    expect(result.problem).toMatch(/private repository/);
  });
  it("drops the file's own bookkeeping: $schema and the reason for an opt-out", () => {
    const file = read({ $schema: "https://example.com/s.json", reason: "kept for later" });
    const { entry } = entryFor(repo("A", null), file, { owner: OWNER, seen });
    expect(entry).not.toHaveProperty("$schema");
    expect(entry).not.toHaveProperty("reason");
  });
});

describe("syncProjects", () => {
  it("publishes what each repository's own file allows, ordered, and counts every repository", () => {
    const { file, counts } = run([
      repo("Zed", meta("zed", { order: 1 })),
      repo("Alpha", meta("alpha", { order: 2 })),
      repo("Quiet", meta("quiet", { display: false })),
      repo("Bare", null),
    ]);
    expect(file.projects.map((p: { slug: string }) => p.slug)).toEqual(["zed", "alpha"]);
    expect(file.repositories).toBe(4);
    expect(counts).toMatchObject({ published: 2, optedOut: 1, withoutFile: 1, invalid: 0 });
  });
  it("orders by name when the order is the same", () => {
    const { file } = run([repo("B", meta("bravo")), repo("A", meta("alpha"))]);
    expect(file.projects.map((p: { slug: string }) => p.slug)).toEqual(["alpha", "bravo"]);
  });
  it("leaves out an opted-out repository entirely, name and all", () => {
    const { file, notes } = run([
      repo("Quiet", meta("quiet", { display: false, reason: "No." })),
      repo("A", meta("a")),
    ]);
    expect(JSON.stringify(file)).not.toMatch(/quiet/i);
    expect(JSON.stringify(notes)).not.toMatch(/quiet/i);
  });
  it("never writes a private repository's name, consenting or not", () => {
    const { file, notes } = run([
      repo("Hidden-service", meta("hidden-service-slug", { display: false })),
      repo("Private-thing", meta("shown-thing", { publicSafe: true }), true),
      repo("Shy-thing", meta("shy", {}), true),
      repo("Broken-private", "{", true),
    ]);
    const written = JSON.stringify(file);
    expect(written).not.toMatch(/Private-thing|Shy-thing|Broken-private/);
    expect(file.projects.map((p: { slug: string }) => p.slug)).toEqual(["shown-thing"]);
    expect(notes.filter((n: { repo: string | null }) => n.repo !== null)).toHaveLength(0);
  });
  it("keeps what a public repository published last when its file breaks, and says so", () => {
    const previous = run([repo("A", meta("a", { tagline: "The old words." }))]).file;
    const { file, notes, counts } = run([repo("A", "{ broken")], previous);
    expect(file.projects[0].tagline).toBe("The old words.");
    expect(counts.invalid).toBe(1);
    expect(notes[0]).toMatchObject({ repo: "A" });
    expect(notes[0].text).toMatch(/keeps what it published last/);
  });
  it("keeps what a public repository published last when its file goes missing, and says so", () => {
    const previous = run([repo("A", meta("a"))]).file;
    const { file, notes, counts } = run([repo("A", null)], previous);
    expect(file.projects.map((p: { slug: string }) => p.slug)).toEqual(["a"]);
    expect(counts.withoutFile).toBe(1);
    expect(notes[0].text).toBe("it has no .portfolio/project.json; it keeps what it published last");
  });
  it("takes a project off only when its own file says so", () => {
    const previous = run([repo("A", meta("a"))]).file;
    expect(run([repo("A", meta("a", { display: false }))], previous).file.projects).toEqual([]);
  });
  it("cannot keep a private project whose file went missing, because it has no name to match", () => {
    const previous = run([repo("S", meta("s", { publicSafe: true }), true)]).file;
    expect(run([repo("S", null, true)], previous).file.projects).toEqual([]);
  });
  it("drops a public project whose file breaks and that never published before", () => {
    const { file, notes } = run([repo("A", "{ broken")]);
    expect(file.projects).toEqual([]);
    expect(notes[0].text).not.toMatch(/keeps/);
  });
  it("refuses a second project that takes a slug already in use", () => {
    const { file, notes, counts } = run([repo("A", meta("same")), repo("B", meta("same"))]);
    expect(file.projects.map((p: { repo: string }) => p.repo)).toEqual(["A"]);
    expect(counts.invalid).toBe(1);
    expect(notes.find((n: { repo: string }) => n.repo === "B").text).toMatch(/already taken/);
  });
  it("says how many links pointed into a private repository", () => {
    const { notes } = run([
      repo("A", meta("a", { links: { site: "https://github.com/tochi-mba/Secret" } })),
      repo("Secret", null, true),
    ]);
    expect(notes.find((n: { repo: string }) => n.repo === "A").text).toMatch(/1 of its links/);
  });

  describe("with a token that sees public repositories only", () => {
    const owners = run([
      repo("Public-one", meta("public-one")),
      repo("Private-one", meta("private-one", { publicSafe: true }), true),
      repo("Private-two", meta("private-two", { publicSafe: true }), true),
    ]);

    it("carries private projects over unchanged and keeps the full repository count", () => {
      const { file, counts, seesPrivate } = run([repo("Public-one", meta("public-one"))], owners.file);
      expect(seesPrivate).toBe(false);
      expect(file.projects.map((p: { slug: string }) => p.slug).sort()).toEqual([
        "private-one",
        "private-two",
        "public-one",
      ]);
      expect(counts.carried).toBe(2);
      expect(file.repositories).toBe(3);
    });
    it("still refreshes the public ones", () => {
      const { file } = run([repo("Public-one", meta("public-one", { tagline: "New words." }))], owners.file);
      expect(file.projects.find((p: { slug: string }) => p.slug === "public-one").tagline).toBe("New words.");
    });
    it("lets a public project keep a slug a carried private one had, and drops the private one", () => {
      const { file, notes } = run([repo("Public-one", meta("private-one"))], owners.file);
      expect(file.projects.filter((p: { slug: string }) => p.slug === "private-one")).toHaveLength(1);
      expect(file.projects.find((p: { slug: string }) => p.slug === "private-one").visibility).toBe("public");
      expect(
        notes.some((n: { repo: string | null; text: string }) => n.repo === null && /already taken/.test(n.text)),
      ).toBe(true);
    });
    it("starts from nothing when there is no previous snapshot", () => {
      expect(run([repo("A", meta("a"))]).file.repositories).toBe(1);
    });
  });
});

describe("report and summary", () => {
  it("names public repositories and folds private ones into counts, details removed", () => {
    const lines = report([
      { repo: "Open", text: "it has no .portfolio/project.json" },
      { repo: null, text: 'its slug "secret-slug" is already taken by another project' },
      { repo: null, text: "its .portfolio/project.json was not used: it is not valid JSON (x)" },
      { repo: null, text: "its .portfolio/project.json was not used: name: too long" },
    ]);
    expect(lines).toEqual([
      "Open: it has no .portfolio/project.json",
      "1 private repository: its slug a slug is already taken by another project",
      "2 private repositories: its .portfolio/project.json was not used",
    ]);
  });
  it("says what happened in one line, and when private projects were carried over", () => {
    const owners = run([repo("A", meta("a")), repo("S", meta("s", { publicSafe: true }), true), repo("N", null)]);
    expect(summary(owners)).toBe("sync: 2 of 3 repositories published, 0 opted out, 1 without metadata.");
    const workflow = run([repo("A", meta("a")), repo("B", "{")], owners.file);
    expect(summary(workflow)).toMatch(/1 not used, 1 private carried over: this token sees public repositories only/);
    const shy = run([repo("S", meta("s"), true)]);
    expect(summary(shy)).toMatch(/1 private without consent/);
  });
});
