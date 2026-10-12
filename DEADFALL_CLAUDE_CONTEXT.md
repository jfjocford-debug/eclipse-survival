# Deadfall — Claude continuation context

Prepared 12 October 2026. The companion ZIP contains the runnable source, PNG assets, screenshots, original references and verification reports. The companion text source bundle is for inspection, not a standalone runnable game.


---

## Document: CLAUDE.md

# Deadfall — continuation instructions

Continue this existing playable game. The user wants further iteration and development, preserving the working prototype and its visual direction. The handoff does not authorize an automatic rewrite or define every future feature.

Read `handoff/START_HERE.md`, `handoff/PROJECT_HANDOFF.md`, `handoff/NEXT_STEPS.md`, and `tests/RESULTS.md` before making changes. `README.md` covers controls and local setup. Use source code as the authority when an older module README differs. Earlier parallel-agent folder ownership and workspace-specific coordination instructions do not apply to the next developer.

## Working baseline

- Native browser ES modules, Canvas 2D, sparse actor ECS, module-worker AI, static hosting. No runtime package dependencies or backend.
- Run from the repository root: `python3 -m http.server 8080 --bind 127.0.0.1`, then open `http://localhost:8080`.
- Node 20+ tests: `node --test tests/*.test.mjs save/*.test.mjs ai/*.test.mjs world/*.test.mjs render/*.test.mjs`.
- Package: `node build/optimized/build.mjs`. Output is `build/optimized/site/`.
- Last recorded baseline: 80 Node tests passed; 14 gameplay checks passed in each of Chromium, Firefox, and WebKit. Final renderer changes had a separate three-engine visual/movement/zoom pass. Report new checks separately from this historical evidence.
- Browser test launchers depend on the original development environment. Read `handoff/PORTABILITY.md` before running or adapting them. Playing the game and running Node tests need no Solid account, token, relay, or service.

## Preserve these behaviors

1. Opens directly into play and automatically resumes the current browser's save. Keep import/export, visible save failures, and preservation of unreadable saves.
2. Preserve the import reload guard: old state must not autosave over an imported snapshot during `pagehide`.
3. Fixed simulation step and bounded catch-up; A* stays in the worker. Paused menus continue rendering while simulation is frozen.
4. World changes survive chunk eviction and save/reload. Stable generated prop IDs, seed behavior, and save schema changes require a migration strategy.
5. `state.player`/zombie objects are shared ECS component objects; do not create competing actor stores or resurrect removed entities.
6. Pointer/projection coordinates are CSS pixels. Props use integer tile origins; actor positions are fractional tile coordinates. Recheck zoom and DPR after renderer edits.
7. Preserve cutaway interiors, warm lamps, worn materials, muted olive/amber UI, and readable player silhouettes. Use the included screenshot and reference files.
8. Keep the app portable and dependency-light. New development tools are fine; explain any new runtime or server requirement.

Make one coherent improvement at a time. Inspect the relevant implementation first; use focused regression tests and actual browser checks when behavior or rendering changes. Do not claim browser execution or hardware performance from a mock, a screenshot, or an old report. Report changed files, behavior, validation, and remaining limits. Maintain the handoff/roadmap as decisions change.


---

## Document: handoff/START_HERE.md

# Exporting Deadfall to another development environment

This handoff is a complete source snapshot plus continuation context, prepared on 12 October 2026. The game is an original Project Zomboid-inspired browser survival foundation. It is already playable; the purpose of the handoff is to help another developer extend it without losing its working systems.

## What to give Claude

**For a session that can work with files:** extract `deadfall-claude-handoff.zip`, open the enclosed `deadfall/` directory in that environment, and provide the text in `handoff/CLAUDE_PROMPT.md`. Ask Claude to read `CLAUDE.md` first. The project does not need the original machine or service credentials.

