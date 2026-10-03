import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { checkSite } from "../../scripts/check-site.mjs";
// @ts-expect-error plain ESM script without types
import { inlineStylesheets } from "../../scripts/inline-css.mjs";

/** The snapshot the checker reads its allow-list from: one public project, one private one. */
const snapshot = {
  owner: "tochi-mba",
  projects: [
    { visibility: "public", repo: "Open-thing", slug: "open-thing" },
    { visibility: "private", slug: "quiet-thing" },
  ],
};

const REQUIRED = [
  "favicon.svg",
  "robots.txt",
  "site.webmanifest",
  "og.png",
  "schema/project.schema.json",
  "fonts/bricolage-grotesque-latin.woff2",
  "fonts/martian-mono-latin.woff2",
];

function site(pages: Record<string, string>, { omit = [] as string[] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  for (const f of REQUIRED.filter((f) => !omit.includes(f))) {
    mkdirSync(join(dir, f, ".."), { recursive: true });
    writeFileSync(join(dir, f), "");
  }
  const urls = Object.keys(pages)
    .filter((p) => p !== "404.html")
    .map((p) => `https://tochi-mba.github.io/${p === "index.html" ? "" : p.replace(/\.html$/, "")}`);
  writeFileSync(join(dir, "sitemap.xml"), urls.map((u) => `<loc>${u}</loc>`).join(""));
  for (const [name, html] of Object.entries(pages)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), html);
  }
  return dir;
}

const head = `<title>T</title><meta name="description" content="d"><link rel="canonical" href="https://tochi-mba.github.io/"><meta property="og:image" content="https://tochi-mba.github.io/og.png">`;
const good = (body = "", extraHead = "") =>
  `<!doctype html><html lang="en"><head>${head}${extraHead}</head><body><h1>Hi</h1>${body}</body></html>`;
const five = (extra: Record<string, string> = {}) => ({
  "index.html": good(),
  "work.html": good(),
  "about.html": good(),
  "404.html": good(),
  "work/a.html": good(),
  ...extra,
});
const problems = (pages: Record<string, string>) => checkSite(site(pages), snapshot).problems.join("\n");

describe("checkSite", () => {
  it("passes a clean site", () => {
    expect(checkSite(site(five()), snapshot).problems).toEqual([]);
  });
  it("flags two h1s, a missing description and an http link", () => {
    const html = `<!doctype html><html lang="en"><head><title>T</title></head><body><h1>a</h1><h1>b</h1><a href="http://x.y">x</a></body></html>`;
    const found = problems(five({ "work/b.html": html }));
    expect(found).toMatch(/2 h1/);
    expect(found).toMatch(/no description/);
    expect(found).toMatch(/http:\/\//);
    expect(found).toMatch(/no og:image/);
    expect(found).toMatch(/no canonical/);
  });
  it("flags a page without a language or a title, and one that says it is a draft", () => {
    const html = "<!doctype html><html><head></head><body><h1>TODO</h1></body></html>";
    const found = problems(five({ "work/b.html": html }));
    expect(found).toMatch(/no lang/);
    expect(found).toMatch(/no title/);
    expect(found).toMatch(/draft words/);
  });
  it("allows GitHub links only into repositories the portfolio publishes, and the portfolio itself", () => {
    const allowed = good(
      '<a href="https://github.com/tochi-mba/Open-thing">a</a><a href="https://github.com/tochi-mba/tochi-mba.github.io">b</a><a href="https://github.com/tochi-mba">c</a><a href="https://github.com/vuejs/core">d</a>',
    );
    expect(problems(five({ "work/b.html": allowed }))).toBe("");
  });
  it("flags a link into any other repository of the owner's, without printing its name", () => {
    const found = problems(
      five({ "work/b.html": good('<a href="https://github.com/tochi-mba/Quiet-repo/blob/main/x">x</a>') }),
    );
    expect(found).toMatch(/work\/b.html: 1 link\(s\) into a repository the portfolio does not publish/);
    expect(found).not.toMatch(/Quiet-repo/i);
  });
  it("flags a dead local link and a _blank without rel", () => {
    const found = problems(
      five({ "work/b.html": good('<a href="/nowhere">x</a><a href="https://e.x" target="_blank">y</a>') }),
    );
    expect(found).toMatch(/dead local link \/nowhere/);
    expect(found).toMatch(/target=_blank without rel/);
  });
  it("flags structured data that is not valid JSON, and an id used twice", () => {
    const found = problems(
      five({
        "work/b.html": good(
          '<p id="x"></p><p id="x"></p>',
          '<script type="application/ld+json">{ "@type": "Person", }</script>',
        ),
      }),
    );
    expect(found).toMatch(/structured data that is not valid JSON/);
    expect(found).toMatch(/duplicate id "x"/);
  });
  it("lets the 404 page go without a canonical address or a preview image", () => {
    const notFound = `<!doctype html><html lang="en"><head><title>T</title><meta name="description" content="d"></head><body><h1>404</h1></body></html>`;
    expect(problems(five({ "404.html": notFound }))).toBe("");
  });
  it("flags a page missing from the sitemap, and a sitemap entry without a page", () => {
    const dir = site(five());
    writeFileSync(join(dir, "work/z.html"), good());
    writeFileSync(
      join(dir, "sitemap.xml"),
      "<loc>https://tochi-mba.github.io/</loc><loc>https://tochi-mba.github.io/gone</loc>",
    );
    const found = checkSite(dir, snapshot).problems.join("\n");
    expect(found).toMatch(/work\/z.html: missing from sitemap/);
    expect(found).toMatch(/sitemap entry without a page: https:\/\/tochi-mba.github.io\/gone/);
  });
  it("flags a missing asset the pages depend on, and a build with too few pages", () => {
    const found = checkSite(site({ "index.html": good() }, { omit: ["og.png"] }), snapshot).problems.join("\n");
    expect(found).toMatch(/missing og.png/);
    expect(found).toMatch(/only 1 pages built/);
  });
  it("flags a page that links its stylesheet instead of carrying it inline", () => {
    const linked = good("", '<link rel="stylesheet" crossorigin href="/assets/style.css">');
    expect(problems(five({ "work/b.html": linked }))).toMatch(
      /work\/b.html: links its stylesheet instead of carrying it inline/,
    );
  });
});

describe("inlining the stylesheet", () => {
  const css = ":root{--bg:#fff}body{margin:0}";
  const read = (href: string) => (href === "/assets/style-1.css" ? css : "");

  it("replaces the build's stylesheet link with the styles themselves, where the link was", () => {
    const html = `<head><script>boot()</script><link rel="stylesheet" crossorigin="" href="/assets/style-1.css"><link rel="canonical" href="/"></head>`;
    expect(inlineStylesheets(html, read)).toBe(
      `<head><script>boot()</script><style>${css}</style><link rel="canonical" href="/"></head>`,
    );
  });
  it("keeps a dollar sign in the styles as it is", () => {
    const html = '<link rel="stylesheet" href="/assets/style-1.css">';
    expect(inlineStylesheets(html, () => "a::after{content:'$&'}")).toBe("<style>a::after{content:'$&'}</style>");
  });
  it("leaves a page without a linked stylesheet alone", () => {
    const html = '<head><link rel="icon" href="/favicon.svg"></head>';
    expect(inlineStylesheets(html, read)).toBe(html);
  });
  it("refuses styles that would close the style element early", () => {
    expect(() => inlineStylesheets('<link rel="stylesheet" href="/assets/x.css">', () => "a{}</style><p>")).toThrow(
      /cannot be inlined/,
    );
  });
});
