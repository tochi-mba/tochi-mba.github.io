import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2022",
    cssMinify: true,
    assetsInlineLimit: 0,
    // One small stylesheet (under 7 kB gzipped), loaded before the first paint. Extracting "critical"
    // CSS and loading the rest later was measured to paint a different layout first and shift the page.
    cssCodeSplit: false,
  },
  ssgOptions: {
    formatting: "minify",
    // No critical-CSS extraction: it made the stylesheet load after the first paint and inlined only
    // one of the @font-face rules, so pages painted in a generic font and then reflowed (CLS 0.32).
    beastiesOptions: false,
    // Prerender every project page too, so each has real HTML for crawlers and no flash.
    includedRoutes: async (paths) => {
      const { projects } = (await import("./src/generated/site-data.json", { with: { type: "json" } })).default;
      return [...paths.filter((p) => !p.includes(":")), "/404", ...projects.map((p) => `/work/${p.slug}`)];
    },
  },
});
