// Screenshots of the built site, for looking at a change before it ships: every listed page, at phone,
// tablet and desktop sizes, in both themes. Needs `npm run build`; serves dist/ itself.
//   node scripts/shots.mjs [out-dir] [--only=home,work] [--themes=dark,light] [--sizes=phone,desktop]
//                          [--fold | --tiles]   the first screen only, or a long page as a run of screens
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { servePreview } from "./preview.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3).split(",") : fallback;
};
const out = resolve(args.find((a) => !a.startsWith("--")) ?? "shots");
const { base, close } = await servePreview();

const PAGES = {
  home: "/",
  work: "/work",
  project: "/work/weftai",
  private: "/work/weftai-for-python",
  about: "/about",
  missing: "/no-such-page",
};
const SIZES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 1 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

const pages = option("only", Object.keys(PAGES));
const themes = option("themes", ["dark", "light"]);
const sizes = option("sizes", Object.keys(SIZES));
const fold = args.includes("--fold");
const tiles = args.includes("--tiles");

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const size of sizes) {
  for (const theme of themes) {
    const { width, height, ...rest } = SIZES[size];
    // Reduced motion, so nothing is caught half-way through a reveal.
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: "reduce",
      ...rest,
    });
    const page = await context.newPage();
    for (const name of pages) {
      await page.goto(`${base}${PAGES[name]}`);
      await page.waitForSelector("html[data-hydrated]", { state: "attached" });
      await page.evaluate(() => document.fonts.ready);
      const stem = `${name}-${size}-${theme}`;
      if (tiles) {
        // A long page as a run of screens, each small enough to read at full size.
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        const step = Math.max(height, 1000);
        for (let y = 0, n = 1; y < total; y += step, n += 1) {
          const path = resolve(out, `${stem}-${n}.png`);
          await page.screenshot({ path, fullPage: true, clip: { x: 0, y, width, height: Math.min(step, total - y) } });
          console.log(path);
        }
      } else {
        const path = resolve(out, `${stem}.png`);
        await page.screenshot({ path, fullPage: !fold });
        console.log(path);
      }
    }
    await context.close();
  }
}
await browser.close();
await close();
