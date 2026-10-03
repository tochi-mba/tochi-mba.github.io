// The arithmetic and the verdicts behind `npm run perf`: medians of repeated runs, the comparison
// with the saved baseline, and the table it prints. Pure, so every decision here is tested; the
// measuring itself (a browser, a server, the clock) is scripts/perf.mjs.

/**
 * Every number a measurement holds, in the order the table prints them. `weight` is what a first
 * visit downloads, compressed the way GitHub Pages serves it: the same on every machine. `phone` and
 * `desktop` are how the page loads and runs, medians of several runs: they depend on the machine.
 */
export const METRICS = {
  weight: [
    { key: "transfer", label: "transfer (gzip)", unit: "bytes" },
    { key: "js", label: "JavaScript (gzip)", unit: "bytes" },
    { key: "jsRaw", label: "JavaScript to parse", unit: "bytes" },
    { key: "css", label: "CSS (gzip)", unit: "bytes" },
    { key: "html", label: "HTML (gzip)", unit: "bytes" },
    { key: "fonts", label: "fonts", unit: "bytes" },
    { key: "requests", label: "requests", unit: "count" },
  ],
  speed: [
    { key: "fcp", label: "first contentful paint", unit: "ms" },
    { key: "lcp", label: "largest contentful paint", unit: "ms" },
    { key: "tbt", label: "total blocking time", unit: "ms" },
    { key: "cls", label: "layout shift", unit: "score" },
    { key: "script", label: "script", unit: "ms" },
    { key: "style", label: "style", unit: "ms" },
    { key: "layout", label: "layout", unit: "ms" },
    { key: "busy", label: "main thread per second, map on screen", unit: "ms" },
    { key: "elements", label: "elements", unit: "count" },
    { key: "heap", label: "JavaScript heap", unit: "bytes" },
  ],
};

/** Which list of metrics each section of a page's measurement uses, and the heading it prints under. */
export const SECTIONS = {
  weight: { metrics: "weight", title: "weight of a first visit" },
  phone: { metrics: "speed", title: "on a phone" },
  desktop: { metrics: "speed", title: "on a desktop" },
};

/**
 * How much a number may move and still be the same (`noise`), and how much it may grow before a
 * check fails (`budget`). Weight is exact, so its noise is only what a date in the data shifts;
 * timings wander from run to run, so theirs is wider.
 */
export const RULES = {
  bytes: { noise: (before) => Math.max(before * 0.01, 512), budget: (before) => Math.max(before * 0.05, 2048) },
  count: { noise: () => 0, budget: () => 2 },
  ms: { noise: (before) => Math.max(before * 0.1, 20), budget: (before) => Math.max(before * 0.25, 100) },
  score: { noise: () => 0.005, budget: () => 0.05 },
};

