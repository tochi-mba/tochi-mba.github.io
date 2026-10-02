# Portfolio metadata contract

Every repository owned by `tochi-mba` describes itself to the portfolio in one file:

```text
.portfolio/project.json
```

The repository's own file is the truth. The portfolio publishes what the file allows and nothing
else; there is no list of projects to edit here. Adding a project is adding the file; taking one
off the site is setting `display` to `false` in it.

The file is validated against <https://tochi-mba.github.io/schema/project.schema.json>, generated
from `ProjectFile` in [`scripts/schema.mjs`](../scripts/schema.mjs). Name it in the file and an
editor completes and checks the fields as you type.

## The file

The least a file can say:

```json
{
  "$schema": "https://tochi-mba.github.io/schema/project.schema.json",
  "slug": "weftai",
  "name": "weftai",
  "tagline": "Composable AI workflows: the model plans, your code executes.",
  "category": "ai",
  "status": "active",
  "display": true
}
```

Everything else is optional:

| Field | Meaning |
| --- | --- |
| `slug` | The project's address: `/work/<slug>`. Lowercase words joined by hyphens, unique across every repository. |
| `name` | What the project is called. Up to 60 characters. |
| `tagline` | One line, shown on every card. Up to 160 characters. |
| `description` | Paragraphs separated by a blank line (`\n\n`). Up to 1,200 characters. |
| `highlights` | Up to eight short lines of what stands out. A featured project needs at least one, and a description. |
| `stack` | Up to twelve technologies, most important first. |
| `category` | `product`, `ai`, `service`, `tool`, `web` or `early`. |
| `family`, `role` | A family of projects and this one's part in it. `family: "lucy"` puts a project on the LUCY map; `role: "hub"` and `role: "vault"` are its two fixed points. |
| `status` | `active`, `wip`, `stable` or `archived`. Archived and `early` projects are listed in the archive. |
| `featured` | Shown on the home page and first on the work page. |
| `order` | Position; lower first. Left out, 500. |
| `display` | `false` opts the repository out. Nothing about it reaches the site or this repository: not its text, not its name. |
| `publicSafe` | A private repository's consent to being shown in its own words. Ignored for a public one. |
| `reason` | Why `display` is false, so an opt-out reads as a decision. Never published. |
| `links.site`, `links.download`, `links.package`, `links.source` | Where a visitor can go. A public repository's source link and its GitHub Pages site are found automatically; write them only to point somewhere else. |
| `year` | When the work happened. Left out, the year the repository was created. |
| `packages` | Package names on npm and PyPI (`{ "npm": [...], "pypi": [...] }`). Versions, dates and downloads are fetched at build time; the first name in each list is the main package. |

Never write a version number in `tagline`, `description` or `highlights`: it is stale the day after
the next release. The build fails if one appears; the site shows fetched versions instead.

What a file may not say is GitHub's to say: whether the repository is private, and its name and
address. The sync adds those, and a file that tries is refused.

## The policy

| The repository is | `display` | `publicSafe` | On the site |
| --- | --- | --- | --- |
| public | true | – | Card and page, with its source, its live site and every link that still answers. |
| public | false | – | Nothing. Counted in the number of repositories, never named. |
| private | true | true | Card and page from the file's own words. Only links anyone can open: a package, a live site elsewhere. Never its name, never its source. |
| private | true | false | Nothing. Counted only. |
| private | false | – | Nothing. Counted only. |
| either | no file | – | Nothing new. A public repository that was published before keeps what it published last, so a missing file never takes a project off by accident; `display: false` does that on purpose. |

The policy is applied twice: by the sync, which writes only publishable projects into
`data/projects.json`, and again by `scripts/build-data.mjs`, so a hand edit to the snapshot cannot
publish what the sync would not. `scripts/check-site.mjs` then fails the build if any page links
into a repository the portfolio does not publish.

A link is published only when a visitor can open it. A link into a private repository is dropped
before anything is fetched; every other link is requested at build time, the way a browser would,
and one that is gone (404, 410, or a host that no longer exists) is left off the site until it
answers again. A slow or failing server is not taken as gone.

## How it gets here

`npm run sync` reads every repository and its file from GitHub in a few GraphQL requests and writes
`data/projects.json`, the snapshot the site is built from. The snapshot holds only what is on the
site, plus one number: how many repositories there are in all.

- **The owner's token** (`PORTFOLIO_TOKEN`, or the GitHub CLI's sign-in when run locally) sees
  private repositories, so a sync with it decides everything afresh.
- **The token a workflow is given by default** (`GITHUB_TOKEN`) sees public repositories only. The
  daily build syncs with it, so a public repository's change reaches the site within a day with no
  commit here. Private projects are carried over from the committed snapshot unchanged, because
  not seeing a repository is no reason to unpublish it.

To publish a private project's change without waiting for a local sync, add a fine-grained token
that can read the owner's repositories' contents and metadata as the `PORTFOLIO_TOKEN` secret of
this repository; the build uses it when it is there.

A file that breaks the contract is not used. A public repository then keeps what it published last,
so one typo never takes a project off the site, and the sync says what to fix.

What the sync prints may end up in a public build log, so it names public repositories only. A
private repository's problem is reported as a count: run the sync locally to see which.

When GitHub cannot be read at all, the snapshot is left as it was and the build goes on with it.
`npm run sync -- --strict` fails instead, and also fails when any file could not be used.

## Adding a repository

1. Create `.portfolio/project.json` in it, with `$schema` so the editor checks it as you type.
2. For a private repository, decide whether `publicSafe` should be `true`: everything in the file
   becomes public.
3. Push. A public repository appears on the next daily build, or straight away with `npm run sync`
   here. A private one appears after `npm run sync` with the owner's token.
