# tochi-mba.github.io

Tochi Mba's portfolio, live at <https://tochi-mba.github.io/>. A REX Technologies site.

Every one of my repositories is described by one metadata file; this site is generated from the
merged set, so adding a project is adding a file. Private repositories can opt in by name and are
never linked; any repository can opt out. The contract is in
[docs/PORTFOLIO_METADATA.md](docs/PORTFOLIO_METADATA.md).

## Stack

Vue 3 and TypeScript on Vite, prerendered to static HTML with vite-ssg, deployed to GitHub Pages by
Actions. No runtime framework for the content: every page exists as HTML before JavaScript runs.
The GitHub activity section is fetched at build time and rebuilt daily.

## Commands

```sh
npm install
npm run dev          # local dev server
npm run check        # data, lint, types, unit tests, build, site checks: what CI runs
npm run test:e2e     # Playwright: desktop, phone and reduced-motion projects
npm run sync         # pull .portfolio/project.json from every repository (needs GITHUB_TOKEN)
```

`npm run build` writes `dist/`: the pages, `sitemap.xml`, `og.png` and the published metadata schema
at `schema/project.schema.json`.

## Layout

| Path | What |
|---|---|
| `data/projects.json` | Every repository, curated. `npm run sync` merges repositories' own files into it. |
| `data/profile.json` | Who I am: narrative, skills, experience, contact. |
| `scripts/schema.mjs` | The metadata contract and the publication policy. |
| `scripts/build-data.mjs` | Validates data, applies the policy, writes `src/generated/site-data.json`. |
| `scripts/fetch-activity.mjs` | GitHub contribution calendar and language mix, at build time. |
| `scripts/check-site.mjs` | Fails the build on a dead link, a private link, a missing title and so on. |
| `src/` | The Vue app: views, components, the REX stylesheet. |
| `tests/unit` | Vitest: schema, policy, generated data, components, the site checker. |
| `tests/e2e` | Playwright: pages, filters, interactions, accessibility (axe). |

## Licence

Code: MIT. The REX visual system and the written content are © Tochi Mba.
