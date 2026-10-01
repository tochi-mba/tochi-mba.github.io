<script setup lang="ts">
import { computed } from "vue";
import { compact, type Project, shortDate } from "../data";

// One line of facts GitHub and the registries vouched for at build time. Nothing typed by hand.
const props = defineProps<{ project: Project; max?: number }>();

const items = computed(() => {
  const p = props.project.proof;
  if (!p) return [];
  const out: { text: string; href?: string }[] = [];
  if (p.release) out.push({ text: `${p.release.tag} · ${shortDate(p.release.at)}`, href: p.release.url });
  if (p.npm && p.pypi && p.npm.version === p.pypi.version) {
    out.push({ text: `v${p.npm.version} on npm and PyPI`, href: p.npm.url });
  } else {
    if (p.npm) out.push({ text: `npm v${p.npm.version}`, href: p.npm.url });
    if (p.pypi) out.push({ text: `PyPI v${p.pypi.version}`, href: p.pypi.url });
  }
  if (p.release && p.release.count > 1) out.push({ text: `${p.release.count} releases` });
  else if (p.npm && p.npm.versions > 1) out.push({ text: `${p.npm.versions} versions` });
  if (p.npm?.downloadsMonth) out.push({ text: `${compact(p.npm.downloadsMonth)} npm downloads last month` });
  if (p.release && p.release.downloads >= 100)
    out.push({ text: `${compact(p.release.downloads)} downloads of ${p.release.tag}` });
  if (p.services) out.push({ text: `${p.services} services` });
  if (p.commits) out.push({ text: `${p.commits.toLocaleString("en-GB")} commits` });
  if (p.pushedAt && !p.release) out.push({ text: `last push ${shortDate(p.pushedAt)}` });
  return out.slice(0, props.max ?? 4);
});
</script>

<template>
  <ul v-if="items.length" class="proof mono" aria-label="Fetched from GitHub and the package registries at build time">
    <li v-for="item in items" :key="item.text">
      <a v-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.text }}</a>
      <template v-else>{{ item.text }}</template>
    </li>
  </ul>
</template>

<style>
.proof {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 0;
  color: var(--text-2);
}
.proof li {
  display: inline-flex;
  align-items: center;
}
.proof li::before {
  content: "·";
  color: var(--text-3);
  margin: 0 0.7em;
}
.proof li:first-child::before {
  content: "";
  width: 7px;
  height: 7px;
  background: var(--signal);
  margin: 0 0.75em 0 0;
}
.proof a {
  color: var(--text);
}
</style>
