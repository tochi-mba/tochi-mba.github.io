# Design: the build log

One point of view: **a build log for agent systems that ship.** The site is evidence, typeset like
an editorial page. These rules keep later changes from drifting back into a template.

## Three rules

1. **Every number is fetched or checked at build time.** Versions, release dates, download counts,
   commit counts and live sites come from GitHub, npm and PyPI during the daily build. Prose never
   carries a version; `scripts/build-data.mjs` fails the build if it does.
2. **Scale, not decoration.** Big type and hairlines do the work. No glows, blurred blobs, gradients,
   card borders and hover spotlights, animated counters, pulse dots, custom cursors, smooth-scroll
   libraries or loaders.
3. **Motion carries information.** The headline rises once; the build log draws in, oldest event
   first; rows fade up as they arrive. Everything else is at most 240 ms, ease-out, on transform or
   opacity. Under `prefers-reduced-motion`, or without JavaScript, nothing moves and everything is
   already in place.

## Colour

Lime (`--signal`, `#d7ff3f`) marks evidence and nothing else: a shipped release, a live signal, a
fetched number, a focus ring. The primary button is ink on paper, not lime. Every text colour is
at least 5.9:1 on the background; the tokens and their OKLCH sources are in `src/styles/tokens.css`.

## Type

- **Bricolage Grotesque** (OFL), one variable file with weight and optical size. Optical sizing is
  automatic, so the 120 px headline gets the display cut and body text the text cut.
- **Martian Mono** (OFL) for data, labels and dates.
- Both are self-hosted and preloaded, with fallback faces whose metrics were measured against the
  web fonts, so the swap does not move the page.

## Layout

A 12-column grid. Section labels sit in the first three columns, titles and content in the other
nine. Sections are separated by a hairline and space, never by a panel.

## The build log

One lane per flagship, plus the LUCY family on the hub's lane and "Everything else". One column per
thing that shipped, oldest on the left. A square is a release (merged across GitHub, npm and PyPI
when they share a version); a tick is a merged pull request; `//` on the axis marks a gap of more
than a week, because the columns are evenly spaced. On a phone the log scrolls and opens on today.
