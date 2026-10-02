import { expect, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open } from "./helpers";

const shown = site.projects.length;
const cards = (page: import("@playwright/test").Page) => page.locator(".work-item");

test("shows flagships first and the archive folded away", async ({ page }) => {
  await open(page, "/work");
  const flagships = site.projects.filter((p) => p.featured).map((p) => p.name);
  await expect(page.locator(".work-flagships .case-name")).toHaveText(flagships);
  await expect(page.locator(".archive-fold")).not.toHaveAttribute("open", "");
  await expect(page.locator(".archive-fold .work-item").first()).toBeHidden();
  await page.locator(".archive-fold summary").click();
  await expect(page.locator(".archive-fold .work-item").first()).toBeVisible();
});

test("shows every project, then filters by category and writes it to the URL", async ({ page }) => {
  await open(page, "/work");
  await expect(cards(page)).toHaveCount(shown);
  await expect(page.locator(".results-line[role=status]")).toContainText(`${shown} projects`);

  await page.getByRole("button", { name: /^Services/ }).click();
  const services = site.projects.filter((p) => p.category === "service").length;
  await expect(page).toHaveURL(/category=service/);
  await expect(cards(page)).toHaveCount(services);
  await expect(page.getByRole("button", { name: /^Services/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".results-line[role=status]")).toContainText(`in Services`);

  // The back button undoes a filter, because the filter lives in the URL.
  await page.goBack();
  await expect(page).not.toHaveURL(/category=/);
  await expect(cards(page)).toHaveCount(shown);
});

test("a shared URL opens already filtered", async ({ page }) => {
  await open(page, "/work?category=product&q=fire");
  await expect(page.getByRole("button", { name: /^Products/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".search input")).toHaveValue("fire");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator(".work-item .case-name")).toHaveText("Flint");
});

test("search matches stack and family, shows an empty state, and clears", async ({ page }) => {
  await open(page, "/work");
  const input = page.locator(".search input");
  await input.fill("fastapi");
  await expect(page).toHaveURL(/q=fastapi/);
  const fastapi = site.projects.filter((p) => p.stack.some((s) => /fastapi/i.test(s))).length;
  await expect(cards(page)).toHaveCount(fastapi);

  await input.fill("zzzz-nothing");
  await expect(page.locator(".empty")).toBeVisible();
  await expect(page.locator(".results-line[role=status]")).toContainText("Nothing matches");
  await page.getByRole("button", { name: /clear filters/i }).click();
  await expect(cards(page)).toHaveCount(shown);
  await expect(input).toBeFocused();
});

test("keyboard: / focuses search, Escape clears it, arrows move between chips", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hardware keyboard");
  await open(page, "/work");
  await page.keyboard.press("/");
  const input = page.locator(".search input");
  await expect(input).toBeFocused();
  await input.fill("lucy");
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("");
  await expect(page).not.toHaveURL(/q=/);

  await page.getByRole("button", { name: /^All/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: /^Products/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: /^Early work/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/category=early/);
  await expect(page.locator(".archive-fold")).toHaveAttribute("open", "");
  await expect(page.locator(".archive-fold .work-item")).toHaveCount(
    site.projects.filter((p) => p.category === "early").length,
  );
});

test("links only into repositories the portfolio publishes, and says which projects are private", async ({ page }) => {
  await open(page, "/work");
  await page.locator(".archive-fold summary").click();
  const published = new Set([
    ...site.projects.filter((p) => p.visibility === "public").map((p) => (p as { repo: string }).repo.toLowerCase()),
    "tochi-mba.github.io",
  ]);
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  for (const href of hrefs) {
    const match = /^https:\/\/github\.com\/tochi-mba\/([^/?#]+)/i.exec(href);
    if (match) expect(published.has(match[1]!.toLowerCase()), href).toBe(true);
  }
  expect(site.projects.some((p) => p.visibility === "private")).toBe(true);
  await expect(page.getByText(/private repositor(y|ies): shown in their own words/)).toBeVisible();
});

test("every published project has its own prerendered page, and nothing else does", async ({ request, page }) => {
  const decode = (html: string) =>
    html
      .replace(/<[^>]+>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim();
  for (const p of site.projects) {
    const res = await request.get(`/work/${p.slug}`);
    expect(res.status(), p.slug).toBe(200);
    // The heading is in the HTML itself: the page exists before any JavaScript runs.
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(await res.text())?.[1] ?? "";
    expect(decode(h1), p.slug).toBe(p.name);
  }
  const res = await page.goto("/work/not-a-published-project");
  // GitHub Pages would serve 404.html; the preview server serves the app, which routes to the 404 view.
  expect([200, 404]).toContain(res?.status());
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await expect(page.locator("h1")).toContainText("Nothing lives");
});
