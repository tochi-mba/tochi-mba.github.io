<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CaseStudyRow from "../components/CaseStudyRow.vue";
import { useReveal } from "../composables/useReveal";
import { CATEGORY_LABEL, type Category, type Project, profile, projects, STATUS_LABEL, totals } from "../data";

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
    return normalised(`${p.name} ${p.tagline} ${p.stack.join(" ")} ${p.repo ?? ""} ${p.family ?? ""}`).includes(q);
  });
});
// Four tiers, so six flagships are never one card among forty: what to look at first, the system
// behind it, everything else that is current, and the archive (folded away until asked for).
const isArchive = (p: Project) => p.category === "early" || p.status === "archived";
const groups = computed(() => [
  {
    id: "flagships",
    title: "Flagships",
    note: "products and runtimes with releases",
    items: filtered.value.filter((p) => p.featured),
  },
  {
    id: "lucy",
    title: "The LUCY family",
    note: "services behind the assistant hub",
    items: filtered.value.filter((p) => !p.featured && p.family === "lucy" && !isArchive(p)),
  },
  {
    id: "also",
    title: "Also built",
    note: "tools, sites and work in progress",
    items: filtered.value.filter((p) => !p.featured && p.family !== "lucy" && !isArchive(p)),
  },
  {
    id: "archive",
    title: "Archive",
    note: "early and archived work, 2023 to 2025",
    items: filtered.value.filter((p) => !p.featured && isArchive(p)),
  },
]);
const archiveOpen = computed(() => category.value !== "all" || query.value.trim() !== "");
const privateCount = computed(() => filtered.value.filter((p) => p.visibility === "private").length);
const meta = (p: Project) =>
  [p.visibility === "private" ? "private" : STATUS_LABEL[p.status].toLowerCase(), p.year].join(" · ");

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
      <p class="crumbs">Work</p>
      <h1>Every repository, one contract.</h1>
      <p class="lede">
        {{ totals.shown }} projects across {{ totals.repositories }} repositories. Each one carries the same metadata file; this page is generated from it.
        Private work appears in its own words, with only the links anyone can open.
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
      <template v-for="g in groups" :key="g.id">
        <section v-if="g.items.length" class="work-group" :class="`work-${g.id}`" :aria-labelledby="`group-${g.id}`">
          <header class="work-group-head">
            <h2 :id="`group-${g.id}`">{{ g.title }}</h2>
            <p class="mono faint">{{ g.items.length }} · {{ g.note }}</p>
          </header>
          <div v-if="g.id === 'flagships'" class="cases">
            <CaseStudyRow v-for="p in g.items" :key="p.slug" :project="p" compact />
          </div>
          <details v-else-if="g.id === 'archive'" class="archive-fold" :open="archiveOpen">
            <summary>{{ archiveOpen ? "Archive" : `Show ${g.items.length} archived projects` }}</summary>
            <ul class="work-list">
              <li v-for="p in g.items" :key="p.slug" class="work-row work-item">
                <router-link class="work-main" :to="`/work/${p.slug}`">
                  <span class="work-name">{{ p.name }}</span>
                  <span class="work-what">{{ p.tagline }}</span>
                  <span class="work-meta">{{ meta(p) }}</span>
                </router-link>
                <a v-if="p.links.site" class="work-site" :href="p.links.site" target="_blank" rel="noopener noreferrer" :aria-label="`${p.name} website`">site ↗</a>
              </li>
            </ul>
          </details>
          <ul v-else class="work-list">
            <li v-for="p in g.items" :key="p.slug" class="work-row work-item">
              <router-link class="work-main" :to="`/work/${p.slug}`">
                <span class="work-name">{{ p.name }}</span>
                <span class="work-what">{{ p.tagline }}</span>
                <span class="work-meta">{{ p.role ?? p.stack.slice(0, 2).join(" · ") }} · {{ meta(p) }}</span>
              </router-link>
              <a v-if="p.links.site" class="work-site" :href="p.links.site" target="_blank" rel="noopener noreferrer" :aria-label="`${p.name} website`">site ↗</a>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <p v-if="privateCount" class="results-line private-note">
      {{ privateCount }} of these {{ privateCount === 1 ? "is a private repository" : "are private repositories" }}: shown in their own words, with only the links anyone can open. Source and detail on request.
    </p>
  </div>
</template>
