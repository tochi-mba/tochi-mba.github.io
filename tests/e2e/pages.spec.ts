import { expect, test } from "@playwright/test";
import site from "../../src/generated/site-data.json" with { type: "json" };
import { open } from "./helpers";

const routes = ["/", "/work", "/about", ...site.projects.slice(0, 6).map((p) => `/work/${p.slug}`)];

for (const route of routes) {
  test(`${route} is a complete, well-formed page`, async ({ page }) => {
    const response = await open(page, route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/Tochi Mba/);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(
      /^https:\/\/tochi-mba\.github\.io\//,
    );
    await expect(page.locator("header .brand")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    // No horizontal scroll at any width: the page never overflows its viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the home page is prerendered: content exists before JavaScript runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Agent systems");
  await expect(page.locator(".card").first()).toBeVisible();
  await expect(page.locator(".principle").first()).toBeVisible();
  await context.close();
});

test("navigation marks the current page and moves focus to the heading", async ({ page, isMobile }) => {
  await open(page, "/");
  await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Home");
  if (isMobile) await page.getByRole("button", { name: /toggle navigation/i }).click();
  await page.getByRole("link", { name: "Work", exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Work");
  await expect(page.locator("h1")).toBeFocused();
});

test("an unknown address gets the 404 page with a way back", async ({ page }) => {
  await open(page, "/404");
  await expect(page.locator("h1")).toContainText("Nothing lives");
  await page.getByRole("link", { name: /all projects/i }).click();
  await expect(page).toHaveURL(/\/work$/);
});

test("a project page links out safely and offers next and previous", async ({ page }) => {
  const p = site.projects.find((x) => x.links.site && x.links.source)!;
  await open(page, `/work/${p.slug}`);
  await expect(page.locator("h1")).toHaveText(p.name);
  for (const a of await page.locator('aside a[target="_blank"]').all()) {
    expect(await a.getAttribute("rel")).toBe("noopener noreferrer");
  }
  await page.getByRole("link", { name: /next/i }).click();
  await expect(page).toHaveURL(/\/work\/[a-z0-9-]+$/);
  await expect(page.locator("h1")).toBeFocused();
});

test("a private project shows no links at all", async ({ page }) => {
  const p = site.projects.find((x) => x.visibility === "private")!;
  await open(page, `/work/${p.slug}`);
  await expect(page.locator("h1")).toHaveText(p.name);
  await expect(page.locator("aside a")).toHaveCount(0);
  await expect(page.getByText("Private repository")).toBeVisible();
});

test("the metadata schema is published for other repositories", async ({ request }) => {
  const res = await request.get("/schema/project.schema.json");
  expect(res.ok()).toBe(true);
  const schema = await res.json();
  expect(schema.properties.display).toBeDefined();
  expect(schema.properties.publicSafe).toBeDefined();
});
