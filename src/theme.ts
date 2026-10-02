// The colour theme: the device decides until a visitor chooses, and the choice is remembered.
// index.html applies a stored choice before the first paint (see THEME_BOOT); this module is what the
// toggle uses afterwards. The tokens themselves are in styles/tokens.css.

import { ref } from "vue";

export type Theme = "light" | "dark";

/** The theme on screen, once the browser is running; null on the prerendered page, which cannot know. */
export const theme = ref<Theme | null>(null);

export const THEME_KEY = "theme";

/** What a browser paints its own chrome with: --bg in each theme. */
export const THEME_COLOR: Record<Theme, string> = { light: "#f4f4eb", dark: "#080b07" };

/**
 * The script index.html runs in <head>, ahead of the stylesheet, so a stored choice never shows a
 * frame of the other theme. Kept here so a test can hold the page to it.
 */
export const THEME_BOOT = `try{const t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}`;

export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** A visitor's choice wins; without one, the device decides. */
export function resolveTheme(chosen: unknown, deviceIsLight: boolean): Theme {
  return parseTheme(chosen) ?? (deviceIsLight ? "light" : "dark");
}

export function opposite(of: Theme): Theme {
  return of === "dark" ? "light" : "dark";
}

/** The theme on screen right now. */
export function currentTheme(): Theme {
  return resolveTheme(
    document.documentElement.dataset.theme,
    window.matchMedia("(prefers-color-scheme: light)").matches,
  );
}

/** Shows the chosen theme, remembers it, and tells the browser's own chrome. */
export function applyTheme(chosen: Theme): void {
  document.documentElement.dataset.theme = chosen;
  theme.value = chosen;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLOR[chosen];
  }
  try {
    localStorage.setItem(THEME_KEY, chosen);
  } catch {
    // Storage can be refused (private windows, blocked site data); the choice then lasts the visit.
  }
}
