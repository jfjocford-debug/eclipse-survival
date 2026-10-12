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
