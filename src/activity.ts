import generated from "./generated/activity.json";

interface Activity {
  available: boolean;
  fetchedAt: string;
  reason?: string;
  calendar?: { total: number; days: [string, number][] };
  counts?: {
    commits: number;
    pullRequests: number;
    issues: number;
    repositoriesCreated: number;
    publicRepositories: number;
  };
  languages?: { name: string; share: number }[];
  recent?: { name: string; pushedAt: string }[];
  recordAvailable?: boolean;
  commitsByRepo?: { repo: string; total: number; days: [string, number][] }[];
}

// The JSON's inferred type follows whatever GitHub returned at build time; the declared shape is the contract.
export const activity = generated as unknown as Activity;

/** A sentence for a time ago, kept short enough for the hero panel. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo} mo ago` : `${Math.floor(mo / 12)} y ago`;
}

/** Four magnitude steps over zero, so the strip's legend and cells agree. */
export function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const q = count / max;
  if (q <= 0.25) return 1;
  if (q <= 0.5) return 2;
  if (q <= 0.75) return 3;
  return 4;
}

/**
 * Browser-side fallback: the newest public push, from the unauthenticated events API. `allowed`
 * holds the repositories the site may name (shown in full), so an opted-out one never appears.
 */
export async function fetchLatestPush(
  login: string,
  allowed: Set<string>,
  signal?: AbortSignal,
): Promise<{ repo: string; at: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/users/${login}/events/public?per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
    if (!res.ok) return null;
    const events = (await res.json()) as { type: string; repo: { name: string }; created_at: string }[];
    for (const e of events) {
      if (e.type !== "PushEvent") continue;
      const repo = e.repo.name.split("/")[1] ?? e.repo.name;
      if (allowed.has(repo.toLowerCase())) return { repo, at: e.created_at };
    }
    return null;
  } catch {
    return null;
  }
}
