<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProjectCard from "../components/ProjectCard.vue";
import { useReveal } from "../composables/useReveal";
import { CATEGORY_LABEL, type Category, profile, projects, totals } from "../data";

useHead({
  title: "Work",
  link: [{ rel: "canonical", href: `${profile.site}work` }],
  meta: [
    {
      name: "description",
      content: `All ${totals.shown} of ${profile.name}'s projects: products, AI and agent systems, services, tools and web work.`,
    },
    { property: "og:title", content: `Work · ${profile.name}` },
    { property: "og:url", content: `${profile.site}work` },
  ],
});

const route = useRoute();
const router = useRouter();
const { refresh } = useReveal();

const categories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => projects.some((p) => p.category === c));
const counts = Object.fromEntries(
  categories.map((c) => [c, projects.filter((p) => p.category === c).length]),
) as Record<Category, number>;

const category = ref<Category | "all">("all");
const query = ref("");
const searchInput = ref<HTMLInputElement | null>(null);

function readRoute() {
  const c = route.query.category;
  category.value = typeof c === "string" && categories.includes(c as Category) ? (c as Category) : "all";
  query.value = typeof route.query.q === "string" ? route.query.q : "";
}
readRoute();
watch(() => route.query, readRoute);

// Filters live in the URL, so a filtered view can be shared and the back button undoes a filter.
function writeRoute() {
  const q: Record<string, string> = {};
  if (category.value !== "all") q.category = category.value;
  if (query.value.trim()) q.q = query.value.trim();
  router.replace({ query: q });
}
let debounce = 0;
watch(query, () => {
  clearTimeout(debounce);
  debounce = window.setTimeout(writeRoute, 150);
});
// A chip is a navigation (Back undoes it); typing is not (Back would be unusable mid-word).
function pick(c: Category | "all") {
  category.value = c;
  const q: Record<string, string> = {};
  if (c !== "all") q.category = c;
  if (query.value.trim()) q.q = query.value.trim();
  router.push({ query: q });
}

const normalised = (s: string) => s.toLowerCase().normalize("NFKD");
const filtered = computed(() => {
  const q = normalised(query.value.trim());
  return projects.filter((p) => {
    if (category.value !== "all" && p.category !== category.value) return false;
    if (!q) return true;
    return normalised(`${p.name} ${p.tagline} ${p.stack.join(" ")} ${p.repo} ${p.family ?? ""}`).includes(q);
  });
});
const cards = computed(() => filtered.value.filter((p) => p.category !== "early"));
const archive = computed(() => filtered.value.filter((p) => p.category === "early"));
const privateCount = computed(() => filtered.value.filter((p) => p.visibility === "private").length);

const resultLine = computed(() => {
  const n = filtered.value.length;
  if (n === 0) return "Nothing matches.";
  const what = n === 1 ? "project" : "projects";
  const scope = category.value === "all" ? "" : ` in ${CATEGORY_LABEL[category.value]}`;
  const q = query.value.trim() ? ` for “${query.value.trim()}”` : "";
  return `${n} ${what}${scope}${q}`;
});

function clear() {
  query.value = "";
  category.value = "all";
  writeRoute();
  searchInput.value?.focus();
}

// Roving focus on the chips: arrow keys move, one tab stop for the whole row.
function onChipKey(event: KeyboardEvent, index: number) {
  const chips = (event.currentTarget as HTMLElement).closest(".chips")?.querySelectorAll<HTMLButtonElement>(".chip");
  if (!chips) return;
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % chips.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + chips.length) % chips.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = chips.length - 1;
  else return;
  event.preventDefault();
  chips[next]?.focus();
}

function onGlobalKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchInput.value?.focus();
  } else if (event.key === "Escape" && target === searchInput.value && query.value) {
    query.value = "";
    writeRoute();
  }
}
onMounted(() => document.addEventListener("keydown", onGlobalKey));
onBeforeUnmount(() => document.removeEventListener("keydown", onGlobalKey));
watch(filtered, () => nextTick(refresh));
</script>

<template>
  <div class="container">
    <header class="page-hero">
      <div class="eyebrow">Work</div>
      <h1>Every repository, <span>one contract.</span></h1>
      <p class="hero-lede">
        {{ totals.shown }} projects across {{ totals.repositories }} repositories. Each one carries the same metadata file; this page is generated from it.
        Private work is listed by name and never linked.
      </p>
    </header>

    <div class="toolbar" role="region" aria-label="Filter projects">
      <div role="group" aria-label="Category">
        <ul class="chips">
        <li>
          <button class="chip" type="button" :aria-pressed="category === 'all'" @click="pick('all')" @keydown="onChipKey($event, 0)" :tabindex="category === 'all' ? 0 : -1">
            All <span class="count">{{ projects.length }}</span>
          </button>
        </li>
        <li v-for="(c, i) in categories" :key="c">
          <button class="chip" type="button" :aria-pressed="category === c" @click="pick(c)" @keydown="onChipKey($event, i + 1)" :tabindex="category === c ? 0 : -1">
            {{ CATEGORY_LABEL[c] }} <span class="count">{{ counts[c] }}</span>
          </button>
        </li>
      </ul>
      </div>
      <label class="search">
        <span class="sr-only">Search projects</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref="searchInput" v-model="query" type="search" placeholder="Search name, stack, family…" autocomplete="off" spellcheck="false" />
        <kbd v-if="!query" aria-hidden="true">/</kbd>
        <button v-else class="clear" type="button" aria-label="Clear search" @click="query = ''; writeRoute()">×</button>
      </label>
    </div>

    <p class="results-line" role="status" aria-live="polite">{{ resultLine }}</p>

    <div v-if="filtered.length === 0" class="empty">
      <p>No project matches that. Try a stack name like <strong>FastAPI</strong> or <strong>Kotlin</strong>, or a family like <strong>LUCY</strong>.</p>
      <button class="button button-secondary" type="button" @click="clear">Clear filters</button>
    </div>

    <template v-else>
      <h2 class="sr-only">Projects</h2>
      <div v-if="cards.length" class="grid" :key="`${category}-${query}`">
        <ProjectCard v-for="(p, i) in cards" :key="p.slug" :project="p" :index="i" />
      </div>

      <section v-if="archive.length" class="section" aria-labelledby="archive-title">
        <div class="section-heading">
          <div class="eyebrow">Archive</div>
          <h2 id="archive-title">Early work, 2023–2024</h2>
          <p>Where it started: console programs, WinForms, first web projects. Kept because the progression is the point.</p>
        </div>
        <ul class="archive">
          <li v-for="p in archive" :key="p.slug">
            <router-link :to="`/work/${p.slug}`">
              <span><span class="name">{{ p.name }}</span><span class="what">{{ p.tagline }}</span></span>
              <span class="tag" v-if="p.stack[0]">{{ p.stack[0] }}</span>
              <span class="year">{{ p.year }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </template>

    <p v-if="privateCount" class="results-line" style="margin-top: 24px">
      {{ privateCount }} of these are private repositories: shown by name and description only, with no links. Source and detail on request.
    </p>
  </div>
</template>
