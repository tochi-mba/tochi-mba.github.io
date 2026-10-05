<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { lucyFamily, type Project } from "../data";
import { advance, clampPull, driftLoop, type Vec } from "../systemMotion";
import { journeys, traceFor } from "../systemTrace";

// The hub in the middle, keyring (the vault everything authenticates against) directly beneath it,
// and the rest of the family around the ring. Positions are computed from the list alone, so the
// picture is stable between builds and makes room when a service is added.
//
// It is prerendered still. Once the browser is running, and only when motion is allowed, it plays
// back what the family does: a mark travels from the hub to a service, to keyring and back, while
// the caption says which step that is; then it moves on to the next member. A person who hovers,
// focuses or drags takes over, and the tour waits. Members can be picked up; they spring home.
//
// What it costs while it plays is next to nothing: the drift is a CSS animation and each travelling
// mark a Web Animation, both run by the compositor; the steps of the tour are timers. Script runs
// every frame only while a member is being dragged or is springing home, and a line is redrawn
// only while one of its members is pulled away from its place.
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
/** A member's place in its box, as percentages so it scales with the box, and its drift loop. */
const slotStyle = (n: Node, i: number) => {
  const loop = driftLoop(i);
  return {
    left: `${(n.x / W) * 100}%`,
    top: `${(n.y / H) * 100}%`,
    "--loop": `${loop.seconds.toFixed(2)}s`,
    "--start": `${loop.delay.toFixed(2)}s`,
  };
};

const activeSlug = ref<string>(hub.slug);
const active = computed(() => nodes[indexOf.get(activeSlug.value) ?? 0]!);
const steps = computed(() => traceFor(active.value.project, hub, vault));
/** The step being played back, or -1 when nothing is moving and every step reads the same. */
const step = ref(-1);
/** Whether motion is allowed at all: decided on mount, never on the prerendered page. */
const canMove = ref(false);
/** The tour and the drift; the pause button turns both off. */
const playing = ref(true);
/** Whether the picture is on screen; the drift and the tour stop when it is not. */
const inView = ref(false);
const drifting = computed(() => canMove.value && playing.value && inView.value);
/** False while the tour is the one changing the selection, so a screen reader is not read a slideshow. */
const byPerson = ref(true);

// A role that only repeats the name says nothing, so it is not drawn.
const roleOf = (p: Project) => (p.role && p.role.toLowerCase() !== p.name.toLowerCase() ? p.role : "");

const edgeLit = (e: (typeof edges)[number]) => order[e.from] === activeSlug.value || order[e.to] === activeSlug.value;

const STEP_MS = 900;
const TRAVEL_MS = 720;
const DWELL_MS = 1500;
const HOLD_MS = 6000;
const PULL_LIMIT = 150;
/** Beyond this distance from its place a member counts as pulled, and its lines follow it. */
const PULLED = 2;

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
let hovering = false;
let focused = false;
let holdUntil = 0;
let dragging = -1;
let grab: Vec = { x: 0, y: 0 };
let box = { left: 0, top: 0 };
let lastPull = { at: 0, x: 0, y: 0 };
let timer = 0;
let travelling: Animation[] = [];

const mapShown = () => (stage.value?.getClientRects().length ?? 0) > 0;
const px = (units: number) => units * scale;

// ---- The tour: a timer per step, and the marks of each step played by the compositor.
function stopTravelling() {
  for (const animation of travelling) animation.cancel();
  travelling = [];
}

function playStep(index: number) {
  step.value = index;
  stopTravelling();
  const current = steps.value[index];
  if (!current) return;
  const at = (p: Vec) => `translate3d(${px(p.x - PULSE / 2)}px, ${px(p.y - PULSE / 2)}px, 0)`;
  journeys(current, services).forEach(([from, to], k) => {
    const el = pulseEls[k];
    if (!el || typeof el.animate !== "function") return;
    const a = home[indexOf.get(from)!]!;
    const b = home[indexOf.get(to)!]!;
    travelling.push(
      el.animate(
        [
          { transform: at(a), opacity: 1 },
          { transform: at(b), opacity: 1 },
        ],
        { duration: TRAVEL_MS, easing: "ease-in-out" },
      ),
    );
  });
}

function schedule(next: () => void, ms: number) {
  clearTimeout(timer);
  timer = window.setTimeout(next, ms);
}

