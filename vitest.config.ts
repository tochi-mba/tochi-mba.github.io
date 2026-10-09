import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// Every module that decides something is held to full coverage: the metadata contract, the
// publication policy, the sync, link safety, the shipping log, the performance comparison, and the
// logic behind the theme, the command palette and the LUCY map. Command-line wrappers that only read
// files and talk to the network or a browser around those modules are reported but not gated; their
// logic lives in the gated ones.
const GATED = [
  "scripts/schema.mjs",
  "scripts/links.mjs",
  "scripts/sync.mjs",
  "scripts/github.mjs",
  "scripts/shipping.mjs",
  "scripts/token.mjs",
  "scripts/perf-report.mjs",
  "src/theme.ts",
  "src/search.ts",
  "src/palette.ts",
  "src/systemMotion.ts",
  "src/systemTrace.ts",
  "src/activity.ts",
  "src/data.ts",
  "src/wakeLater.ts",
  "src/lucyFace.ts",
];

export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "agent-robot-avatar" } } })],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // Logic runs in plain Node; a test file that mounts components says so in its first line with
    // `// @vitest-environment happy-dom`, so only those pay for a DOM.
    environment: "node",
    pool: "threads",
    // Generous, because a component test pays for compiling its components on first use, and on a
    // busy machine or a shared CI runner that can take longer than the default five seconds.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["scripts/**/*.mjs", "src/**/*.{ts,vue}"],
      exclude: ["src/generated/**", "scripts/shots*.mjs", "src/main.ts"],
      reporter: ["text-summary", "text", "html", "json"],
      thresholds: Object.fromEntries(
        GATED.map((file) => [file, { lines: 100, branches: 100, functions: 100, statements: 100 }]),
      ),
    },
  },
});
