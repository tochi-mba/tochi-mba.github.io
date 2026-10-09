<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  announcement,
  caption,
  FACE_COLOR,
  isLive,
  MOODS,
  type MoodFace,
  type MoodId,
  showMood,
  stageCaption,
  trickAt,
} from "../lucyFace";

// Lucy on her own page: the face LUCY-ui wears, big, with the moods a conversation moves her
// through as buttons. Asleep she is a still drawing and the page schedules no frames; a click
// imports the real face. Out of view or in a hidden tab she sleeps again, and wakes in the mood
// she was in.
const props = withDefaults(
  defineProps<{
    /** Seam for tests: how the custom element's definition is loaded. */
    load?: () => Promise<unknown>;
  }>(),
  { load: () => import("agent-robot-avatar") },
);

interface FaceElement extends HTMLElement, MoodFace {}

const root = ref<HTMLElement | null>(null);
const face = ref<FaceElement | null>(null);
const awake = ref(false);
const inView = ref(true);
const hidden = ref(false);
const small = ref(false);
const mood = ref<MoodId | null>(null);
const pats = ref(0);
const said = ref("");

const live = computed(() => isLive({ awake: awake.value, inView: inView.value, hidden: hidden.value }));
const size = computed(() => (small.value ? 148 : 200));
const label = computed(() => caption({ awake: awake.value }));
const line = computed(() => stageCaption({ awake: awake.value, mood: mood.value }));

async function wake(): Promise<void> {
  if (awake.value) return;
  await props.load();
  awake.value = true;
}

async function pat(): Promise<void> {
  if (!awake.value) {
    await wake();
    said.value = announcement(null);
    return;
  }
  mood.value = null;
  const trick = trickAt(pats.value);
  pats.value += 1;
  said.value = announcement(trick);
  const playing = face.value?.play(trick);
  if (playing instanceof Promise) playing.catch(() => {});
}

async function choose(id: MoodId): Promise<void> {
  // A face already on screen takes the mood now; one about to appear takes it when it mounts.
  // The mood is recorded before waking: the face that waking renders reads it as it mounts.
  const showing = face.value;
  mood.value = id;
  await wake();
  said.value = `Lucy shows ${stageCaption({ awake: true, mood: id })}`;
  if (showing !== null && upgraded(showing)) showMood(showing, id);
}

/** The element has its methods once its definition has loaded and upgraded it. */
function upgraded(element: HTMLElement): element is FaceElement {
  return typeof (element as Partial<FaceElement>).startWaiting === "function";
}

// A face that comes back (scrolled into view again, the tab shown again) is a new element: put
// it back in the mood it was in.
watch(face, (element) => {
  if (element !== null && mood.value !== null && upgraded(element)) showMood(element, mood.value);
});

let watcher: IntersectionObserver | null = null;
let narrow: MediaQueryList | null = null;
const onVisibility = () => {
  hidden.value = document.hidden;
};
const onNarrow = () => {
  small.value = narrow?.matches ?? false;
};

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  if (typeof window.matchMedia === "function") {
    narrow = window.matchMedia("(max-width: 760px)");
    onNarrow();
    narrow.addEventListener("change", onNarrow);
  }
  if (typeof IntersectionObserver === "undefined" || root.value === null) return;
  watcher = new IntersectionObserver(([entry]) => {
    inView.value = entry?.isIntersecting ?? true;
  });
  watcher.observe(root.value);
});
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  narrow?.removeEventListener("change", onNarrow);
  watcher?.disconnect();
});
</script>

