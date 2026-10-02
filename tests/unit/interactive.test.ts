// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { fetchLatestPush } from "../../src/activity";
import CommandPalette from "../../src/components/CommandPalette.vue";
import SiteHeader from "../../src/components/SiteHeader.vue";
import SystemMap from "../../src/components/SystemMap.vue";
import ThemeToggle from "../../src/components/ThemeToggle.vue";
import { compact, lucyFamily, type Profile, profile, projects, shortDate, site } from "../../src/data";
import { buildItems, paletteOpen, textsOf } from "../../src/palette";
import { routes } from "../../src/routes";
import { applyTheme, currentTheme, THEME_COLOR, THEME_KEY, theme } from "../../src/theme";

// Navigation is what is under test here, not the pages, so each route renders a stub: loading the
// real views on demand is slow on a busy machine and says nothing about the palette or the header.
const Stub = { template: "<div />" };
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: routes.map((r) => ({ path: r.path, name: r.name, component: Stub })),
  });

/** happy-dom's matchMedia answers false for everything; this answers true for the queries given. */
function media(matching: string[]) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.className = "js";
  document.head.innerHTML = '<meta name="theme-color" content="#000"><meta name="theme-color" content="#111">';
  localStorage.clear();
  theme.value = null;
  paletteOpen.value = false;
  media([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("theme", () => {
  it("follows the device until a visitor chooses", () => {
    expect(currentTheme()).toBe("dark");
    media(["(prefers-color-scheme: light)"]);
    expect(currentTheme()).toBe("light");
    document.documentElement.dataset.theme = "dark";
    expect(currentTheme()).toBe("dark");
  });
  it("shows a choice, remembers it, and repaints the browser's chrome", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(theme.value).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      expect(meta.content).toBe(THEME_COLOR.light);
    }
  });
  it("still switches when storage is refused", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => applyTheme("dark")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("ThemeToggle", () => {
  it("names the theme it would switch to once it knows which is showing", async () => {
    const w = mount(ThemeToggle);
    await nextTick();
    expect(w.find("button").attributes("aria-label")).toBe("Switch to the light theme");
  });
  it("switches at once when motion is off", async () => {
    const w = mount(ThemeToggle);
    await w.find("button").trigger("click");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(w.find("button").attributes("aria-label")).toBe("Switch to the dark theme");
  });
  it("opens the new theme from the button through a view transition when motion is on", async () => {
    document.documentElement.classList.add("motion");
    let finish = () => {};
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: new Promise<void>((resolve) => (finish = resolve)) };
    });
    Object.defineProperty(document, "startViewTransition", { value: startViewTransition, configurable: true });
    const w = mount(ThemeToggle);
    await w.find("button").trigger("click", { clientX: 40, clientY: 20 });
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains("theme-wipe")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--wipe-x")).toBe("40px");
    finish();
    await flushPromises();
    expect(document.documentElement.classList.contains("theme-wipe")).toBe(false);
    // @ts-expect-error removing the stub
    delete document.startViewTransition;
  });
});

describe("palette items", () => {
  const items = buildItems(projects, profile as Profile);
  it("offers every page, every shown project and the actions", () => {
    expect(items.filter((i) => i.kind === "page").map((i) => i.to)).toEqual(["/", "/work", "/about"]);
    expect(items.filter((i) => i.kind === "project")).toHaveLength(projects.length);
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(["action-theme", "action-copy-email", "link-email"]));
  });
  it("offers LinkedIn only when the profile has it", () => {
    expect(items.some((i) => i.id === "link-linkedin")).toBe(Boolean(profile.linkedin));
    const { linkedin: _linkedin, ...without } = profile as Profile;
    expect(buildItems(projects, without as Profile).some((i) => i.id === "link-linkedin")).toBe(false);
  });
  it("matches a project on its name first, then its stack and family, then its tagline", () => {
    const lucy = items.find((i) => i.id === `project-${lucyFamily[0]!.slug}`)!;
    const texts = textsOf(lucy);
    expect(texts[0]).toBe(lucy.label);
    expect(texts.at(-1)).toBe(lucy.hint);
    expect(texts).not.toContain("");
  });
});

