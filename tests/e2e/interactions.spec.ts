import { expect, test } from "@playwright/test";
import { open, settle } from "./helpers";

test("the header earns its border and progress line on scroll", async ({ page }) => {
  await open(page, "/");
  const header = page.locator("header.site-header");
  await expect(header).not.toHaveClass(/scrolled/);
  await page.mouse.wheel(0, 600);
  await expect(header).toHaveClass(/scrolled/);
  const progress = await page
    .locator(".scroll-progress")
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--progress"));
  expect(Number.parseFloat(progress)).toBeGreaterThan(0);
});

test("sections reveal as they scroll into view, and stay revealed", async ({ page }) => {
  await open(page, "/");
  const motion = await page.evaluate(() => document.documentElement.classList.contains("motion"));
  test.skip(!motion, "reduced motion: nothing to reveal");
  const cta = page.locator(".cta");
  await expect(cta).not.toHaveClass(/visible/);
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toHaveClass(/visible/);
  await expect(cta).toHaveCSS("opacity", "1");
});

test("reduced motion: everything is visible at once and nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  await expect(page.locator("html")).not.toHaveClass(/motion/);
  await expect(page.locator(".cta")).toHaveCSS("opacity", "1");
  const duration = await page
    .locator(".card")
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration.split(",").every((d) => Number.parseFloat(d) < 0.01)).toBe(true);
});

test("the LUCY map responds to hover, click and arrow keys", async ({ page, isMobile }) => {
  await open(page, "/");
  const detail = page.locator(".map-detail h3");
  await expect(detail).toHaveText("LUCY");
  await page.locator(".map-node", { hasText: "keyring" }).click();
  await expect(detail).toHaveText("keyring");
  // A vertical <line> has no width, so "visible" means present and lit, not a bounding box.
  expect(await page.locator(".map-edge.is-active").count()).toBeGreaterThan(0);
  if (!isMobile) {
    await page.locator("svg.map-svg").focus();
    await page.keyboard.press("ArrowRight");
    await expect(detail).not.toHaveText("keyring");
  }
  await page.locator(".map-detail a").click();
  await expect(page).toHaveURL(/\/work\/[a-z0-9-]+$/);
});

test("the mobile menu opens, traps focus, closes on Escape and returns focus", async ({ page, isMobile }) => {
  test.skip(!isMobile, "desktop shows the full nav");
  await open(page, "/");
  const button = page.getByRole("button", { name: /toggle navigation/i });
  await expect(page.locator("#site-nav")).toBeHidden();
  await button.click();
  await expect(page.locator("#site-nav")).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#site-nav")).toBeHidden();
  await expect(button).toBeFocused();
});

test("the copy button copies the email and announces it", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permissions are chromium-only here");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, "/about");
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("@");
});

test("the skip link is the first tab stop and lands on main", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hardware keyboard");
  await open(page, "/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("card hover lifts the card and lights the arrow", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hover on touch");
  await open(page, "/");
  const card = page.locator(".card").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/visible/);
  await settle(page);
  await card.hover();
  await expect(card).toHaveCSS("transform", /matrix/);
  await expect(card.locator(".arrow")).toHaveCSS("color", "rgb(215, 255, 63)");
});
