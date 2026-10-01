// Pure functions that turn what GitHub and the package registries said at build time into the two
// things the site draws: a proof line per project and the shipping log (releases, package publishes
// and merged pull requests, newest first). No network here, so every rule is unit-tested.

/**
 * Words that must never reach a page: check-site fails the build on them, and a fetched title that
 * carries one is not shown. Case matters: "todo-list" is a project, TODO is a draft marker.
 */
export const DRAFT_WORDS = /\b(TODO|FIXME|TBD|XXX)\b|lorem ipsum|coming soon/;

/** A version written anywhere in prose goes stale the day after a release; the site fetches them. */
export const VERSION_IN_PROSE = /\bv?\d+\.\d+\.\d+\b/;

/** "v2.3.3" → "2.3.3", "weftai@0.5.2" and "@weftai/mcp@0.5.2" → "0.5.2", "latest-windows" stays. */
export function normaliseVersion(tag) {
  const afterAt = tag.includes("@") ? tag.slice(tag.lastIndexOf("@") + 1) : tag;
  return afterAt.replace(/^v(?=\d)/, "");
}

/** The lane an event belongs to: a featured project, the LUCY hub for its family, or "other". */
function laneFor(project, featuredSlugs, hubSlug) {
  if (featuredSlugs.has(project.slug)) return project.slug;
  if (project.family === "lucy" && hubSlug) return hubSlug;
  return "other";
}

function safeTitle(title, fallback) {
  const t = (title ?? "").trim();
  return t && !DRAFT_WORDS.test(t) ? t : fallback;
}

/**
 * A release's own words, without the tag it repeats: "v2.3.3: Pause copies" → "Pause copies".
 * A name that is only a tag ("weftai@0.5.2", "@weftai/mcp@0.5.2", "v1.0.0") says nothing: null.
 */
export function releaseWords(name, tagName) {
  let t = (name ?? "").trim();
  if (!t) return null;
  if (tagName && t.startsWith(tagName)) t = t.slice(tagName.length).replace(/^[\s:·—–-]+/, "");
  if (!t || /^@?[\w./-]*@?v?\d+(\.\d+)*(-[\w.]+)?$/.test(t)) return null;
  return DRAFT_WORDS.test(t) ? null : t;
}

/**
 * Builds the shipping log. `projects` are the shown projects (already through the publication policy),
 * so a private or opted-out repository can never contribute an event or a name.
 */
export function buildShipping({ projects, activity, registry, limit = 40 }) {
  const publicByRepo = new Map(projects.filter((p) => p.visibility === "public").map((p) => [p.repo.toLowerCase(), p]));
  const featuredSlugs = new Set(projects.filter((p) => p.featured).map((p) => p.slug));
  const hubSlug = projects.find((p) => p.family === "lucy" && p.role === "hub")?.slug;
  const versions = new Map();

  const addVersion = (project, version, at, patch) => {
    const key = `${project.slug}@${version}`;
    const existing = versions.get(key);
    if (!existing) {
      versions.set(key, {
        id: key,
        lane: laneFor(project, featuredSlugs, hubSlug),
        project: project.slug,
        kind: "release",
        label: /^\d/.test(version) ? `v${version}` : version,
        title: `${project.name} ${/^\d/.test(version) ? `v${version}` : version}`,
        words: null,
        at,
        url: project.links.source ?? project.links.site ?? "",
        ...patch,
        channels: [...(patch.channels ?? [])],
      });
      return;
    }
    if (at < existing.at) existing.at = at;
    if (patch.words && !existing.words) existing.words = patch.words;
    // A GitHub release page is the best link; otherwise the first (main) package keeps it.
    if (patch.url?.includes("/releases/") && !existing.url.includes("/releases/")) existing.url = patch.url;
    for (const c of patch.channels ?? []) if (!existing.channels.includes(c)) existing.channels.push(c);
  };

  for (const repo of activity?.repos ?? []) {
    const project = publicByRepo.get(repo.name.toLowerCase());
    if (!project) continue;
    for (const r of repo.releases ?? []) {
      if (r.isDraft || !r.publishedAt) continue;
      const version = normaliseVersion(r.tagName);
      addVersion(project, version, r.publishedAt, {
        words: releaseWords(r.name, r.tagName),
        url: r.url,
        channels: ["GitHub"],
      });
    }
  }

  for (const project of projects) {
    for (const [channel, names] of [
      ["npm", project.packages?.npm ?? []],
      ["PyPI", project.packages?.pypi ?? []],
    ]) {
      const source = channel === "npm" ? registry?.npm : registry?.pypi;
      for (const name of names) {
        const pkg = source?.[name];
        if (!pkg) continue;
        for (const v of pkg.versions) {
          addVersion(project, v.version, v.at, { channels: [channel], url: pkg.url });
        }
      }
    }
  }

  const prs = [];
  for (const pr of activity?.pullRequests ?? []) {
    if (!pr.merged || !pr.mergedAt) continue;
    const project = publicByRepo.get(pr.repo.toLowerCase());
    if (!project) continue;
    prs.push({
      id: `${project.slug}#${pr.number}`,
      lane: laneFor(project, featuredSlugs, hubSlug),
      project: project.slug,
      kind: "pr",
      label: `#${pr.number}`,
      title: `${project.name} #${pr.number}`,
      words: safeTitle(pr.title, null),
      at: pr.mergedAt,
      url: pr.url,
      channels: [],
    });
  }

  const events = [...versions.values(), ...prs].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}

