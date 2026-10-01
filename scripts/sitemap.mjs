// Writes dist/sitemap.xml from the pages vite-ssg produced. 404.html is left out on purpose.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const dist = resolve(process.argv[2] ?? "dist");
const base = "https://tochi-mba.github.io/";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const urls = walk(dist)
  .filter((f) => f.endsWith(".html"))
  .map((f) => relative(dist, f).replace(/\\/g, "/"))
  .filter((p) => p !== "404.html")
  .map((p) => (p === "index.html" ? "" : p.replace(/\.html$/, "")))
  .sort();

const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(dist, "sitemap.xml"), xml);
console.log(`sitemap: ${urls.length} urls`);
