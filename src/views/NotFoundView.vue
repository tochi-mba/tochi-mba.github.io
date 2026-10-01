<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { useRoute } from "vue-router";

const route = useRoute();
useHead({ title: "Not found", meta: [{ name: "robots", content: "noindex" }] });
</script>

<template>
  <div class="container not-found">
    <div class="eyebrow signal"><span class="pulse-dot"></span> 404</div>
    <h1>Nothing lives at <span>that address.</span></h1>
    <p class="hero-lede">
      <code>{{ route.path }}</code> is not a page here. Project links moved when the portfolio moved to its own metadata; the work page has every current one.
    </p>
    <div class="hero-actions">
      <router-link class="button button-primary" to="/work">All projects <span class="arrow" aria-hidden="true">→</span></router-link>
      <router-link class="button button-secondary" to="/">Home</router-link>
    </div>
  </div>
</template>