function startTrace() {
  if (!canMove.value || !playing.value || !inView.value || !mapShown()) return;
  const play = (index: number) => {
    if (index < steps.value.length) {
      playStep(index);
      schedule(() => play(index + 1), STEP_MS);
      return;
    }
    step.value = -1;
    stopTravelling();
    schedule(tour, DWELL_MS);
  };
  play(0);
}

/** On to the next member, unless someone has taken over; then it asks again a little later. */
function tour() {
  if (!playing.value || !inView.value) return;
  const wait = Math.max(holdUntil - performance.now(), 0);
  if (hovering || focused || dragging !== -1 || wait > 0 || !mapShown()) {
    schedule(tour, Math.max(wait, 500));
    return;
  }
  byPerson.value = false;
  activeSlug.value = order[((indexOf.get(activeSlug.value) ?? 0) + 1) % order.length]!;
}

function stopTour() {
  clearTimeout(timer);
  step.value = -1;
  stopTravelling();
}

// ---- Dragging: the one time script runs every frame, until the member is home again.
const away = (i: number) => Math.hypot(pos[i]!.x - home[i]!.x, pos[i]!.y - home[i]!.y) > PULLED;

/** What each member was last given, so one at rest is not restyled. */
const written = new WeakMap<HTMLElement, string>();

function draw() {
  nodes.forEach((_, i) => {
    const el = nodeEls[i];
    if (!el) return;
    const dx = pos[i]!.x - home[i]!.x;
    const dy = pos[i]!.y - home[i]!.y;
    const transform = dx || dy ? `translate3d(${px(dx)}px, ${px(dy)}px, 0)` : "";
    if (written.get(el) === transform) return;
    written.set(el, transform);
    el.style.transform = transform;
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
}

/** Starts the frame loop if it is idle. It runs for as long as a member is held or springing. */
function wake() {
  if (raf || typeof requestAnimationFrame !== "function") return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function frame(now: number) {
  raf = 0;
  // The time since the last frame, up to a tenth of a second, so a tab that was in the background
  // does not fling a member on its return. `advance` splits it into 60 Hz steps.
  const elapsed = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
  last = now;
  let busy = dragging !== -1;
  nodes.forEach((_, i) => {
    if (i === dragging) return;
    // Once close enough and slow enough it lands exactly, so a member let go rests where it started.
    const next = advance(pos[i]!, vel[i]!, home[i]!, elapsed);
    pos[i] = next.pos;
    vel[i] = next.vel;
    if (!next.settled) busy = true;
  });
  draw();
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
  if (!value) holdUntil = Math.max(holdUntil, performance.now() + 2000);
}
function setFocus(value: boolean) {
  focused = value;
}
function togglePlaying() {
  playing.value = !playing.value;
  if (playing.value) startTrace();
  else stopTour();
}

function stopMotion() {
  stopTour();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  dragging = -1;
  root.value?.classList.remove("is-dragging");
  home.forEach((h, i) => {
    pos[i] = { ...h };
    vel[i] = { x: 0, y: 0 };
  });
  draw();
}

let observer: IntersectionObserver | null = null;
let resizer: ResizeObserver | null = null;
let removeMotionListener = () => {};
onMounted(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = () => {
    canMove.value = !reduce.matches;
    if (canMove.value) startTrace();
    else stopMotion();
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
      inView.value = Boolean(entry?.isIntersecting);
      if (!inView.value) {
        stopTour();
        return;
      }
      // The first time it is seen, it shows what the hub does; after that it just carries on.
      if (!started) {
        started = true;
        byPerson.value = false;
      }
      startTrace();
    },
    { threshold: 0.35 },
  );
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  resizer?.disconnect();
  removeMotionListener();
  stopTour();
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div ref="root" class="system-map" :class="{ 'can-move': canMove, drifting }">
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
        <span
          v-for="(n, i) in nodes"
          :key="n.project.slug"
          class="map-slot"
          :class="{ drifts: i > 1 }"
          :style="slotStyle(n, i)"
        >
          <button
            :ref="(el) => (nodeEls[i] = el as HTMLElement | null)"
            type="button"
            class="map-node"
            :class="{ 'map-hub': n.project.role === 'hub' || n.project.role === 'vault', 'is-active': activeSlug === n.project.slug }"
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
        </span>
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
