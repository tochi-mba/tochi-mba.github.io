<script setup lang="ts">
import { useSpotlight } from "../composables/useSpotlight";
import { type Project, STATUS_LABEL } from "../data";

const props = defineProps<{ project: Project; featured?: boolean; index?: number }>();
const { onMove, onLeave } = useSpotlight();
</script>

<template>
  <router-link
    class="card reveal"
    :class="{ 'card-featured': featured }"
    :to="`/work/${project.slug}`"
    :style="{ '--delay': `${Math.min(index ?? 0, 6) * 50}ms` }"
    :aria-label="`${project.name}: ${project.tagline}`"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div class="card-head">
      <h3>{{ project.name }}</h3>
      <span class="badge" :class="`badge-${project.status}`">{{ STATUS_LABEL[project.status] }}</span>
    </div>
    <p class="tagline">{{ project.tagline }}</p>
    <ul v-if="project.stack.length" class="tags" aria-label="Stack">
      <li v-for="s in project.stack.slice(0, featured ? 6 : 4)" :key="s" class="tag">{{ s }}</li>
    </ul>
    <div class="card-foot">
      <span class="badge badge-private" v-if="project.family === 'lucy'">LUCY family</span>
      <span v-else></span>
      <span class="arrow" aria-hidden="true">→</span>
    </div>
  </router-link>
</template>
