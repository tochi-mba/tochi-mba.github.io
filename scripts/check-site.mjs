// Checks the built site before it is deployed. Node standard library only. Fails on anything a
// person would notice (a page without a title, a dead local link) and on anything that must never
// ship (a link into a repository the portfolio does not publish, an http:// link, a draft word).
//
// The repository rule is an allow-list: a GitHub link must point at a repository the snapshot
// publishes, or at the portfolio itself. The checker never learns a private name, so it cannot leak
// one, and a problem it finds is reported without the repository's name for the same reason: this
// runs in a public build log.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ownedRepository, repoSets } from "./links.mjs";
import { DRAFT_WORDS } from "./shipping.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://tochi-mba.github.io/";

function readSnapshot() {
  return JSON.parse(readFileSync(resolve(root, "data/projects.json"), "utf8"));
}

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const f = join(d, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });

function checkPage(html, rel, { owner, publicRepos }) {
  const problems = [];
  const say = (msg) => problems.push(`${rel}: ${msg}`);
  const isNotFound = rel === "404.html";

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) say(`${h1s} h1 elements`);
  if (!/<title>[^<]+<\/title>/.test(html)) say("no title");
  if (!/<meta name="description" content="[^"]+"/.test(html)) say("no description");
  if (!/<html[^>]*\blang="en"/.test(html)) say("no lang");
  if (!isNotFound && !/<link rel="canonical" href="https:\/\/tochi-mba\.github\.io\//.test(html)) say("no canonical");
  if (!isNotFound && !/<meta property="og:image" content="https:\/\//.test(html)) say("no og:image");
  if (/\bhttp:\/\//.test(html)) say("http:// link");
  if (/<link rel="stylesheet"/.test(html)) say("links its stylesheet instead of carrying it inline");
  if (DRAFT_WORDS.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) say("draft words");

  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      say("structured data that is not valid JSON");
    }
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) say(`duplicate id "${id}"`);

  for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="noopener noreferrer"/.test(m[0])) say(`target=_blank without rel: ${m[0].slice(0, 80)}`);
  }
  const unknown = [...html.matchAll(/https:\/\/(?:www\.)?github\.com\/[^\s"'<>)]+/g)]
    .map((m) => ownedRepository(m[0], owner))
    .filter((repository) => repository !== null && !publicRepos.has(repository));
  if (unknown.length) say(`${unknown.length} link(s) into a repository the portfolio does not publish`);
  return problems;
}

/** Every problem with the built site in `dir`. `snapshot` is data/projects.json unless given. */
export function checkSite(dir, snapshot = readSnapshot()) {
  const problems = [];
  const pages = walk(dir).filter((f) => f.endsWith(".html"));
  if (pages.length < 5) problems.push(`only ${pages.length} pages built`);
  const allowed = { owner: snapshot.owner, publicRepos: repoSets(snapshot).publicRepos };

  const sitemap = existsSync(join(dir, "sitemap.xml")) ? readFileSync(join(dir, "sitemap.xml"), "utf8") : "";
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

  for (const file of pages) {
    const rel = relative(dir, file).replace(/\\/g, "/");
    const html = readFileSync(file, "utf8");
    problems.push(...checkPage(html, rel, allowed));
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]+)/g)) {
      const target = m[1];
      const candidates = [join(dir, target), join(dir, `${target}.html`), join(dir, target, "index.html")];
      if (!candidates.some((c) => existsSync(c))) problems.push(`${rel}: dead local link ${target}`);
    }
    if (rel !== "404.html") {
      const url = `${ORIGIN}${rel === "index.html" ? "" : rel.replace(/\.html$/, "")}`;
      if (!sitemapUrls.has(url)) problems.push(`${rel}: missing from sitemap`);
    }
  }
  for (const url of sitemapUrls) {
    const path = url.replace(ORIGIN, "");
    const file = path === "" ? "index.html" : `${path}.html`;
    if (!existsSync(join(dir, file))) problems.push(`sitemap entry without a page: ${url}`);
  }
  for (const required of [
    "favicon.svg",
    "robots.txt",
    "site.webmanifest",
    "og.png",
    "schema/project.schema.json",
    "fonts/bricolage-grotesque-latin.woff2",
    "fonts/martian-mono-latin.woff2",
  ]) {
    if (!existsSync(join(dir, required))) problems.push(`missing ${required}`);
  }
  return { pages: pages.length, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pages, problems } = checkSite(resolve(process.argv[2] ?? "dist"));
  for (const p of problems) console.error(`✗ ${p}`);
  console.log(`check-site: ${pages} pages, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}
