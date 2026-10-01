# Portfolio metadata contract

Every repository owned by `tochi-mba` can describe itself to the portfolio with one file:

```
.portfolio/project.json
```

It is validated against `https://tochi-mba.github.io/schema/project.schema.json` (generated from
`scripts/schema.mjs` here). `npm run sync` with a `GITHUB_TOKEN` pulls the file from every
repository into `data/projects.json`; a repository's own file wins over the curated entry.

## The file

```json
{
  "$schema": "https://tochi-mba.github.io/schema/project.schema.json",
  "repo": "weftai",
  "slug": "weftai",
  "name": "weftai",
  "tagline": "Composable AI workflows: the model plans, your code executes.",
  "description": "One or more paragraphs, separated by blank lines.",
  "highlights": ["Up to eight short lines of what stands out"],
  "stack": ["TypeScript", "Zod"],
  "category": "ai",
  "family": "lucy",
  "role": "runtime",
  "status": "active",
  "featured": true,
  "order": 20,
  "visibility": "public",
  "display": true,
  "publicSafe": false,
  "links": { "site": "https://…", "source": "https://github.com/tochi-mba/weftai", "package": "https://…" },
  "year": 2026,
  "packages": { "npm": ["weftai", "@weftai/mcp"], "pypi": ["weftai"] }
}
```

| Field | Meaning |
|---|---|
| `category` | `product`, `ai`, `service`, `tool`, `web` or `early`. `early` is listed in the archive, not as a card. |
| `status` | `active`, `wip`, `stable` or `archived`. |
| `featured` | Shown on the home page. Needs a description and highlights. |
| `order` | Sort key on the work page; lower first. |
| `visibility` | Always GitHub's fact. The sync overwrites whatever the file says. |
| `display` | `false` opts the repository out entirely. Nothing about it reaches the site, not even its name. |
| `publicSafe` | For a private repository: `true` means the name, tagline, description, highlights and stack may be shown. Links are always dropped for private repositories. |
| `reason` | Free text saying why `display` is false, so an opt-out is explicit. |
| `links.site` | Optional. A public repository with a live GitHub Pages site is linked to it automatically at build time; set this only for a site hosted elsewhere. |
| `packages` | Optional. Package names on npm and PyPI. Versions, release dates and downloads are fetched at build time, the first name in each list being the main package. |

Never write a version number in `tagline`, `description`, `highlights` or `profile.now`: it is stale the
day after the next release. The build fails if one appears; the site shows fetched versions instead.

## The policy, in one table

| `visibility` | `display` | `publicSafe` | Result |
|---|---|---|---|
| public | true | – | Full card and page, links included. |
| public | false | – | Nothing shown. Counted in "44 repositories". |
| private | true | true | Card and page from the file's own text. No links. |
| private | true | false | Counted only. Not named. |
| private | false | – | Nothing shown. |

The policy is `publication()` in `scripts/schema.mjs`, tested in `tests/unit/schema.test.ts`, and
`scripts/check-site.mjs` fails the build if any page links into a private repository or names an
opted-out one.

## Adding a new repository

1. Create it on GitHub. `npm run sync` adds it to `data/projects.json` with `display: false` and
   `reason: "Added by sync; not reviewed yet."`
2. Either edit that entry here, or add `.portfolio/project.json` to the repository and sync again.
3. `npm run check` validates everything and builds the site. Push to `main` to deploy.
