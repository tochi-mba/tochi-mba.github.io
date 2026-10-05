// Measures the built site and compares it with perf/baseline.json, so an optimisation or a
// regression shows up as a number. Needs `npm run build`; serves dist/ itself (or SHOTS_BASE).
//
//   npm run perf                        measure everything and compare with the baseline
//   npm run perf -- --save              ...and keep this measurement as the new baseline
//   npm run perf -- --weight            page weight only: quick, and the same on every machine
//   npm run perf -- --check             exit 1 if a page's weight broke its budget (CI runs this)
//   npm run perf -- --runs=5 --pages=/,/work
//   npm run perf -- --out=before.json   also write this measurement to a file of its own
//   npm run perf -- --baseline=before.json   compare with that file instead of the baseline
//   npm run perf -- --dist=../other/dist     measure another build (serve it with SHOTS_BASE)
//
// Weight is what a first visit downloads, gzip-compressed the way GitHub Pages serves it. Speed is
// measured on an emulated mid-range phone (Pixel 7 screen, CPU four times slower, 150 ms round trips
// at 1.6 Mbps: what Lighthouse's mobile run assumes) and on a desktop (1440x900, 40 ms at 10 Mbps),
// each page several times from a cold cache; the fastest run is kept (see summarise). Requests to
// other sites are refused, so GitHub's API never adds noise. Timings depend on the machine and on
// what else it is doing: the report says when the baseline came from a different processor or a
// quieter machine.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium, devices } from "playwright";
import { caveats, compare, formatTable, median, overBudget, summarise, summaryLine } from "./perf-report.mjs";
import { servePreview } from "./preview.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const savedBaseline = join(root, "perf/baseline.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const dist = resolve(option("dist", join(root, "dist")));
const baselineFile = resolve(option("baseline", savedBaseline));

const PAGES = option("pages", "/,/work,/about,/work/lucy-assistant").split(",");
const RUNS = Math.max(1, Number(option("runs", "3")));
/** How long to keep watching after `load`: hydration and the first reveals happen in here. */
const SETTLE_MS = 3000;

const PROFILES = {
  phone: {
    describe: "Pixel 7, CPU x4, 150 ms at 1.6 Mbps",
    context: { ...devices["Pixel 7"] },
    cpu: 4,
    network: { latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 },
  },
  desktop: {
    describe: "1440x900, 40 ms at 10 Mbps",
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    cpu: 1,
    network: { latency: 40, downloadThroughput: (10240 * 1024) / 8, uploadThroughput: (10240 * 1024) / 8 },
  },
};

// Runs in the page before anything else: what the browser reports about painting and blocking.
function observe() {
  const perf = { lcp: 0, cls: 0, longTasks: [] };
  window.__perf = perf;
  const watch = (type, take) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(take)).observe({ type, buffered: true });
    } catch {}
  };
  watch("largest-contentful-paint", (e) => {
    perf.lcp = e.startTime;
  });
  watch("layout-shift", (e) => {
    if (!e.hadRecentInput) perf.cls += e.value;
  });
  watch("longtask", (e) => perf.longTasks.push([e.startTime, e.duration]));
}

async function chromeMetrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

/** A fresh, isolated browser context that may only talk to the site under test. */
async function isolated(browser, base, options) {
  const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "no-preference", ...options });
  const origin = new URL(base).origin;
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  return context;
}

/** One cold load of a page: paint, blocking, main-thread time and memory. */
async function loadOnce(browser, base, path, profile, withBusy) {
  const context = await isolated(browser, base, profile.context);
  await context.addInitScript(observe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
  await cdp.send("Performance.enable");
  await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached", timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  const timeline = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const { lcp, cls, longTasks } = window.__perf;
    // Blocking time after the first paint, as Lighthouse counts it: each long task's time past 50 ms.
    const tbt = longTasks.reduce((sum, [start, duration]) => {
      const from = Math.max(start, fcp);
      return sum + Math.max(0, start + duration - from - 50);
    }, 0);
    return { fcp, lcp, tbt, cls, elements: document.getElementsByTagName("*").length };
  });
  const chrome = await chromeMetrics(cdp);
  const result = {
    ...timeline,
    script: chrome.ScriptDuration * 1000,
    style: chrome.RecalcStyleDuration * 1000,
    layout: chrome.LayoutDuration * 1000,
    heap: chrome.JSHeapUsedSize,
  };
  if (withBusy) {
    // What the LUCY map costs while it is on screen: main-thread milliseconds per second.
    await page.evaluate(() => document.querySelector("#system")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1000);
    const before = (await chromeMetrics(cdp)).TaskDuration;
    await page.waitForTimeout(3000);
    result.busy = (((await chromeMetrics(cdp)).TaskDuration - before) / 3) * 1000;
  }
  await context.close();
  return result;
}

const KIND = { ".html": "html", ".js": "js", ".css": "css", ".woff2": "fonts" };

function distFile(pathname) {
  const clean = decodeURIComponent(pathname);
  const candidates = [join(dist, clean), join(dist, `${clean}.html`), join(dist, clean, "index.html")];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile());
}

