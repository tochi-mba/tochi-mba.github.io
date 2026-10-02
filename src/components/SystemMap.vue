<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { lucyFamily, type Project } from "../data";
import { along, clampPull, drift, settled, springStep, type Vec } from "../systemMotion";
import { journeys, traceFor } from "../systemTrace";

// The hub in the middle, keyring (the vault everything authenticates against) directly beneath it,
// and the rest of the family around the ring. Positions are computed from the list alone, so the
// picture is stable between builds and makes room when a service is added.
//
// It is prerendered still. Once the browser is running, and only when motion is allowed, it plays
// back what the family does: a mark travels from the hub to a service, to keyring and back, while
// the caption says which step that is; then it moves on to the next member. A person who hovers,
// focuses or drags takes over, and the tour waits. Nodes can be picked up; they spring home.
const hub = lucyFamily.find((p) => p.role === "hub")!;
const vault = lucyFamily.find((p) => p.role === "vault")!;
const ring = lucyFamily.filter((p) => p !== hub && p !== vault);

const W = 760;
const H = 470;
const cx = W / 2;
const cy = 205;
const rx = 300;
const ry = 172;
const NODE_W = 112;
const NODE_H = 40;
const PULSE = 8;

interface Node {
  project: Project;
  x: number;
  y: number;
}
const nodes: Node[] = [
  { project: hub, x: cx, y: cy },
  { project: vault, x: cx, y: H - 32 },
  ...ring.map((p, i) => {
    // Three quarters of the ellipse, over the top from lower left to lower right: the gap at the
    // bottom is keyring's.
    const a = Math.PI * (0.75 + (1.5 * i) / Math.max(1, ring.length - 1));
    return { project: p, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  }),
];
const order = nodes.map((n) => n.project.slug);
const indexOf = new Map(order.map((slug, i) => [slug, i]));
const services = nodes.filter((n) => n.project.category === "service").map((n) => n.project.slug);
const edges = nodes.flatMap((n, i) => {
  if (i === 0) return [];
  const out = [{ from: 0, to: i, key: `hub-${n.project.slug}` }];
  if (i !== 1) out.push({ from: 1, to: i, key: `vault-${n.project.slug}` });
  return out;
});

const activeSlug = ref<string>(hub.slug);
const active = computed(() => nodes[indexOf.get(activeSlug.value) ?? 0]!);
const steps = computed(() => traceFor(active.value.project, hub, vault));
/** The step being played back, or -1 when nothing is moving and every step reads the same. */
const step = ref(-1);
/** Whether motion is allowed at all: decided on mount, never on the prerendered page. */
const canMove = ref(false);
/** The tour and the drift; the pause button turns both off. */
const playing = ref(true);
/** False while the tour is the one changing the selection, so a screen reader is not read a slideshow. */
const byPerson = ref(true);

// A role that only repeats the name says nothing, so it is not drawn.
const roleOf = (p: Project) => (p.role && p.role.toLowerCase() !== p.name.toLowerCase() ? p.role : "");

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
const edgeLit = (e: (typeof edges)[number]) => order[e.from] === activeSlug.value || order[e.to] === activeSlug.value;

// ---- Movement. Plain arrays and direct attribute writes: sixty frames a second is no place for
// reactivity, and Vue leaves an attribute alone as long as the value it rendered has not changed.
const STEP_MS = 900;
const TRAVEL_MS = 720;
const DWELL_MS = 1500;
const HOLD_MS = 6000;
const PULL_LIMIT = 150;

const root = ref<HTMLElement | null>(null);
const svg = ref<SVGSVGElement | null>(null);
const nodeEls: (Element | null)[] = [];
const edgeEls: (Element | null)[] = [];
const pulseEls: (SVGElement | null)[] = [];
const home: Vec[] = nodes.map((n) => ({ x: n.x, y: n.y }));
const pos: Vec[] = home.map((h) => ({ ...h }));
const vel: Vec[] = home.map(() => ({ x: 0, y: 0 }));

let raf = 0;
let last = 0;
let inView = false;
let hovering = false;
let focused = false;
let holdUntil = 0;
let dragging = -1;
let grab: Vec = { x: 0, y: 0 };
let lastPull = { at: 0, x: 0, y: 0 };
let traceStart = 0;
let traceEnd = 0;
let pulses: { from: number; to: number; start: number }[] = [];

function wake() {
  if (raf || typeof requestAnimationFrame !== "function") return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function playStep(index: number, now: number) {
  step.value = index;
  const current = steps.value[index];
  pulses = current
    ? journeys(current, services).map(([from, to]) => ({ from: indexOf.get(from)!, to: indexOf.get(to)!, start: now }))
    : [];
}

function startTrace() {
  if (!canMove.value || !playing.value || !mapShown()) return;
  traceStart = performance.now();
  traceEnd = 0;
  playStep(0, traceStart);
  wake();
}

function advanceTrace(now: number) {
  if (traceStart === 0) return;
  const index = Math.floor((now - traceStart) / STEP_MS);
  if (index === step.value) return;
  if (index < steps.value.length) {
    playStep(index, now);
    return;
  }
  traceStart = 0;
  traceEnd = now;
  step.value = -1;
  pulses = [];
}

const mapShown = () => (svg.value?.getClientRects().length ?? 0) > 0;

function tour(now: number) {
  const free = playing.value && inView && !hovering && !focused && dragging === -1 && now > holdUntil;
  if (!free || traceStart !== 0 || now - traceEnd < DWELL_MS || !mapShown()) return;
  byPerson.value = false;
  activeSlug.value = order[((indexOf.get(activeSlug.value) ?? 0) + 1) % order.length]!;
}

function draw(now: number) {
  nodes.forEach((_, i) => {
    nodeEls[i]?.setAttribute("transform", `translate(${pos[i]!.x - NODE_W / 2} ${pos[i]!.y - NODE_H / 2})`);
  });
  edges.forEach((e, i) => {
    const el = edgeEls[i];
    if (!el) return;
    el.setAttribute("x1", String(pos[e.from]!.x));
    el.setAttribute("y1", String(pos[e.from]!.y));
    el.setAttribute("x2", String(pos[e.to]!.x));
    el.setAttribute("y2", String(pos[e.to]!.y));
  });
  pulseEls.forEach((el, i) => {
    if (!el) return;
    const pulse = pulses[i];
    const t = pulse ? (now - pulse.start) / TRAVEL_MS : 2;
    if (!pulse || t > 1) {
      el.style.opacity = "0";
      return;
    }
    const at = along(pos[pulse.from]!, pos[pulse.to]!, t);
    el.setAttribute("x", String(at.x - PULSE / 2));
    el.setAttribute("y", String(at.y - PULSE / 2));
    el.style.opacity = "1";
  });
}

function frame(now: number) {
  raf = 0;
  if (!canMove.value) return;
  const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
  last = now;
  const drifting = playing.value && inView && canMove.value;
  let busy = drifting || dragging !== -1 || traceStart !== 0;
  nodes.forEach((_, i) => {
    if (i === dragging) return;
    // The hub and keyring are the fixed points; the ring floats around them.
    const offset = drifting && i > 1 ? drift(i, now / 1000) : { x: 0, y: 0 };
    const target = { x: home[i]!.x + offset.x, y: home[i]!.y + offset.y };
    const next = springStep(pos[i]!, vel[i]!, target, dt);
    // Close enough and slow enough: land exactly, so a node let go comes to rest where it started.
    const rest = settled(next.pos, next.vel, target);
    pos[i] = rest ? { ...target } : next.pos;
    vel[i] = rest ? { x: 0, y: 0 } : next.vel;
    if (!rest) busy = true;
  });
  advanceTrace(now);
  tour(now);
  draw(now);
  if (busy) wake();
}

function pick(slug: string) {
  byPerson.value = true;
  holdUntil = performance.now() + HOLD_MS;
  if (activeSlug.value === slug) startTrace();
  else activeSlug.value = slug;
}
watch(activeSlug, startTrace);

function onKey(event: KeyboardEvent) {
  const i = indexOf.get(activeSlug.value) ?? 0;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    pick(order[(i + 1) % order.length]!);
    event.preventDefault();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    pick(order[(i - 1 + order.length) % order.length]!);
    event.preventDefault();
  }
}

function toLocal(event: PointerEvent): Vec {
  const matrix = svg.value?.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
function onDown(event: PointerEvent, i: number) {
  if (!canMove.value || event.button !== 0) return;
  (event.currentTarget as Element).setPointerCapture(event.pointerId);
  const at = toLocal(event);
  dragging = i;
  grab = { x: at.x - pos[i]!.x, y: at.y - pos[i]!.y };
  lastPull = { at: event.timeStamp, x: pos[i]!.x, y: pos[i]!.y };
  root.value?.classList.add("is-dragging");
  wake();
}
function onMove(event: PointerEvent, i: number) {
  if (dragging !== i) return;
  const at = toLocal(event);
  const next = clampPull(home[i]!, { x: at.x - grab.x, y: at.y - grab.y }, PULL_LIMIT);
  // Remember how fast it was moving, so letting go mid-swing throws it rather than dropping it.
  const dt = Math.max(0.001, (event.timeStamp - lastPull.at) / 1000);
  vel[i] = { x: (next.x - lastPull.x) / dt, y: (next.y - lastPull.y) / dt };
  lastPull = { at: event.timeStamp, x: next.x, y: next.y };
  pos[i] = next;
  wake();
}
function onUp(i: number) {
  if (dragging !== i) return;
  dragging = -1;
  const speed = Math.hypot(vel[i]!.x, vel[i]!.y);
  if (speed > 1200) vel[i] = { x: (vel[i]!.x / speed) * 1200, y: (vel[i]!.y / speed) * 1200 };
  holdUntil = performance.now() + HOLD_MS;
  root.value?.classList.remove("is-dragging");
  wake();
}

function setHover(value: boolean) {
  hovering = value;
  if (!value) holdUntil = performance.now() + 2000;
  wake();
}
function setFocus(value: boolean) {
  focused = value;
  wake();
}
function togglePlaying() {
  playing.value = !playing.value;
  if (!playing.value) stopMotion();
  else startTrace();
  wake();
}

function stopMotion() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  traceStart = 0;
  step.value = -1;
  pulses = [];
  dragging = -1;
  root.value?.classList.remove("is-dragging");
  home.forEach((h, i) => {
    pos[i] = { ...h };
    vel[i] = { x: 0, y: 0 };
  });
  draw(performance.now());
}

let observer: IntersectionObserver | null = null;
let removeMotionListener = () => {};
onMounted(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = () => {
    canMove.value = !reduce.matches;
    if (!canMove.value) stopMotion();
    else if (inView) {
      startTrace();
      wake();
    }
  };
  applyMotion();
  reduce.addEventListener("change", applyMotion);
  removeMotionListener = () => reduce.removeEventListener("change", applyMotion);
  if (!root.value || !("IntersectionObserver" in window)) return;
  let started = false;
  observer = new IntersectionObserver(
    ([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      if (!inView) return;
      // The first time it is seen, it shows what the hub does; after that it just carries on.
      if (!started) {
        started = true;
        byPerson.value = false;
        startTrace();
      }
      wake();
    },
    { threshold: 0.35 },
  );
  observer.observe(root.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  removeMotionListener();
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div ref="root" class="system-map" :class="{ 'can-move': canMove }">
    <div class="map-stage">
      <svg
        ref="svg"
        class="map-svg"
        :viewBox="`0 0 ${W} ${H}`"
        role="group"
        aria-label="Map of the LUCY service family. Use the arrow keys to move between services."
        tabindex="0"
        @keydown="onKey"
        @pointerenter="setHover(true)"
        @pointerleave="setHover(false)"
        @focusin="setFocus(true)"
        @focusout="setFocus(false)"
      >
        <g>
          <line
            v-for="(e, i) in edges"
            :key="e.key"
            :ref="(el) => (edgeEls[i] = el as Element | null)"
            class="map-edge"
            :class="{ 'is-active': edgeLit(e) }"
            :x1="nodes[e.from]!.x"
            :y1="nodes[e.from]!.y"
            :x2="nodes[e.to]!.x"
            :y2="nodes[e.to]!.y"
          />
        </g>
        <g aria-hidden="true">
          <rect
            v-for="i in services.length"
            :key="i"
            :ref="(el) => (pulseEls[i - 1] = el as SVGElement | null)"
            class="map-pulse"
            :width="PULSE"
            :height="PULSE"
          />
        </g>
        <g
          v-for="(n, i) in nodes"
          :key="n.project.slug"
          :ref="(el) => (nodeEls[i] = el as Element | null)"
          class="map-node"
          :class="{ 'map-hub': n.project.role === 'hub' || n.project.role === 'vault', 'is-active': activeSlug === n.project.slug, 'is-lit': isLit(n) }"
          :transform="`translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`"
          role="button"
          :aria-pressed="activeSlug === n.project.slug"
          :aria-label="roleOf(n.project) ? `${n.project.name}: ${n.project.role}` : n.project.name"
          tabindex="-1"
          @pointerenter="pick(n.project.slug)"
          @focus="pick(n.project.slug)"
          @click="pick(n.project.slug)"
          @pointerdown="onDown($event, i)"
          @pointermove="onMove($event, i)"
          @pointerup="onUp(i)"
          @pointercancel="onUp(i)"
        >
          <rect :width="NODE_W" :height="NODE_H" rx="10" />
          <text :x="NODE_W / 2" :y="roleOf(n.project) ? 17 : 24.5" text-anchor="middle">{{ n.project.name }}</text>
          <text v-if="roleOf(n.project)" class="role" :x="NODE_W / 2" y="31" text-anchor="middle">{{ n.project.role }}</text>
        </g>
      </svg>
      <button v-if="canMove" class="map-play mono" type="button" :aria-pressed="!playing" @click="togglePlaying">
        {{ playing ? "Pause" : "Play" }}<span class="sr-only"> the tour of the family</span>
      </button>
    </div>
    <!-- On a narrow screen the picture would be too small to read or touch, so the same family is a list. -->
    <ul class="map-list" aria-label="The LUCY service family">
      <li v-for="n in nodes" :key="n.project.slug">
        <button class="map-chip" type="button" :aria-pressed="activeSlug === n.project.slug" @click="pick(n.project.slug)">
          {{ n.project.name }}
        </button>
      </li>
    </ul>
    <div class="map-detail" :aria-live="byPerson ? 'polite' : 'off'">
      <span class="role-line">{{ [active.project.role, ...active.project.stack.slice(0, 3)].filter(Boolean).join(" · ") }}</span>
      <h3>{{ active.project.name }}</h3>
      <p>{{ active.project.tagline }}</p>
      <ol class="map-trace" :class="{ 'is-playing': step >= 0 }" aria-label="What happens">
        <li v-for="(s, i) in steps" :key="s.label" :class="{ 'is-now': step === i }">
          <span class="trace-label mono">{{ s.label }}</span>
          <span class="trace-note">{{ s.note }}</span>
        </li>
      </ol>
      <router-link class="link-arrow" :to="`/work/${active.project.slug}`">Open {{ active.project.name }} <span class="arrow" aria-hidden="true">→</span></router-link>
    </div>
  </div>
</template>
