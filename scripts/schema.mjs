// The metadata contract, in two halves.
//
// A repository describes itself in `.portfolio/project.json` (ProjectFile): what it is called, what it
// is, and whether it wants to be on the portfolio at all. The sync adds GitHub's facts, which no file
// may claim: whether the repository is private, and, for a public one, its name and address. What may
// be published is kept in data/projects.json (ProjectsFile), the snapshot this site is built from.
//
// The snapshot holds nothing that is not on the site. A repository that opts out, or a private one
// that has not consented, never reaches it: not its text, not its name, not its existence beyond
// one number. A private project that has consented is there by its own words only; its repository's
// name is never written down, because the name is GitHub's fact and the consent covers the file.
import { z } from "zod";

export const CATEGORIES = ["product", "ai", "service", "tool", "web", "early"];
export const STATUSES = ["active", "wip", "stable", "archived"];

export const SCHEMA_URL = "https://tochi-mba.github.io/schema/project.schema.json";

/** Where in every repository its metadata lives. */
export const METADATA_PATH = ".portfolio/project.json";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words joined by single hyphens");
const url = z.string().url().startsWith("https://");

/** Every field a repository may write about itself, in the order the snapshot keeps them. */
const fields = {
  slug,
  name: z.string().min(1).max(60),
  tagline: z.string().min(1).max(160),
  description: z.string().max(1200).default(""),
  highlights: z.array(z.string().min(1).max(160)).max(8).default([]),
  stack: z.array(z.string().min(1).max(32)).max(12).default([]),
  category: z.enum(CATEGORIES),
  family: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  status: z.enum(STATUSES),
  featured: z.boolean().default(false),
  // Position among projects; lower first. Left out, a project follows the ones that set it.
  order: z.number().int().nonnegative().default(500),
  // false opts the repository out: nothing about it reaches the site, not even its name.
  display: z.boolean(),
  // A private repository's consent to being shown by its own words. Ignored for a public one.
  publicSafe: z.boolean().default(false),
  links: z
    .object({
      site: url.optional(),
      source: url.optional(),
      download: url.optional(),
      package: url.optional(),
    })
    .strict()
    .default({}),
  // Left out, the year the repository was created.
  year: z.number().int().min(2015).max(2100).optional(),
  // Published packages the registries describe at build time; names only, never numbers.
  packages: z
    .object({ npm: z.array(z.string().min(1)).default([]), pypi: z.array(z.string().min(1)).default([]) })
    .strict()
    .optional(),
};

const featuredHasStory = {
  check: (p) => !p.featured || (p.description.length > 0 && p.highlights.length > 0),
  message: "a featured project needs a description and highlights",
};

/** `.portfolio/project.json`: what a repository says about itself. */
export const ProjectFile = z
  .object({
    // For the editor: the file names the published schema so it is validated as it is typed.
    $schema: z.string().optional(),
    ...fields,
    // Why `display` is false, so an opt-out reads as a decision rather than an omission.
    reason: z.string().min(1).max(300).optional(),
  })
  .strict()
  .refine(featuredHasStory.check, { message: featuredHasStory.message });

/** One published project: the file's own fields, plus what GitHub says about its repository. */
export const Project = z
  .object({
    // GitHub's facts. A private project never carries its repository's name.
    repo: z.string().min(1).optional(),
    visibility: z.enum(["public", "private"]),
    ...fields,
    year: z.number().int().min(2015).max(2100),
  })
  .strict()
  .refine((p) => p.visibility === "private" || (p.repo && p.links.source), {
    message: "a public project needs its repository's name and links.source",
  })
  .refine((p) => p.visibility === "public" || p.repo === undefined, {
    message: "a private project never carries its repository's name",
  })
  .refine(featuredHasStory.check, { message: featuredHasStory.message });

/** data/projects.json: everything the site may publish, and how many repositories there are in all. */
export const ProjectsFile = z
  .object({
    version: z.literal(1),
    owner: z.string().min(1),
    // Every repository the owner has, published or not. A count, so it names nothing.
    repositories: z.number().int().nonnegative(),
    projects: z.array(Project),
  })
  .strict()
  .superRefine((file, ctx) => {
    for (const key of ["slug", "repo"]) {
      const seen = new Set();
      file.projects.forEach((p, i) => {
        if (p[key] === undefined) return;
        if (seen.has(p[key])) {
          ctx.addIssue({ code: "custom", path: ["projects", i, key], message: `duplicate ${key} ${p[key]}` });
        }
        seen.add(p[key]);
      });
    }
    file.projects.forEach((p, i) => {
      if (publication(p) === "hidden" || publication(p) === "counted") {
        ctx.addIssue({
          code: "custom",
          path: ["projects", i],
          message: `${p.slug} may not be published, so it may not be in the snapshot either`,
        });
      }
    });
    if (file.repositories < file.projects.length) {
      ctx.addIssue({
        code: "custom",
        path: ["repositories"],
        message: "there are more published projects than repositories",
      });
    }
  });

const Dated = z
  .object({
    title: z.string(),
    org: z.string(),
    period: z.string(),
    summary: z.string(),
    // What the role produced, a line each. The first role's are on the home page.
    points: z.array(z.string().min(1).max(160)).max(8).optional(),
    source: z.enum(["github", "cv"]),
  })
  .strict();

/**
 * A section of the home page in the owner's own words: the small label beside it, its title and
 * the line under the title. {services}, {shown} and {featured} are filled in with the numbers.
 */
const HomeSection = z
  .object({ label: z.string().min(1).max(60), title: z.string().min(1).max(90), body: z.string().max(400).optional() })
  .strict();

export const Profile = z
  .object({
    $schema: z.string().optional(),
    name: z.string(),
    handle: z.string(),
    company: z.string(),
    role: z.string(),
    // One sentence for search results and link previews.
    lede: z.string().max(400),
    // The home page's opening: who this is, a short paragraph or two in the first person.
    intro: z.array(z.string().min(1).max(500)).min(1).max(3),
    location: z.string(),
    email: z.string().email(),
    github: url,
    linkedin: url.optional(),
    site: url,
    availability: z.string(),
    now: z.array(z.object({ label: z.string(), detail: z.string(), slug })).max(4),
    // How the owner likes to work, and what they want to go deeper on: near the top of the home page.
    howIWork: z
      .object({
        title: z.string().min(1).max(90),
        body: z.string().max(400),
        points: z.array(z.object({ title: z.string(), body: z.string() }).strict()).max(4),
        deeper: z.array(z.string().min(1).max(60)).max(8),
      })
      .strict(),
    home: z
      .object({
        buildLog: HomeSection,
        topProjects: HomeSection,
        lucy: HomeSection,
        activity: HomeSection,
        contact: HomeSection,
      })
      .strict(),
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

/** The JSON Schema other repositories validate their `.portfolio/project.json` against. */
export function projectFileJsonSchema() {
  const schema = z.toJSONSchema(ProjectFile, { target: "draft-07", io: "input" });
  return {
    ...schema,
    $id: SCHEMA_URL,
    title: "Portfolio project metadata",
    description:
      "What a repository says about itself to https://tochi-mba.github.io/. Kept in .portfolio/project.json; the portfolio publishes it only when display is true, and a private repository only when publicSafe is true as well.",
  };
}