/** Everything a first visit to `path` downloads, and what it weighs over the wire. */
async function weigh(browser, base, path) {
  const context = await isolated(browser, base, PROFILES.desktop.context);
  const page = await context.newPage();
  const requested = new Set();
  page.on("requestfinished", (request) => requested.add(new URL(request.url()).pathname));
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(500);
  await context.close();
  const out = { transfer: 0, js: 0, jsRaw: 0, css: 0, html: 0, fonts: 0, requests: requested.size };
  for (const pathname of requested) {
    const file = distFile(pathname);
    if (!file) throw new Error(`perf: ${pathname} was downloaded but is not in dist/`);
    const bytes = readFileSync(file);
    const kind = KIND[extname(file)];
    // A woff2 file is compressed already, and is served as it is.
    const wire = kind === "fonts" ? bytes.length : gzipSync(bytes, { level: 9 }).length;
    out.transfer += wire;
    if (kind) out[kind] += wire;
    if (kind === "js") out.jsRaw += bytes.length;
  }
  return out;
}

/** How fast this machine is right now, so timings from a busier or quieter moment can be told apart. */
async function benchmark(browser) {
  const page = await browser.newPage();
  const times = [];
  for (let i = 0; i < 5; i += 1) {
    times.push(
      await page.evaluate(() => {
        const start = performance.now();
        let check = 0;
        for (let round = 0; round < 200; round += 1) {
          const values = Array.from({ length: 2000 }, (_, j) => (j * 7919 + round) % 1009);
          values.sort((a, b) => a - b);
          check += values[1000] + values.join(",").length;
        }
        return performance.now() - start + (check < 0 ? 1 : 0);
      }),
    );
  }
  await page.close();
  return Math.round(median(times));
}

function commit() {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
    return dirty ? `${sha}+changes` : sha;
  } catch {
    return "unknown";
  }
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("perf: no dist/index.html; run `npm run build` first");
  process.exit(1);
}

const weightOnly = flag("weight");
if (weightOnly && flag("save")) {
  console.error("perf: a baseline holds speed as well as weight; save from a full measurement (no --weight)");
  process.exit(1);
}
const { base, close } = await servePreview();
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const environment = {
  node: process.version,
  chromium: browser.version(),
  os: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model.trim() ?? "unknown",
  cores: cpus().length,
  memoryGb: Math.round(totalmem() / 1e9),
  benchmarkMs: await benchmark(browser),
};

const pages = {};
for (const path of PAGES) {
  pages[path] = { weight: await weigh(browser, base, path) };
  if (weightOnly) continue;
  for (const [name, profile] of Object.entries(PROFILES)) {
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) runs.push(await loadOnce(browser, base, path, profile, path === "/"));
    pages[path][name] = summarise(runs);
  }
  console.error(`perf: measured ${path}`);
}
await browser.close();
await close();

const current = {
  version: 1,
  measuredAt: new Date().toISOString(),
  commit: commit(),
  environment,
  settings: {
    runs: RUNS,
    settleMs: SETTLE_MS,
    phone: PROFILES.phone.describe,
    desktop: PROFILES.desktop.describe,
  },
  pages,
};

const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")) : undefined;
// Weight alone is compared with the baseline's weight alone: a quick check says nothing about speed.
const comparable =
  weightOnly && baseline
    ? {
        ...baseline,
        pages: Object.fromEntries(Object.entries(baseline.pages).map(([p, m]) => [p, { weight: m.weight }])),
      }
    : baseline;
const rows = compare(comparable, current);

console.log(
  `perf: ${PAGES.length} pages${weightOnly ? ", weight only" : `, fastest of ${RUNS} runs; phone ${PROFILES.phone.describe}; desktop ${PROFILES.desktop.describe}`}`,
);
if (baseline) {
  const name = baselineFile === savedBaseline ? "perf/baseline.json" : baselineFile;
  console.log(`compared with ${name}: ${baseline.measuredAt.slice(0, 10)} at ${baseline.commit}`);
  if (!weightOnly) for (const note of caveats(baseline.environment, environment)) console.log(`  note: ${note}`);
} else {
  console.log("no baseline yet: run with --save to keep this measurement as one");
}
console.log(`\n${formatTable(rows)}\n`);
if (baseline) console.log(summaryLine(rows));

const json = `${JSON.stringify(current, null, 2)}\n`;
if (option("out", "")) {
  writeFileSync(resolve(option("out", "")), json);
  console.log(`perf: wrote ${resolve(option("out", ""))}`);
}
if (flag("save")) {
  mkdirSync(dirname(savedBaseline), { recursive: true });
  writeFileSync(savedBaseline, json);
  console.log("perf: saved as the baseline, perf/baseline.json; commit it with the change it measures");
}
if (flag("check")) {
  const over = overBudget(rows, ["weight"]);
  for (const row of over) console.error(`✗ ${row.page}: ${row.label} grew past its budget`);
  if (over.length) process.exit(1);
}
