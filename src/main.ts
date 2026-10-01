import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import { routes } from "./routes";
import "./styles/site.css";

export const createApp = ViteSSG(App, {
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, top: 80 };
    // Same page, only the query changed (filters): stay put.
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});
