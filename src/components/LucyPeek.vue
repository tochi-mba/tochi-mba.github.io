<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { announcement, caption, FACE_COLOR, isLive, trickAt } from "../lucyFace";

// Lucy in the hero. Asleep she is a still inline drawing and costs nothing; a click imports the
// real face (agent-robot-avatar, the same element LUCY-ui uses) and wakes her, eyes on the
// cursor. Out of view or in a hidden tab she goes back to sleep, so no page animates unwatched.
const props = withDefaults(
  defineProps<{
    /** Seam for tests: how the custom element's definition is loaded. */
    load?: () => Promise<unknown>;
  }>(),
  { load: () => import("agent-robot-avatar") },
);

interface FaceElement extends HTMLElement {
  play(action: string): unknown;
  wake(): unknown;
}

const root = ref<HTMLElement | null>(null);
const face = ref<FaceElement | null>(null);
const awake = ref(false);
const inView = ref(true);
const hidden = ref(false);
const pats = ref(0);
const said = ref("");

const live = computed(() => isLive({ awake: awake.value, inView: inView.value, hidden: hidden.value }));
const label = computed(() => caption({ awake: awake.value }));

async function pat(): Promise<void> {
  if (!awake.value) {
    await props.load();
    awake.value = true;
    said.value = announcement(null);
    return;
  }
  const trick = trickAt(pats.value);
  pats.value += 1;
  said.value = announcement(trick);
  const playing = face.value?.play(trick);
  if (playing instanceof Promise) playing.catch(() => {});
}

let watcher: IntersectionObserver | null = null;
const onVisibility = () => {
  hidden.value = document.hidden;
};

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  if (typeof IntersectionObserver === "undefined" || root.value === null) return;
  watcher = new IntersectionObserver(([entry]) => {
    inView.value = entry?.isIntersecting ?? true;
  });
  watcher.observe(root.value);
});
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  watcher?.disconnect();
});
</script>

<template>
  <div ref="root" class="lucy-peek">
    <button type="button" class="lucy-peek-face" :aria-label="label" :title="label" @click="pat">
      <agent-robot-avatar v-if="live" ref="face" size="104" :color="FACE_COLOR" auto-sleep="0" motion="auto" />
      <svg v-else class="lucy-asleep" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="10" r="4" :fill="FACE_COLOR" opacity="0.6" />
        <rect x="8" y="16" width="88" height="82" rx="30" :fill="FACE_COLOR" />
        <path d="M32 58q6 6 12 0M60 58q6 6 12 0" stroke="#f4f4eb" stroke-width="4" stroke-linecap="round" fill="none" />
      </svg>
    </button>
    <p class="lucy-peek-caption mono">{{ live ? "lucy-ui, in the flesh · pat her" : "psst — wake Lucy" }}</p>
    <p class="sr-only" role="status" aria-live="polite">{{ said }}</p>
  </div>
</template>

<style scoped>
.lucy-peek {
  display: grid;
  justify-items: center;
  gap: 4px;
}
.lucy-peek-face {
  display: grid;
  place-items: center;
  width: 128px;
  height: 128px;
  padding: 10px;
  border: 1px solid var(--rule);
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--signal) 22%, transparent), transparent 70%), var(--bg-2);
  color: var(--text);
  cursor: pointer;
  transition: border-color 150ms ease;
}
.lucy-peek-face:hover {
  border-color: var(--signal);
}
.lucy-asleep {
  width: 104px;
  height: 104px;
}
.lucy-peek-caption {
  font-size: 11px;
  color: var(--text-3);
}
</style>
