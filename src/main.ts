import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import { routes } from "./routes";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

export const createApp = ViteSSG(
  App,
  {
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved;
      if (to.hash) return { el: to.hash, top: 80 };
      // Same page, only the query changed (filters): stay put.
      if (to.path === from.path) return false;
      return { top: 0 };
    },
  },
  undefined,
  // Hydrate the prerendered page rather than render it again. Without this, vite-ssg mounts with
  // createApp, which empties #app and builds every element a second time on every visit.
  { hydration: true },
);