**For a chat session without a filesystem:** provide `DEADFALL_CLAUDE_CONTEXT.md` and the prompt. Supply `DEADFALL_CLAUDE_SOURCE.txt` when source inspection is needed. It contains the text source and tests with explicit file boundaries. Attach the daylight and night/rain screenshots separately when discussing visuals. If a session cannot handle the full text bundle, supply the brief and relevant individual files from the ZIP instead. Chat suggestions still need to be applied and executed in a development environment.

Download these files yourself before uploading them to another service. Workspace attachment links use your workspace access; another model cannot be assumed to fetch them. The public preview is supplementary, not a replacement for the source.

## Included files

| Location | Purpose |
| --- | --- |
| `CLAUDE.md` | Concise continuation instructions and invariants |
| `handoff/CLAUDE_PROMPT.md` | Ready-to-paste first message |
| `handoff/PROJECT_HANDOFF.md` | Architecture, data flow, APIs, fixed bugs, current limits |
| `handoff/NEXT_STEPS.md` | Suggested priorities with acceptance criteria |
| `handoff/PORTABILITY.md` | Setup, hosting, browser-test adaptation, save transfer |
| `handoff/screenshots/` | Actual final daylight and night/rain game captures |
| `handoff/references/` | Original user-supplied visual references and sprite study |
| `tests/RESULTS.md` | Scope and results of the executed verification |
| `tests/browser-results.json`, `perf/profile-results.json` | Compact verification evidence |
| `HANDOFF_MANIFEST.json` | File sizes and SHA-256 checksums for the exported snapshot |

The complete runtime source and eight character PNGs are included. Large raw profiler captures, generated compressed build output, machine credentials, and workspace management helpers are omitted. The original user references are design inputs, not runtime dependencies.

## First local run

In a terminal opened in the extracted `deadfall/` directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. On systems where Python is named `python`, use that command instead. Do not double-click `index.html`: native modules and module workers need HTTP(S). Click the world, press E to collect the starter supplies, then use WASD, click/Space, and I. H opens controls.

The development terminal must stay open while serving. The existing hosted version is at https://deadfall-cwdknte.solid.site; local edits do not change that deployment.

## Verification and saves

With Node 20+ available, run the full command in `CLAUDE.md`. These Node checks do not need npm install. Browser automation has additional development dependencies and environment assumptions documented in `PORTABILITY.md`.

Your personal running survivor is stored in your browser and is **not** embedded in the source archive. To continue that survivor locally, use Pause → Export in the hosted game, keep the downloaded JSON, then use Pause → Import on the local copy. Different hostnames or ports have different browser storage. Keep the original export while changing persistence code.

The software is a foundation. The source has no open-source license grant; `package.json` currently says `UNLICENSED`. Asset provenance is documented in `assets/README.md`. Confirm redistribution terms for the supplied imagery before a wider release.


---

## Document: handoff/PROJECT_HANDOFF.md

# Deadfall technical handoff

## Product and release state

Deadfall is a desktop browser survival sandbox inspired by Project Zomboid's systems. It starts directly inside a furnished safehouse and resumes a previously saved survivor automatically. It is a playable foundation, not a commercial-scale simulation. The continuation goal is richer gameplay, stronger presentation, and measured performance improvements while retaining this working baseline.

Implemented: deterministic streamed town/interiors; colliding doors and windows; searchable loot; inventory and equipment; melee and pistol combat; worker-based local zombie behavior; hunger, thirst, energy, stamina, bleeding and infection; simple skills; crafting; barricading and wooden barrier placement/dismantling; resting; day/night and weather; map, journal, help, pause and death/restart UI; local autosave and validated import/export.

The latest runtime is dependency-free native JavaScript modules and Canvas 2D, with local images and system fonts. There is no backend, cloud save, multiplayer, bundler requirement, or runtime model API. Development browser automation packages are separate from the game.

The published baseline is https://deadfall-cwdknte.solid.site. `tests/RESULTS.md` records the original verification and limits. Runtime files in the handoff match that source baseline; the handoff adds documentation and reference material only. The manifest identifies the exported file contents. This snapshot was not a Git repository, so no commit history is included; initialize version control in the new working copy if desired.

