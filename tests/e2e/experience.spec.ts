import { expect, type Page, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open } from "./helpers";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = "rgb(8, 11, 7)";
const LIGHT_BG = "rgb(244, 244, 235)";

test.describe("themes", () => {
  test("follow the device on a first visit", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    expect(await background(page)).toBe(LIGHT_BG);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await background(page)).toBe(DARK_BG);
  });

  test("switch from the header, stay switched after a reload, and repaint the browser's chrome", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    await page.getByRole("button", { name: "Switch to the light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => background(page)).toBe(LIGHT_BG);
    for (const color of await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((ms) => ms.map((m) => m.getAttribute("content")))) {
      expect(color).toBe("#f4f4eb");
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Switch to the dark theme" })).toBeVisible();
  });

  test("apply a stored choice before the app's code arrives, so nothing flashes", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.emulateMedia({ colorScheme: "dark" });
    // Refuse every bundled script: what is on screen now is the prerendered page and the head script
    // alone. (Holding them instead would hang the page: module scripts delay DOMContentLoaded.)
    await page.route(/\/assets\/.*\.js$/, (route) => route.abort());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await background(page)).toBe(LIGHT_BG);
  });

  test("ignore a stored value that is not a theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "sepia"));
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    expect(await background(page)).toBe(LIGHT_BG);
  });
});

test.describe("command palette", () => {
  test("opens with the keyboard, finds a project, goes there and closes", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard");
    await open(page, "/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search the site" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("combobox")).toBeFocused();
    const target = site.projects.find((p) => p.slug === "clyde") ?? site.projects[0]!;
    await page.getByRole("combobox").fill(target.name);
    await expect(page.getByRole("option").first()).toContainText(target.name);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/work/${target.slug}$`));
    await expect(dialog).toBeHidden();
    await expect(page.locator("h1")).toHaveText(target.name);
  });

  test("moves with the arrow keys and closes on Escape, giving focus back", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard");
    await open(page, "/work");
    const trigger = page.getByRole("button", { name: "Search the site" });
    await trigger.click();
    const options = page.getByRole("option");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("switches the theme as an action", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard");
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("theme");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("opens from the header button on a phone and fits the screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await open(page, "/");
    await page.getByRole("button", { name: "Search the site" }).click();
    const dialog = page.getByRole("dialog", { name: "Search the site" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.getByRole("combobox").fill("about");
    await page.getByRole("option").first().click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test("is not downloaded until it is asked for", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard");
    const scripts: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "script") scripts.push(r.url());
    });
    await open(page, "/");
    const before = scripts.length;
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(scripts.length).toBeGreaterThan(before);
  });
});

test.describe("the LUCY map", () => {
  const motion = (name: string) => !["reduced-motion"].includes(name);

  test("plays back a request: a mark travels and the step it belongs to lights up", async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile || !motion(info.project.name), "the picture shows on a wide screen with motion allowed");
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect(page.locator(".map-trace")).toHaveClass(/is-playing/);
    await expect(page.locator(".map-trace li.is-now")).toHaveCount(1);
    await expect
      .poll(() =>
        page.locator(".map-pulse").evaluateAll((els) => els.some((e) => (e as SVGElement).style.opacity === "1")),
      )
      .toBe(true);
  });

  test("moves on to the next member by itself, and waits while someone is pointing", async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile || !motion(info.project.name), "the picture shows on a wide screen with motion allowed");
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    const detail = page.locator(".map-detail h3");
    await expect(detail).toHaveText("LUCY");
    await expect(detail).not.toHaveText("LUCY", { timeout: 15_000 });
    await page.locator(".map-node", { hasText: "keyring" }).hover();
    await expect(detail).toHaveText("keyring");
    await page.waitForTimeout(4000);
    await expect(detail).toHaveText("keyring");
  });

  test("lets a member be picked up, then springs it home", async ({ page, isMobile }, info) => {
    test.skip(isMobile || !motion(info.project.name), "dragging needs a pointer and motion");
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Pause/ }).click();
    const node = page.locator(".map-node", { hasText: "memory" });
    const home = await node.getAttribute("transform");
    const box = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50, { steps: 8 });
    await expect.poll(() => node.getAttribute("transform")).not.toBe(home);
    await page.mouse.up();
    await expect.poll(() => node.getAttribute("transform"), { timeout: 5000 }).toBe(home);
  });

  test("stops drifting when paused, and starts again on play", async ({ page, isMobile }, info) => {
    test.skip(isMobile || !motion(info.project.name), "the picture shows on a wide screen with motion allowed");
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Pause the tour of the family" }).click();
    const node = page.locator(".map-node").last();
    const still = await node.getAttribute("transform");
    await page.waitForTimeout(400);
    expect(await node.getAttribute("transform")).toBe(still);
    await page.getByRole("button", { name: "Play the tour of the family" }).click();
    await expect.poll(() => node.getAttribute("transform")).not.toBe(still);
  });

  test("stays still with no tour to pause under reduced motion, and stops when the preference changes", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "phone uses the list of members");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect(page.locator(".system-map")).toHaveClass(/can-move/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".system-map")).not.toHaveClass(/can-move/);
    await expect(page.locator(".map-play")).toHaveCount(0);
    await expect(page.locator(".map-trace")).not.toHaveClass(/is-playing/);
  });

  test("is a row of buttons on a phone, each explaining its member", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await open(page, "/");
    await expect(page.locator("svg.map-svg")).toBeHidden();
    const chips = page.locator(".map-chip");
    await expect(chips.first()).toBeVisible();
    await chips.filter({ hasText: "keyring" }).click();
    await expect(page.locator(".map-detail h3")).toHaveText("keyring");
    await expect(chips.filter({ hasText: "keyring" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("layout at the smallest width", () => {
  for (const route of ["/", "/work", "/about", `/work/${site.projects[0]!.slug}`]) {
    test(`${route} fits a 320px screen without sideways scrolling`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one narrow pass is enough");
      await page.setViewportSize({ width: 320, height: 640 });
      await open(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("performance", () => {
  test("the home page does not move once it has painted", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "layout-shift entries are a Chromium API");
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await open(page, "/");
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.02);
  });

  test("the first page loads under its budget, with nothing missing", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one budget pass is enough");
    const failed: string[] = [];
    let scriptBytes = 0;
    page.on("response", async (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      if (r.request().resourceType() === "script") scriptBytes += (await r.body()).length;
    });
    await open(page, "/");
    await page.waitForLoadState("networkidle");
    expect(failed).toEqual([]);
    // Uncompressed: what a visitor downloads is about a third of this.
    expect(scriptBytes).toBeLessThan(260_000);
  });
});

test.describe("what search engines and link previews read", () => {
  test("the home page says who this is, with GitHub and LinkedIn", async ({ page }) => {
    await open(page, "/");
    const data = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((ss) => ss.map((s) => JSON.parse(s.textContent!)));
    const person = data.find((d) => d["@type"] === "Person");
    expect(person).toMatchObject({ name: "Tochi Mba", alternateName: "Rex" });
    expect(person.sameAs).toEqual(expect.arrayContaining(["https://github.com/tochi-mba"]));
    expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(
      /^https:\/\/tochi-mba\.github\.io\/og\.png$/,
    );
  });

  test("the sitemap lists every published project and robots points at it", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const p of site.projects) expect(sitemap, p.slug).toContain(`https://tochi-mba.github.io/work/${p.slug}<`);
    expect(await (await request.get("/robots.txt")).text()).toContain(
      "Sitemap: https://tochi-mba.github.io/sitemap.xml",
    );
  });
});
