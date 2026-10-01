<script setup lang="ts">
import { computed, ref } from "vue";
import { level } from "../activity";

const props = defineProps<{ days: [string, number][]; total: number }>();

const cell = 12;
const gap = 3;
const step = cell + gap;

const max = computed(() => Math.max(1, ...props.days.map((d) => d[1])));
const first = computed(() => new Date(`${props.days[0]?.[0] ?? "1970-01-01"}T00:00:00Z`));

interface Cell {
  x: number;
  y: number;
  date: string;
  count: number;
  level: number;
  order: number;
}
const cells = computed<Cell[]>(() => {
  const startDow = first.value.getUTCDay();
  return props.days.map(([date, count], i) => {
    const idx = i + startDow;
    return {
      x: Math.floor(idx / 7) * step,
      y: (idx % 7) * step,
      date,
      count,
      level: level(count, max.value),
      order: i,
    };
  });
});
const weeks = computed(() => Math.ceil((props.days.length + first.value.getUTCDay()) / 7));
const width = computed(() => weeks.value * step - gap);
const height = 7 * step - gap;

const months = computed(() => {
  const out: { x: number; label: string }[] = [];
  let last = -1;
  for (const c of cells.value) {
    const d = new Date(`${c.date}T00:00:00Z`);
    if (d.getUTCMonth() !== last && d.getUTCDate() <= 7) {
      last = d.getUTCMonth();
      out.push({ x: c.x, label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) });
    }
  }
  return out;
});

const active = ref<Cell | null>(null);
const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const describe = (c: Cell) =>
  `${c.count === 0 ? "No" : c.count} contribution${c.count === 1 ? "" : "s"} on ${dateLabel(c.date)}`;

const busiest = computed(() => cells.value.reduce((a, b) => (b.count > a.count ? b : a), cells.value[0]!));
const activeDays = computed(() => props.days.filter((d) => d[1] > 0).length);
</script>

<template>
  <figure class="contrib">
    <div class="contrib-scroll" tabindex="0" aria-label="Contribution calendar, scrolls horizontally on small screens">
      <svg
        class="contrib-svg"
        :viewBox="`0 -18 ${width} ${height + 18}`"
        :width="width"
        :height="height + 18"
        role="img"
        :aria-label="`${total} contributions in the last year, ${activeDays} active days, busiest day ${busiest.count} on ${dateLabel(busiest.date)}`"
      >
        <text v-for="m in months" :key="m.x + m.label" class="contrib-month" :x="m.x" y="-6">{{ m.label }}</text>
        <rect
          v-for="c in cells"
          :key="c.date"
          class="contrib-cell"
          :class="[`l${c.level}`, { 'is-active': active?.date === c.date }]"
          :x="c.x"
          :y="c.y"
          :width="cell"
          :height="cell"
          rx="3"
          :style="{ '--i': c.order }"
          @pointerenter="active = c"
          @pointerleave="active = null"
          @focus="active = c"
          @blur="active = null"
          tabindex="-1"
        >
          <title>{{ describe(c) }}</title>
        </rect>
      </svg>
    </div>
    <figcaption class="contrib-caption">
      <span class="contrib-live" role="status" aria-live="polite">{{ active ? describe(active) : `${total} contributions in the last year · ${activeDays} active days` }}</span>
      <span class="contrib-legend" aria-hidden="true">
        Less
        <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>
        More
      </span>
    </figcaption>
  </figure>
</template>

<style>
.contrib {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.contrib-scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}
.contrib-svg {
  display: block;
  max-width: none;
}
.contrib-month {
  fill: var(--muted);
  font-family: var(--font);
  font-size: 10px;
  font-weight: 600;
}
.contrib-cell {
  fill: var(--raised);
  stroke: transparent;
  transition: fill var(--t-fast), stroke var(--t-fast);
}
.contrib-cell.l1 {
  fill: var(--heat-1);
}
.contrib-cell.l2 {
  fill: var(--heat-2);
}
.contrib-cell.l3 {
  fill: var(--heat-3);
}
.contrib-cell.l4 {
  fill: var(--heat-4);
}
.contrib-cell.is-active {
  stroke: var(--text);
  stroke-width: 1.5;
}
/* The year lights up left to right once it scrolls into view: each cell waits its turn. */
.motion .reveal .contrib-cell {
  opacity: 0;
  transform: scale(0.6);
  transform-box: fill-box;
  transform-origin: center;
}
.motion .reveal.visible .contrib-cell {
  animation: ignite 0.5s var(--ease-out) forwards;
  animation-delay: calc(var(--i) * 3ms);
}
@keyframes ignite {
  to {
    opacity: 1;
    transform: none;
  }
}
.contrib-caption {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--muted);
  font-family: var(--mono);
}
.contrib-live {
  min-height: 20px;
}
.contrib-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.contrib-legend i {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background: var(--raised);
}
.contrib-legend .l1 {
  background: var(--heat-1);
}
.contrib-legend .l2 {
  background: var(--heat-2);
}
.contrib-legend .l3 {
  background: var(--heat-3);
}
.contrib-legend .l4 {
  background: var(--heat-4);
}
</style>