## Entry and runtime flow

`index.html` loads `main.js`. It dynamically imports `Game`, awaits `init()`, exposes `window.game`, and calls `start()`. Errors produce a recovery overlay. `Game.init()` loads a saved state, creates World/Renderer/Input/AI/ECS/UI/Engine, and saves a fresh survivor if no usable save exists. `start()` paints once before starting animation frames.

The engine runs fixed 1/60-second simulation updates with at most five catch-up steps per frame. Excess elapsed time is discarded and counted, so a very slow browser can advance simulation more slowly than wall-clock time. Hidden tabs reset the clock. The game handles pause/death independently so menus can render while simulation is frozen.

`Game.update()` processes menus/zoom, stops simulation when paused/dead, handles movement/rest, updates streamed world and actor views, applies input actions, then calls weather → needs → AI → combat. It handles a death notification/save once and autosaves after 15 simulation seconds. `Game.render()` renders the world and refreshes the UI.

## File map and interfaces

| Area | Source and responsibility |
| --- | --- |
| Boot/integration | `main.js`, `game.js`: setup, movement, actions, inventory, spawning, lifecycle and persistence scheduling |
| Loop/input | `engine/loop.js`, `engine/input.js`: fixed timestep, browser input edges, normalized screen movement, pointer capture |
| Actors | `ecs/world.js`: sparse component maps; `create`, `add`, `get`, `has`, `remove`, live `query` |
| World | `world/generator.js`, `world/layout.js`: deterministic chunks, stable live props, collision, mutations and layouts |
| AI | `ai/controller.js`: worker snapshots, decisions, live collision validation, fallback steering |
| Worker | `workers/aiWorker.js` → `ai-worker.js`; `simulation.js`, `pathfinding.js`: sensory behavior and bounded A* |
| Simulation | `systems/combat.js`, `needs.js`, `weather.js`: attacks, damage, needs, clock and weather |
| Rendering | `render/renderer.js`, `primitives.js`, `tiles.js`, `props.js`, `characters.js`: projection, depth, atlases, lighting/effects |
| UI | `ui/hud.js`, `icons.js`, `styles.css`: HUD, panels, actual item actions and save controls |
| Content | `data/items.js`: item metadata and recipes; `assets/survivor/`: eight supplied sprite facings |
| Persistence | `save/indexedDB.js`, `serializer.js`, `deserializer.js`, `schema.js`, `errors.js` |
| Verification/release | `tests/`, module-specific tests, `perf/`, `build/optimized/build.mjs` |

`World` exposes `update`, `getTile`, `isBlocked`, `getVisibleTiles`, `getProps`, `getNearby`, `serialize`, `applyChanges`, `placeProp`, `damageProp`, `destroyProp`, `getLocation`, and `getBuildings`. Read `world/README.md` for signatures. Returned props are live objects; saving/eviction captures nested mutations. New geometry must use `placeProp`; destruction must use the damage/destruction APIs.

`Renderer(canvas, world)` exposes `resize`, `render(state, alpha)`, `worldToScreen`, `screenToWorld`, `setZoom`, and `destroy`. The game clamps zoom to 0.6–1.8; Renderer itself supports a slightly wider range. `renderer.cacheGround = false` is a profiling switch, not a user feature.

`UI(game)` exposes `mount`, `update`, `notify`, `toggle`, `close`, `setSaveStatus`, and `destroy`; `panel` is the current name or null. Panels invoke `game.action(name, payload)`. Payload conventions and action behavior are in `game.js`; do not duplicate inventory/crafting logic in the UI.

## State, identity, and coordinates

`createState()` in `game.js` is the canonical fresh-state definition. Top-level fields include `version`, `seed`, `time`, `day`, `elapsed`, `paused`, `dead`, `weather`, `player`, `zombies`, `worldChanges`, `objectives`, `stats`, `settings`, and `noise`. It also has transient messages/particles/UI fields. `spawnedChunks` is added to persistent snapshots. Needs use 0–100 with higher values better; bleeding/infection increase with injury. `time` is minutes of day, not seconds; weather advances five game minutes per simulation second.

