import generated from "./generated/site-data.json";

export type Category = "product" | "ai" | "service" | "tool" | "web" | "early";
export type Status = "active" | "wip" | "stable" | "archived";

export interface Project {
  /** The repository's name on GitHub. Only a public project has one: a private one is shown by its own words. */
  repo?: string;
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
  /** What the role produced, a line each. */
  points?: string[];
  source: "github" | "cv";
}

/** A home page section in the owner's own words (see `fill` for the numbers it may name). */
export interface HomeSection {
  label: string;
  title: string;
  body?: string;
}

export interface Profile {
  name: string;
  handle: string;
  company: string;
  role: string;
  /** One sentence for search results and link previews. */
  lede: string;
  /** The home page's opening paragraphs. */
  intro: string[];
  location: string;
  email: string;
  github: string;
  linkedin?: string;
  site: string;
  availability: string;
  now: { label: string; detail: string; slug: string }[];
  howIWork: { title: string; body: string; points: { title: string; body: string }[]; deeper: string[] };
  home: Record<"buildLog" | "topProjects" | "lucy" | "activity" | "contact", HomeSection>;
  skills: { group: string; items: string[] }[];
  experience: Dated[];
  education: Dated[];
}

interface Totals {
  /** Every repository the owner has, shown or not. */
  repositories: number;
  shown: number;
  /** Of the shown projects, how many are public and how many private. */
  public: number;
  private: number;
  products: number;
  services: number;
  languages: number;
}

/** What the home page draws from GitHub. Only `available` is set when GitHub was not reached at build time. */
export interface Activity {
  available: boolean;
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

interface SiteData {
  generatedAt: string;
  profile: Profile;
  totals: Totals;
  projects: Project[];
  shipping: ShipEvent[];
  lanes: Lane[];
  activity: Activity;
}

// The JSON's inferred type follows whatever the APIs returned at build time; the declared shape is the contract.
export const site = generated as unknown as SiteData;
export const profile = site.profile;
export const totals = site.totals;
export const projects = site.projects;
export const shipping = site.shipping;
export const lanes = site.lanes;
export const activity = site.activity;

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
/** The services behind the hub: the family members that are services, not the hub, a runtime or a provider. */
export const lucyServices = lucyFamily.filter((p) => p.category === "service");

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

/**
 * Copy from the profile with its numbers filled in: "{services} services" → "9 services". A name
 * with no value is left as it is, so a typo shows on the page instead of vanishing.
 */
export function fill(text: string, values: Record<string, number | string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/** 1356 → "1.4k"; under a thousand stays exact. */
export function compact(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}k`;
}
