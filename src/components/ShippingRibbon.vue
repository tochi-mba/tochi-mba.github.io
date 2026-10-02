<script setup lang="ts">
import { computed, ref } from "vue";
import { type Lane, type ShipEvent, shortDate } from "../data";

// The build log: one lane per flagship, one column per thing that shipped, oldest on the left.
// It is prerendered in its final state; the draw-in is CSS that only runs under .motion.
const props = defineProps<{ events: ShipEvent[]; lanes: Lane[] }>();

// A fixed design width, so type and marks keep one size however many events there are: the
// events spread to fill it. Narrow screens scroll it (and bump the SVG type, see the styles).
const WIDTH = 1200;
const PAD = 16;
const LANE_H = 42;
const AXIS_H = 30;

const ordered = computed(() => [...props.events].reverse());
const laneIndex = computed(() => new Map(props.lanes.map((l, i) => [l.id, i])));
const width = WIDTH;
const STEP = computed(() => (ordered.value.length > 1 ? (WIDTH - PAD * 2) / (ordered.value.length - 1) : 0));
const lanesHeight = computed(() => props.lanes.length * LANE_H);
const height = computed(() => lanesHeight.value + AXIS_H);
const x = (i: number) => (ordered.value.length > 1 ? PAD + i * STEP.value : WIDTH - PAD);
const lineY = (lane: number) => lane * LANE_H + 30;

const marks = computed(() =>
  ordered.value.map((e, i) => ({ e, i, x: x(i), y: lineY(laneIndex.value.get(e.lane) ?? 0) })),
);

// Date labels where the day changes. The newest and the oldest always keep theirs; the others are
// kept only where there is room, newest first.
const ticks = computed(() => {
  const n = ordered.value.length;
  const changes: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0 || ordered.value[i]!.at.slice(0, 10) !== ordered.value[i - 1]!.at.slice(0, 10)) changes.push(i);
  }
  const lastChange = changes.at(-1);
  const keep = new Set<number>([n - 1]);
  if (lastChange !== undefined && lastChange !== n - 1 && x(n - 1) - x(lastChange) < 64) keep.delete(n - 1);
  if (lastChange !== undefined) keep.add(lastChange);
  if (n > 1) keep.add(0);
  for (const i of [...changes].reverse()) {
    if ([...keep].every((k) => Math.abs(x(k) - x(i)) >= 64)) keep.add(i);
  }
  return [...keep].sort((a, b) => a - b).map((i) => ({ x: x(i), label: shortDate(ordered.value[i]!.at) }));
});

// Columns are evenly spaced, so a quiet stretch would look like an hour. Mark every gap over a week.
const breaks = computed(() => {
  const out: number[] = [];
  for (let i = 1; i < ordered.value.length; i += 1) {
    const gap = Date.parse(ordered.value[i]!.at) - Date.parse(ordered.value[i - 1]!.at);
    if (gap > 7 * 86400000) out.push((x(i) + x(i - 1)) / 2);
  }
  return out;
});

const active = ref(ordered.value.length - 1);
const current = computed(() => ordered.value[active.value]);

