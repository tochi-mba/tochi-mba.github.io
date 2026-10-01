// Copies the two self-hosted typefaces out of their fontsource packages into public/fonts, with their
// licences. Run `npm run fonts` after bumping either package; the output is committed so the build and
// the preload in index.html never depend on node_modules at runtime.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/fonts");
mkdirSync(out, { recursive: true });

// One file per face: Bricolage carries weight + optical size, Martian Mono carries weight.
const faces = [
  {
    pkg: "@fontsource-variable/bricolage-grotesque",
    file: "bricolage-grotesque-latin-opsz-normal.woff2",
    as: "bricolage-grotesque-latin.woff2",
  },
  {
    pkg: "@fontsource-variable/martian-mono",
    file: "martian-mono-latin-wght-normal.woff2",
    as: "martian-mono-latin.woff2",
  },
];

const licence = [];
for (const f of faces) {
  const dir = resolve(root, "node_modules", f.pkg);
  copyFileSync(resolve(dir, "files", f.file), resolve(out, f.as));
  licence.push(`${f.as}\n${"=".repeat(f.as.length)}\n\n${readFileSync(resolve(dir, "LICENSE"), "utf8").trim()}\n`);
  console.log(`fonts: ${f.as}`);
}
writeFileSync(resolve(out, "LICENSE.txt"), `${licence.join("\n\n")}\n`);
