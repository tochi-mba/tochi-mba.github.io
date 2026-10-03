<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ languages: { name: string; share: number }[] }>();

// Six named rows and the rest folded into "Other": identity comes from the label, never a hue.
const rows = computed(() => {
  const top = props.languages.slice(0, 6);
  const rest = props.languages.slice(6).reduce((a, l) => a + l.share, 0);
  return rest > 0 ? [...top, { name: "Other", share: rest }] : top;
});
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => (v * 100 >= 10 ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(1)}%`);
</script>

<template>
  <div class="langs">
    <ol class="langs-list" aria-label="Languages by bytes of code across public repositories">
      <li v-for="(l, i) in rows" :key="l.name" class="langs-row" :style="{ '--i': i }">
        <span class="langs-name">{{ l.name }}</span>
        <span class="langs-track" aria-hidden="true"><span class="langs-bar" :style="{ '--w': pct(l.share) }"></span></span>
        <span class="langs-value">{{ pct1(l.share) }}</span>
      </li>
    </ol>
  </div>
</template>

<style>
.langs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.langs-row {
  display: grid;
  grid-template-columns: 110px 1fr 56px;
  align-items: center;
  gap: 12px;
  font-size: var(--fs-small);
}
.langs-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.langs-track {
  height: 3px;
  border-radius: 0;
  background: var(--rule);
  overflow: hidden;
}
.langs-bar {
  display: block;
  height: 100%;
  width: var(--w);
  background: var(--signal);
  transform-origin: left;
}
/* The bars grow from the left by scaling, not by changing width: a transform needs no layout. */
.motion .reveal .langs-bar {
  transform: scaleX(0);
}
.motion .reveal[data-revealed] .langs-bar {
  transform: none;
  transition: transform 0.9s var(--ease-out);
  transition-delay: calc(var(--i) * 60ms);
}
.langs-value {
  font-family: var(--mono);
  font-size: var(--fs-mono-s);
  color: var(--text-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 420px) {
  .langs-row {
    grid-template-columns: 90px 1fr 48px;
  }
}
</style>
