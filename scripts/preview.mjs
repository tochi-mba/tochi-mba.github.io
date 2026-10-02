// Serves dist/ for a script that needs to look at the built site, and stops when it is done. Uses
// SHOTS_BASE instead when it is set, so a server that is already running can be reused.
import { preview } from "vite";

/** The base URL to load pages from, and how to stop serving them. */
export async function servePreview() {
  if (process.env.SHOTS_BASE) return { base: process.env.SHOTS_BASE.replace(/\/$/, ""), close: async () => {} };
  const server = await preview({ logLevel: "silent", preview: { host: "127.0.0.1", port: 4180, strictPort: false } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, "");
  return { base, close: () => server.close() };
}
