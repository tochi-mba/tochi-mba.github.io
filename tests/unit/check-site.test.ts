import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { checkSite } from "../../scripts/check-site.mjs";

function site(pages: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  for (const f of [
    "favicon.svg",
    "robots.txt",
    "site.webmanifest",
    "schema/project.schema.json",
    "fonts/inter-latin.woff2",
  ]) {
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

const good = (body = "") =>
  `<!doctype html><html lang="en"><head><title>T</title><meta name="description" content="d"><link rel="canonical" href="https://tochi-mba.github.io/"></head><body><h1>Hi</h1>${body}</body></html>`;
const five = (extra: Record<string, string> = {}) => ({
  "index.html": good(),
  "work.html": good(),
  "about.html": good(),
  "404.html": good(),
  "work/a.html": good(),
  ...extra,
});

describe("checkSite", () => {
  it("passes a clean site", () => {
    expect(checkSite(site(five())).problems).toEqual([]);
  });
  it("flags two h1s, a missing description and an http link", () => {
    const html = `<!doctype html><html lang="en"><head><title>T</title></head><body><h1>a</h1><h1>b</h1><a href="http://x.y">x</a></body></html>`;
    const { problems } = checkSite(site(five({ "work/b.html": html })));
    expect(problems.join("\n")).toMatch(/2 h1/);
    expect(problems.join("\n")).toMatch(/no description/);
    expect(problems.join("\n")).toMatch(/http:\/\//);
  });
  it("flags a link into a private repository", () => {
    const { problems } = checkSite(
      site(five({ "work/b.html": good('<a href="https://github.com/tochi-mba/Media-tool">x</a>') })),
    );
    expect(problems.join("\n")).toMatch(/private repository Media-tool/);
  });
  it("flags a dead local link and a _blank without rel", () => {
    const { problems } = checkSite(
      site(five({ "work/b.html": good('<a href="/nowhere">x</a><a href="https://e.x" target="_blank">y</a>') })),
    );
    expect(problems.join("\n")).toMatch(/dead local link \/nowhere/);
    expect(problems.join("\n")).toMatch(/target=_blank without rel/);
  });
  it("flags a page missing from the sitemap", () => {
    const dir = site(five());
    writeFileSync(join(dir, "work/z.html"), good());
    expect(checkSite(dir).problems.join("\n")).toMatch(/work\/z.html: missing from sitemap/);
  });
});
