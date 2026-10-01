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

export interface Totals {
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

export interface SiteData {
  generatedAt: string;
  profile: Profile;
  totals: Totals;
  projects: Project[];
}

export const site = generated as SiteData;
export const profile = site.profile;
export const totals = site.totals;
export const projects = site.projects;

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