function describe(e: ShipEvent) {
  const what = e.kind === "pr" ? `merged pull request ${e.label}` : e.label;
  const where = e.channels.length ? `, on ${e.channels.join(", ")}` : "";
  return `${shortDate(e.at)}: ${projectName(e)} ${what}${e.words ? `, ${e.words}` : ""}${where}`;
}
function projectName(e: ShipEvent) {
  return e.title.replace(/\s+(v?[\d.]+\S*|#\d+|latest-\S+)$/, "");
}

const svg = ref<SVGSVGElement | null>(null);
function focusMark(i: number) {
  active.value = i;
  svg.value?.querySelectorAll<SVGAElement>("a.tick")[i]?.focus();
}
function onKey(event: KeyboardEvent) {
  const last = ordered.value.length - 1;
  const moves: Record<string, number> = {
    ArrowRight: Math.min(last, active.value + 1),
    ArrowLeft: Math.max(0, active.value - 1),
    Home: 0,
    End: last,
  };
  if (event.key in moves) {
    event.preventDefault();
    focusMark(moves[event.key]!);
  }
}
</script>

<template>
  <figure class="ribbon" :style="{ '--n': ordered.length }">
    <!-- When the log is wider than the screen it opens on today, with the lane names scrolled away;
         these stay pinned to the visible edge instead. Hidden wherever the drawing's own names show. -->
    <ol class="lane-labels" aria-hidden="true">
      <li v-for="(lane, li) in lanes" :key="lane.id" :style="{ '--lane': li }">{{ lane.name }}</li>
    </ol>
    <div class="ribbon-scroll">
      <svg
        ref="svg"
        class="ribbon-svg"
        :viewBox="`0 0 ${width} ${height}`"
        role="group"
        :aria-label="`Build log: the latest ${ordered.length} releases and merged pull requests, oldest first. Arrow keys move between them.`"
      >
        <g v-for="(lane, li) in lanes" :key="lane.id" class="ribbon-lane">
          <text class="lane-name" :x="PAD - 6" :y="li * LANE_H + 16">{{ lane.name }}</text>
          <line class="lane-line" :x1="PAD - 6" :x2="width - PAD + 6" :y1="lineY(li)" :y2="lineY(li)" />
        </g>
        <line class="ribbon-guide" :x1="current ? x(active) : 0" :x2="current ? x(active) : 0" y1="4" :y2="lanesHeight" />
        <g class="ribbon-axis" aria-hidden="true">
          <line :x1="PAD - 6" :x2="width - PAD + 6" :y1="lanesHeight + 4" :y2="lanesHeight + 4" />
          <g v-for="b in breaks" :key="`b${b}`" class="ribbon-break">
            <rect :x="b - 5" :y="lanesHeight" width="10" height="9" />
            <path :d="`M${b - 4} ${lanesHeight + 8} l4 -8 M${b} ${lanesHeight + 8} l4 -8`" />
          </g>
          <g v-for="t in ticks" :key="t.x">
            <line :x1="t.x" :x2="t.x" :y1="lanesHeight + 4" :y2="lanesHeight + 9" />
            <text :x="t.x" :y="lanesHeight + 24" text-anchor="middle">{{ t.label }}</text>
          </g>
        </g>
        <a
          v-for="m in marks"
          :key="m.e.id"
          class="tick"
          :class="[`is-${m.e.kind}`, { 'is-active': m.i === active }]"
          :href="m.e.url"
          target="_blank"
          rel="noopener noreferrer"
          :tabindex="m.i === active ? 0 : -1"
          :aria-label="describe(m.e)"
          :style="{ '--i': m.i }"
          @pointerenter="active = m.i"
          @focus="active = m.i"
          @keydown="onKey"
        >
          <rect class="hit" :x="m.x - Math.max(STEP, 12) / 2" y="0" :width="Math.max(STEP, 12)" :height="lanesHeight" />
          <rect v-if="m.e.kind === 'release'" class="mark" :x="m.x - 5" :y="m.y - 5" width="10" height="10" />
          <rect v-else class="mark" :x="m.x - 1" :y="m.y - 7" width="2" height="14" />
        </a>
      </svg>
    </div>
    <figcaption class="ribbon-caption">
      <span v-if="current" class="ribbon-now">
        <time class="mono faint" :datetime="current.at">{{ shortDate(current.at) }}</time>
        <strong>{{ current.title }}</strong>
        <span v-if="current.words" class="muted">{{ current.words }}</span>
        <span v-if="current.channels.length" class="mono faint">{{ current.channels.join(" · ") }}</span>
      </span>
      <span class="ribbon-legend mono faint" aria-hidden="true">
        <i class="key key-release"></i> release <i class="key key-pr"></i> merged pull request
        <template v-if="breaks.length"><i class="key-break">//</i> more than a week</template>
      </span>
    </figcaption>
  </figure>
</template>

<style>
.ribbon {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  container-type: inline-size;
}
.lane-labels {
  display: none;
}
/* Below 900px the drawing keeps its minimum width and scrolls, so it is always drawn at 0.75:1 and
   a lane is 31.5px tall: the pinned names can be placed from that alone. */
@container (max-width: 899px) {
  .lane-name {
    display: none;
  }
  .lane-labels {
    display: block;
    position: absolute;
    inset: 0 auto auto 0;
    z-index: 1;
    margin: 0;
    padding: 0;
    list-style: none;
    pointer-events: none;
  }
  .lane-labels li {
    position: absolute;
    left: 0;
    top: calc(7px + var(--lane) * 31.5px);
    padding-right: 8px;
    background: var(--bg);
    color: var(--text-3);
    font-family: var(--mono);
    font-size: 11px;
    line-height: 14px;
    white-space: nowrap;
  }
}
/* row-reverse puts the scroll origin at the newest end, so a phone opens on today without any JS. */
.ribbon-scroll {
  display: flex;
  flex-direction: row-reverse;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--rule) transparent;
  background-image: radial-gradient(circle at 1px 1px, var(--grid-dot) 1px, transparent 0);
  background-size: 24px 24px;
  padding: 6px 0 2px;
}
.ribbon-svg {
  flex: none;
  width: 100%;
  min-width: 900px;
  height: auto;
  overflow: visible;
}
.lane-name {
  fill: var(--text-3);
  font-family: var(--mono);
  font-size: 11px;
}
.lane-line {
  stroke: var(--rule-2);
  stroke-width: 1;
}
.ribbon-axis line {
  stroke: var(--rule);
}
.ribbon-axis text {
  fill: var(--text-3);
  font-family: var(--mono);
  font-size: 10.5px;
}
/* The SVG is drawn smaller than 1:1 below 1200px, so its type is set larger to land near 11px. */
@media (max-width: 1240px) {
  .lane-name {
    font-size: 13px;
  }
  .ribbon-axis text {
    font-size: 12.5px;
  }
}
@media (max-width: 760px) {
  .lane-name {
    font-size: 14.5px;
  }
  .ribbon-axis text {
    font-size: 13.5px;
  }
}
.ribbon-break rect {
  fill: var(--bg);
}
.ribbon-break path {
  stroke: var(--text-3);
  stroke-width: 1;
  fill: none;
}
.ribbon-guide {
  stroke: var(--text-3);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}
.tick .hit {
  fill: transparent;
}
.tick .mark {
  fill: var(--signal);
  transition: transform var(--t-fast) var(--ease-out);
  transform-box: fill-box;
  transform-origin: center;
}
.tick.is-pr .mark {
  fill: var(--text-2);
}
.tick.is-active .mark {
  transform: scale(1.35);
}
.tick.is-active.is-pr .mark {
  fill: var(--text);
}
.tick:focus-visible {
  outline: none;
}
.tick:focus-visible .hit {
  stroke: var(--signal);
  stroke-width: 1.5;
}
.ribbon-caption {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px 24px;
  flex-wrap: wrap;
  min-height: 3.2em;
}
.ribbon-now {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  font-size: var(--fs-small);
}
.ribbon-legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-mono-s);
}
.key {
  display: inline-block;
  background: var(--signal);
}
.key-release {
  width: 8px;
  height: 8px;
}
.key-pr {
  width: 2px;
  height: 11px;
  background: var(--text-2);
  margin-left: 10px;
}
.key-break {
  font-style: normal;
  margin-left: 10px;
}

/* The draw-in: lanes rule across, then each thing that shipped lands in order. */
.motion .ribbon.reveal .lane-line {
  transform: scaleX(0);
  transform-box: fill-box;
  transform-origin: left;
}
.motion .ribbon.reveal .tick .mark {
  opacity: 0;
  transform: scale(0.2);
}
.motion .ribbon.reveal.visible .lane-line {
  transform: none;
  transition: transform 900ms var(--ease-out);
}
.motion .ribbon.reveal.visible .tick .mark {
  animation: land 420ms var(--ease-out) forwards;
  animation-delay: calc(240ms + var(--i) * 24ms);
}
.motion .ribbon.reveal.visible .tick.is-active .mark {
  animation-name: land-active;
}
@keyframes land {
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes land-active {
  to {
    opacity: 1;
    transform: scale(1.35);
  }
}
</style>
