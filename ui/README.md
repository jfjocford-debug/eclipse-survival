# Deadfall UI

Owned UI files: `index.html`, `ui/hud.js`, `ui/icons.js`, `ui/styles.css`. Native ES modules and system fonts; no runtime dependencies.

`new UI(game).mount()` creates the DOM HUD. Call `update(state)` each render frame: DOM updates throttle to 10 Hz and small-map rendering to ~1 Hz. `notify(text)` displays an escaped, deduplicated toast. `toggle(name)` supports inventory, crafting, skills, map, help, pause, and close. `close(forceResume = false)` handles returning focus and simulation state. `destroy()` removes DOM/listeners. `panel` is the current name or null. `setSaveStatus('saving'|'saved'|'error')` is optional; state.saveStatus is the fallback.

All gameplay buttons route through `game.action()`. Modal opening calls `action('pause', {source:'ui'})`, and closing calls `action('resume', {source:'ui'})` when appropriate. Game owns hotkeys and must respect this source guard. A restarted state can close the death panel with `toggle('close')`.

Features: live needs, weather/time/location, objective progress, current stance/noise, quick actions, interactions, inventory filters and item details, nearby looting, recipes and barrier building, real skill XP, local maps from world terrain/props, nearby infected markers, controls, persistence actions, restart confirmation, death record. Tab stays within open dialogs; focus returns on close. CSS leaves canvas actions available outside interactive controls and adapts down to small viewports. Desktop keyboard and mouse are required for movement.

Validation (2026-10-12): `node --check` passed for both JS modules. A temporary LinkeDOM harness at `/tmp/deadfall-ui-check/check.mjs` exercised UI against the real Game/World classes: mount/unique IDs, inventory filtering and selection, consumption, pause/resume, crafting, building availability, map/skills/help, restart confirmation, escaped notification text, death/restart, cleanup. No package was added to the game. Inspected QA's 1440×900 live Chromium screenshot `tests/artifacts/chromium/01-first-play.png`; layout and canvas visibility look correct. The QA agent owns broader live browser tests.
