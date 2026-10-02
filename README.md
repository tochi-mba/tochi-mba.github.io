# tochi-mba.github.io

Tochi Mba's portfolio, live at <https://tochi-mba.github.io/>. A REX Technologies site.

Every one of my repositories describes itself in one file, `.portfolio/project.json`, and this site
is built from them: adding a project is adding the file, and taking one off is setting `display` to
`false` in it. A private repository can opt in with its own consent and is then shown in its own
words, with only the links anyone can open; its name and its source never leave GitHub. The
contract is in [docs/PORTFOLIO_METADATA.md](docs/PORTFOLIO_METADATA.md).

## Stack

Vue 3 and TypeScript on Vite, prerendered to static HTML with vite-ssg, deployed to GitHub Pages by
Actions. Every page exists as HTML before JavaScript runs. Projects, releases, package versions and
GitHub activity are read at build time and the site is rebuilt daily, so nothing on it is typed by
hand twice. Light and dark themes follow the device until a visitor picks one; the choice is applied
before the first paint. The design rules are in [docs/design.md](docs/design.md).

## Commands

```sh
npm install
npm run dev          # local dev server
npm run sync         # refresh data/projects.json from every repository's own file
npm run check        # data, lint, types, unit tests with coverage, build, site checks: what CI runs
npm run test:e2e     # Playwright: Chromium, Firefox and WebKit; phone, tablet, desktop; both themes
npm run shots        # screenshots of every page at three sizes in both themes (needs a preview server)
```

`npm run sync` uses `PORTFOLIO_TOKEN`, else `GITHUB_TOKEN`, else the GitHub CLI's sign-in. Run it
with the owner's sign-in to refresh private projects; the daily build refreshes public ones itself.

`npm run build` writes `dist/`: the pages, `sitemap.xml`, `og.png`, and the published metadata
schema at `schema/project.schema.json`.

## Layout

| Path | What |
| --- | --- |
| `data/projects.json` | The snapshot: every project that may be published, and how many repositories there are in all. Written by `npm run sync`. |
| `data/profile.json` | Who I am: narrative, experience, skills, contact. |
| `scripts/schema.mjs` | The metadata contract and the publication policy. |
| `scripts/sync.mjs` | Turns every repository's file into the snapshot. Pure and unit-tested; `sync-projects.mjs` is its command line. |
| `scripts/github.mjs` | Lists every repository with its metadata file, a few GraphQL requests in all. |
| `scripts/links.mjs` | Which links may be published, and which still answer. |
| `scripts/build-data.mjs` | Applies the policy again, merges what was fetched, writes `src/generated/site-data.json`. |
| `scripts/fetch-*.mjs` | GitHub activity, npm and PyPI packages, GitHub Pages sites and link checks, at build time. |
| `scripts/check-site.mjs` | Fails the build on a dead local link, a link into an unpublished repository, a missing title and so on. |
| `src/` | The Vue app: views, components, the theme, the command palette and the LUCY map's motion. |
| `tests/unit` | Vitest, with every module that decides something held to 100% coverage. |
| `tests/e2e` | Playwright: pages, filters, themes, the palette, the map, accessibility (axe) and performance. |

## Licence

Code: MIT. The written content is © Tochi Mba. Bricolage Grotesque and Martian Mono are under the SIL
Open Font License; see `public/fonts/LICENSE.txt`.