Player/zombie actor objects are shared with ECS component values; the current code is a hybrid plain-state/ECS architecture. `syncEntities()` rebuilds the zombie array from the registry. Simply filtering or replacing `state.zombies` after registration can reintroduce actors on the next sync. Update registry membership deliberately when adding removal, unloading, or pooling.

Actor positions are continuous world tiles. Props use integer tile origins with a usual visual/interaction center at `(x + .5, y + .5)`, and optional tile footprint `w`/`h`. Collision samples use tile centers and live prop flags. Screen movement is converted by Game to isometric world movement; changing that conversion affects every movement key.

Projection uses a 64×32 diamond and 32 pixels per height unit. Pointer and projection APIs use CSS pixels; the backing canvas handles DPR separately (capped at 2). Do not multiply input coordinates by DPR. South/east cutaway walls remain solid despite their shortened artwork.

Fresh seed is 74219. Spawn is `(7.5, 7.5)` in Morrow House. The starter supply prop is `crate:6:7`; the closed east exit is `door:12:7`. These are fixtures used by tests. The town uses 16×16 chunks and 32-tile blocks, with a 5×5 preload neighborhood and 7×7 retention region. Generation spans negative coordinates. A detached map query can temporarily load additional chunks; the next update evicts outside retention.

## AI and simulation ownership

AI snapshots run at 8 Hz. The worker receives a 65×65 occupancy grid periodically; A* has a seven-search-per-snapshot budget and bounded node exploration. Only living zombies within 30 tiles are active. Main-thread collision and attack rays recheck the current world so a stale worker answer cannot cross a newly closed door. `state.ai.worker` and related fields report worker health.

The game caps living zombies at 100 and marks visited spawn chunks. Distant living actors are dormant, not a persistent offscreen ecology. Worker failure falls back to limited direct steering, not main-thread A*. There is no door-breaking, scent system, town migration or independent sound-source network. Read `ai/README.md` before expanding populations.

| Owner | Timers and state it advances |
| --- | --- |
| Game | Player movement, elapsed time, spawning, rest health/energy bonuses, input, inventory, save timing |
| Needs | Hunger/thirst/energy depletion, stamina drain/recovery, bleeding/infection damage |
| Weather | Time/day, weather transitions, daylight |
| AI controller | Zombie movement and behavior decisions, worker coordination |
| Combat | Attack/hurt cooldowns, strikes/damage, particles, noise decay, corpse visual timers |
| Renderer | Visual caches and animation presentation, not persistent simulation |

Do not double-decrement timers across systems. Combat/needs can set `state.dead` before Game observes the damage. Game uses `_deathHandled` so notification/save happens once. Corpses remain in the actor registry until the game's distance cleanup removes them.

## Persistence and regressions to preserve

The envelope is `{format: "deadfall-save", version: 1, savedAt: ISO timestamp, data: state}`. IndexedDB database `deadfall`, store `saves`, key `current` is mirrored to localStorage key `deadfall.save.v1`. `loadGame`, `saveGame`, `clearSave`, `exportSave`, and `importSave` are async. `importSave(file)` validates and returns state; Game separately saves it and reloads.

`world.serialize()` and the visited spawn-chunk set must be placed into a save/export snapshot. Transient particles, messages, render data, nearby prop references, paused state, save labels and location are removed. Unknown safe JSON extension data is retained. Writes are ordered, snapshots detached, and success awaits transaction commit. The newest valid copy wins; timestamped deletion markers prevent a stale backend from restoring a cleared survivor. Load failures preserve unreadable data rather than overwriting it.

Critical fixes already covered by tests:

