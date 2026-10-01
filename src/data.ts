import generated from "./generated/site-data.json";

export type Category = "product" | "ai" | "service" | "tool" | "web" | "early";
export type Status = "active" | "wip" | "stable" | "archived";

export interface Project {
  repo: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  stack: string[];
  category: Category;
  family?: string;
  role?: string;
  status: Status;
  featured?: boolean;
  order: number;
  visibility: "public" | "private";
  display: boolean;
  publicSafe?: boolean;
  links: { site?: string; source?: string; download?: string; package?: string };
  year: number;
  packages?: { npm: string[]; pypi: string[] };
  proof?: Proof;
}

/** What GitHub and the package registries vouched for at build time. Absent means "not fetched". */
interface Proof {
  release?: {
    tag: string;
    words: string | null;
    at: string;
    url: string;
    count: number;
    prerelease: boolean;
    assets: number;
    downloads: number;
  };
  commits?: number;
  pushedAt?: string;
  npm?: RegistryProof & { daily: [string, number][] };
  pypi?: RegistryProof;
  services?: number;
}

interface RegistryProof {
  name: string;
  version: string;
  at: string | null;
  versions: number;
  downloadsMonth: number | null;
  url: string;
  packages: number;
}

/** One thing that shipped: a release (merged across GitHub, npm and PyPI) or a merged pull request. */
export interface ShipEvent {
  id: string;
  lane: string;
  project: string;
  kind: "release" | "pr";
  label: string;
  title: string;
  words: string | null;
  at: string;
  url: string;
  channels: string[];
}

export interface Lane {
  id: string;
  name: string;
  slug: string | null;
}

export interface Dated {
  title: string;
  org: string;
  period: string;
  summary: string;
  source: "github" | "cv";
}

export interface Profile {
  name: string;
  handle: string;
  company: string;
  role: string;
  headline: string;
  lede: string;
  location: string;
  email: string;
  github: string;
  site: string;
  availability: string;
  now: { label: string; detail: string; slug: string }[];
  principles: { title: string; body: string }[];
  skills: { group: string; items: string[] }[];
  experience: Dated[];
  education: Dated[];
}

interface Totals {
  repositories: number;
  public: number;
  private: number;
  shown: number;
  privateCounted: number;
  hidden: number;
  products: number;
  services: number;
  languages: number;
}

interface SiteData {
  generatedAt: string;
  profile: Profile;
  totals: Totals;
  projects: Project[];
  shipping: ShipEvent[];
  lanes: Lane[];
}

export const site = generated as SiteData;
export const profile = site.profile;
export const totals = site.totals;
export const projects = site.projects;
export const shipping = site.shipping;
export const lanes = site.lanes;

export const CATEGORY_LABEL: Record<Category, string> = {
  product: "Products",
  ai: "AI & agents",
  service: "Services",
  tool: "Tools",
  web: "Web",
  early: "Early work",
};

export const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  wip: "In progress",
  stable: "Stable",
  archived: "Archived",
};

export const featured = projects.filter((p) => p.featured);
export const bySlug = new Map(projects.map((p) => [p.slug, p]));
export const lucyFamily = projects.filter((p) => p.family === "lucy");

/** "1 Oct", or "1 Oct 2025" when the year is not the build's year. Always UTC, so SSG and the browser agree. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date(site.generatedAt).getUTCFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** 1356 → "1.4k"; under a thousand stays exact. */
export function compact(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}k`;
}
