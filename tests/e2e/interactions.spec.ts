import { expect, test } from "@playwright/test";
import type { ShipEvent } from "../../src/data";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open, settle } from "./helpers";

// The generated file's inferred type depends on the data fetched at build time; this is its contract.
const shipping = site.shipping as unknown as ShipEvent[];

test("the header earns its border on scroll", async ({ page }) => {
  await open(page, "/");
  const header = page.locator("header.site-header");
  await expect(header).not.toHaveClass(/scrolled/);
  // Scroll the page itself: a phone has no mouse wheel, and WebKit on a phone refuses to fake one.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(header).toHaveClass(/scrolled/);
});

test("rows reveal as they scroll into view, and stay revealed", async ({ page }) => {
  await open(page, "/");
  const motion = await page.evaluate(() => document.documentElement.classList.contains("motion"));
  test.skip(!motion, "reduced motion: nothing to reveal");
  const last = page.locator(".case").last();
  await expect(last).not.toHaveClass(/visible/);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveClass(/visible/);
  await expect(last).toHaveCSS("opacity", "1");
});

test("reduced motion: everything is visible at once, nothing animates, no animation code loads", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  await expect(page.locator("html")).not.toHaveClass(/motion/);
  await expect(page.locator(".case").last()).toHaveCSS("opacity", "1");
  if (shipping.length) {
    const mark = page.locator(".ribbon .tick .mark").first();
    await expect(mark).toHaveCSS("opacity", "1");
    expect(await mark.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  }
  expect(await page.evaluate(() => "gsap" in window)).toBe(false);
});

test("the build log draws every event and moves with the keyboard", async ({ page, isMobile }) => {
  test.skip(!shipping.length, "no shipping data in this build");
  await open(page, "/");
  const ticks = page.locator(".ribbon a.tick");
  await expect(ticks).toHaveCount(shipping.length);
  const caption = page.locator(".ribbon-now strong");
  await expect(caption).toHaveText(shipping[0]!.title);
  await expect(page.locator('.ribbon a.tick[tabindex="0"]')).toHaveCount(1);
  if (!isMobile && shipping.length > 1) {
    await page.locator('.ribbon a.tick[tabindex="0"]').focus();
    await page.keyboard.press("ArrowLeft");
    await expect(caption).toHaveText(shipping[1]!.title);
    await expect(page.locator(".ribbon a.tick").nth(shipping.length - 2)).toBeFocused();
  }
});

test("the LUCY map responds to hover, click and arrow keys", async ({ page, isMobile }) => {
  await open(page, "/");
  const detail = page.locator(".map-detail h3");
  await expect(detail).toHaveText("LUCY");
  await page.locator(isMobile ? ".map-chip" : ".map-node", { hasText: "keyring" }).click();
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
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toHaveCount(1);
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

test("a case study row underlines its name in the theme signal on hover", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hover on touch");
  await open(page, "/");
  const row = page.locator(".case").first();
  await row.scrollIntoViewIfNeeded();
  // The row rises into place as it reveals; hovering before it has finished would lose the pointer.
  await expect(row).toHaveClass(/visible/);
  await settle(page);
  await expect(row).toHaveCSS("opacity", "1");
  await expect(row).toHaveCSS("translate", "none");
  const name = row.locator(".case-name a");
  await name.hover();
  const signal = await name.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--signal)";
    el.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(name).toHaveCSS("text-decoration-color", signal);
});
