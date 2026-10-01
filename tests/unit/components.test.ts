import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import ContributionGraph from "../../src/components/ContributionGraph.vue";
import CopyButton from "../../src/components/CopyButton.vue";
import LanguageMix from "../../src/components/LanguageMix.vue";
import ProjectCard from "../../src/components/ProjectCard.vue";
import { projects } from "../../src/data";
import { routes } from "../../src/routes";

const router = () => createRouter({ history: createMemoryHistory(), routes });

describe("ProjectCard", () => {
  it("links to the project page and names it for assistive tech", () => {
    const p = projects[0]!;
    const w = mount(ProjectCard, { props: { project: p }, global: { plugins: [router()] } });
    expect(w.attributes("href")).toBe(`/work/${p.slug}`);
    expect(w.attributes("aria-label")).toContain(p.name);
    expect(w.text()).toContain(p.tagline);
  });
  it("shows at most four stack tags, six when featured", () => {
    const p = { ...projects[0]!, stack: ["a", "b", "c", "d", "e", "f", "g"] };
    expect(mount(ProjectCard, { props: { project: p }, global: { plugins: [router()] } }).findAll(".tag")).toHaveLength(
      4,
    );
    expect(
      mount(ProjectCard, { props: { project: p, featured: true }, global: { plugins: [router()] } }).findAll(".tag"),
    ).toHaveLength(6);
  });
});

describe("CopyButton", () => {
  it("copies and announces, then returns to its label", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const w = mount(CopyButton, { props: { text: "hello@example.com" } });
    await w.find("button").trigger("click");
    await vi.waitFor(() => expect(w.find("button").text()).toBe("Copied"));
    expect(writeText).toHaveBeenCalledWith("hello@example.com");
    expect(w.find("[role=status]").text()).toContain("Copied");
    vi.advanceTimersByTime(1500);
    await w.vm.$nextTick();
    expect(w.find("button").text()).toBe("Copy");
    vi.useRealTimers();
  });
  it("says so when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("no")) },
      configurable: true,
    });
    const w = mount(CopyButton, { props: { text: "x" } });
    await w.find("button").trigger("click");
    await vi.waitFor(() => expect(w.find("button").text()).toBe("Copy failed"));
  });
});

describe("ContributionGraph", () => {
  const days: [string, number][] = [];
  const start = Date.UTC(2025, 9, 1);
  for (let i = 0; i < 365; i += 1) {
    days.push([new Date(start + i * 86400000).toISOString().slice(0, 10), i % 7 === 0 ? 0 : (i % 9) + 1]);
  }
  it("draws one cell per day with an accessible summary", () => {
    const w = mount(ContributionGraph, { props: { days, total: 1234 } });
    expect(w.findAll("rect")).toHaveLength(365);
    expect(w.find("svg").attributes("aria-label")).toContain("1234 contributions");
    expect(w.find("svg").attributes("aria-label")).toContain("active days");
  });
  it("describes a hovered day in the live region", async () => {
    const w = mount(ContributionGraph, { props: { days, total: 1 } });
    await w.findAll("rect")[1]!.trigger("pointerenter");
    expect(w.find("[role=status]").text()).toMatch(/contribution/);
    expect(w.find("[role=status]").text()).toContain("2025");
  });
});

describe("LanguageMix", () => {
  it("folds everything past six into Other", () => {
    const languages = Array.from({ length: 9 }, (_, i) => ({ name: `L${i}`, share: 0.1 + (i === 0 ? 0.1 : 0) }));
    const w = mount(LanguageMix, { props: { languages } });
    const names = w.findAll(".langs-name").map((n) => n.text());
    expect(names).toHaveLength(7);
    expect(names.at(-1)).toBe("Other");
  });
});
