<script setup lang="ts">
import { computed } from "vue";
import type { Project } from "../data";
import CopyButton from "./CopyButton.vue";
import DownloadSparkline from "./DownloadSparkline.vue";
import ProofChips from "./ProofChips.vue";

// A flagship as an editorial row: name and stack on the left, what it is and what proves it on the right.
const props = defineProps<{ project: Project; compact?: boolean; headingLevel?: 2 | 3 }>();
const tag = computed(() => `h${props.headingLevel ?? 3}`);
const npmName = computed(() => props.project.packages?.npm[0]);
const daily = computed(() => props.project.proof?.npm?.daily.map((d) => d[1]) ?? []);
</script>

<template>
  <article class="case work-item reveal" :class="{ 'case-compact': compact }">
    <div class="case-head">
      <component :is="tag" class="case-name">
        <router-link :to="`/work/${project.slug}`">{{ project.name }}</router-link>
      </component>
      <p class="case-stack mono faint">{{ project.stack.slice(0, 5).join(" · ") }}</p>
    </div>
    <div class="case-body">
      <p class="case-tagline">{{ project.tagline }}</p>
      <ul v-if="!compact && project.highlights.length" class="case-highlights">
        <li v-for="h in project.highlights.slice(0, 3)" :key="h">{{ h }}</li>
      </ul>
      <ProofChips :project="project" />
      <DownloadSparkline v-if="!compact && daily.length > 6" :values="daily" label="npm downloads, last 30 days" />
      <div class="case-actions">
        <router-link class="case-more" :to="`/work/${project.slug}`" :aria-label="`${project.name}: the full story`">The full story <span aria-hidden="true">→</span></router-link>
        <a v-if="project.links.download" :href="project.links.download" target="_blank" rel="noopener noreferrer">Download ↗</a>
        <CopyButton v-if="npmName" :text="`npm install ${npmName}`" :label="`npm i ${npmName}`" />
        <a v-if="project.links.site" :href="project.links.site" target="_blank" rel="noopener noreferrer">Website ↗</a>
        <a v-if="project.links.source" :href="project.links.source" target="_blank" rel="noopener noreferrer">Source ↗</a>
      </div>
    </div>
  </article>
</template>

<style>
.case {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--col-gap);
  row-gap: 16px;
  padding: clamp(28px, 4vw, 48px) 0;
  border-top: 1px solid var(--rule);
}
.case:last-child {
  border-bottom: 1px solid var(--rule);
}
.case-head {
  grid-column: 1 / span 5;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.case-name {
  font-size: var(--fs-2);
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1;
}
.case-name a {
  text-decoration: none;
}
.case-name a:hover {
  text-decoration: underline;
  text-decoration-color: var(--signal);
  text-decoration-thickness: 2px;
}
.case-body {
  grid-column: 6 / span 7;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.case-tagline {
  font-size: var(--fs-3);
  line-height: 1.45;
}
.case-highlights {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  color: var(--text-2);
  font-size: var(--fs-small);
}
.case-highlights li {
  padding-left: 22px;
  position: relative;
}
.case-highlights li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.8em;
  width: 12px;
  height: 1px;
  background: var(--rule-2);
}
.case-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 22px;
  font-size: var(--fs-small);
}
.case-actions a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.case-more {
  font-weight: 600;
}
.case-compact .case-name {
  font-size: clamp(1.5rem, 1.2rem + 1.1vw, 2rem);
}
.case-compact {
  padding: clamp(22px, 3vw, 32px) 0;
}
@media (max-width: 900px) {
  .case-head,
  .case-body {
    grid-column: 1 / -1;
  }
}
</style>
