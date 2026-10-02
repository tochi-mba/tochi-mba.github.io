<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { profile, projects } from "../data";
import { buildItems, type PaletteItem, paletteOpen, textsOf } from "../palette";
import { rank } from "../search";
import { applyTheme, currentTheme, opposite } from "../theme";

// A keyboard-first way round the site: every page, every shown project and a few actions, one
// search away. It is a native <dialog>, so the browser traps focus, closes on Escape and puts focus
// back where it was. Loaded the first time it is opened; it is not part of the first page.
const router = useRouter();
const dialog = ref<HTMLDialogElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const list = ref<HTMLElement | null>(null);
const query = ref("");
const active = ref(0);
const status = ref("");

const items = buildItems(projects, profile);
const featuredSlugs = new Set(projects.filter((p) => p.featured).map((p) => `project-${p.slug}`));
// With nothing typed: where to go and what to do, and the flagships. Everything else is a search away.
const resting = items.filter((i) => i.kind !== "project" || featuredSlugs.has(i.id));
const results = computed(() => (query.value.trim() ? rank(items, query.value, textsOf).slice(0, 12) : resting));

const activeId = computed(() => {
  const item = results.value[active.value];
  return item ? `palette-${item.id}` : undefined;
});

watch(query, () => {
  active.value = 0;
});
watch(results, (found) => {
  status.value = found.length === 0 ? "Nothing matches" : `${found.length} result${found.length === 1 ? "" : "s"}`;
});

function show() {
  query.value = "";
  active.value = 0;
  if (!dialog.value?.open) dialog.value?.showModal();
  nextTick(() => input.value?.focus());
}
watch(paletteOpen, (open) => {
  if (open) show();
  else if (dialog.value?.open) dialog.value.close();
});
onMounted(() => {
  if (paletteOpen.value) show();
});

function move(to: number) {
  const count = results.value.length;
  if (count === 0) return;
  active.value = (to + count) % count;
  nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
}

async function run(item: PaletteItem | undefined) {
  if (!item) return;
  paletteOpen.value = false;
  if (item.to) await router.push(item.to);
  else if (item.href?.startsWith("mailto:")) window.location.href = item.href;
  else if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
  else if (item.action === "theme") applyTheme(opposite(currentTheme()));
  else if (item.action === "copy-email") await navigator.clipboard?.writeText(profile.email).catch(() => {});
}

function onKey(event: KeyboardEvent) {
  const moves: Record<string, () => void> = {
    ArrowDown: () => move(active.value + 1),
    ArrowUp: () => move(active.value - 1),
    Home: () => move(0),
    End: () => move(results.value.length - 1),
    Enter: () => run(results.value[active.value]),
  };
  const handler = moves[event.key];
  if (!handler) return;
  event.preventDefault();
  handler();
}

// A click on the backdrop lands on the dialog itself, never on its content.
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) paletteOpen.value = false;
}
</script>

<template>
  <dialog
    ref="dialog"
    class="palette"
    aria-label="Search the site"
    @close="paletteOpen = false"
    @click="onBackdrop"
  >
    <div class="palette-box">
      <label class="palette-field">
        <span class="sr-only">Search projects, pages and actions</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          ref="input"
          v-model="query"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          :aria-activedescendant="activeId"
          placeholder="Search projects, pages, actions…"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="go"
          @keydown="onKey"
        />
        <kbd aria-hidden="true">esc</kbd>
      </label>
      <ul id="palette-list" ref="list" class="palette-list" role="listbox" aria-label="Results">
        <li
          v-for="(item, i) in results"
          :id="`palette-${item.id}`"
          :key="item.id"
          class="palette-item"
          role="option"
          :aria-selected="i === active"
          @click="run(item)"
          @pointermove="active = i"
        >
          <span class="palette-label">{{ item.label }}</span>
          <span class="palette-hint">{{ item.hint }}</span>
          <span class="palette-kind mono">{{ item.kind }}</span>
        </li>
      </ul>
      <p v-if="results.length === 0" class="palette-empty">Nothing matches “{{ query.trim() }}”. Try a project, a language or “theme”.</p>
      <p class="palette-keys mono" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> open <kbd>esc</kbd> close</p>
      <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
    </div>
  </dialog>
</template>

<style>
.palette {
  width: min(640px, 100% - 2 * var(--gutter));
  max-height: min(560px, 100dvh - 96px);
  margin: 72px auto 0;
  padding: 0;
  border: 1px solid var(--rule-2);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
.palette::backdrop {
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.palette-box {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}
.palette-field {
  position: relative;
  display: block;
  border-bottom: 1px solid var(--rule);
}
.palette-field svg {
  position: absolute;
  left: 18px;
  top: 50%;
  translate: 0 -50%;
  width: 18px;
  height: 18px;
  stroke: var(--text-3);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  pointer-events: none;
}
.palette-field input {
  width: 100%;
  min-height: 60px;
  padding: 0 64px 0 50px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.125rem;
}
.palette-field input::placeholder {
  color: var(--text-3);
}
/* The whole dialog is the focus indicator: its field is the only thing that takes typing. */
.palette-field input:focus-visible {
  outline: none;
}
.palette-field:focus-within {
  box-shadow: inset 0 -2px 0 var(--signal);
}
.palette kbd {
  font-family: var(--mono);
  font-size: var(--fs-mono-s);
  color: var(--text-3);
  border: 1px solid var(--rule-2);
  border-radius: 3px;
  padding: 1px 6px;
}
.palette-field kbd {
  position: absolute;
  right: 16px;
  top: 50%;
  translate: 0 -50%;
}
.palette-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.palette-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 16px;
  row-gap: 2px;
  align-items: baseline;
  min-height: 48px;
  padding: 9px 12px;
  border-radius: 3px;
  cursor: pointer;
  border-left: 2px solid transparent;
}
.palette-item[aria-selected="true"] {
  background: var(--bg-2);
  border-left-color: var(--signal);
}
.palette-label {
  font-weight: 600;
}
.palette-hint {
  grid-column: 1;
  color: var(--text-2);
  font-size: var(--fs-small);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette-kind {
  grid-column: 2;
  grid-row: 1;
  color: var(--text-3);
  font-size: var(--fs-mono-s);
}
.palette-empty {
  padding: 20px 18px;
  color: var(--text-2);
}
.palette-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-top: 1px solid var(--rule);
  color: var(--text-3);
  font-size: var(--fs-mono-s);
}
.palette-keys kbd + kbd {
  margin-left: -2px;
}
.palette-keys kbd:not(:first-child):not(kbd + kbd) {
  margin-left: 12px;
}
.motion .palette[open] {
  animation: palette-in var(--t-fast) var(--ease-out);
}
@keyframes palette-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
@media (max-width: 760px) {
  .palette {
    margin-top: 12px;
    max-height: calc(100dvh - 24px);
  }
  .palette-keys {
    display: none;
  }
}
</style>
