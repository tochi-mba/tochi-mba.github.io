import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open, settle } from "./helpers";

const routes = [
  "/",
  "/work",
  "/about",
  "/404",
  `/work/${site.projects[0]!.slug}`,
  `/work/${site.projects.find((p) => p.visibility === "private")!.slug}`,
];

for (const route of routes) {
  test(`${route} has no axe violations`, async ({ page }) => {
    await page.goto(route);
    // Reveal everything so axe sees the page as a reader would after scrolling.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(".reveal")) el.setAttribute("data-revealed", "");
    });
    await settle(page);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("every interactive element has a visible focus ring", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hardware keyboard");
  await open(page, "/work");
  // Every control on the page, in one pass inside the page: a round trip per control is a hundred
  // round trips, too slow for a busy machine.
  const withoutRing = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
    const missing: string[] = [];
    for (const control of controls) {
      if (control.getClientRects().length === 0 || getComputedStyle(control).visibility === "hidden") continue;
      control.focus();
      if (document.activeElement !== control) continue;
      // Chromium reports a used outline width of 0 for some anchors under reduced motion; the style
      // is the cross-engine signal that the ring is drawn.
      if (getComputedStyle(control).outlineStyle === "none") missing.push(`${control.tagName}.${control.className}`);
    }
    return missing;
  });
  expect(withoutRing).toEqual([]);
});

test("touch targets are at least 44px on the phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await open(page, "/");
  for (const sel of [
    "header .brand",
    ".palette-button",
    ".theme-toggle",
    ".menu-button",
    ".button",
    ".case-actions a",
    ".map-chip",
  ]) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box?.height ?? 0, sel).toBeGreaterThanOrEqual(44);
    if (sel !== "header .brand" && sel !== ".case-actions a") expect(box?.width ?? 0, sel).toBeGreaterThanOrEqual(44);
  }
});

test("the command palette has no axe violations while it is open", async ({ page, isMobile }) => {
  test.skip(isMobile, "the palette is opened the same way everywhere; one pass is enough");
  await open(page, "/work");
  await page.getByRole("button", { name: "Search the site" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("combobox").fill("lucy");
  const results = await new AxeBuilder({ page })
    .include(".palette")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