/** The lanes the log draws, in the order the featured projects are listed, then "other". */
export function buildLanes({ projects, events }) {
  const used = new Set(events.map((e) => e.lane));
  const lanes = projects
    .filter((p) => p.featured && used.has(p.slug))
    .map((p) => ({ id: p.slug, name: p.name, slug: p.slug }));
  if (used.has("other")) lanes.push({ id: "other", name: "Everything else", slug: null });
  return lanes;
}

/** What GitHub and the registries can vouch for about one project. Absent means "not fetched". */
export function buildProof({ project, activity, registry, projects }) {
  const proof = {};
  const repo = (activity?.repos ?? []).find((r) => r.name.toLowerCase() === project.repo.toLowerCase());
  if (project.visibility === "public" && repo) {
    const published = (repo.releases ?? []).filter((r) => !r.isDraft && r.publishedAt);
    const latest = published.find((r) => !r.isPrerelease) ?? published[0];
    if (latest) {
      proof.release = {
        tag: latest.tagName,
        words: releaseWords(latest.name, latest.tagName),
        at: latest.publishedAt,
        url: latest.url,
        count: repo.releaseCount ?? published.length,
        prerelease: Boolean(latest.isPrerelease),
        assets: latest.assetCount ?? 0,
        downloads: latest.downloads ?? 0,
      };
    }
    if (typeof repo.commits === "number") proof.commits = repo.commits;
    if (repo.pushedAt) proof.pushedAt = repo.pushedAt;
  }
  const npmName = project.packages?.npm?.[0];
  const npm = npmName ? registry?.npm?.[npmName] : undefined;
  if (npm) {
    proof.npm = {
      name: npm.name,
      version: npm.version,
      at: npm.publishedAt,
      versions: npm.versions.length,
      downloadsMonth: npm.downloadsMonth,
      daily: npm.daily,
      url: npm.url,
      packages: (project.packages?.npm ?? []).filter((n) => registry?.npm?.[n]).length,
    };
  }
  const pypiName = project.packages?.pypi?.[0];
  const pypi = pypiName ? registry?.pypi?.[pypiName] : undefined;
  if (pypi) {
    proof.pypi = {
      name: pypi.name,
      version: pypi.version,
      at: pypi.publishedAt,
      versions: pypi.versions.length,
      downloadsMonth: pypi.downloadsMonth,
      url: pypi.url,
      packages: (project.packages?.pypi ?? []).filter((n) => registry?.pypi?.[n]).length,
    };
  }
  if (project.family === "lucy" && project.role === "hub") {
    proof.services = projects.filter((p) => p.family === "lucy" && p !== project).length;
  }
  return Object.keys(proof).length ? proof : undefined;
}
