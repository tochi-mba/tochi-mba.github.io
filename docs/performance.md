# Performance

What a visit costs, measured the same way every time, so an optimisation or a regression is a
number rather than a feeling. The tool is `scripts/perf.mjs`; the numbers it compares against are in
`perf/baseline.json`.

## Measuring

```sh
npm run build                         # perf measures the build in dist/
npm run perf                          # measure, and compare with perf/baseline.json
npm run perf -- --save                # ...and keep this measurement as the new baseline
npm run perf -- --weight              # page weight only: quick, and the same on every machine
npm run perf -- --check               # exit 1 if a page's weight grew past its budget
npm run perf -- --runs=5              # more runs per page for steadier timings (default 3)
npm run perf -- --pages=/,/work       # other pages (default: home, work, about, a project)
npm run perf -- --out=before.json     # also write the measurement to a file of its own
npm run perf -- --baseline=before.json  # compare with that file instead of the baseline
npm run perf -- --dist=../other/dist  # measure another build (serve it and set SHOTS_BASE)
```

To compare two versions of the site directly: build the first, `npm run perf -- --out=a.json`;
build the second, `npm run perf -- --baseline=a.json`.

## What is measured

**Weight**: everything a first visit to the page downloads, compressed with gzip the way GitHub
Pages serves it (fonts are already compressed and count as they are). Measured from the files in
`dist/` that a real browser asked for, so a lazily loaded chunk counts only if the page loads it.
The same on every machine, so it is the part a check can fail on.

**Speed**, twice per page, each run from a cold cache with requests to other sites refused:

- on a phone: the Pixel 7's screen, the CPU four times slower, 150 ms round trips at 1.6 Mbps
  (what Lighthouse's mobile run assumes);
- on a desktop: 1440x900, 40 ms at 10 Mbps.

For each: first and largest contentful paint, total blocking time (the part of every long task past
50 ms, after the first paint), layout shift, the main thread's time in script, style and layout up
to three seconds after load, the number of elements, and the JavaScript heap. On the home page also
the main thread's milliseconds per second while the LUCY map is on screen, which is what its
animation costs. Each figure is the fastest of the runs, since whatever else the machine is doing
only ever adds time; layout shift keeps the worst run instead, so an occasional shift still shows.

Timings depend on the machine and on whatever else it is doing. Each measurement records the
processor, the Chromium version and a short benchmark of how fast the machine ran at that moment;
the report says when the baseline came from a different processor, a different browser, or a
noticeably faster or slower moment. Compare timings from the same machine, run when it is quiet.

## Reading the report

A block per section (weight, phone, desktop), a row per metric and a column per page. Each cell is
the value now and its change against the baseline: `✓` better, `!` worse, `✗` worse than the budget
allows. Changes inside the noise are shown without a mark.

| Unit | The same if within | Over budget past |
| --- | --- | --- |
| bytes | 1% or 512 B | 5% or 2 kB |
| counts | exactly | 2 more |
| milliseconds | 10% or 20 ms | 25% or 100 ms |
| layout shift | 0.005 | 0.05 |

Pull requests run `npm run perf -- --weight --check`: a page that got more than 5% heavier fails
the check. Timings are not checked in CI, because a shared runner's speed varies from run to run.

## Changing the baseline

After a change that is meant to move the numbers, run `npm run perf -- --save` on a quiet machine
and commit `perf/baseline.json` with the change, so the next comparison starts from it. A change
that makes a page heavier on purpose is committed the same way, with a line in the commit message
saying why.