- **Import/reload overwrite:** before writing an imported snapshot, Game sets `persistenceBlocked = true` and clears queued saves. Reload fires `pagehide`; saving old live state then would undo the import. Preserve the guard and error rollback.
- **Save overlap:** Game coalesces a requested save while another is busy; the persistence module serializes writes. Keep the two responsibilities consistent.
- **Modal recursion:** UI-originated pause uses `{source: "ui"}` and only changes pause state. It must not reopen/toggle the panel recursively. P/Escape must close the modal as well as resume. Clear queued input when leaving menus.
- **Restart carryover:** reset rest/attack transients, AI worker, ECS, world, spawn set, save clock and renderer motion/blood/camera caches.
- **Live doors:** `open` and `barricaded` determine collision; metadata alone is not enough. Recheck on the main thread after worker output.
- **Reachability:** searching/interacting through solid walls is prevented by the current reach checks.

Cross-tab ownership, save slots, durable backups, cloud sync, and world-generator migration are not implemented. Changing stable prop IDs or generation geometry without a migration can misapply existing world patches even if the JSON validates. Test an old exported save whenever persistent state changes.

## Renderer, art, and performance

The source generates local terrain/furniture/tree/car textures and sprites. The eight survivor images came from the user's supplied sprite-lighting study. Infected variants are derived from them with cached tinting and transformed motion. No additional commercial game assets were obtained. Read `assets/README.md`; the handoff is not a new license grant.

The static ground cache covers the viewport plus 192-pixel margins, rebuilding after 128 pixels of camera movement or on zoom/resize/world replacement. Terrain, road paint, rugs and litter are cached; actors, props and lights stay dynamic. If future gameplay changes cached ground, add an explicit invalidation/revision path. Prop atlases are alpha-cropped once, preserve one-pixel padding and adjusted anchors, and fall back when pixel reads fail. The cache is bounded to 420 entries.

Recorded baseline: 80 Node tests; 14 gameplay checks per Chromium 146, Firefox 157, WebKit 27.2; a subsequent renderer-only three-engine pass. The final same-scene Chromium software profile measured 22.05 ms cache-on, 43.10 ms off, 23.42 ms re-enabled. This supports roughly 46–49% improvement from the cache toggle in that scene, not a measured standalone alpha-crop improvement. Earlier gameplay samples were slower, especially WebKit. Do not compare different scenes as a controlled benchmark.

Rendering uses Canvas composites and ambient/contact shadows, not WebGL or physical lighting. The supplied character art has directional views with procedural sway, not complete animation sheets. Physical GPU devices, actual Safari on Apple hardware, mobile controls, long sessions and large hordes remain unverified.

## Where to extend a feature

Add an item/recipe in `data/items.js`, implement any new use semantics in `game.action`, connect UI display/actions, and check save normalization accepts its data. Add a prop through `World` and its stable persistence path, then implement artwork/interaction and stream/reload tests. Add AI behavior in the worker simulation while keeping authoritative collision checks. For a new panel, follow UI-originated pause/resume and input clearing. For performance work, hold scene/viewport/DPR/zoom/browser fixed and compare frame intervals as well as JavaScript timing.


---

## Document: handoff/NEXT_STEPS.md

# Suggested iteration plan

These are proposed priorities, not claims that the features already exist and not an instruction to implement everything at once. The owner can change their order. The broader `ROADMAP.md` remains the expansion outline.

## 1. Establish a reproducible development baseline

Read the handoff, run locally, execute Node tests, inspect the actual game and screenshot references, and initialize version control if desired. Adapt the existing browser harness to the new machine as described in `PORTABILITY.md`. Avoid changing gameplay during that adaptation.

Acceptance: baseline tests recorded; one fresh browser session can loot, move, pause, save/reload and import an export; browser errors captured; setup commands work without the original workspace relay. Clearly mark checks that cannot be run. Keep historical and new results separate.

## 2. Profile and improve frame consistency