describe("CommandPalette", () => {
  async function openPalette() {
    const router = makeRouter();
    await router.push("/");
    const w = mount(CommandPalette, { global: { plugins: [router] }, attachTo: document.body });
    paletteOpen.value = true;
    await flushPromises();
    return { w, router };
  }

  it("opens as a modal with the search box focused, and lists where to go with nothing typed", async () => {
    const { w } = await openPalette();
    const dialog = w.find("dialog").element as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(w.find("input").element);
    const labels = w.findAll("[role=option] .palette-label").map((o) => o.text());
    expect(labels.slice(0, 3)).toEqual(["Home", "Work", "About"]);
    w.unmount();
  });
  it("narrows as you type, best match first, and says how many", async () => {
    const { w } = await openPalette();
    const target = projects.find((p) => p.featured)!;
    await w.find("input").setValue(target.name);
    expect(w.findAll("[role=option] .palette-label")[0]!.text()).toBe(target.name);
    expect(w.find("[role=status]").text()).toMatch(/\d+ results?/);
    await w.find("input").setValue("zzzz-nothing-zzzz");
    expect(w.find(".palette-empty").text()).toContain("zzzz-nothing-zzzz");
    expect(w.find("[role=status]").text()).toBe("Nothing matches");
    w.unmount();
  });
  it("moves with the arrow keys, wrapping, and points the combobox at the active option", async () => {
    const { w } = await openPalette();
    const input = w.find("input");
    const count = w.findAll("[role=option]").length;
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(input.attributes("aria-activedescendant")).toBe("palette-page-work");
    await input.trigger("keydown", { key: "ArrowUp" });
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(w.findAll("[role=option]")[count - 1]!.attributes("aria-selected")).toBe("true");
    await input.trigger("keydown", { key: "Home" });
    expect(input.attributes("aria-activedescendant")).toBe("palette-page-home");
    await input.trigger("keydown", { key: "End" });
    expect(w.findAll("[role=option]")[count - 1]!.attributes("aria-selected")).toBe("true");
    await input.trigger("keydown", { key: "x" });
    expect(w.findAll("[role=option]")[count - 1]!.attributes("aria-selected")).toBe("true");
    w.unmount();
  });
  it("goes to the chosen page with Enter and closes", async () => {
    const { w, router } = await openPalette();
    await w.find("input").setValue("about");
    await w.find("input").trigger("keydown", { key: "Enter" });
    // The page is loaded on first visit, so the route changes once its code has arrived.
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/about"));
    expect(paletteOpen.value).toBe(false);
    expect((w.find("dialog").element as HTMLDialogElement).open).toBe(false);
    w.unmount();
  });
  it("runs an action: switching the theme, copying the email", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { w } = await openPalette();
    await w.find("#palette-action-theme").trigger("click");
    expect(document.documentElement.dataset.theme).toBe("light");
    paletteOpen.value = true;
    await flushPromises();
    await w.find("#palette-action-copy-email").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(profile.email);
    w.unmount();
  });
  it("opens an outside link in a new tab, safely, and mail in the mail app", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const { w } = await openPalette();
    await w.find("#palette-link-github").trigger("click");
    expect(open).toHaveBeenCalledWith(profile.github, "_blank", "noopener,noreferrer");
    w.unmount();
  });
  it("closes on a click on the backdrop, but not on one inside the box", async () => {
    const { w } = await openPalette();
    await w.find(".palette-box").trigger("click");
    expect(paletteOpen.value).toBe(true);
    await w.find("dialog").trigger("click");
    expect(paletteOpen.value).toBe(false);
    w.unmount();
  });
  it("follows the dialog closing on its own, as it does on Escape", async () => {
    const { w } = await openPalette();
    await w.find("dialog").trigger("close");
    expect(paletteOpen.value).toBe(false);
    w.unmount();
  });
});

describe("SiteHeader", () => {
  it("opens the palette from its search button and closes the menu while doing so", async () => {
    const router = makeRouter();
    await router.push("/work");
    const w = mount(SiteHeader, { global: { plugins: [router] }, attachTo: document.body });
    await w.find(".menu-button").trigger("click");
    expect(w.find(".site-nav").classes()).toContain("open");
    await w.find(".palette-button").trigger("click");
    expect(paletteOpen.value).toBe(true);
    expect(w.find(".site-nav").classes()).not.toContain("open");
    expect(w.find('nav a[aria-current="page"]').text()).toBe("Work");
    w.unmount();
  });
  it("shows the shortcut a Mac uses on a Mac", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const router = makeRouter();
    await router.push("/");
    const w = mount(SiteHeader, { global: { plugins: [router] } });
    await nextTick();
    expect(w.find(".palette-button kbd").text()).toBe("⌘ K");
    w.unmount();
  });
});

