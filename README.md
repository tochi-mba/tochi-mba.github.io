# tochi-mba.github.io

Tochi Mba's portfolio, live at <https://tochi-mba.github.io/>. A REX Technologies site.

Every one of my repositories is described by one metadata file; this site is generated from the
merged set, so adding a project is adding a file. Private repositories can opt in by name and are
never linked; any repository can opt out. The contract is in
[docs/PORTFOLIO_METADATA.md](docs/PORTFOLIO_METADATA.md).

## Stack

Vue 3 and TypeScript on Vite, prerendered to static HTML with vite-ssg, deployed to GitHub Pages by
Actions. No runtime framework for the content: every page exists as HTML before JavaScript runs.
Releases, package versions and GitHub activity are fetched at build time and the site is rebuilt
daily, so no version or count on it is ever typed by hand. The design rules are in
[docs/design.md](docs/design.md).

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
| `scripts/fetch-activity.mjs` | GitHub calendar, languages, releases, commit counts and merged pull requests, at build time. |
| `scripts/fetch-registry.mjs` | npm and PyPI versions and downloads for the packages a project declares. No token. |
| `scripts/fetch-sites.mjs` | Finds each repository's GitHub Pages site, so every live site is linked. No token. |
| `scripts/shipping.mjs` | Turns all of that into the build log and each project's proof line. Pure, unit-tested. |
| `scripts/fonts.mjs` | Copies the two OFL typefaces from their packages into `public/fonts`. |
| `scripts/check-site.mjs` | Fails the build on a dead link, a private link, a missing title and so on. |
| `src/` | The Vue app: views, components, and the stylesheet split into tokens, base, layout and components. |
| `tests/unit` | Vitest: schema, policy, generated data, components, the site checker. |
| `tests/e2e` | Playwright: pages, filters, interactions, accessibility (axe). |

## Licence

Code: MIT. The written content is © Tochi Mba. Bricolage Grotesque and Martian Mono are under the SIL
Open Font License; see `public/fonts/LICENSE.txt`.