Reproduce fixed indoor, outdoor and combat scenes on available hardware. Record browser, resolution, DPR, zoom, actor count, mean/p95 frame intervals, draw timings and memory. Include moving across cache/chunk boundaries, not only standing still. Investigate the largest measured cost before choosing Canvas refinements, quality controls, or a WebGL migration. Preserve the existing direct rendering path for comparison.

Acceptance: repeatable before/after measurements in identical conditions; no regression in movement, projection, hit targeting, lighting or save behavior; no increasing cache/memory trend in a documented longer session. If a quality option is introduced, explain the visual tradeoff to the player. Set a hardware-specific target after measuring instead of asserting universal 60 FPS.

## 3. Improve the survival loop and interaction clarity

Choose a narrow feature such as explicit nearby-target selection when a container and doorway overlap, or clearer early guidance. Investigate how the 100-living-actor cap and dormant distant actors affect exploration. Tune needs, combat and loot with recorded play sessions rather than changing many constants at once.

Acceptance: the action clearly identifies its target; reach/collision rules remain enforced; inputs work at low frame rates and after menus; new state survives reload; the player can understand the first useful action without reading source. Add regression tests for the chosen behavior.

## 4. Make persistence safer for longer-term use

Add cross-tab ownership and user-visible recovery/backup behavior before cloud sync. Plan explicit schema and generator migrations before changing stable world IDs or geometry. Keep a version-1 fixture as a compatibility check.

Acceptance: an old exported survivor restores position/inventory/doors/builds and visited spawn chunks; import cannot be overwritten by pagehide; unavailable/quota/corrupt storage produces a truthful status; a stale tab cannot silently replace newer progress; restart stays intentional.

## 5. Expand content and simulation in separate milestones

Examples: weapon wear and repair; richer original animation; deeper building/disassembly; expanded recipes; independent sound events; larger population interest management; authored locations. Each needs a small playable target plus a save/performance budget. Advanced construction, utilities, vehicles, farming, NPCs, multiplayer and GPU renderer replacement are substantial additional systems, not switches to enable in this prototype.

At each milestone, deliver changed files, tests/screenshots or measurements, a short known-limitations update, and a runnable build. Ask the owner about major product-direction choices when needed; routine implementation choices can proceed within the chosen milestone.


---

## Document: handoff/PORTABILITY.md

# Running and validating outside the original workspace

## Runtime and Node tests

The game is static browser code. Copy the whole `deadfall/` directory, including `assets/` and `workers/`. No Solid credential, remote machine ID, relay or environment variable is needed to run it.

From the extracted root, with Python 3:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. Use `python` if that is the Python 3 command on your machine. Any correct static HTTP server works; a single-page-app fallback is unnecessary. Modules/workers must receive JavaScript, not an HTML fallback. Serve over localhost or HTTPS. `file://` is not supported.

With Node 20+ and a shell that expands these globs:

```sh
node --test tests/*.test.mjs save/*.test.mjs ai/*.test.mjs world/*.test.mjs render/*.test.mjs
node perf/benchmark.mjs
node build/optimized/build.mjs
```

If the shell does not expand file globs, pass the individual `.test.mjs` paths to `node --test`. Tests and packaging use Node's standard library; no npm install is required. Packaging validates module/worker/resource references and generates raw assets, Gzip/Brotli sidecars and SHA-256 checksums under `build/optimized/site/`. Do not treat old `build-results.json` as the result of a newly executed build.

## Browser automation needs environment adaptation

The checked-in browser scripts are the real scripts used for the original reports. Their launchers import development-only `cloakbrowser`/`playwright-core`, route traffic through SOCKS on `127.0.0.1:1080`, and default output paths to `/workspace/browser/artifacts`. That relay has been removed. They are not ready-to-run generic CI scripts. This is a tooling limitation, not a dependency of the game.

In the new environment, adapt only the launch/configuration section first:

