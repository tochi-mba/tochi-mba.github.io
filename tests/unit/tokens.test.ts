import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "../../src/theme";

// The colour tokens, read from the stylesheet itself, so a change there is held to these numbers.
const css = readFileSync(resolve(__dirname, "../../src/styles/tokens.css"), "utf8");

type Theme = "light" | "dark";

function tokens(): Record<string, Record<Theme, string>> {
  const out: Record<string, Record<Theme, string>> = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)) {
    out[m[1]!] = { light: m[2]!.toLowerCase(), dark: m[3]!.toLowerCase() };
  }
  return out;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const t = tokens();

describe("colour tokens", () => {
  it("define every colour for both themes", () => {
    for (const name of ["bg", "bg-2", "rule", "rule-2", "text", "text-2", "text-3", "signal", "on-signal", "heat-4"]) {
      expect(t[name], name).toBeDefined();
    }
  });

  for (const theme of ["light", "dark"] as const) {
    describe(`the ${theme} theme`, () => {
      it("keeps every text colour at 5.5:1 or more on both backgrounds, above WCAG AA", () => {
        for (const text of ["text", "text-2", "text-3"]) {
          for (const bg of ["bg", "bg-2"]) {
            expect(contrast(t[text]![theme], t[bg]![theme]), `${text} on ${bg}`).toBeGreaterThanOrEqual(5.5);
          }
        }
      });
      it("keeps the signal colour legible as text and as a focus ring", () => {
        expect(contrast(t.signal![theme], t.bg![theme])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["on-signal"]![theme], t.signal![theme])).toBeGreaterThanOrEqual(4.5);
      });
      it("draws a control's border at 3:1 where it marks the control, in the light theme", () => {
        if (theme === "light") expect(contrast(t["rule-2"]!.light, t.bg!.light)).toBeGreaterThanOrEqual(3);
      });
      it("paints the browser's own chrome the same colour as the page", () => {
        expect(THEME_COLOR[theme]).toBe(t.bg![theme]);
      });
    });
  }

  it("falls back to the dark theme where light-dark() is not supported, with the same values", () => {
    const fallback = /@supports not \(color: light-dark\(#000, #fff\)\) \{\s*:root \{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    for (const [name, value] of Object.entries(t)) {
      if (!value.dark.startsWith("#")) continue;
      expect(fallback, name).toContain(`--${name}: ${value.dark}`);
    }
  });
});
