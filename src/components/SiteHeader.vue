<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { profile } from "../data";

const route = useRoute();
const open = ref(false);
const scrolled = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);
const nav = ref<HTMLElement | null>(null);

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

function onScroll() {
  scrolled.value = window.scrollY > 8;
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
    <div class="container nav-wrap">
      <router-link class="brand" to="/" :aria-label="`${profile.name}, home`">
        <span class="brand-name">{{ profile.name }}</span>
        <span class="brand-role" aria-hidden="true">AI engineer · UK</span>
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
        <a :href="profile.github" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>
</template>
