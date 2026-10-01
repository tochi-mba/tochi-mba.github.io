// Renders scripts/og.html to dist/og.png (1200x630) with the Chromium Playwright uses for the tests.
// A missing browser is not a build failure: the page still works, only the social preview is blank.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, process.argv[2] ?? "dist", "og.png");

try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(root, "scripts/og.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: "png" });
  await browser.close();
  console.log(`og: wrote ${out}`);
} catch (error) {
  console.warn(`og: skipped (${error.message.split("\n")[0]})`);
  if (!existsSync(out)) process.exitCode = 0;
}
