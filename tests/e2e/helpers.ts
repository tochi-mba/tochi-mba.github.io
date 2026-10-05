import type { Page } from "@playwright/test";

/**
 * Opens a page and waits for the app to hydrate, so keyboard and click handlers exist: the page
 * itself, and every part woken a moment later (see src/wakeLater.ts).
 */
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForSelector("html[data-hydrated]:not([data-waking])", { state: "attached" });
  return response;
}

/** Counts every animation frame the page asks for from here on. Call it before `open`. */
export async function countFrames(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number };
    w.__frames = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      w.__frames += 1;
      return request(callback);
    };
  });
}

/** How many animation frames the page asked for in the next `ms` milliseconds. Needs `countFrames`. */
export async function framesDuring(page: Page, ms: number) {
  const read = () => page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  const before = await read();
  await page.waitForTimeout(ms);
  return (await read()) - before;
}

/** Jumps every running CSS animation to its end, so colours and positions are final. */
export async function settle(page: Page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      // An infinite animation cannot be finished (finish() throws), so one is left running.
      if (a.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY) a.finish();
    }
  });
}
