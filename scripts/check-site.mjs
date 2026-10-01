// Checks the built site before it is deployed. Node standard library only. Fails on anything a
// person would notice (a page without a title, a dead local link) and on anything that must never
// ship (a link into a private repository, an http:// link, a draft word).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function checkSite(dir) {
  const problems = [];
  const walk = (d) =>
    readdirSync(d).flatMap((n) => {
      const f = join(d, n);
      return statSync(f).isDirectory() ? walk(f) : [f];
    });
  const pages = walk(dir).filter((f) => f.endsWith(".html"));
  if (pages.length < 5) problems.push(`only ${pages.length} pages built`);

  const data = JSON.parse(readFileSync(resolve(root, "data/projects.json"), "utf8"));
  const privateRepos = data.projects.filter((p) => p.visibility === "private").map((p) => p.repo.toLowerCase());
  const hiddenNames = data.projects.filter((p) => !p.display).map((p) => p.name);
  // Case matters: "todo-list" is a project, TODO is a draft marker.
  const drafts = /\b(TODO|FIXME|TBD|XXX)\b|lorem ipsum|coming soon/;

  const sitemap = existsSync(join(dir, "sitemap.xml")) ? readFileSync(join(dir, "sitemap.xml"), "utf8") : "";
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

  for (const file of pages) {
    const rel = relative(dir, file).replace(/\\/g, "/");
    const html = readFileSync(file, "utf8");
    const say = (msg) => problems.push(`${rel}: ${msg}`);

    const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
    if (h1s !== 1) say(`${h1s} h1 elements`);
    if (!/<title>[^<]+<\/title>/.test(html)) say("no title");
    if (!/<meta name="description" content="[^"]+"/.test(html)) say("no description");
    if (!/<html[^>]*\blang="en"/.test(html)) say("no lang");
    if (rel !== "404.html" && !/<link rel="canonical" href="https:\/\/tochi-mba\.github\.io\//.test(html))
      say("no canonical");
    if (/\bhttp:\/\//.test(html)) say("http:// link");
    if (drafts.test(html.replace(/<script[\s\S]*?<\/script>/g, ""))) say("draft words");

    for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) {
      if (!/rel="noopener noreferrer"/.test(m[0])) say(`target=_blank without rel: ${m[0].slice(0, 80)}`);
    }
    for (const m of html.matchAll(/https:\/\/github\.com\/tochi-mba\/([A-Za-z0-9._-]+)/g)) {
      if (privateRepos.includes(m[1].toLowerCase())) say(`links to private repository ${m[1]}`);
    }
    for (const name of hiddenNames) {
      if (new RegExp(`>\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`).test(html))
        say(`shows hidden project ${name}`);
    }
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]+)/g)) {
      const target = m[1];
      const candidates = [join(dir, target), join(dir, `${target}.html`), join(dir, target, "index.html")];
      if (!candidates.some((c) => existsSync(c))) say(`dead local link ${target}`);
    }
    if (rel !== "404.html") {
      const url = `https://tochi-mba.github.io/${rel === "index.html" ? "" : rel.replace(/\.html$/, "")}`;
      if (!sitemapUrls.has(url)) say("missing from sitemap");
    }
  }
  for (const url of sitemapUrls) {
    const path = url.replace("https://tochi-mba.github.io/", "");
    const file = path === "" ? "index.html" : `${path}.html`;
    if (!existsSync(join(dir, file))) problems.push(`sitemap entry without a page: ${url}`);
  }
  for (const required of [
    "favicon.svg",
    "robots.txt",
    "site.webmanifest",
    "schema/project.schema.json",
    "fonts/inter-latin.woff2",
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
