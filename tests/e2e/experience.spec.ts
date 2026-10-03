import { expect, type Locator, type Page, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { countFrames, framesDuring, open } from "./helpers";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const chrome = (page: Page) =>
  page.locator('meta[name="theme-color"]').evaluateAll((metas) => metas.map((m) => m.getAttribute("content")));
/** How far a map member has moved from its place: its transform, empty when it is at home. */
const offset = (node: Locator) => node.evaluate((el) => (el as HTMLElement).style.transform);
const DARK_BG = "rgb(8, 11, 7)";
const LIGHT_BG = "rgb(244, 244, 235)";

test.describe("themes", () => {
  test("follow the device on a first visit", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    await expect.poll(() => background(page)).toBe(LIGHT_BG);
    // The device changing its mind mid-visit is followed too, once the browser has restyled.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => background(page)).toBe(DARK_BG);
  });

  test("switch from the header, stay switched after a reload, and repaint the browser's chrome", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    await page.getByRole("button", { name: "Switch to the light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => background(page)).toBe(LIGHT_BG);
    expect(await chrome(page)).toEqual(["#f4f4eb", "#f4f4eb"]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Switch to the dark theme" })).toBeVisible();
    // The browser's own chrome keeps the chosen theme too, not the device's.
    expect(await chrome(page)).toEqual(["#f4f4eb", "#f4f4eb"]);
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
    expect(await chrome(page)).toEqual(["#f4f4eb", "#f4f4eb"]);
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
        page.locator(".map-pulse").evaluateAll((els) => els.some((e) => (e as HTMLElement).style.opacity === "1")),
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
    // A click may scroll the page; the drag below uses raw coordinates, so put the picture in the
    // middle of the screen, clear of the header.
    await page.locator(".map-stage").evaluate((stage) => stage.scrollIntoView({ block: "center" }));
    const node = page.locator(".map-node", { hasText: "memory" });
    const home = await offset(node);
    const box = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 50, { steps: 8 });
    await expect.poll(() => offset(node)).not.toBe(home);
    await page.mouse.up();
    await expect.poll(() => offset(node), { timeout: 5000 }).toBe(home);
  });

  test("stops drifting when paused, and starts again on play", async ({ page, isMobile }, info) => {
    test.skip(isMobile || !motion(info.project.name), "the picture shows on a wide screen with motion allowed");
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Pause the tour of the family" }).click();
    const node = page.locator(".map-node").last();
    const still = await offset(node);
    await page.waitForTimeout(400);
    expect(await offset(node)).toBe(still);
    await page.getByRole("button", { name: "Play the tour of the family" }).click();
    await expect.poll(() => offset(node)).not.toBe(still);
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

  test("moves neither itself nor what follows it as the entry beside it changes", async ({ page, isMobile }) => {
    test.skip(isMobile, "phone uses the list of members");
    // A still picture, so the only thing that changes from member to member is the entry.
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [800, 1024, 1150, 1200, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "/");
      await page.evaluate(() => document.fonts.ready);
      const positions = await page.evaluate(async () => {
        const top = (el: Element) => Math.round(el.getBoundingClientRect().top + window.scrollY);
        const stage = document.querySelector(".map-stage")!;
        const next = document.querySelector("#system + section")!;
        const seen = new Set<string>();
        for (const node of document.querySelectorAll(".map-node")) {
          node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          seen.add(`map at ${top(stage)}, next section at ${top(next)}`);
        }
        return [...seen];
      });
      expect(positions, `${width}px wide`).toHaveLength(1);
    }
  });

  test("stays on screen when motion is turned back on while the page is open", async ({ page, isMobile }) => {
    test.skip(isMobile, "phone uses the list of members");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/");
    const map = page.locator(".system-map");
    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveAttribute("data-revealed");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The map re-renders its own classes here; being revealed must survive that.
    await expect(map).toHaveClass(/can-move/);
    await expect(map).toHaveCSS("opacity", "1");
  });

  test("is a row of buttons on a phone, each explaining its member", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await open(page, "/");
    await expect(page.locator(".map-stage")).toBeHidden();
    const chips = page.locator(".map-chip");
    await expect(chips.first()).toBeVisible();
    await chips.filter({ hasText: "keyring" }).click();
    await expect(page.locator(".map-detail h3")).toHaveText("keyring");
    await expect(chips.filter({ hasText: "keyring" })).toHaveAttribute("aria-pressed", "true");
  });

  test("asks for no animation frames on a phone, where the picture is not drawn", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await countFrames(page);
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect(page.locator(".map-chip").first()).toBeVisible();
    await page.locator(".map-chip", { hasText: "memory" }).click();
    expect(await framesDuring(page, 1000)).toBe(0);
  });

  test("stops asking for animation frames once it is scrolled away", async ({ page, isMobile }, info) => {
    test.skip(isMobile || !motion(info.project.name), "the picture shows on a wide screen with motion allowed");
    await countFrames(page);
    await open(page, "/");
    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect.poll(() => framesDuring(page, 300)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    // A request being played back finishes first; then the members settle and the loop ends.
    await expect.poll(() => framesDuring(page, 300), { timeout: 10_000 }).toBe(0);
  });
});

test.describe("layout at the smallest width", () => {
  test("every page fits a 320px screen without sideways scrolling", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one narrow pass is enough");
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 320, height: 640 });
    const routes = ["/", "/work", "/about", "/404", ...site.projects.map((p) => `/work/${p.slug}`)];
    const tooWide: string[] = [];
    for (const route of routes) {
      await open(page, route);
      // The window clips sideways overflow as a safety net. Without the net, anything too wide shows.
      await page.addStyleTag({ content: "html { overflow-x: visible !important; }" });
      const offenders = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= width) return [];
        return [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > width + 0.5 && !el.closest(".ribbon-scroll"))
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}`);
      });
      if (offenders.length) tooWide.push(`${route}: ${offenders.join(", ")}`);
    }
    expect(tooWide).toEqual([]);
  });
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

  test("the first page loads under its budget, with nothing missing", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "one budget pass is enough");
    // The site's own files only: GitHub's API refusing the live-push request (rate limits do) is a
    // failure the page absorbs by design, not a missing file.
    const failed: string[] = [];
    let scriptBytes = 0;
    page.on("response", async (r) => {
      if (!r.url().startsWith(baseURL!)) return;
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
