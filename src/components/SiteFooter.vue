<script setup lang="ts">
import { profile, site } from "../data";

const year = new Date(site.generatedAt).getUTCFullYear();
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-wrap">
      <span>© {{ year }} {{ profile.name }} · {{ profile.company }}</span>
      <div class="footer-links">
        <a :href="profile.github" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a :href="`mailto:${profile.email}`">Email</a>
        <a href="https://github.com/tochi-mba/tochi-mba.github.io" target="_blank" rel="noopener noreferrer">This site's source</a>
      </div>
    </div>
  </footer>
</template>
