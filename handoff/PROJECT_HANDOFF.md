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
