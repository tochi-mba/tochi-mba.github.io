import { describe, expect, it } from "vitest";
import {
  caveats,
  compare,
  formatChange,
  formatTable,
  formatValue,
  median,
  overBudget,
  summarise,
  summaryLine,
  verdict,
  // @ts-expect-error plain ESM script without types
} from "../../scripts/perf-report.mjs";

const environment = { cpu: "Ryzen 7", chromium: "149.0", benchmarkMs: 100 };
const measurement = (pages: Record<string, unknown>, env = environment) => ({ environment: env, pages });

describe("medians of repeated runs", () => {
  it("takes the middle value, or the mean of the two middle values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("ignores what is not a finite number, and has no median of nothing", () => {
    expect(median([5, Number.NaN, undefined, Number.POSITIVE_INFINITY, 7])).toBe(6);
    expect(median([])).toBeUndefined();
    expect(median([undefined])).toBeUndefined();
  });
  it("keeps each metric's fastest run, leaving out a metric no run measured", () => {
    const runs = [
      { lcp: 900, tbt: 30, busy: undefined },
      { lcp: 1100, tbt: 10 },
      { lcp: 1000, tbt: 20, heap: 4 },
    ];
    expect(summarise(runs)).toEqual({ lcp: 900, tbt: 10, heap: 4 });
  });
  it("keeps the worst layout shift, so one that happens now and then still shows", () => {
    expect(summarise([{ cls: 0 }, { cls: 0.04 }, { cls: 0 }])).toEqual({ cls: 0.04 });
  });
});

describe("verdicts against the baseline", () => {
  it("calls a byte count the same within its noise, and over budget past five per cent", () => {
    expect(verdict("bytes", 100_000, 100_900)).toBe("same");
    expect(verdict("bytes", 100_000, 103_000)).toBe("worse");
    expect(verdict("bytes", 100_000, 106_000)).toBe("over");
    expect(verdict("bytes", 100_000, 90_000)).toBe("better");
  });
  it("gives a small file a floor of noise and budget, so a few bytes are not news", () => {
    expect(verdict("bytes", 2000, 2400)).toBe("same");
    expect(verdict("bytes", 2000, 3000)).toBe("worse");
    expect(verdict("bytes", 2000, 5000)).toBe("over");
  });
  it("counts exactly, with two to spare before a check fails", () => {
    expect(verdict("count", 10, 10)).toBe("same");
    expect(verdict("count", 10, 12)).toBe("worse");
    expect(verdict("count", 10, 13)).toBe("over");
    expect(verdict("count", 10, 9)).toBe("better");
  });
  it("lets a timing wander by a tenth, and fails it past a quarter", () => {
    expect(verdict("ms", 1000, 1080)).toBe("same");
    expect(verdict("ms", 1000, 1200)).toBe("worse");
    expect(verdict("ms", 1000, 1300)).toBe("over");
    expect(verdict("ms", 1000, 850)).toBe("better");
    expect(verdict("ms", 50, 65)).toBe("same");
    expect(verdict("ms", 50, 160)).toBe("over");
  });
  it("reads a layout shift score on its own small scale", () => {
    expect(verdict("score", 0, 0.004)).toBe("same");
    expect(verdict("score", 0, 0.02)).toBe("worse");
    expect(verdict("score", 0, 0.1)).toBe("over");
    expect(verdict("score", 0.05, 0)).toBe("better");
  });
  it("marks a metric only one side has as new or gone", () => {
    expect(verdict("ms", undefined, 5)).toBe("new");
    expect(verdict("ms", 5, undefined)).toBe("gone");
  });
});

describe("comparing two measurements", () => {
  const baseline = measurement({
    "/": { weight: { js: 70_000, requests: 9 }, phone: { lcp: 2000 } },
    "/old": { weight: { js: 1000 } },
  });
  const current = measurement({
    "/": { weight: { js: 60_000, requests: 9 }, phone: { lcp: 2600, tbt: 100 }, desktop: {} },
    "/new": { weight: { js: 2000 } },
  });
  const rows = compare(baseline, current);
  const row = (page: string, section: string, key: string) =>
    rows.find(
      (r: { page: string; section: string; key: string }) => r.page === page && r.section === section && r.key === key,
    );

  it("pairs every metric of every page, with a verdict", () => {
    expect(row("/", "weight", "js")).toMatchObject({ before: 70_000, after: 60_000, verdict: "better", unit: "bytes" });
    expect(row("/", "weight", "requests")).toMatchObject({ verdict: "same", label: "requests" });
    expect(row("/", "phone", "lcp")).toMatchObject({ before: 2000, after: 2600, verdict: "over" });
    expect(row("/", "phone", "tbt")).toMatchObject({ before: undefined, after: 100, verdict: "new" });
  });
  it("keeps pages and metrics that appear on one side only", () => {
    expect(row("/old", "weight", "js")).toMatchObject({ verdict: "gone" });
    expect(row("/new", "weight", "js")).toMatchObject({ verdict: "new" });
  });
  it("leaves out metrics neither side measured", () => {
    expect(rows.some((r: { section: string }) => r.section === "desktop")).toBe(false);
    expect(row("/", "weight", "css")).toBeUndefined();
  });
  it("treats every metric as new when there is no baseline yet", () => {
    expect(compare(undefined, current).every((r: { verdict: string }) => r.verdict === "new")).toBe(true);
  });
  it("fails a check only on what broke its budget, in the sections asked about", () => {
    expect(overBudget(rows)).toEqual([]);
    expect(overBudget(rows, ["phone"]).map((r: { key: string }) => r.key)).toEqual(["lcp"]);
  });
  it("sums the comparison up in a line", () => {
    expect(summaryLine(rows)).toBe("1 better, 1 unchanged, 0 worse, 1 over budget, 2 new, 1 gone");
    expect(summaryLine(rows.filter((r: { verdict: string }) => !["new", "gone"].includes(r.verdict)))).toBe(
      "1 better, 1 unchanged, 0 worse, 1 over budget",
    );
  });
});

