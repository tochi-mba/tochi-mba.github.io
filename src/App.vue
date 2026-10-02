<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { defineAsyncComponent, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from "vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { profile } from "./data";
import { paletteOpen } from "./palette";

// The command palette is fetched the first time it is asked for, and then kept.
const CommandPalette = defineAsyncComponent(() => import("./components/CommandPalette.vue"));
const paletteWanted = ref(false);
watch(paletteOpen, (open) => {
  if (open) paletteWanted.value = true;
});

function onShortcut(event: KeyboardEvent) {
  if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
  event.preventDefault();
  paletteOpen.value = !paletteOpen.value;
}

useHead({
  titleTemplate: (t) => (t ? `${t} · ${profile.name}` : `${profile.name} · ${profile.role}`),
  htmlAttrs: { lang: "en" },
  meta: [
    { name: "description", content: profile.lede },
    { property: "og:site_name", content: profile.name },
    { property: "og:type", content: "website" },
    { property: "og:image", content: `${profile.site}og.png` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "index,follow" },
  ],
});

// After a page change, put focus on the new page's heading, so screen readers and keyboard users
// land where the content starts rather than where the old focus was. The transition's own hook
// is used because it fires once the new page is really in the document, however long the
// transition took (including the near-zero duration under reduced motion).
function focusHeading() {
  const h1 = document.querySelector<HTMLElement>("main h1");
  if (!h1) return;
  h1.setAttribute("tabindex", "-1");
  h1.focus({ preventScroll: true });
}

// Opt into motion only when the person has not asked for less of it; CSS keys off this class so a
// reduced-motion visit, or a visit without JavaScript, shows everything in place. Decided before
// anything mounts (and never on the server), so a component can read it as it mounts.
let removeMotionListener = () => {};
onBeforeMount(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const apply = () => root.classList.toggle("motion", !reduce.matches);
  apply();
  reduce.addEventListener("change", apply);
  removeMotionListener = () => reduce.removeEventListener("change", apply);
});

onMounted(() => {
  const root = document.documentElement;
  if (window.matchMedia("(pointer: fine)").matches) root.classList.add("pointer-fine");
  document.addEventListener("keydown", onShortcut);
  // Tests and anything else that must wait for the app wait for this, not for a timeout.
  root.dataset.hydrated = "true";
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onShortcut);
  removeMotionListener();
});
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <SiteHeader />
  <main id="main">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in" @after-enter="focusHeading">
        <component :is="Component" :key="$route.path" />
      </transition>
    </router-view>
  </main>
  <SiteFooter />
  <CommandPalette v-if="paletteWanted" />
</template>
