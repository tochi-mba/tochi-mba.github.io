<script setup lang="ts">
import { computed, ref } from "vue";
import { lucyFamily, type Project } from "../data";

// The hub in the middle, keyring (the vault everything authenticates against) directly beneath it,
// and the other services around the ring. Positions are fixed so the picture is stable between builds.
const hub = lucyFamily.find((p) => p.role === "hub")!;
const vault = lucyFamily.find((p) => p.role === "vault")!;
const ring = lucyFamily.filter((p) => p !== hub && p !== vault);

const W = 560;
const H = 380;
const cx = W / 2;
const cy = 170;
const rx = 240;
const ry = 130;

interface Node {
  project: Project;
  x: number;
  y: number;
}
const nodes = computed<Node[]>(() => {
  const n = ring.length;
  return [
    { project: hub, x: cx, y: cy },
    { project: vault, x: cx, y: H - 30 },
    ...ring.map((p, i) => {
      // Spread the ring over the top 300 degrees, leaving the bottom for keyring.
      const a = Math.PI * (1.17 + (1.66 * i) / Math.max(1, n - 1));
      return { project: p, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    }),
  ];
});

const activeSlug = ref<string>(hub.slug);
const active = computed(() => nodes.value.find((n) => n.project.slug === activeSlug.value)!);

function isLit(n: Node) {
  const a = active.value.project;
  return (
    n.project.slug === a.slug ||
    a.role === "hub" ||
    a.role === "vault" ||
    n.project.role === "hub" ||
    n.project.role === "vault"
  );
}
function edgeLit(from: Node, to: Node) {
  const a = activeSlug.value;
  return from.project.slug === a || to.project.slug === a;
}
const edges = computed(() =>
  nodes.value
    .filter((n) => n.project !== hub)
    .flatMap((n) => {
      const hubNode = nodes.value[0]!;
      const vaultNode = nodes.value[1]!;
      const out = [{ from: hubNode, to: n, key: `hub-${n.project.slug}` }];
      if (n.project !== vault) out.push({ from: vaultNode, to: n, key: `vault-${n.project.slug}` });
      return out;
    }),
);

function onKey(event: KeyboardEvent) {
  const order = nodes.value.map((n) => n.project.slug);
  const i = order.indexOf(activeSlug.value);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    activeSlug.value = order[(i + 1) % order.length]!;
    event.preventDefault();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    activeSlug.value = order[(i - 1 + order.length) % order.length]!;
    event.preventDefault();
  }
}
</script>

<template>
  <div class="system-map">
    <svg
      class="map-svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="group"
      aria-label="Map of the LUCY service family. Use the arrow keys to move between services."
      tabindex="0"
      @keydown="onKey"
    >
      <g>
        <line
          v-for="e in edges"
          :key="e.key"
          class="map-edge"
          :class="{ 'is-active': edgeLit(e.from, e.to) }"
          :x1="e.from.x"
          :y1="e.from.y"
          :x2="e.to.x"
          :y2="e.to.y"
        />
      </g>
      <g
        v-for="n in nodes"
        :key="n.project.slug"
        class="map-node"
        :class="{ 'map-hub': n.project.role === 'hub' || n.project.role === 'vault', 'is-active': activeSlug === n.project.slug, 'is-lit': isLit(n) }"
        :transform="`translate(${n.x - 52} ${n.y - 20})`"
        role="button"
        :aria-pressed="activeSlug === n.project.slug"
        :aria-label="`${n.project.name}: ${n.project.role}`"
        tabindex="-1"
        @pointerenter="activeSlug = n.project.slug"
        @focus="activeSlug = n.project.slug"
        @click="activeSlug = n.project.slug"
      >
        <rect width="104" height="40" rx="10" />
        <text x="52" y="17" text-anchor="middle">{{ n.project.name }}</text>
        <text class="role" x="52" y="31" text-anchor="middle">{{ n.project.role }}</text>
      </g>
    </svg>
    <div class="map-detail" aria-live="polite">
      <span class="role-line">{{ active.project.role }} · {{ active.project.stack.slice(0, 3).join(" · ") }}</span>
      <h3>{{ active.project.name }}</h3>
      <p>{{ active.project.tagline }}</p>
      <router-link class="link-arrow" :to="`/work/${active.project.slug}`">Open {{ active.project.name }} <span class="arrow" aria-hidden="true">→</span></router-link>
    </div>
  </div>
</template>
