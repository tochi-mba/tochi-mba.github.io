import type { Page } from "@playwright/test";

/** Opens a page and waits for the app to hydrate, so keyboard and click handlers exist. */
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  return response;
}

/** Jumps every running CSS animation to its end, so colours and positions are final. */
export async function settle(page: Page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      // An infinite animation (the pulse dot) cannot be finished; it is decorative, leave it.
      if (a.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY) a.finish();
    }
  });
}
