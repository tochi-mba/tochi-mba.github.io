import { expect, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open } from "./helpers";

const shown = site.projects.length;
const cards = (page: import("@playwright/test").Page) => page.locator(".grid .card, .archive li");

test("shows every project, then filters by category and writes it to the URL", async ({ page }) => {
  await open(page, "/work");
  await expect(cards(page)).toHaveCount(shown);
  await expect(page.getByRole("status")).toContainText(`${shown} projects`);

  await page.getByRole("button", { name: /^Services/ }).click();
  const services = site.projects.filter((p) => p.category === "service").length;
  await expect(page).toHaveURL(/category=service/);
  await expect(cards(page)).toHaveCount(services);
  await expect(page.getByRole("button", { name: /^Services/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText(`in Services`);

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
  await expect(page.locator(".card h3")).toHaveText("Flint");
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
  await expect(page.getByRole("status")).toContainText("Nothing matches");
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
  await expect(page.locator(".archive li")).toHaveCount(site.projects.filter((p) => p.category === "early").length);
});

test("private projects are listed by name but never linked", async ({ page }) => {
  await open(page, "/work");
  const privateRepos = site.projects.filter((p) => p.visibility === "private").map((p) => p.repo);
  expect(privateRepos.length).toBeGreaterThan(0);
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  for (const repo of privateRepos) {
    expect(
      hrefs.some((h) => h.toLowerCase().includes(`github.com/tochi-mba/${repo.toLowerCase()}`)),
      repo,
    ).toBe(false);
  }
  await expect(page.getByText(/private repositories: shown by name/)).toBeVisible();
});

test("the opted-out repository appears nowhere", async ({ page }) => {
  await open(page, "/work");
  await expect(page.getByText("Media-tool")).toHaveCount(0);
  const res = await page.goto("/work/media-tool");
  // GitHub Pages would serve 404.html; the preview server serves the SPA shell, which routes to the 404 view.
  expect([200, 404]).toContain(res?.status());
  await expect(page.locator("h1")).toContainText("Nothing lives");
});
