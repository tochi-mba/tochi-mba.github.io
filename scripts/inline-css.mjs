// Puts the stylesheet inside every built page instead of linking to it, so a page paints as soon as
// its HTML has arrived: no second request stands between a visitor and the first paint. It costs
// nothing on the way round the site, because moving between pages never fetches HTML again; only a
// page opened fresh carries the styles with it (about 8 kB compressed). Runs after `vite-ssg build`;
// scripts/check-site.mjs fails a page that still links a stylesheet.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LINK = /<link rel="stylesheet"[^>]*\shref="(\/assets\/[^"]+\.css)"[^>]*>/g;

/** `html` with every stylesheet the build links replaced by its text, read through `read(href)`. */
export function inlineStylesheets(html, read) {
  return html.replace(LINK, (_, href) => {
    const css = read(href);
    if (/<\/style/i.test(css)) throw new Error(`${href} cannot be inlined: it contains "</style"`);
    return `<style>${css}</style>`;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? "dist");
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  const sheets = new Map();
  const read = (href) => {
    if (!sheets.has(href)) sheets.set(href, readFileSync(join(dist, href), "utf8").trim());
    return sheets.get(href);
  };
  let pages = 0;
  for (const file of walk(dist).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const inlined = inlineStylesheets(html, read);
    if (inlined === html) continue;
    writeFileSync(file, inlined);
    pages += 1;
  }
  console.log(`inline-css: styles carried inline by ${pages} pages`);
}
