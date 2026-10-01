// Fetches what the public package registries say about the packages a project declares, at build
// time, with no token: npm (registry metadata and download counts) and PyPI (release metadata, and
// pypistats for downloads). Writes src/generated/registry.json. Nothing is invented: a package the
// registries cannot describe is simply absent, and the site shows nothing for it.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/registry.json");
mkdirSync(dirname(out), { recursive: true });

const projectsFile = JSON.parse(await readFile(resolve(root, "data/projects.json"), "utf8"));
const npmNames = [...new Set(projectsFile.projects.flatMap((p) => p.packages?.npm ?? []))];
const pypiNames = [...new Set(projectsFile.projects.flatMap((p) => p.packages?.pypi ?? []))];

async function json(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Versions in publish order, oldest first; the registry's `time` map carries one entry per version. */
export function npmVersions(time) {
  return Object.entries(time ?? {})
    .filter(([k]) => k !== "created" && k !== "modified")
    .map(([version, at]) => ({ version, at }))
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** PyPI lists files per version; a version's publish time is its first file's upload time. */
export function pypiVersions(releases) {
  return Object.entries(releases ?? {})
    .map(([version, files]) => ({ version, at: files?.[0]?.upload_time_iso_8601 ?? files?.[0]?.upload_time ?? null }))
    .filter((v) => v.at)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

async function fetchNpm(name) {
  const meta = await json(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  const versions = npmVersions(meta.time);
  const latest = meta["dist-tags"]?.latest ?? versions.at(-1)?.version ?? null;
  let downloadsMonth = null;
  let daily = [];
  try {
    const point = await json(`https://api.npmjs.org/downloads/point/last-month/${name}`);
    downloadsMonth = point.downloads ?? null;
    const range = await json(`https://api.npmjs.org/downloads/range/last-month/${name}`);
    daily = (range.downloads ?? []).map((d) => [d.day, d.downloads]);
  } catch {
    // Download counts are a nicety; the version history is the record.
  }
  return {
    name,
    version: latest,
    publishedAt: versions.find((v) => v.version === latest)?.at ?? null,
    versions,
    downloadsMonth,
    daily,
    url: `https://www.npmjs.com/package/${name}`,
  };
}

async function fetchPypi(name) {
  const meta = await json(`https://pypi.org/pypi/${name}/json`);
  const versions = pypiVersions(meta.releases);
  const latest = meta.info?.version ?? versions.at(-1)?.version ?? null;
  let downloadsMonth = null;
  try {
    const stats = await json(`https://pypistats.org/api/packages/${name}/recent`);
    downloadsMonth = stats.data?.last_month ?? null;
  } catch {
    // pypistats does not know every package; absence is not zero.
  }
  return {
    name,
    version: latest,
    publishedAt: versions.find((v) => v.version === latest)?.at ?? null,
    versions,
    downloadsMonth,
    url: `https://pypi.org/project/${name}/`,
  };
}

async function collect(names, fetcher, label) {
  const result = {};
  for (const name of names) {
    try {
      result[name] = await fetcher(name);
      console.log(`registry: ${label} ${name} ${result[name].version} (${result[name].versions.length} versions)`);
    } catch (error) {
      console.error(`registry: ${label} ${name} skipped (${error.message})`);
    }
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const npm = await collect(npmNames, fetchNpm, "npm");
  const pypi = await collect(pypiNames, fetchPypi, "pypi");
  const available = Object.keys(npm).length + Object.keys(pypi).length > 0;
  writeFileSync(out, `${JSON.stringify({ available, fetchedAt: new Date().toISOString(), npm, pypi }, null, 2)}\n`);
  console.log(`registry: ${Object.keys(npm).length} npm, ${Object.keys(pypi).length} pypi packages`);
}
