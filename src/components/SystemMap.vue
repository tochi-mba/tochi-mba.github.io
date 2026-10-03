<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { lucyFamily, type Project } from "../data";
import { advance, along, clampPull, drift, type Vec } from "../systemMotion";
import { journeys, traceFor } from "../systemTrace";

// The hub in the middle, keyring (the vault everything authenticates against) directly beneath it,
// and the rest of the family around the ring. Positions are computed from the list alone, so the
// picture is stable between builds and makes room when a service is added.
//
// It is prerendered still. Once the browser is running, and only when motion is allowed, it plays
// back what the family does: a mark travels from the hub to a service, to keyring and back, while
// the caption says which step that is; then it moves on to the next member. A person who hovers,
// focuses or drags takes over, and the tour waits. Nodes can be picked up; they spring home.
//
// The lines are an SVG drawn once; the members and the travelling marks are HTML laid over it and
// moved with transforms, which the compositor applies without repainting anything. Drifting a few
// pixels never moves a line: its ends sit under the members, out of sight. A line is redrawn only
// while one of its members has been pulled away.
const hub = lucyFamily.find((p) => p.role === "hub")!;
const vault = lucyFamily.find((p) => p.role === "vault")!;
const ring = lucyFamily.filter((p) => p !== hub && p !== vault);

const W = 760;
const H = 470;
const cx = W / 2;
const cy = 205;
const rx = 300;
const ry = 172;
const PULSE = 8;
const DRIFT = 3;

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
/** Where a point of the picture sits in its box, as percentages, so it scales with the box. */
const at = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

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

const edgeLit = (e: (typeof edges)[number]) => order[e.from] === activeSlug.value || order[e.to] === activeSlug.value;

// ---- Movement. Plain arrays and direct style and attribute writes: sixty frames a second is no
// place for reactivity, and Vue leaves alone what it did not render (a transform, an edge's ends).
const STEP_MS = 900;
const TRAVEL_MS = 720;
const DWELL_MS = 1500;
const HOLD_MS = 6000;
const PULL_LIMIT = 150;

const root = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const nodeEls: (HTMLElement | null)[] = [];
const edgeEls: (Element | null)[] = [];
const pulseEls: (HTMLElement | null)[] = [];
const home: Vec[] = nodes.map((n) => ({ x: n.x, y: n.y }));
const pos: Vec[] = home.map((h) => ({ ...h }));
const vel: Vec[] = home.map(() => ({ x: 0, y: 0 }));
/** Which lines were last drawn away from home, so each is put back exactly once. */
const edgeAway: boolean[] = edges.map(() => false);

let raf = 0;
let last = 0;
/** Pixels per unit of the picture, kept up to date as the box is resized. */
let scale = 1;
let inView = false;
let hovering = false;
let focused = false;
let holdUntil = 0;
let dragging = -1;
let grab: Vec = { x: 0, y: 0 };
let box = { left: 0, top: 0 };
let lastPull = { at: 0, x: 0, y: 0 };
let traceStart = 0;
let traceEnd = 0;
let pulses: { from: number; to: number; start: number }[] = [];

/** Starts the frame loop if it is idle. The loop keeps itself going for as long as something moves. */
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

const mapShown = () => (stage.value?.getClientRects().length ?? 0) > 0;

function tour(now: number) {
  const free = playing.value && inView && !hovering && !focused && dragging === -1 && now > holdUntil;
  if (!free || traceStart !== 0 || now - traceEnd < DWELL_MS || !mapShown()) return;
  byPerson.value = false;
  activeSlug.value = order[((indexOf.get(activeSlug.value) ?? 0) + 1) % order.length]!;
}

const away = (i: number) => Math.hypot(pos[i]!.x - home[i]!.x, pos[i]!.y - home[i]!.y) > DRIFT + 0.5;
const px = (units: number) => units * scale;

/** What each element was last given, so a member at rest is not restyled sixty times a second. */
const written = new WeakMap<HTMLElement, string>();
function setStyle(el: HTMLElement, transform: string, opacity: string) {
  const value = `${transform}|${opacity}`;
  if (written.get(el) === value) return;
  written.set(el, value);
  el.style.transform = transform;
  el.style.opacity = opacity;
}

