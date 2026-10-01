import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import CaseStudyRow from "../../src/components/CaseStudyRow.vue";
import ContributionGraph from "../../src/components/ContributionGraph.vue";
import CopyButton from "../../src/components/CopyButton.vue";
import LanguageMix from "../../src/components/LanguageMix.vue";
import ProofChips from "../../src/components/ProofChips.vue";
import ShippingRibbon from "../../src/components/ShippingRibbon.vue";
import { type Lane, type Project, projects, type ShipEvent } from "../../src/data";
import { routes } from "../../src/routes";

const router = () => createRouter({ history: createMemoryHistory(), routes });
const withRouter = { global: { plugins: [router()] } };

const base = projects.find((p) => p.links.site && p.links.source)!;
const withProof = (proof: Project["proof"], extra: Partial<Project> = {}): Project => ({ ...base, ...extra, proof });

describe("CaseStudyRow", () => {
  it("links its name to the project page and shows what it is", () => {
    const w = mount(CaseStudyRow, { props: { project: base }, ...withRouter });
    expect(w.find(".case-name a").attributes("href")).toBe(`/work/${base.slug}`);
    expect(w.text()).toContain(base.tagline);
  });
  it("links the project's own site and source, safely", () => {
    const w = mount(CaseStudyRow, { props: { project: base }, ...withRouter });
    const site = w.findAll("a").find((a) => a.attributes("href") === base.links.site);
    expect(site?.text()).toContain("Website");
    for (const a of w.findAll('a[target="_blank"]')) expect(a.attributes("rel")).toBe("noopener noreferrer");
  });
  it("offers a copyable install command for a published package", () => {
    const p = { ...base, packages: { npm: ["weftai"], pypi: [] } };
    const w = mount(CaseStudyRow, { props: { project: p }, ...withRouter });
    expect(w.find(".copy-button").text()).toBe("npm i weftai");
  });
  it("leaves highlights out when compact", () => {
    const p = { ...base, highlights: ["one", "two"] };
    expect(mount(CaseStudyRow, { props: { project: p }, ...withRouter }).findAll(".case-highlights li")).toHaveLength(
      2,
    );
    expect(
      mount(CaseStudyRow, { props: { project: p, compact: true }, ...withRouter })
        .find(".case-highlights")
        .exists(),
    ).toBe(false);
  });
});

describe("ProofChips", () => {
  const release = {
    tag: "v2.3.3",
    words: "Site and docs",
    at: "2026-10-01T17:37:00Z",
    url: "https://github.com/x/y/releases/tag/v2.3.3",
    count: 23,
    prerelease: false,
    assets: 4,
    downloads: 40,
  };
  it("renders nothing without fetched proof", () => {
    expect(
      mount(ProofChips, { props: { project: withProof(undefined) } })
        .find("ul")
        .exists(),
    ).toBe(false);
  });
  it("says the release, its date and how many, and skips a small download count", () => {
    const text = mount(ProofChips, { props: { project: withProof({ release }) } }).text();
    expect(text).toContain("v2.3.3 · 1 Oct");
    expect(text).toContain("23 releases");
    expect(text).not.toContain("downloads");
  });
  it("merges one version on both registries into one chip", () => {
    const reg = {
      version: "0.5.2",
      at: null,
      versions: 10,
      downloadsMonth: 1356,
      url: "https://www.npmjs.com/package/weftai",
      packages: 5,
    };
    const text = mount(ProofChips, {
      props: {
        project: withProof({
          npm: { ...reg, name: "weftai", daily: [] },
          pypi: { ...reg, name: "weftai", url: "https://pypi.org/project/weftai/" },
        }),
      },
    }).text();
    expect(text).toContain("v0.5.2 on npm and PyPI");
    expect(text).toContain("1.4k npm downloads last month");
  });
  it("caps the number of chips", () => {
    const w = mount(ProofChips, { props: { project: withProof({ release, commits: 512, services: 3 }), max: 2 } });
    expect(w.findAll("li")).toHaveLength(2);
  });
});

