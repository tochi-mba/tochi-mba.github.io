<script setup lang="ts">
import { computed } from "vue";

// A day-by-day line with no axes: the number it illustrates is always printed next to it.
const props = defineProps<{ values: number[]; label: string }>();
const W = 120;
const H = 28;
const points = computed(() => {
  const max = Math.max(1, ...props.values);
  const step = props.values.length > 1 ? W / (props.values.length - 1) : W;
  return props.values.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`).join(" ");
});
</script>

<template>
  <span class="spark">
    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" aria-hidden="true">
      <line x1="0" :x2="W" :y1="H - 1" :y2="H - 1" />
      <polyline :points="points" />
    </svg>
    <span class="mono faint">{{ label }}</span>
  </span>
</template>

<style>
.spark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-mono-s);
}
.spark line {
  stroke: var(--rule);
}
.spark polyline {
  fill: none;
  stroke: var(--signal);
  stroke-width: 1.5;
  stroke-linejoin: round;
}
</style>
