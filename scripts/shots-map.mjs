// A few frames of the LUCY map in motion, for looking at the animation: node drift, a travelling
// request and a dragged node. Needs `npm run build`; serves dist/ itself, like scripts/shots.mjs.
//   node scripts/shots-map.mjs [out-dir] [--theme=light]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { servePreview } from "./preview.mjs";

const args = process.argv.slice(2);
const out = resolve(args.find((a) => !a.startsWith("--")) ?? "shots");
const theme = args.includes("--theme=light") ? "light" : "dark";
const { base, close } = await servePreview();

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme })).newPage();
await page.goto(`${base}/`);
await page.waitForSelector("html[data-hydrated]", { state: "attached" });
await page.locator("#system").scrollIntoViewIfNeeded();
await page.locator(".system-map").scrollIntoViewIfNeeded();
const shoot = async (name) => {
  const path = resolve(out, `map-${theme}-${name}.png`);
  await page.locator("#system").screenshot({ path });
  console.log(path);
};
await page.waitForTimeout(1300);
await shoot("1-fan-out");
await page.waitForTimeout(4200);
await shoot("2-touring");
const memory = page.locator(".map-node", { hasText: "memory" });
const hoverBox = await memory.boundingBox();
await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
await page.waitForTimeout(350);
await shoot("3-request");
const box = await page.locator(".map-node", { hasText: "memory" }).boundingBox();
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 6 });
await shoot("4-dragged");
await page.mouse.up();
await browser.close();
await close();
