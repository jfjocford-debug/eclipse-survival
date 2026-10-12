# Deadfall prototype roadmap

Deadfall is an original browser survival foundation. Its intended scope is a
single survivor exploring a procedurally generated town, gathering supplies,
fighting or avoiding zombies, crafting simple tools and securing a shelter.
It is not a feature-complete recreation of a commercial survival game.

## Prototype scope

- Native browser ES modules and Canvas2D rendering with no runtime packages.
- Deterministic chunked terrain, readable interiors, doors, windows and loot.
- Fixed-step movement, collision, melee/ranged combat, survival needs and weather.
- Worker-owned zombie sensing and A* pathfinding with bounded per-update work.
- Inventory, crafting, barricading, wooden barrier placement/dismantling,
  pause/help and a survival journal.
- Versioned local saves, validated JSON import/export and a storage fallback.

Actual verification results and any open failures are recorded separately in
`tests/RESULTS.md`. A listed feature does not imply production-scale coverage,
mobile control support, or sustained performance on every device.

## Next playable improvements

1. Longer play sessions: tune depletion, loot, damage, infection and progression
   from recorded playtests; add more clear early objectives and contextual help.
2. Interaction depth: explicit target selection when loot and doors overlap,
   multiple barricade layers, advanced construction, furniture disassembly and
   weapon wear. Basic wooden barrier placement and dismantling already work.
3. Persistence resilience: cross-tab ownership, save-slot selection, backups and
   user-facing recovery when a browser clears storage. Cloud sync needs a server.
4. Presentation: richer animation, more original environmental art, spatial
   sound, controller rebinding and reduced-motion/high-contrast options.

## Expansion requires additional systems

- Large hordes: actor interest management, sleeping simulation outside the
  active area, worker transfer profiling and systematic CPU/memory budgets.
- Larger settlements: navigation regions, asynchronous chunk generation,
  authored landmarks, streaming stress tests and persistent world migration.
- Rendering scale: a WebGL renderer, GPU sprite batching, adaptive quality and
  representative hardware testing would be additional work. The current
  renderer uses Canvas2D with cached sprite and static-ground layers.
- Deeper survival: farming, cooking, power/water networks, construction,
  vehicles, advanced injuries and NPC schedules are separate projects.
- Multiplayer: authoritative networking, reconciliation, security and hosting
  must be designed before shared-state gameplay can be promised.

## Release gate for a broader public build

Maintain passing unit and integration tests; verify actual IndexedDB reloads,
worker failure handling and world changes across unloading; complete extended
survival sessions on representative laptops; repeat browser checks in current
Chromium, Firefox and Safari; measure draw time, worker latency, actor counts,
chunk retention and save sizes; and publish the tested hardware/browser matrix.
Headless Chromium measurements alone are not a performance guarantee.
