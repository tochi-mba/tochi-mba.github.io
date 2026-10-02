// What the command palette offers: every page, every shown project and a few actions. The list is
// built from the same generated data as the pages, so a project that is not shown cannot be found.
import { ref } from "vue";
import { CATEGORY_LABEL, type Profile, type Project } from "./data";

/** Whether the palette is open. Shared, so the header button and the keyboard shortcut agree. */
export const paletteOpen = ref(false);

export type PaletteAction = "theme" | "copy-email";

export interface PaletteItem {
  id: string;
  label: string;
  /** A second line of context: a tagline, or what an action does. */
  hint: string;
  kind: "page" | "project" | "action" | "link";
  /** Extra words to match on that are not shown. */
  keywords: string[];
  to?: string;
  href?: string;
  action?: PaletteAction;
}

export function buildItems(projects: readonly Project[], profile: Profile): PaletteItem[] {
  const pages: PaletteItem[] = [
    { id: "page-home", label: "Home", hint: "The build log and selected work", kind: "page", keywords: [], to: "/" },
    { id: "page-work", label: "Work", hint: "Every project", kind: "page", keywords: ["projects"], to: "/work" },
    {
      id: "page-about",
      label: "About",
      hint: "Experience, education, skills and contact",
      kind: "page",
      keywords: ["cv", "resume", "experience", "contact"],
      to: "/about",
    },
  ];
  const work = projects.map(
    (p): PaletteItem => ({
      id: `project-${p.slug}`,
      label: p.name,
      hint: p.tagline,
      kind: "project",
      keywords: [...p.stack, CATEGORY_LABEL[p.category], ...(p.family ? [p.family] : [])],
      to: `/work/${p.slug}`,
    }),
  );
  const actions: PaletteItem[] = [
    {
      id: "action-theme",
      label: "Switch colour theme",
      hint: "Light or dark",
      kind: "action",
      keywords: ["dark", "light", "mode", "appearance"],
      action: "theme",
    },
    {
      id: "action-copy-email",
      label: "Copy email address",
      hint: profile.email,
      kind: "action",
      keywords: ["contact", "mail", "hire"],
      action: "copy-email",
    },
    {
      id: "link-email",
      label: "Email Rex",
      hint: "Opens your mail app",
      kind: "link",
      keywords: ["contact", "hire", "mail"],
      href: `mailto:${profile.email}`,
    },
    {
      id: "link-github",
      label: "GitHub",
      hint: `github.com/${profile.handle}`,
      kind: "link",
      keywords: ["source", "code", "repositories"],
      href: profile.github,
    },
    ...(profile.linkedin
      ? [
          {
            id: "link-linkedin",
            label: "LinkedIn",
            hint: profile.linkedin.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, ""),
            kind: "link" as const,
            keywords: ["cv", "experience", "hire"],
            href: profile.linkedin,
          },
        ]
      : []),
  ];
  return [...pages, ...work, ...actions];
}

/** The texts an item is matched on, most important first. */
export function textsOf(item: PaletteItem): string[] {
  return [item.label, ...item.keywords, item.hint];
}