describe("SystemMap", () => {
  const mountMap = async () => {
    media(["(prefers-reduced-motion: reduce)"]);
    const router = makeRouter();
    await router.push("/");
    return mount(SystemMap, { global: { plugins: [router] }, attachTo: document.body });
  };

  it("draws every family member once, the hub first and active", async () => {
    const w = await mountMap();
    expect(w.findAll(".map-node")).toHaveLength(lucyFamily.length);
    expect(w.find(".map-node.is-active").attributes("aria-label")).toMatch(/^LUCY/);
    expect(w.findAll(".map-chip")).toHaveLength(lucyFamily.length);
    w.unmount();
  });
  it("explains what the chosen member does, step by step", async () => {
    const w = await mountMap();
    const keyring = lucyFamily.find((p) => p.role === "vault")!;
    await w
      .findAll(".map-chip")
      .find((c) => c.text() === keyring.name)!
      .trigger("click");
    expect(w.find(".map-detail h3").text()).toBe(keyring.name);
    expect(w.findAll(".map-trace li").length).toBeGreaterThan(1);
    expect(w.find(".map-detail a").attributes("href")).toBe(`/work/${keyring.slug}`);
    w.unmount();
  });
  it("moves between members with the arrow keys, wrapping round", async () => {
    const w = await mountMap();
    const svg = w.find("svg.map-svg");
    await svg.trigger("keydown", { key: "ArrowLeft" });
    expect(w.find(".map-detail h3").text()).toBe(w.findAll(".map-chip").at(-1)!.text());
    await svg.trigger("keydown", { key: "ArrowRight" });
    expect(w.find(".map-detail h3").text()).toBe("LUCY");
    await svg.trigger("keydown", { key: "ArrowDown" });
    await svg.trigger("keydown", { key: "ArrowUp" });
    await svg.trigger("keydown", { key: "Enter" });
    expect(w.find(".map-detail h3").text()).toBe("LUCY");
    w.unmount();
  });
  it("stays still, with no tour to pause, when motion is reduced", async () => {
    const w = await mountMap();
    expect(w.find(".system-map").classes()).not.toContain("can-move");
    expect(w.find(".map-play").exists()).toBe(false);
    w.unmount();
  });
});

describe("activity: the newest public push", () => {
  const event = (type: string, repo: string, at: string) => ({
    type,
    repo: { name: `tochi-mba/${repo}` },
    created_at: at,
  });
  it("names the newest push into a repository the site may name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          event("WatchEvent", "shown", "2026-10-01T12:00:00Z"),
          event("PushEvent", "hidden", "2026-10-01T11:00:00Z"),
          event("PushEvent", "shown", "2026-10-01T10:00:00Z"),
        ]),
      ),
    );
    expect(await fetchLatestPush("tochi-mba", new Set(["shown"]))).toEqual({
      repo: "shown",
      at: "2026-10-01T10:00:00Z",
    });
  });
  it("reads a repository name given without its owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ type: "PushEvent", repo: { name: "shown" }, created_at: "t" }])),
    );
    expect(await fetchLatestPush("tochi-mba", new Set(["shown"]))).toEqual({ repo: "shown", at: "t" });
  });
  it("is null when nothing qualifies, GitHub refuses, or the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([event("PushEvent", "hidden", "t")])),
    );
    expect(await fetchLatestPush("tochi-mba", new Set(["shown"]))).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );
    expect(await fetchLatestPush("tochi-mba", new Set(["shown"]))).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    expect(await fetchLatestPush("tochi-mba", new Set(["shown"]))).toBeNull();
  });
});

describe("dates and counts", () => {
  it("leaves the year out for the year the site was built and puts it in for another", () => {
    const built = new Date(site.generatedAt).getUTCFullYear();
    expect(shortDate(`${built}-03-04T00:00:00Z`)).toBe("4 Mar");
    expect(shortDate("2019-03-04T00:00:00Z")).toBe("4 Mar 2019");
  });
  it("shortens big counts", () => {
    expect(compact(12_400)).toBe("12k");
  });
});