<template>
  <figure ref="root" class="lucy-stage" :data-awake="awake" :data-mood="mood ?? undefined">
    <button type="button" class="lucy-stage-face" :aria-label="label" :title="label" @click="pat">
      <span class="lucy-stage-glow" aria-hidden="true" />
      <agent-robot-avatar
        v-if="live"
        ref="face"
        :size="size"
        :color="FACE_COLOR"
        auto-sleep="0"
        motion="auto"
      />
      <svg v-else class="lucy-stage-asleep" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="10" r="4" :fill="FACE_COLOR" opacity="0.6" />
        <rect x="8" y="16" width="88" height="82" rx="30" :fill="FACE_COLOR" />
        <path d="M32 58q6 6 12 0M60 58q6 6 12 0" stroke="#f4f4eb" stroke-width="4" stroke-linecap="round" fill="none" />
      </svg>
    </button>
    <figcaption class="lucy-stage-caption">
      <span class="lucy-stage-kicker mono">The face of LUCY-ui</span>
      <span class="lucy-stage-line">{{ line }}</span>
    </figcaption>
    <div class="lucy-stage-moods" role="group" aria-label="Show one of Lucy's moods">
      <button
        v-for="m in MOODS"
        :key="m.id"
        type="button"
        class="lucy-stage-mood mono"
        :aria-pressed="mood === m.id"
        @click="choose(m.id)"
      >
        {{ m.label }}
      </button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ said }}</p>
  </figure>
</template>

<style scoped>
.lucy-stage {
  --lucy-warn: light-dark(#b8441e, #ff774d);
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 14px;
  width: min(100%, 22rem);
}
.lucy-stage-face {
  position: relative;
  display: grid;
  place-items: center;
  width: 248px;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, var(--bg-2), var(--bg) 72%);
  color: var(--text);
  cursor: pointer;
  isolation: isolate;
  transition:
    border-color var(--t-fast, 150ms) ease,
    transform var(--t-fast, 150ms) var(--ease-out, ease-out);
}
.lucy-stage-face:hover {
  border-color: var(--signal);
}
.lucy-stage-face:active {
  transform: scale(0.98);
}
.lucy-stage-face:focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 4px;
}
/* A soft halo in the signal colour, brighter once she is awake. */
.lucy-stage-glow {
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--signal) 26%, transparent), transparent 66%);
  opacity: 0.55;
  transition: opacity var(--t-slow, 300ms) ease;
}
.lucy-stage[data-awake="true"] .lucy-stage-glow {
  opacity: 1;
}
.lucy-stage[data-mood="failed"] .lucy-stage-glow,
.lucy-stage[data-mood="needs_you"] .lucy-stage-glow {
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--lucy-warn) 30%, transparent), transparent 66%);
}
.lucy-stage-asleep {
  width: 168px;
  height: 168px;
}
.lucy-stage-caption {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
  min-height: 3.2em;
}
.lucy-stage-kicker {
  font-size: var(--fs-mono-s, 11px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}
.lucy-stage-line {
  color: var(--text-2);
  font-size: 0.95rem;
  max-width: 22rem;
  /* One line reserved, so waking her or changing mood never moves the page below. */
  min-height: 1.5em;
  text-wrap: balance;
}
.lucy-stage-moods {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.lucy-stage-mood {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--rule-2);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-2);
  font-size: var(--fs-mono-s, 12px);
  cursor: pointer;
  transition:
    border-color var(--t-fast, 150ms) ease,
    color var(--t-fast, 150ms) ease,
    background-color var(--t-fast, 150ms) ease;
}
.lucy-stage-mood:hover {
  border-color: var(--text-3);
  color: var(--text);
}
.lucy-stage-mood[aria-pressed="true"] {
  border-color: var(--signal);
  background: color-mix(in srgb, var(--signal) 14%, transparent);
  color: var(--text);
}
:global(html:not(.pointer-fine)) .lucy-stage-mood {
  min-height: 44px;
}
.lucy-stage-mood:focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .lucy-stage-face {
    width: 188px;
  }
  .lucy-stage-asleep {
    width: 128px;
    height: 128px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lucy-stage-face,
  .lucy-stage-glow,
  .lucy-stage-mood {
    transition: none;
  }
}
</style>
