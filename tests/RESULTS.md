# Deadfall verification results

Executed 12 October 2026. **80/80 Node tests passed**, with no failures,
cancellations or skips. **14/14 gameplay checks passed in each of Chromium,
Firefox and WebKit**, with no page errors. The final renderer-only alpha crop
then passed a separate render, movement, zoom and night/rain check in all three
engines. No blocking functional issue remains from these executed scenarios.

## Reproducible evidence

- Node command: `node --test tests/*.test.mjs ai/*.test.mjs save/*.test.mjs world/*.test.mjs render/*.test.mjs`.
- Raw Node result: [node-results.tap](node-results.tap), 80 passes in 11.27 seconds.
- Browser scenarios: [browser-smoke.mjs](browser-smoke.mjs); compact reports: [browser-results.json](browser-results.json).
- Final rendering checks: [browser-render-check.mjs](browser-render-check.mjs).
- Performance harness: [browser-profile.mjs](browser-profile.mjs); measured output: [profile-results.json](../perf/profile-results.json).
- Package report: [build-results.json](../build/optimized/build-results.json).

Node 20 ran the engine/input lifecycle, ECS, actual worker protocol, AI,
needs/weather/combat, world streaming, game actions, persistence and renderer
suites. Game action tests use the production Game class with DOM/storage hooks;
Canvas tests use a validating context double. Browser checks cover real Canvas,
module workers, file downloads, file input and browser storage separately.

The browser machine was Debian 13 with 2 vCPUs and approximately 3.83 GiB RAM.
Runs were sequential, headless, and used isolated contexts through a Solid
relay. Chromium was CloakBrowser 146.0.7680.177; Firefox was 157.0; WebKit was
27.2. Chromium's device report identifies ANGLE SwiftShader, software Canvas,
and disabled hardware compositing/rasterization. WebKit on Linux is not a test
of Safari on Apple hardware.

## Browser behavior checked

Each engine executed the same 14-check harness: direct boot with a module
worker; E to search starter supplies and update the journal; keyboard movement
with collision; pause/resume; inventory and water consumption; inventory and
position after actual reload; projection inversion at several zooms; JSON
download; file-input import and reload; Space and aimed pointer combat;
keyboard barricading followed by reload; a 1280px layout/frame sample; death
and a fresh survivor; and absence of page errors.

Combat uses controlled actor placement, then real keyboard/pointer events.
Fatal bleeding, low thirst and import comparisons also use explicit scenario
setup. These bounded checks establish input-to-action integration; they are
not a long survival playthrough or a balance assessment. Node tests additionally
cover basic wooden barrier placement/dismantling and streamed world changes.

An earlier import test exposed an overwrite: a pagehide autosave could save the
old live state after importing a new snapshot. The coordinator added a guard
before awaiting the import save. The Node regression and actual file-input
roundtrip now pass in all three engines. Earlier pause-modal and restart
transient-state issues were also corrected and verified.

The 14-check gameplay runs include the ground cache, import guard and restart
cleanup. Only the renderer's prop-atlas alpha crop changed afterward. The final
three-engine smoke verified painting, movement, collision, keyboard zoom,
projection roundtrip, daylight and controlled night/rain without page errors.
Daylight and night screenshots were visually reviewed for populated scenes,
prop anchors, lighting and readable HUD. Full gameplay was not repeated solely
for that renderer-only crop.

## Measured performance

The gameplay harness sampled 90 frames at 1280px after combat and barricading,
before the last alpha crop. These are observations from software rendering:

| Browser | Mean frame time | p95 frame time | Approximate rate |
| --- | ---: | ---: | ---: |
| Chromium 146 | 47.35 ms | 66.60 ms | 21.1 fps |
| Firefox 157 | 55.42 ms | 67.32 ms | 18.0 fps |
| WebKit 27.2 | 119.54 ms | 156.00 ms | 8.4 fps |

The final alpha-cropped build received a separate same-view Chromium profile
at 1280×720, 60 frames per phase, with the static ground cache toggled:

| Final build phase | Mean frame time | p95 frame time |
| --- | ---: | ---: |
| Ground cache enabled | 22.05 ms | 33.40 ms |
| Ground cache disabled | 43.10 ms | 50.10 ms |
| Ground cache re-enabled | 23.42 ms | 33.40 ms |
| Canvas rendering disabled, diagnostic only | 16.70 ms | 16.80 ms |

The ground cache reduced measured frame time by approximately 46–49% against
the uncached path in this short comparison. The enabled samples correspond to
roughly 43–45 fps in this scene. This comparison isolates the cache toggle;
it does not isolate the alpha crop's contribution against earlier builds.

Instrumented method averages across the profile phases were 3.56 ms for render,
0.166 ms for simulation update and 0.119 ms for UI update. Lighting averaged
1.05 ms. These calls overlap and their averages must not be added together.
JavaScript timings exclude deferred raster/compositor work. The larger frame
intervals, software device report and no-Canvas diagnostic point to significant
rendering cost outside the measured JavaScript methods. Removing HUD backdrop
filter did not produce a reliable improvement in this short sample.

**There is no sustained 60-fps or GPU performance claim.** WebKit was especially
slow in the software environment. Representative GPU laptops, actual Safari,
mobile controls, long sessions, memory growth and large hordes remain untested.
The short samples are diagnostic evidence, not universal performance budgets.

## Deliverable and scope

The optimized packaging script validated the local module/worker/resource
graph and produced 39 runtime files: 347,614 raw bytes, 175,191 Gzip bytes and
164,274 Brotli bytes. Compression sidecars require server content negotiation.
The build preserves native ES modules and has no external runtime packages.

Screenshot evidence is retained in `tests/artifacts/render-<engine>/` as
`daylight.png`, `movement-zoom.png` and `night-rain.png`. Full gameplay artifacts
are in `tests/artifacts/final-<engine>/`; the raw CPU profile is in
`tests/artifacts/final-profile/`. These larger artifacts may be omitted from a
source archive; this report, the compact JSON reports and test scripts should
remain included.

This is a playable survival foundation. Basic barrier building and dismantling
are implemented. Advanced construction, a WebGL renderer, multiplayer and the
full systems of a commercial survival game remain future work described in
[ROADMAP.md](../ROADMAP.md).

After testing, the temporary QA relay `okevuU` was torn down on the browser
machine and deleted. No browser processes remained and port 1080 was closed.
The hosting machine and HTTP endpoint were preserved; `deadfall-web` remained
active and its local HTTP check returned 200. See [cleanup-results.json](cleanup-results.json).
