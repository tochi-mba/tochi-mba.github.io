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
   first; rows fade up as they arrive; the LUCY map plays back what a request does. Everything else
   is at most 240 ms, ease-out, on transform or opacity. Under `prefers-reduced-motion`, or without
   JavaScript, nothing moves and everything is already in place.

## Colour

Two themes from one set of tokens in `src/styles/tokens.css`. `light-dark()` picks a side by
`color-scheme`, which follows the device until a visitor picks one with the toggle in the header or
the command palette. The choice is stored and applied by a one-line script in `index.html` before
the stylesheet, so a returning visitor never sees a frame of the other theme. A browser without
`light-dark()` gets the dark theme, the one the system was drawn in first.

The signal colour marks evidence and nothing else: a shipped release, a live signal, a fetched
number, a focus ring. On ink it is lime (`#d7ff3f`); on paper lime would vanish, so it is the same
hue taken down to an ink (`#4a6500`). The primary button is ink on paper in the dark theme and paper
on ink in the light one, never the signal colour.

Every text colour is at least 5.5:1 on both backgrounds in both themes, and the signal is at least
4.5:1; `tests/unit/tokens.test.ts` reads the stylesheet and holds it to those numbers.

Switching theme opens the new one as a circle from the control that asked for it, through a view
transition, and only when motion is allowed.

## Type

- **Bricolage Grotesque** (OFL), one variable file with weight and optical size. Optical sizing is
  automatic, so the 120 px headline gets the display cut and body text the text cut.
- **Martian Mono** (OFL) for data, labels and dates.
- Both are self-hosted and preloaded, with fallback faces whose metrics were measured against the
  web fonts, so the swap does not move the page.

## Layout

A 12-column grid. Section labels sit in the first three columns, titles and content in the other
nine. Sections are separated by a hairline and space, never by a panel. Below 760 px everything is
one column, every control is at least 44 px tall, and nothing scrolls sideways except the build log,
which says so.

## The build log

One lane per flagship, plus the LUCY family on the hub's lane and "Everything else". One column per
thing that shipped, oldest on the left. A square is a release (merged across GitHub, npm and PyPI
when they share a version); a tick is a merged pull request; `//` on the axis marks a gap of more
than a week, because the columns are evenly spaced. On a phone the log scrolls, opens on today, and
keeps the lane names pinned to the edge.

## The LUCY map

The hub in the middle, keyring beneath it, and the rest of the family around the ring, placed from
the list alone so a new service makes room for itself. Once it is on screen it plays back what the
family does: a square travels from the hub to a service, to keyring for the caller's token, and back
with data, while the steps beside the map say which is which. Then it moves on to the next member.

A visitor takes over by hovering, focusing or picking a member; the tour waits. Members can be
picked up and thrown; they spring home. The ring drifts a few pixels so the picture is never quite
still. All of it pauses with the button under the map, stops while the map is off screen, and never
starts under reduced motion. On a phone the picture is too small to touch, so the same family is a
row of buttons.

## The command palette

`Ctrl K` (`⌘ K` on a Mac), or the search button in the header, opens a dialog that finds any page,
any shown project and a few actions (switch theme, copy the email address). It is a native
`<dialog>`, so focus is trapped and returned by the browser, and its code is loaded the first time
it is opened.
