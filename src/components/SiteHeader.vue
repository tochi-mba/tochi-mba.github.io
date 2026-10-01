<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { profile } from "../data";

const route = useRoute();
const open = ref(false);
const scrolled = ref(false);
const progress = ref(0);
const menuButton = ref<HTMLButtonElement | null>(null);
const nav = ref<HTMLElement | null>(null);

const links = [
  { to: "/", label: "Home", exact: true },
  { to: "/work", label: "Work", exact: false },
  { to: "/about", label: "About", exact: false },
];

function isCurrent(link: (typeof links)[number]) {
  return link.exact ? route.path === link.to : route.path.startsWith(link.to);
}

function setMenu(value: boolean, returnFocus = false) {
  open.value = value;
  // Closing with the keyboard has to put focus somewhere sensible, or it falls back to the page.
  if (!value && returnFocus) menuButton.value?.focus();
}

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  scrolled.value = window.scrollY > 8;
  progress.value = max > 0 ? Math.min(1, window.scrollY / max) : 0;
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) setMenu(false, true);
}

// While the menu is open it is the whole page as far as the keyboard is concerned.
function onFocusIn(event: FocusEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (nav.value?.contains(target) || target === menuButton.value) return;
  nav.value?.querySelector<HTMLElement>("a")?.focus();
}

watch(
  () => route.fullPath,
  () => setMenu(false),
);

onMounted(() => {
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("keydown", onKey);
  document.addEventListener("focusin", onFocusIn);
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  document.removeEventListener("keydown", onKey);
  document.removeEventListener("focusin", onFocusIn);
});
</script>

<template>
  <header class="site-header" :class="{ scrolled }">
    <div class="scroll-progress" :style="{ '--progress': progress }" aria-hidden="true"></div>
    <div class="container nav-wrap">
      <router-link class="brand" to="/" :aria-label="`${profile.name}, home`">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 19 12 5l7 14M8.5 13h7" /></svg>
        </span>
        <span class="brand-lockup">
          <span class="brand-company">{{ profile.company }}</span>
          <span class="brand-name">{{ profile.name }}</span>
        </span>
      </router-link>
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
      <nav id="site-nav" ref="nav" class="site-nav" :class="{ open }" aria-label="Primary">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :aria-current="isCurrent(link) ? 'page' : undefined"
        >
          {{ link.label }}
        </router-link>
        <a class="nav-github" :href="profile.github" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
          GitHub
        </a>
      </nav>
    </div>
  </header>
</template>