function draw(now: number) {
  nodes.forEach((_, i) => {
    const el = nodeEls[i];
    if (!el) return;
    const dx = pos[i]!.x - home[i]!.x;
    const dy = pos[i]!.y - home[i]!.y;
    setStyle(el, dx || dy ? `translate3d(${px(dx)}px, ${px(dy)}px, 0)` : "", "");
  });
  edges.forEach((e, i) => {
    const el = edgeEls[i];
    const pulled = away(e.from) || away(e.to);
    if (!el || (!pulled && !edgeAway[i])) return;
    // A line follows a member that has been pulled away, and goes back home with it.
    const from = pulled ? pos[e.from]! : home[e.from]!;
    const to = pulled ? pos[e.to]! : home[e.to]!;
    el.setAttribute("x1", String(from.x));
    el.setAttribute("y1", String(from.y));
    el.setAttribute("x2", String(to.x));
    el.setAttribute("y2", String(to.y));
    edgeAway[i] = pulled;
  });
  pulseEls.forEach((el, i) => {
    if (!el) return;
    const pulse = pulses[i];
    const t = pulse ? (now - pulse.start) / TRAVEL_MS : 2;
    if (!pulse || t > 1) {
      setStyle(el, el.style.transform, "0");
      return;
    }
    const point = along(pos[pulse.from]!, pos[pulse.to]!, t);
    setStyle(el, `translate3d(${px(point.x - PULSE / 2)}px, ${px(point.y - PULSE / 2)}px, 0)`, "1");
  });
}

function frame(now: number) {
  raf = 0;
  if (!canMove.value) return;
  // The time since the last frame, up to a tenth of a second, so a tab that was in the background
  // does not fling every node on its return. `advance` splits it into 60 Hz steps.
  const elapsed = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
  last = now;
  const drifting = playing.value && inView && canMove.value;
  let busy = drifting || dragging !== -1 || traceStart !== 0;
  nodes.forEach((_, i) => {
    if (i === dragging) return;
    // The hub and keyring are the fixed points; the ring floats around them.
    const offset = drifting && i > 1 ? drift(i, now / 1000, DRIFT) : { x: 0, y: 0 };
    const target = { x: home[i]!.x + offset.x, y: home[i]!.y + offset.y };
    // Once close enough and slow enough it lands exactly, so a node let go rests where it started.
    const next = advance(pos[i]!, vel[i]!, target, elapsed);
    pos[i] = next.pos;
    vel[i] = next.vel;
    if (!next.settled) busy = true;
  });
  advanceTrace(now);
  tour(now);
  draw(now);
  // Straight on to the next frame, keeping `last` as this frame's time: going through wake() would
  // restart the clock after this frame's own work and undercount the next frame's time.
  if (busy) raf = requestAnimationFrame(frame);
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

/** A pointer's position in the picture's own units. */
function toLocal(event: PointerEvent): Vec {
  return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale };
}
function onDown(event: PointerEvent, i: number) {
  if (!canMove.value || event.button !== 0 || !stage.value) return;
  (event.currentTarget as Element).setPointerCapture(event.pointerId);
  const rect = stage.value.getBoundingClientRect();
  box = { left: rect.left, top: rect.top };
  scale = rect.width / W || scale;
  const point = toLocal(event);
  dragging = i;
  grab = { x: point.x - pos[i]!.x, y: point.y - pos[i]!.y };
  lastPull = { at: event.timeStamp, x: pos[i]!.x, y: pos[i]!.y };
  root.value?.classList.add("is-dragging");
  wake();
}
function onMove(event: PointerEvent, i: number) {
  if (dragging !== i) return;
  const point = toLocal(event);
  const next = clampPull(home[i]!, { x: point.x - grab.x, y: point.y - grab.y }, PULL_LIMIT);
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
let resizer: ResizeObserver | null = null;
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
  if (!stage.value) return;
  if ("ResizeObserver" in window) {
    resizer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) scale = entry.contentRect.width / W;
    });
    resizer.observe(stage.value);
  }
  // The picture is what is watched, not the section: on a phone the picture is not drawn, so it is
  // never in view and nothing runs for it; turned sideways, it is drawn, comes into view and starts.
  if (!("IntersectionObserver" in window)) return;
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
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  resizer?.disconnect();
  removeMotionListener();
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div ref="root" class="system-map" :class="{ 'can-move': canMove }">
    <div ref="stage" class="map-stage">
      <svg class="map-lines" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true" focusable="false">
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
      </svg>
      <div
        class="map-nodes"
        role="group"
        aria-label="Map of the LUCY service family. Use the arrow keys to move between services."
        tabindex="0"
        @keydown="onKey"
        @pointerenter="setHover(true)"
        @pointerleave="setHover(false)"
        @focusin="setFocus(true)"
        @focusout="setFocus(false)"
      >
        <span
          v-for="i in services.length"
          :key="`pulse-${i}`"
          :ref="(el) => (pulseEls[i - 1] = el as HTMLElement | null)"
          class="map-pulse"
          aria-hidden="true"
        ></span>
        <button
          v-for="(n, i) in nodes"
          :key="n.project.slug"
          :ref="(el) => (nodeEls[i] = el as HTMLElement | null)"
          type="button"
          class="map-node"
          :class="{ 'map-hub': n.project.role === 'hub' || n.project.role === 'vault', 'is-active': activeSlug === n.project.slug }"
          :style="at(n.x, n.y)"
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
          <span class="map-node-name">{{ n.project.name }}</span>
          <span v-if="roleOf(n.project)" class="map-node-role">{{ n.project.role }}</span>
        </button>
      </div>
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
