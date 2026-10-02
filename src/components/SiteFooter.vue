<script setup lang="ts">
import { activity } from "../activity";
import { profile, shortDate, site } from "../data";

const year = new Date(site.generatedAt).getUTCFullYear();
const built = shortDate(site.generatedAt);
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-wrap">
      <div>
        <span>© {{ year }} {{ profile.name }} · {{ profile.company }}</span>
        <div class="footer-links">
          <a :href="profile.github" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a v-if="profile.linkedin" :href="profile.linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a :href="`mailto:${profile.email}`">Email</a>
          <a href="https://github.com/tochi-mba/tochi-mba.github.io" target="_blank" rel="noopener noreferrer">This site's source</a>
        </div>
      </div>
      <p class="footer-colophon">
        Prerendered with Vue and vite-ssg; built {{ built }} and rebuilt every day.
        Releases, packages{{ activity.available ? " and GitHub activity" : "" }} are fetched from GitHub, npm and PyPI at build time, never typed by hand.
        Set in Bricolage Grotesque and Martian Mono.
      </p>
    </div>
  </footer>
</template>
