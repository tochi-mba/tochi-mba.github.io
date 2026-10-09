import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "agent-robot-avatar" } } })],
  // `VUE_MISMATCH=1 npm run build` makes the production build name any place where the prerendered
  // HTML and the page the browser renders differ, which hydration would otherwise patch in silence.
  define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: process.env.VUE_MISMATCH === "1" },
  build: {
    target: "es2022",
    cssMinify: true,
    assetsInlineLimit: 0,
    // One small stylesheet (about 8 kB gzipped), which scripts/inline-css.mjs puts inside every page.
    // Extracting "critical" CSS and loading the rest later was measured to paint a different layout
    // first and shift the page.
    cssCodeSplit: false,
  },
  ssgOptions: {
    // Not "minify": it collapses the whitespace between elements and words, so the prerendered page
    // no longer matches what Vue renders and hydration has to patch text on every visit. Compression
    // on the wire takes care of the whitespace.
    formatting: "none",
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