describe("ShippingRibbon", () => {
  const lanes: Lane[] = [
    { id: "a", name: "Alpha", slug: "a" },
    { id: "b", name: "Beta", slug: "b" },
  ];
  const ev = (i: number, lane: string, at: string, kind: ShipEvent["kind"] = "release"): ShipEvent => ({
    id: `e${i}`,
    lane,
    project: lane,
    kind,
    label: kind === "pr" ? `#${i}` : `v1.${i}.0`,
    title: kind === "pr" ? `Alpha #${i}` : `Alpha v1.${i}.0`,
    words: i === 3 ? "The newest one" : null,
    at,
    url: `https://example.com/${i}`,
    channels: kind === "pr" ? [] : ["GitHub"],
  });
  // Newest first, as the site data stores them.
  const events = [
    ev(3, "a", "2026-10-01T10:00:00Z"),
    ev(2, "b", "2026-09-30T10:00:00Z", "pr"),
    ev(1, "a", "2026-05-06T10:00:00Z"),
  ];

  it("draws one mark per event, a release as a square and a pull request as a tick", () => {
    const w = mount(ShippingRibbon, { props: { events, lanes } });
    expect(w.findAll("a.tick")).toHaveLength(3);
    expect(w.findAll("a.tick.is-release")).toHaveLength(2);
    expect(w.find("a.tick.is-pr rect.mark").attributes("width")).toBe("2");
    expect(w.findAll(".lane-name").map((t) => t.text())).toEqual(["Alpha", "Beta"]);
  });
  it("starts on the newest event, with one tab stop", () => {
    const w = mount(ShippingRibbon, { props: { events, lanes } });
    const ticks = w.findAll("a.tick");
    expect(ticks.map((t) => t.attributes("tabindex"))).toEqual(["-1", "-1", "0"]);
    expect(w.find(".ribbon-caption").text()).toContain("The newest one");
    expect(ticks[2]!.attributes("aria-label")).toContain("1 Oct");
  });
  it("moves with the arrow keys and Home", async () => {
    const w = mount(ShippingRibbon, { props: { events, lanes }, attachTo: document.body });
    await w.findAll("a.tick")[2]!.trigger("keydown", { key: "ArrowLeft" });
    expect(w.findAll("a.tick").map((t) => t.attributes("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(w.find(".ribbon-caption").text()).toContain("Alpha #2");
    await w.findAll("a.tick")[1]!.trigger("keydown", { key: "Home" });
    expect(w.findAll("a.tick")[0]!.attributes("tabindex")).toBe("0");
    w.unmount();
  });
  it("labels the oldest and newest days and marks a gap of more than a week", () => {
    const w = mount(ShippingRibbon, { props: { events, lanes } });
    const labels = w.findAll(".ribbon-axis text").map((t) => t.text());
    expect(labels[0]).toBe("6 May");
    expect(labels.at(-1)).toBe("1 Oct");
    expect(w.findAll(".ribbon-break")).toHaveLength(1);
  });
  it("opens every event in a new tab, safely", () => {
    const w = mount(ShippingRibbon, { props: { events, lanes } });
    for (const a of w.findAll("a.tick")) {
      expect(a.attributes("target")).toBe("_blank");
      expect(a.attributes("rel")).toBe("noopener noreferrer");
    }
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
    expect(w.find("svg").attributes("aria-label")).toContain("1234 contributions in the last year");
    expect(w.find("svg").attributes("aria-label")).toContain("active days");
  });
  it("names the period it covers", () => {
    const w = mount(ContributionGraph, { props: { days: days.slice(-91), total: 9, period: "in the last 13 weeks" } });
    expect(w.findAll("rect")).toHaveLength(91);
    expect(w.find("svg").attributes("aria-label")).toContain("9 contributions in the last 13 weeks");
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
