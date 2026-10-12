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
