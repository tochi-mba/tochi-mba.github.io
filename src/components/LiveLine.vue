<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchLatestPush, timeAgo } from "../activity";
import { activity, profile, projects, shortDate } from "../data";

// Only repositories the site shows in full (and the site itself) may be named here. A private
// project carries no repository name, so it can never be one of them.
const allowed = new Set([
  ...projects.flatMap((p) => (p.visibility === "public" && p.repo ? [p.repo.toLowerCase()] : [])),
  `${profile.handle}.github.io`,
]);

// Build-time data first, then the browser asks GitHub for anything newer. Never a made-up value.
const latest = ref<{ repo: string; at: string } | null>(
  activity.recent?.[0] ? { repo: activity.recent[0].name, at: activity.recent[0].pushedAt } : null,
);
const mounted = ref(false);
const controller = new AbortController();
onMounted(async () => {
  mounted.value = true;
  const live = await fetchLatestPush(profile.handle, allowed, controller.signal);
  if (live && (!latest.value || live.at > latest.value.at)) latest.value = live;
});
onBeforeUnmount(() => controller.abort());

// The prerendered page says a date; once the browser is running it can say how long ago.
const when = computed(() => {
  if (!latest.value) return "";
  return mounted.value ? timeAgo(latest.value.at) : shortDate(latest.value.at);
});
</script>

<template>
  <p class="live-line mono">
    <span class="live-dot" aria-hidden="true"></span>
    <template v-if="latest">
      last push · <a :href="`https://github.com/${profile.handle}/${latest.repo}`" target="_blank" rel="noopener noreferrer">{{ latest.repo }}</a> ·
      <time :datetime="latest.at">{{ when }}</time>
    </template>
    <template v-else>
      <a :href="profile.github" target="_blank" rel="noopener noreferrer">github.com/{{ profile.handle }}</a>
    </template>
  </p>
</template>

<style>
.live-line {
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 0.55em;
  min-height: 1.5em;
}
.live-line a {
  color: var(--text);
}
.live-dot {
  width: 7px;
  height: 7px;
  background: var(--signal);
  flex: none;
}
</style>
