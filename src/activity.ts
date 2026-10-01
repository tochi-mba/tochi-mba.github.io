import generated from "./generated/activity.json";

export interface Activity {
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
}

export const activity = generated as Activity;

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

/** Four magnitude steps over zero, so the heatmap's legend and cells agree. */
export function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const q = count / max;
  if (q <= 0.25) return 1;
  if (q <= 0.5) return 2;
  if (q <= 0.75) return 3;
  return 4;
}

/** Browser-side fallback: the newest public push, from the unauthenticated events API. */
export async function fetchLatestPush(
  login: string,
  signal?: AbortSignal,
): Promise<{ repo: string; at: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/users/${login}/events/public?per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
    if (!res.ok) return null;
    const events = (await res.json()) as { type: string; repo: { name: string }; created_at: string }[];
    const push = events.find((e) => e.type === "PushEvent");
    return push ? { repo: push.repo.name.split("/")[1] ?? push.repo.name, at: push.created_at } : null;
  } catch {
    return null;
  }
}
