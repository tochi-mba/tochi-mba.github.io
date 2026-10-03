<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { applyTheme, currentTheme, opposite, theme } from "../theme";

// The prerendered page cannot know the theme, so the button starts with a label that is true either
// way and names the theme it would switch to once the browser is running. Until a visitor chooses,
// the device decides, and the device can change its mind mid-visit (at sunset, say): the label
// follows it.
let device: MediaQueryList | null = null;
const follow = () => {
  theme.value = currentTheme();
};
onMounted(() => {
  follow();
  device = window.matchMedia("(prefers-color-scheme: light)");
  device.addEventListener("change", follow);
});
onBeforeUnmount(() => device?.removeEventListener("change", follow));
const next = computed(() => (theme.value ? opposite(theme.value) : null));

function toggle(event: MouseEvent) {
  const chosen = opposite(currentTheme());
  const root = document.documentElement;
  const still = !root.classList.contains("motion") || typeof document.startViewTransition !== "function";
  if (still) {
    applyTheme(chosen);
  } else {
    // The new theme opens from the control that asked for it. Keyboard activation has no pointer
    // position, so it opens from the button's own centre.
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    root.style.setProperty("--wipe-x", `${event.clientX || box.left + box.width / 2}px`);
    root.style.setProperty("--wipe-y", `${event.clientY || box.top + box.height / 2}px`);
    root.classList.add("theme-wipe");
    const transition = document.startViewTransition(() => applyTheme(chosen));
    transition.finished.finally(() => root.classList.remove("theme-wipe"));
  }
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="next ? `Switch to the ${next} theme` : 'Switch colour theme'"
    :title="next ? `Switch to the ${next} theme` : undefined"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5z" />
    </svg>
  </button>
</template>

<style>
.theme-toggle {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.theme-toggle:hover {
  color: var(--text);
}
.theme-toggle svg {
  width: 18px;
  height: 18px;
  transition: rotate var(--t-base) var(--ease-out);
}
.theme-toggle circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.theme-toggle path {
  fill: currentColor;
}
/* The half-filled disc turns over with the theme: the filled side is always the dark one. */
:root[data-theme="light"] .theme-toggle svg {
  rotate: 180deg;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) .theme-toggle svg {
    rotate: 180deg;
  }
}

/* The switch itself: the new theme opens as a circle from the control. Only under .motion. */
.theme-wipe::view-transition-old(root),
.theme-wipe::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
.theme-wipe::view-transition-new(root) {
  animation: theme-open 420ms var(--ease-out);
}
@keyframes theme-open {
  from {
    clip-path: circle(0 at var(--wipe-x) var(--wipe-y));
  }
  to {
    clip-path: circle(150vmax at var(--wipe-x) var(--wipe-y));
  }
}
</style>