/** The middle value; the mean of the two middle values for an even count. Undefined for none. */
export function median(values) {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One object from several runs of the same measurement: the fastest value of each metric, because
 * whatever else the machine is doing only ever adds time, so the fastest run is the closest to what
 * the page itself costs. Layout shift is the exception: it keeps the worst run, so a shift that
 * happens now and then is not hidden.
 */
export function summarise(runs) {
  const keys = [...new Set(runs.flatMap((run) => Object.keys(run)))];
  const out = {};
  for (const key of keys) {
    const values = runs.map((run) => run[key]).filter((v) => typeof v === "number" && Number.isFinite(v));
    if (values.length) out[key] = key === "cls" ? Math.max(...values) : Math.min(...values);
  }
  return out;
}

/** better, same, worse, or over (worse than the budget allows); new or gone when one side is missing. */
export function verdict(unit, before, after) {
  if (before === undefined) return "new";
  if (after === undefined) return "gone";
  const rule = RULES[unit];
  const delta = after - before;
  if (delta > rule.budget(before)) return "over";
  if (delta > rule.noise(before)) return "worse";
  if (delta < -rule.noise(before)) return "better";
  return "same";
}

/** Every metric of every page in either measurement, with both values and a verdict. */
export function compare(baseline, current) {
  const rows = [];
  const pages = [...new Set([...Object.keys(baseline?.pages ?? {}), ...Object.keys(current.pages)])];
  for (const page of pages) {
    for (const [section, { metrics }] of Object.entries(SECTIONS)) {
      const before = baseline?.pages?.[page]?.[section] ?? {};
      const after = current.pages[page]?.[section] ?? {};
      for (const metric of METRICS[metrics]) {
        if (!(metric.key in before) && !(metric.key in after)) continue;
        const b = before[metric.key];
        const a = after[metric.key];
        rows.push({ page, section, ...metric, before: b, after: a, verdict: verdict(metric.unit, b, a) });
      }
    }
  }
  return rows;
}

/** The rows that broke their budget, in the given sections. */
export function overBudget(rows, sections = ["weight"]) {
  return rows.filter((row) => row.verdict === "over" && sections.includes(row.section));
}

/**
 * Why two measurements' timings may not be comparable: a different processor or browser, or the
 * same machine running much slower or faster (another program busy, a laptop on battery). Weight is
 * unaffected by any of this.
 */
export function caveats(before, after) {
  if (!before) return [];
  const out = [];
  if (before.cpu !== after.cpu) out.push(`the baseline was measured on a different processor (${before.cpu})`);
  if (before.chromium !== after.chromium) out.push(`the baseline used Chromium ${before.chromium}`);
  const ratio = after.benchmarkMs / before.benchmarkMs;
  if (ratio > 1.15) out.push(`this machine is running ${Math.round((ratio - 1) * 100)}% slower than at the baseline`);
  if (ratio < 1 / 1.15)
    out.push(`this machine is running ${Math.round((1 / ratio - 1) * 100)}% faster than at the baseline`);
  return out;
}

/** A number in its unit, short enough for a table cell. */
export function formatValue(unit, value) {
  if (value === undefined) return "-";
  if (unit === "bytes") {
    if (Math.abs(value) < 1000) return `${Math.round(value)} B`;
    if (Math.abs(value) < 1e6) return `${(value / 1000).toFixed(1)} kB`;
    return `${(value / 1e6).toFixed(2)} MB`;
  }
  if (unit === "ms") return Math.abs(value) < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
  if (unit === "score") return value.toFixed(3);
  return String(Math.round(value));
}

/** "-8.5%" against the baseline, or a mark for a value only one side has. */
export function formatChange(row) {
  if (row.verdict === "new") return "new";
  if (row.verdict === "gone") return "gone";
  if (row.before === row.after) return "=";
  // Every metric is a size, a time or a count, so from zero the only way is up.
  if (row.before === 0) return "up";
  const percent = ((row.after - row.before) / row.before) * 100;
  const text = `${percent > 0 ? "+" : ""}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}%`;
  return text === "+0.0%" || text === "-0.0%" ? "~0%" : text;
}

const MARK = { better: " ✓", worse: " !", over: " ✗", same: "", new: "", gone: "" };

/**
 * The table: a block per section, a row per metric, a column per page. Each cell is the current
 * value and, when there is a baseline, the change against it.
 */
export function formatTable(rows) {
  const cell = (row) => {
    if (!row) return "";
    const value = formatValue(row.unit, row.after ?? row.before);
    return row.verdict === "new" ? value : `${value} ${formatChange(row)}${MARK[row.verdict]}`;
  };
  const lines = [];
  for (const [section, { title }] of Object.entries(SECTIONS)) {
    const inSection = rows.filter((r) => r.section === section);
    if (inSection.length === 0) continue;
    const pages = [...new Set(inSection.map((r) => r.page))];
    const labels = [...new Map(inSection.map((r) => [r.key, r.label])).entries()];
    const table = [
      [title, ...pages],
      ...labels.map(([key, label]) => [
        `  ${label}`,
        ...pages.map((page) => cell(inSection.find((r) => r.page === page && r.key === key))),
      ]),
    ];
    const widths = table[0].map((_, i) => Math.max(...table.map((line) => line[i].length)));
    for (const line of table)
      lines.push(
        line
          .map((text, i) => text.padEnd(widths[i]))
          .join("   ")
          .trimEnd(),
      );
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** One line that says how this measurement compares, for the end of the report. */
export function summaryLine(rows) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const parts = [
    `${count("better")} better`,
    `${count("same")} unchanged`,
    `${count("worse")} worse`,
    `${count("over")} over budget`,
  ];
  if (count("new")) parts.push(`${count("new")} new`);
  if (count("gone")) parts.push(`${count("gone")} gone`);
  return parts.join(", ");
}
