import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: () => import("./views/HomeView.vue") },
  { path: "/work", name: "work", component: () => import("./views/WorkView.vue") },
  { path: "/work/:slug", name: "project", component: () => import("./views/ProjectView.vue"), props: true },
  { path: "/about", name: "about", component: () => import("./views/AboutView.vue") },
  // GitHub Pages serves /404.html for unknown paths; prerendering this route produces it.
  { path: "/404", name: "not-found-page", component: () => import("./views/NotFoundView.vue") },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("./views/NotFoundView.vue") },
];
