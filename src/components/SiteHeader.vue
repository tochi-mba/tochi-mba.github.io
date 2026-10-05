<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { profile } from "../data";
import { paletteOpen } from "../palette";
import ThemeToggle from "./ThemeToggle.vue";

const route = useRoute();
const open = ref(false);
// The prerendered page says Ctrl; a Mac says ⌘ once the browser is running.
const shortcut = ref("Ctrl K");

function openPalette() {
  setMenu(false);
  paletteOpen.value = true;
}
const menuButton = ref<HTMLButtonElement | null>(null);
const nav = ref<HTMLElement | null>(null);

// The header earns its border once the page has moved. A marker as tall as that first stretch of
// scrolling sits at the very top of the page, and an observer says when it has left the screen:
// reading the scroll position instead would make the browser lay the page out while it hydrates.
const scrolled = ref(false);
const marker = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const links = [
  { to: "/work", label: "Work" },
  { to: "/about", label: "About" },
];

function isCurrent(link: (typeof links)[number]) {
  return route.path.startsWith(link.to);
}

function setMenu(value: boolean, returnFocus = false) {
  open.value = value;
  // Closing with the keyboard has to put focus somewhere sensible, or it falls back to the page.
  if (!value && returnFocus) menuButton.value?.focus();
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) setMenu(false, true);
}

// While the menu is open it is the whole page as far as the keyboard is concerned.
function onFocusIn(event: FocusEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (nav.value?.contains(target) || target === menuButton.value) return;
  // The search and theme buttons sit between the brand and the menu button; they stay reachable.
  if (target instanceof Element && target.closest(".header-tools")) return;
  nav.value?.querySelector<HTMLElement>("a")?.focus();
}

watch(
  () => route.fullPath,
  () => setMenu(false),
);

onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform)) shortcut.value = "⌘ K";
  document.addEventListener("keydown", onKey);
  document.addEventListener("focusin", onFocusIn);
  if (!marker.value || !("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(([entry]) => {
    if (entry) scrolled.value = !entry.isIntersecting;
  });
  observer.observe(marker.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener("keydown", onKey);
  document.removeEventListener("focusin", onFocusIn);
});
</script>

<template>
  <span ref="marker" class="scroll-marker" aria-hidden="true"></span>
  <header class="site-header" :class="{ scrolled }">
    <div class="container nav-wrap">
      <router-link class="brand" to="/" :aria-label="`${profile.name}, home`">
        <span class="brand-name">{{ profile.name }}</span>
        <span class="brand-role" aria-hidden="true">AI engineer · UK</span>
      </router-link>
      <nav id="site-nav" ref="nav" class="site-nav" :class="{ open }" aria-label="Primary">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :aria-current="isCurrent(link) ? 'page' : undefined"
        >
          {{ link.label }}
        </router-link>
        <a :href="profile.github" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
      <div class="header-tools">
        <button
          class="palette-button"
          type="button"
          aria-label="Search the site"
          aria-haspopup="dialog"
          :title="`Search (${shortcut})`"
          @click="openPalette"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span class="palette-word" aria-hidden="true">Search</span>
          <kbd aria-hidden="true">{{ shortcut }}</kbd>
        </button>
        <ThemeToggle />
      </div>
      <button
        ref="menuButton"
        class="menu-button"
        type="button"
        :aria-expanded="open"
        aria-controls="site-nav"
        @click="setMenu(!open)"
      >
        <span class="sr-only">Toggle navigation</span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
    </div>
  </header>
</template>
