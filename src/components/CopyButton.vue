<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";

const props = defineProps<{ text: string; label?: string }>();
const state = ref<"idle" | "done" | "failed">("idle");
const status = ref("");
let timer = 0;

async function copy() {
  // Emptied first, so a second copy is a change a screen reader announces again.
  status.value = "";
  await nextTick();
  try {
    await navigator.clipboard.writeText(props.text);
    state.value = "done";
    status.value = "Copied to the clipboard";
  } catch {
    state.value = "failed";
    status.value = "Could not copy";
  }
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    state.value = "idle";
  }, 1400);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <button class="copy-button" :class="{ done: state === 'done' }" type="button" @click="copy">
    {{ state === "done" ? "Copied" : state === "failed" ? "Copy failed" : (label ?? "Copy") }}
  </button>
  <!-- The button changing its own text says nothing to a screen reader; this does. -->
  <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
</template>
