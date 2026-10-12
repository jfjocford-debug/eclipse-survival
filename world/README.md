# World generation

`generator.js` exports `World` and `CHUNK_SIZE` (16). Instantiate with
`new World(seed, savedChanges)`. It imports only the pure deterministic blueprints
in `layout.js`; both are native ES modules with no external dependencies.

The town extends in every direction. Thirty-two-tile blocks contain furnished
buildings, a connected road and sidewalk network, clear entrance paths, trees,
fences, abandoned vehicles, and seeded loot. Nine named landmarks surround the
starting house: Morrow House, Mercy Pharmacy, Hollis Hardware, Last Stop Diner,
Juniper Market, Station No. 4, Black Pine Auto, The Lantern Apartments, and
Garden House. Further blocks select from nine building templates and palettes.

## Public interface

- `update(px, py)`: preload a 5 × 5 chunk neighborhood; evict chunks outside a
  7 × 7 retention area. Eviction records modified props. Queried distant chunks
  are also evicted on the next update.
- `getTile(x, y)`: tile with integer coordinates, type, room when indoors, and
  current collision. `isBlocked(x, y)` returns that collision. Fractional and
  negative coordinates work; nonfinite coordinates are blocked.
- `getVisibleTiles(px, py, radius = 24)`: square tile region for renderer culling.
- `getProps(px, py, radius = 24)`: unique, live props intersecting that square.
- `getNearby(x, y, radius = 2)`: live props within radius of their tile centers,
  using the nearest occupied center for wide props; nearest first.
- `serialize()`: detached JSON object of changed prop snapshots keyed by stable
  prop ID. Unmodified exploration adds no save data.
- `applyChanges(changes)`: apply full snapshots or field patches, preserving
  references held by the game. It accepts the flat save object or `{props: …}`.
- `placeProp({x, y, type, ...})`: place a persistent custom prop with an assigned
  ID; returns its live object or `null` for an invalid/occupied footprint. The
  caller consumes materials only after success.
- `damageProp(id, amount = 25)`: `{hit, destroyed, health, prop?}`. Destruction
  immediately removes collision and rendering. Damage to loaded or unloaded
  generated props and custom props persists. `destroyProp(id)` destroys directly.
- `getLocation(x, y)`: building name, street name, or surrounding grounds.
- `getBuildings(px, py, radius = 48)`: building rectangles and names for a map.

## Integration details

Spawn `(7.5, 7.5)` is clear inside Morrow House. `crate:6:7` contains guaranteed
starting supplies. `door:12:7` is the closed east exit, with a clear approach to
the street. Opening it immediately clears collision. Barricades restore
collision even on an open door/window.

Props use tile-origin `x, y` and occupied tile dimensions `w, h`. Their render
center is normally `(x + .5, y + .5)`. Wall rotation is 0 along the x axis and 1
along the y axis. South/east perimeter walls have `cutaway: true`; all four
perimeter walls still collide. Additional renderer metadata includes `side`,
`color`, `variant`, `buildingId`, lamp `lit`, and tile `floorStyle`/`rug`.

Direct gameplay mutations to live props, including edits to nested loot arrays,
are captured by saving or unloading. Use `placeProp` for new geometry and
`damageProp` for removal; existing prop IDs and positions should remain stable.
Destroyed props remain as save markers but are excluded from `getProps` and
`getNearby`. Custom props can span chunk and town-block seams.

Validation: `node --test world/world.test.mjs tests/world.test.mjs`.