describe("when timings cannot be compared", () => {
  it("says nothing without a baseline, or on the same machine at the same speed", () => {
    expect(caveats(undefined, environment)).toEqual([]);
    expect(caveats(environment, { ...environment, benchmarkMs: 110 })).toEqual([]);
  });
  it("names a different processor or browser", () => {
    expect(caveats(environment, { ...environment, cpu: "M3", chromium: "150.0" })).toEqual([
      "the baseline was measured on a different processor (Ryzen 7)",
      "the baseline used Chromium 149.0",
    ]);
  });
  it("says when the same machine is running much slower or faster", () => {
    expect(caveats(environment, { ...environment, benchmarkMs: 150 })).toEqual([
      "this machine is running 50% slower than at the baseline",
    ]);
    expect(caveats(environment, { ...environment, benchmarkMs: 50 })).toEqual([
      "this machine is running 100% faster than at the baseline",
    ]);
  });
});

describe("the printed table", () => {
  it("writes each unit short enough for a cell", () => {
    expect(formatValue("bytes", undefined)).toBe("-");
    expect(formatValue("bytes", 512)).toBe("512 B");
    expect(formatValue("bytes", 67_116)).toBe("67.1 kB");
    expect(formatValue("bytes", 4_200_000)).toBe("4.20 MB");
    expect(formatValue("ms", 840.4)).toBe("840 ms");
    expect(formatValue("ms", 2100)).toBe("2.10 s");
    expect(formatValue("score", 0.0123)).toBe("0.012");
    expect(formatValue("count", 9)).toBe("9");
  });
  it("writes the change against the baseline", () => {
    expect(formatChange({ verdict: "new" })).toBe("new");
    expect(formatChange({ verdict: "gone" })).toBe("gone");
    expect(formatChange({ verdict: "same", before: 5, after: 5 })).toBe("=");
    expect(formatChange({ verdict: "worse", before: 0, after: 3 })).toBe("up");
    expect(formatChange({ verdict: "better", before: 200, after: 183 })).toBe("-8.5%");
    expect(formatChange({ verdict: "over", before: 100, after: 150 })).toBe("+50%");
    expect(formatChange({ verdict: "same", before: 100_000, after: 100_001 })).toBe("~0%");
    expect(formatChange({ verdict: "same", before: 100_000, after: 99_999 })).toBe("~0%");
  });
  it("lays out a block per section, a row per metric and a column per page measured in it", () => {
    const rows = compare(
      measurement({
        "/": { weight: { js: 70_000 }, phone: { lcp: 2000 } },
        "/work": { weight: { js: 40_000 } },
      }),
      measurement({
        "/": { weight: { js: 60_000 }, phone: { lcp: 2600, tbt: 120 } },
        "/work": { weight: { js: 40_000 } },
      }),
    );
    const gap = (n: number) => " ".repeat(n);
    expect(formatTable(rows).split("\n")).toEqual([
      `weight of a first visit   /${gap(16)}/work`,
      `  JavaScript (gzip)${gap(7)}60.0 kB -14% ✓   40.0 kB =`,
      "",
      `on a phone${gap(19)}/`,
      "  largest contentful paint   2.60 s +30% ✗",
      `  total blocking time${gap(8)}120 ms`,
    ]);
  });
  it("prints nothing for no rows, leaves a cell empty where a page lacks a metric, and marks one that went", () => {
    expect(formatTable([])).toBe("");
    const rows = compare(
      measurement({ "/": { weight: { js: 10, css: 5 } } }),
      measurement({ "/": { weight: { js: 10 } }, "/work": { weight: { js: 20 } } }),
    );
    const gap = (n: number) => " ".repeat(n);
    expect(formatTable(rows).split("\n")).toEqual([
      `weight of a first visit   /${gap(10)}/work`,
      `  JavaScript (gzip)${gap(7)}10 B =${gap(5)}20 B`,
      `  CSS (gzip)${gap(14)}5 B gone`,
    ]);
  });
});
