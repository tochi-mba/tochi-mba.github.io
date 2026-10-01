import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2022",
    cssMinify: true,
    assetsInlineLimit: 0,
  },
  ssgOptions: {
    formatting: "minify",
    // Prerender every project page too, so each has real HTML for crawlers and no flash.
    includedRoutes: async (paths) => {
      const { projects } = (await import("./src/generated/site-data.json", { with: { type: "json" } })).default;
      return [...paths.filter((p) => !p.includes(":")), "/404", ...projects.map((p) => `/work/${p.slug}`)];
    },
  },
});
