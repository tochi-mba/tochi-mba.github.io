// Ranking for the command palette: how well a text answers what was typed. Pure, so it is unit-tested.

/** Lowercased and stripped of accents, so "Résumé" is found by "resume". */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const EXACT = 100;
const PREFIX = 80;
const WORD_START = 60;
const INSIDE = 40;
const SCATTERED = 20;

function isSubsequence(needle: string, text: string): boolean {
  let found = 0;
  for (const character of text) {
    if (character === needle[found]) found += 1;
    if (found === needle.length) return true;
  }
  return false;
}

/**
 * How well `text` answers `query`: 0 for not at all, higher for a closer match. A match at the
 * start of the text beats one at the start of a later word, which beats one inside a word, which
 * beats the letters merely appearing in order.
 */
export function score(text: string, query: string): number {
  const haystack = fold(text);
  const needle = fold(query).trim();
  if (needle === "") return 0;
  if (haystack === needle) return EXACT;
  if (haystack.startsWith(needle)) return PREFIX;
  const at = haystack.indexOf(needle);
  if (at > 0) return /[\s\-_/.@]/.test(haystack.charAt(at - 1)) ? WORD_START : INSIDE;
  return isSubsequence(needle, haystack) ? SCATTERED : 0;
}

/**
 * The items that answer `query`, best first. Each item offers several texts, most important first,
 * and is judged by its best one; ties keep the order the items came in. An empty query returns
 * everything, in order.
 */
export function rank<T>(items: readonly T[], query: string, texts: (item: T) => string[]): T[] {
  if (query.trim() === "") return [...items];
  return items
    .map((item, position) => ({
      item,
      position,
      // A match in a later text (a tagline, a stack) counts for slightly less than one in the name.
      best: Math.max(0, ...texts(item).map((text, index) => score(text, query) - index)),
    }))
    .filter((entry) => entry.best > 0)
    .sort((a, b) => b.best - a.best || a.position - b.position)
    .map((entry) => entry.item);
}
