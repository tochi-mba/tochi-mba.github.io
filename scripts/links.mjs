// Which links may be published, and which still answer. Two questions, kept apart.
// Whether a URL points into a repository that is not public is decided from the URL alone, with no
// request, so a private address is never fetched and never survives. Whether a public URL is dead is
// decided by asking for it the way a visitor's browser would, with no token. No network in the first
// half, an injectable fetcher in the second, so every rule is unit-tested.

const REPO_HOSTS = new Set(["github.com", "www.github.com", "raw.githubusercontent.com", "codeload.github.com"]);

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function named(first, owner, repository) {
  if (first?.toLowerCase() !== owner.toLowerCase() || !repository) return null;
  return repository.toLowerCase().replace(/\.git$/, "");
}

/** The owner's repository a URL points into, lowercased as GitHub compares names, or null. */
export function ownedRepository(url, owner) {
  const parsed = parse(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (REPO_HOSTS.has(host)) return named(segments[0], owner, segments[1]);
  if (host === "api.github.com" && segments[0] === "repos") return named(segments[1], owner, segments[2]);
  return null;
}

/** The project site a `<owner>.github.io/<name>/` URL belongs to, lowercased, or null. */
export function ownedSite(url, owner) {
  const parsed = parse(url);
  if (!parsed || parsed.hostname.toLowerCase() !== `${owner.toLowerCase()}.github.io`) return null;
  return parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? null;
}

/**
 * True when publishing the URL would point a visitor at something they cannot open.
 *
 * A repository address is refused unless the repository is known to be public: not being able to see
 * a repository is no evidence that it is safe to name. A project-site address is refused only when
 * the name is known to be private, because the first path segment of the owner's own site is usually
 * a page, not a repository. Both sets hold lowercased names.
 */
export function pointsAtPrivate(url, owner, { publicRepos, privateRepos }) {
  const repository = ownedRepository(url, owner);
  if (repository !== null) return !publicRepos.has(repository);
  const site = ownedSite(url, owner);
  return site !== null && privateRepos.has(site);
}

/**
 * The repositories a published snapshot can vouch for: the public ones it publishes, and the
 * portfolio's own. It knows no private name, by design, so a link into any other repository of the
 * owner's is refused, opted-out public ones included: an opt-out means the site does not point there.
 */
export function repoSets(file) {
  const publicRepos = new Set(file.projects.filter((p) => p.visibility === "public").map((p) => p.repo.toLowerCase()));
  publicRepos.add(`${file.owner}.github.io`.toLowerCase());
  return { publicRepos, privateRepos: new Set() };
}

/** The repositories a listing from GitHub can vouch for, with the private ones named, lowercased. */
export function listingSets(repositories) {
  const names = (isPrivate) =>
    new Set(repositories.filter((r) => r.private === isPrivate).map((r) => r.name.toLowerCase()));
  return { publicRepos: names(false), privateRepos: names(true) };
}

/** The publicly safe subset of a project's `links` object: nothing that points into a private repository. */
export function publicLinks(links, owner, repos, dead = new Set()) {
  return Object.fromEntries(
    Object.entries(links).filter(([, url]) => !pointsAtPrivate(url, owner, repos) && !dead.has(url)),
  );
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/g;

/** Every URL written inside a piece of prose. */
export function urlsIn(text) {
  return text.match(URL_IN_TEXT) ?? [];
}

/** The links worth asking about: every link a published project declares that is safe to publish. */
export function linkCandidates(file) {
  const repos = repoSets(file);
  const urls = file.projects
    .flatMap((p) => Object.values(p.links))
    .filter((u) => !pointsAtPrivate(u, file.owner, repos));
  return [...new Set(urls)].sort();
}

const DEAD_STATUSES = new Set([404, 410]);
const DEAD_ERRORS = new Set(["ENOTFOUND", "EAI_NONAME"]);

/**
 * Asks for one URL as a stranger: "ok", "dead" or "unknown".
 *
 * Only a clear answer counts as dead: the page is gone, or the host does not exist. A timeout, a
 * server error or a site that refuses robots says nothing about what a person would see, so the
 * link stays. That keeps one slow registry from stripping links off the site for a day.
 */
export async function reach(url, fetcher = fetch, timeoutMs = 10_000) {
  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "tochi-mba.github.io link check", Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    if (DEAD_STATUSES.has(response.status)) return "dead";
    return response.ok ? "ok" : "unknown";
  } catch (error) {
    return DEAD_ERRORS.has(error?.cause?.code) ? "dead" : "unknown";
  }
}

/** The reachability of each distinct URL, a few at a time, as a Map. */
export async function reachAll(urls, fetcher = fetch, concurrency = 6) {
  const queue = [...new Set(urls)];
  const results = new Map();
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      results.set(url, await reach(url, fetcher));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}
