import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lucyFamily } from "../../src/data";
import { fold, rank, score } from "../../src/search";
import { along, clampPull, drift, easeInOut, settled, springStep } from "../../src/systemMotion";
import { EVERY_SERVICE, journeys, traceFor } from "../../src/systemTrace";
import { opposite, parseTheme, resolveTheme, THEME_BOOT } from "../../src/theme";

describe("map motion", () => {
  it("returns a displaced node home without numerical instability", () => {
    const home = { x: 380, y: 205 };
    let state = { pos: { x: 500, y: 300 }, vel: { x: 1200, y: -1200 } };
    for (let i = 0; i < 600; i++) state = springStep(state.pos, state.vel, home, 0.034);
    expect(settled(state.pos, state.vel, home)).toBe(true);
  });
  it("bounds drift and gives neighbours different paths", () => {
    for (let i = 0; i < 10; i++) {
      const value = drift(i, 100);
      expect(Math.abs(value.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(value.y)).toBeLessThanOrEqual(3);
      expect(value).not.toEqual(drift(i + 1, 100));
    }
  });
  it("clamps travel and limits a drag without changing its direction", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
    expect(along({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
    expect(clampPull({ x: 0, y: 0 }, { x: 300, y: 400 }, 150)).toEqual({ x: 90, y: 120 });
  });
  it("leaves a drag within reach exactly where the pointer is", () => {
    expect(clampPull({ x: 0, y: 0 }, { x: 30, y: 40 }, 150)).toEqual({ x: 30, y: 40 });
  });
  it("eases out of the start and into the end, symmetrically", () => {
    expect(easeInOut(0.25)).toBeCloseTo(0.125);
    expect(easeInOut(0.75)).toBeCloseTo(0.875);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
  it("is settled only when both close and slow", () => {
    const home = { x: 0, y: 0 };
    expect(settled({ x: 0.01, y: 0 }, { x: 0, y: 0 }, home)).toBe(true);
    expect(settled({ x: 0.01, y: 0 }, { x: 5, y: 0 }, home)).toBe(false);
    expect(settled({ x: 3, y: 0 }, { x: 0, y: 0 }, home)).toBe(false);
  });
});
describe("request traces", () => {
  it("connects every family trace to known nodes", () => {
    const hub = lucyFamily.find((p) => p.role === "hub")!;
    const vault = lucyFamily.find((p) => p.role === "vault")!;
    const slugs = lucyFamily.map((p) => p.slug);
    for (const project of lucyFamily) {
      const steps = traceFor(project, hub, vault);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps)
        for (const pair of journeys(step, slugs)) {
          expect(slugs).toContain(pair[0]);
          expect(slugs).toContain(pair[1]);
          expect(pair[0]).not.toBe(pair[1]);
        }
    }
  });
  it("fans out without sending a service to itself", () => {
    expect(journeys({ from: EVERY_SERVICE, to: "vault", label: "", note: "" }, ["a", "vault"])).toEqual([
      ["a", "vault"],
    ]);
  });
});
describe("palette ranking", () => {
  it("ignores case and accents and ranks exact names before partial matches", () => {
    expect(fold("Résumé")).toBe("resume");
    expect(rank(["my resume", "Résumé", "resume helper"], "resume", (item) => [item])).toEqual([
      "Résumé",
      "resume helper",
      "my resume",
    ]);
    expect(score("LUCY", "lcy")).toBeGreaterThan(0);
    expect(score("LUCY", "xyz")).toBe(0);
  });
  it("ranks the start of a later word above the middle of a word, and nothing for an empty query", () => {
    expect(score("hub-lucy", "lucy")).toBeGreaterThan(score("metalucy", "lucy"));
    expect(score("metalucy", "lucy")).toBeGreaterThan(score("l-u-c-y", "lucy"));
    expect(score("LUCY", "")).toBe(0);
    expect(score("LUCY", "lucy")).toBeGreaterThan(score("LUCY hub", "lucy"));
  });
  it("keeps ties stable and handles an empty query", () => {
    expect(rank(["alpha", "alpine"], "al", (item) => [item])).toEqual(["alpha", "alpine"]);
    expect(rank(["b", "a"], " ", (item) => [item])).toEqual(["b", "a"]);
  });
});
describe("theme choice", () => {
  it("uses a valid stored choice before the device preference", () => {
    expect(parseTheme("invalid")).toBeNull();
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("light");
    expect(opposite("light")).toBe("dark");
  });
  it("keeps the first-paint script identical to the tested contract", () => {
    expect(readFileSync("index.html", "utf8")).toContain(`<script>${THEME_BOOT}</script>`);
  });
});
