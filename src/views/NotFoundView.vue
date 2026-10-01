<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { useRoute } from "vue-router";

const route = useRoute();
useHead({ title: "Not found", meta: [{ name: "robots", content: "noindex" }] });
</script>

<template>
  <div class="container not-found">
    <p class="crumbs">404</p>
    <h1>Nothing lives at that address.</h1>
    <p class="lede">
      <code>{{ route.path }}</code> is not a page here. Project links moved when the portfolio moved to its own metadata; the work page has every current one.
    </p>
    <div class="hero-actions">
      <router-link class="button button-primary" to="/work">All projects <span class="arrow" aria-hidden="true">→</span></router-link>
      <router-link class="button button-secondary" to="/">Home</router-link>
    </div>
  </div>
</template>