1. Choose the locally available automation/browser installation and install its development dependencies outside the runtime bundle.
2. Set the target to the local server, for example `DEADFALL_URL=http://localhost:8080`.
3. Remove the old SOCKS proxy and Chromium host-resolver override, or replace them with the new environment's actual network configuration. Do not assume port 1080 is available.
4. Resolve artifact paths inside the new checkout. `browser-smoke.mjs` and `browser-profile.mjs` support `QA_OUTPUT`; `browser-render-check.mjs` currently embeds its output directory and needs an edit.
5. Preserve the scenario bodies: they exercise real input, actual reload/storage, file import/download and module workers. Wait for `game.engine.frame > 2` and `game.state.ai` before interacting; fixed short sleeps caused false startup failures in slow WebKit.
6. Run browsers sequentially for uncontended measurements. Keep each context isolated. Record actual browser versions, new results and any unexecuted engines.

`browser-profile.mjs` uses Chromium CDP for CPU/GPU diagnostics and is not an engine-neutral profiler. The controlled night/rain screenshot explicitly sets time/weather; it does not establish that a full day was played. Node Canvas mocks verify geometry/API use but do not establish real rendering correctness. Do not represent launcher adaptation as a fresh browser pass until it actually executes.

## Hosting a new build

The generated static `build/optimized/site/` can be hosted independently. Serve originals normally; only serve `.gz`/`.br` sidecars when the server negotiates encoding and sets `Content-Encoding` correctly. Preserve relative asset and module-worker paths. Revalidate nonhashed entry/module filenames to avoid mixing versions.

`deploy/server.py` is the previous Python production server. It defaults to `/workspace/deadfall`, binds loopback port 8080, and supports precompressed assets. To use it elsewhere, set `DEADFALL_ROOT` to the absolute directory being served. For simple local development, the standard Python HTTP command above is easier. The original persistent service/tunnel configuration and API helpers are intentionally not part of this export.

The preview URL belongs to the existing hosted deployment. Editing the exported copy or running the packager will not update it. Deploy to your own chosen hosting target when ready; keep that a separate step from local verification.

## Moving a survivor and reference material

Browser saves belong to their origin and profile. Export from the hosted game's pause menu, then import on the new origin. No personal browser save is included in the handoff. Keep an untouched exported file when validating migration behavior. Changing ports also changes the local browser origin.

The ZIP includes runtime images, final game screenshots and the original supplied references. `DEADFALL_CLAUDE_SOURCE.txt` contains text only; it cannot reproduce binary PNG assets by itself and is not a runnable substitute for the ZIP. The context brief is a reading aid; the real source remains authoritative.


---

## Document: handoff/CLAUDE_PROMPT.md

# Paste this into the new Claude session

I want you to continue developing Deadfall, the working browser survival prototype in the attached project. Preserve the current game and visual direction while improving it incrementally.

Read `CLAUDE.md`, `handoff/PROJECT_HANDOFF.md`, `handoff/NEXT_STEPS.md`, `handoff/PORTABILITY.md`, and `tests/RESULTS.md`. Inspect the actual code and the included daylight/night screenshots before proposing structural or visual changes. If only the text bundle is available, use its file boundaries and state which files or capabilities you still need.

First establish the baseline: run the game locally and the Node tests if your environment allows it. Distinguish tests you actually execute from the handoff's recorded results. Summarize the architecture, the main remaining gaps, and a short prioritized iteration plan. Unless I give a different priority, begin with the baseline and profiling milestone in `handoff/NEXT_STEPS.md`, then make the smallest useful improvement justified by what you find. Do not replace the project with a new scaffold.

Keep automatic save/resume, save import/export and compatibility, world mutations after streaming, worker pathfinding, input/pause behavior, and the isometric projection working. Preserve the warm cutaway interiors, gritty muted palette, and readable tactical UI. The game currently has no runtime dependencies or backend; explain any proposed change to that.

Work in small reviewable changes. For each completed iteration give me: the concrete behavior changed, the edited files or patch, how you checked it, remaining risks or limitations, and the next recommended step. If you cannot execute code, say so and provide exact changes and verification instructions instead of claiming tests passed.

