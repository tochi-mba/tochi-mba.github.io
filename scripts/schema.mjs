// The metadata contract. Every repository may carry `.portfolio/project.json` matching
// `Project`; this site's `data/projects.json` is the merged, curated copy of them all.
import { z } from "zod";

export const CATEGORIES = ["product", "ai", "service", "tool", "web", "early"];
export const STATUSES = ["active", "wip", "stable", "archived"];

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words joined by single hyphens");
const url = z.string().url().startsWith("https://");

export const Project = z
  .object({
    repo: z.string().min(1),
    slug,
    name: z.string().min(1).max(60),
    tagline: z.string().max(160),
    description: z.string().max(1200),
    highlights: z.array(z.string().min(1).max(160)).max(8),
    stack: z.array(z.string().min(1).max(32)).max(12),
    category: z.enum(CATEGORIES),
    family: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(STATUSES),
    featured: z.boolean().default(false),
    order: z.number().int().nonnegative(),
    visibility: z.enum(["public", "private"]),
    display: z.boolean(),
    // A private repository is shown by name only when both `display` and `publicSafe` are true.
    publicSafe: z.boolean().default(false),
    reason: z.string().optional(),
    links: z
      .object({
        site: url.optional(),
        source: url.optional(),
        download: url.optional(),
        package: url.optional(),
      })
      .strict(),
    year: z.number().int().min(2015).max(2100),
  })
  .strict()
  .refine((p) => p.visibility === "private" || p.links.source, {
    message: "a public project needs links.source",
  })
  .refine((p) => p.visibility === "public" || p.publicSafe || Object.keys(p.links).length === 0, {
    message: "a private project that is not publicSafe must carry no links",
  })
  .refine((p) => !p.featured || (p.description.length > 0 && p.highlights.length > 0), {
    message: "a featured project needs a description and highlights",
  });

export const ProjectsFile = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    owner: z.string(),
    projects: z.array(Project),
  })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Map();
    for (const key of ["slug", "repo"]) {
      seen.clear();
      file.projects.forEach((p, i) => {
        if (seen.has(p[key])) {
          ctx.addIssue({ code: "custom", path: ["projects", i, key], message: `duplicate ${key} ${p[key]}` });
        }
        seen.set(p[key], i);
      });
    }
  });

const Dated = z.object({
  title: z.string(),
  org: z.string(),
  period: z.string(),
  summary: z.string(),
  source: z.enum(["github", "cv"]),
});

export const Profile = z
  .object({
    $schema: z.string().optional(),
    name: z.string(),
    handle: z.string(),
    company: z.string(),
    role: z.string(),
    headline: z.string().max(60),
    lede: z.string().max(400),
    location: z.string(),
    email: z.string().email(),
    github: url,
    site: url,
    availability: z.string(),
    now: z.array(z.object({ label: z.string(), detail: z.string(), slug })).max(4),
    principles: z.array(z.object({ title: z.string(), body: z.string() })).max(4),
    skills: z.array(z.object({ group: z.string(), items: z.array(z.string()).min(1) })),
    experience: z.array(Dated),
    education: z.array(Dated),
  })
  .strict();

/** Which projects the public site may show, and how. Fail-closed: when in doubt, hide. */
export function publication(project) {
  if (!project.display) return "hidden";
  if (project.visibility === "public") return "full";
  return project.publicSafe ? "name-only" : "counted";
}
