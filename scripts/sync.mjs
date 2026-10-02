// Turns what GitHub says about every repository into the snapshot the site is built from. Pure: the
// listing comes in, the snapshot and a report go out, so every rule below is unit-tested.
//
// The rules, in the order they apply to one repository:
//   1. No .portfolio/project.json: nothing new is published. A public repository that published
//      before keeps what it published last, so a file that goes missing (or has not arrived yet)
//      does not take a project off the site; taking one off is display false, said in the file.
//   2. A file that breaks the contract: not used. A public repository keeps what it published last,
//      so one typo does not take a project off the site; the report says what to fix.
//   3. display false: nothing published, not even the name.
//   4. A private repository also needs publicSafe true.
//   5. Text that contains an address inside a private repository: not used, as in rule 2.
//   6. A link into a private repository is dropped; the rest of the project stands.
//
// A token that sees no private repository (the one a workflow is given by default) cannot tell a
// private project that changed from one that went away, so private entries are then carried over
// from the previous snapshot unchanged. The owner's own token sees everything and decides afresh.
//
// What this reports may be printed in a public build log, so a private repository is never named in
// it: notes about one carry `repo: null` and are folded into counts by `report`.
import { listingSets, pointsAtPrivate, urlsIn } from "./links.mjs";
import { METADATA_PATH, Project, ProjectFile, ProjectsFile } from "./schema.mjs";

function describe(error) {
  return error.issues.map((i) => `${i.path.join(".") || "the file"}: ${i.message}`).join("; ");
}

/** What a repository's own file says, validated, or why it cannot be used. */
export function readProjectFile(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { problem: `it is not valid JSON (${error.message})` };
  }
  const parsed = ProjectFile.safeParse(raw);
  return parsed.success ? { file: parsed.data } : { problem: describe(parsed.error) };
}

const prose = (file) => [
  file.name,
  file.tagline,
  file.description,
  file.reason ?? "",
  ...file.highlights,
  ...file.stack,
];

/**
 * What one repository publishes. `outcome` is "published" (with the entry and how many links were
 * dropped), "opted-out", "no-consent" or "invalid" (with the problem).
 */
export function entryFor(repository, file, { owner, seen }) {
  if (!file.display) return { outcome: "opted-out" };
  if (repository.private && !file.publicSafe) return { outcome: "no-consent" };
  if (prose(file).some((text) => urlsIn(text).some((u) => pointsAtPrivate(u, owner, seen)))) {
    return { outcome: "invalid", problem: "its text contains an address inside a private repository" };
  }
  const links = Object.fromEntries(Object.entries(file.links).filter(([, u]) => !pointsAtPrivate(u, owner, seen)));
  const dropped = Object.keys(file.links).length - Object.keys(links).length;
  // A public repository is its own source; the file need not say so.
  if (!repository.private && !links.source) links.source = repository.url;
  const { $schema: _schema, reason: _reason, ...fields } = file;
  const entry = Project.parse({
    ...(repository.private ? {} : { repo: repository.name }),
    visibility: repository.private ? "private" : "public",
    ...fields,
    links,
    year: file.year ?? repository.year,
  });
  return { outcome: "published", entry, dropped };
}

const byName = (a, b) => a.name.localeCompare(b.name, "en");
const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name, "en");

/**
 * The next snapshot, from the previous one (or null) and a listing of every repository the token can
 * see, each with the text of its metadata file or null. Returns the snapshot, the notes behind it and
 * counts of what happened.
 */
export function syncProjects(previous, repositories, { owner }) {
  const seesPrivate = repositories.some((r) => r.private);
  const seen = listingSets(repositories);
  const notes = [];
  const counts = { published: 0, optedOut: 0, noConsent: 0, withoutFile: 0, invalid: 0, carried: 0 };
  const projects = [];
  const slugs = new Set();

  const take = (entry, say) => {
    if (slugs.has(entry.slug)) {
      say(`its slug "${entry.slug}" is already taken by another project`);
      return false;
    }
    slugs.add(entry.slug);
    projects.push(entry);
    return true;
  };

  // What a public repository published last, if anything. A private one carries no name to match.
  const lastPublished = (repository) =>
    repository.private ? undefined : previous?.projects.find((p) => p.repo === repository.name);
  const keeps = (kept) => (kept ? "; it keeps what it published last" : "");

  for (const repository of [...repositories].sort(byName)) {
    const say = (text) => notes.push({ repo: repository.private ? null : repository.name, text });
    if (repository.metadata === null) {
      counts.withoutFile += 1;
      const kept = lastPublished(repository);
      say(`it has no ${METADATA_PATH}${keeps(kept)}`);
      if (kept) take(kept, say);
      continue;
    }
    const read = readProjectFile(repository.metadata);
    const result = read.file
      ? entryFor(repository, read.file, { owner, seen })
      : { outcome: "invalid", problem: read.problem };
    if (result.outcome === "opted-out") counts.optedOut += 1;
    else if (result.outcome === "no-consent") counts.noConsent += 1;
    else if (result.outcome === "invalid") {
      counts.invalid += 1;
      const kept = lastPublished(repository);
      say(`its ${METADATA_PATH} was not used: ${result.problem}${keeps(kept)}`);
      if (kept) take(kept, say);
    } else {
      if (result.dropped > 0) say(`${result.dropped} of its links point into a private repository and were left out`);
      if (take(result.entry, say)) counts.published += 1;
      else counts.invalid += 1;
    }
  }

  if (!seesPrivate) {
    for (const entry of previous?.projects ?? []) {
      if (entry.visibility !== "private") continue;
      if (take(entry, (text) => notes.push({ repo: null, text }))) counts.carried += 1;
    }
  }

  const file = ProjectsFile.parse({
    version: 1,
    owner,
    // Without the private repositories in view, the last full count is the best there is.
    repositories: seesPrivate ? repositories.length : Math.max(repositories.length, previous?.repositories ?? 0),
    projects: projects.sort(byOrder),
  });
  return { file, notes, counts, seesPrivate };
}

/**
 * The notes as lines a public build log may print: public repositories by name, private ones only as
 * a count per kind of note, with any quoted slug and any detail after a colon taken out.
 */
export function report(notes) {
  const lines = notes.filter((n) => n.repo).map((n) => `${n.repo}: ${n.text}`);
  const counted = new Map();
  for (const note of notes.filter((n) => !n.repo)) {
    const text = note.text.replace(/"[^"]*"/g, "a slug").replace(/: .*$/, "");
    counted.set(text, (counted.get(text) ?? 0) + 1);
  }
  for (const [text, count] of counted) {
    lines.push(`${count} private ${count === 1 ? "repository" : "repositories"}: ${text}`);
  }
  return lines;
}

/** One line saying what the sync did. */
export function summary({ file, counts, seesPrivate }) {
  const parts = [
    `${file.projects.length} of ${file.repositories} repositories published`,
    `${counts.optedOut} opted out`,
    `${counts.withoutFile} without metadata`,
  ];
  if (counts.noConsent) parts.push(`${counts.noConsent} private without consent`);
  if (counts.invalid) parts.push(`${counts.invalid} not used`);
  if (!seesPrivate) parts.push(`${counts.carried} private carried over: this token sees public repositories only`);
  return `sync: ${parts.join(", ")}.`;
}
