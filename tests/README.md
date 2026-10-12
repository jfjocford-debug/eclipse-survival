# Deadfall verification

Run from the project root with Node 20+:

```sh
node --test tests/*.test.mjs ai/*.test.mjs save/*.test.mjs world/*.test.mjs render/*.test.mjs
node perf/benchmark.mjs
node build/optimized/build.mjs
```

The first command covers the engine/input lifecycle, ECS joins, worker
pathfinding/protocol, needs/weather/combat, world generation/streaming, game
actions, and save serialization/fallbacks. The save specialist's suite adds an
asynchronous IndexedDB test double. Browser smoke tests separately exercise
real browser storage and native module workers.

`fixtures.mjs` provides plain contract states. `worker-bridge.mjs` adapts browser
worker globals to an actual Node worker; pathfinding and simulation modules are
the production code. `game.test.mjs` runs the real Game update/actions with DOM
and saving hooks replaced; it does not assert that Canvas or real browser IDB
works. No tests silently skip missing production modules.

## Browser suite

Run on the dedicated browser machine, not the small main workspace. Install
`cloakbrowser` and `playwright-core` in its browser workspace and configure the
Solid relay on `127.0.0.1:1080`. Copy `browser-smoke.mjs` beside those packages.
Install Firefox/WebKit with Playwright when running those variants.

```sh
DEADFALL_URL=https://your-endpoint QA_BROWSER=chromium node browser-smoke.mjs
DEADFALL_URL=https://your-endpoint QA_BROWSER=firefox node browser-smoke.mjs
DEADFALL_URL=https://your-endpoint QA_BROWSER=webkit node browser-smoke.mjs
```

Artifacts default to `/workspace/browser/artifacts/<browser>/`: JSON report,
screenshots and an exported save. Each run uses a new isolated browser context.
`QA_OUTPUT` overrides the artifact directory. Chromium uses CloakBrowser via
the relay. Firefox/WebKit use Playwright's actual engines for compatibility
checks; WebKit on Linux is not a Safari/macOS hardware test.

The browser suite combines keyboard/UI checks with explicit state setup for
bounded scenarios such as fatal bleeding and consuming water. Frame timing is
reported for diagnosis and has no universal pass/fail threshold. Screenshots
must also be inspected for visual defects. See `RESULTS.md` for executed runs.

`browser-render-check.mjs` runs the bounded three-engine render/movement/zoom
check and captures daylight/night-rain views. `browser-profile.mjs` records
Chromium method timings, a CPU profile, the GPU feature report and an on/off/on
ground-cache comparison. Run these beside the same browser packages. The
temporary QA relay was removed after the recorded run; provision/configure a
new relay before repeating the scripts. Compact measured reports are retained
in `browser-results.json` and `../perf/profile-results.json` independently of
the larger screenshot/CPU-profile artifacts.
