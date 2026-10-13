# Visibility system (specified by Jacques, Oct 12, 2026)

The player no longer sees the whole area at once.

## Rules

1. **Room-bounded sight.** The player sees only the interior space they stand in. Other rooms stay hidden.
2. **Openings.** Rooms connected by a legitimate opening (an open door, or a window) are visible through it as a directional cone.
3. **Outdoors.** A small visibility radius, with fog of war beyond it.
4. **Light matters.** A dark room stays dark without a light source. Windows show silhouettes at night. Weather reduces outdoor clarity.
5. **Memory.** A room or area that has been seen stays faintly visible after the player leaves.

## What the code gives us (checked Oct 12)

- Every tile already carries `room` and `buildingId`. In the current generator each building is **one open room**: a rectangle with a perimeter of walls, doors and windows and no interior partitions. So rule 1 maps to "the building you are in" in the first version.
- Doors and windows are props with live `open` and `barricaded` state, so rule 2 can use the real state of each opening.
- Lamps already have a `lit` flag, and the renderer has `_lighting`, `_windowShafts` and `_weather` passes to build rules 4 on.
- Interior partition walls would change the generated geometry and the stable prop IDs, so they need a save migration. They are a later step.

## Phases

1. Visibility model in the pure simulation layer (testable without a browser): which tiles the player sees, from room, openings, radius, light and weather. Unit tests first.
2. Rendering: hide what is not visible; draw the fog.
3. Memory: store seen tiles per building and chunk in the save (versioned, with a migration).
4. Zombies and loot are hidden or shown by the same rule.
5. Later: interior partitions and room-by-room generation.

Open decisions (answer in play, not in advance): the outdoor radius at day and at night; how faint remembered areas are; whether zombies seen through a window stay shown.

## Status (Oct 12): phase 1 done

`world/visibility.js` and `world/visibility.test.mjs` (14 tests, all passing; whole suite 94 of 94). It computes, from the live props, what the player sees, with no drawing code yet. Nothing is wired into the game or the save.

How it decides, in plain terms: walls, closed doors and barricaded windows stop sight; open doors and clear windows pass it, which makes the cones. Indoors the room is fully in range; outdoors the radius is about 9 tiles on a clear day, 3.5 at night, less in rain, fog and storm. A room is dark unless a door or window lets daylight in or a lamp is lit; tiles within 1.5 tiles can always be felt. Through glass, a tile that is too dark shows a silhouette. Tiles seen are remembered; silhouettes are not.

Known simplifications: trees, cars and fences do not block sight; lamps light only their own building (or the open street); the 1.5-tile near radius, the 0.25 light threshold and the radii are first guesses to tune in play; the memory is not yet saved.

## Status (Oct 12, later): phase 2 done, drawn in the game

Decided by Jacques: beyond the player's sight the world is covered by **dark fog in which the shapes of the town stay faintly visible**, not by black.

- `render/renderer.js` `_fog()` draws it: hidden tiles 90 percent dark, remembered tiles 74, silhouettes 62; the outdoor radius fades out over its last 40 percent; dim rooms are shaded. It is drawn at a sixth of the screen resolution and scaled up, which softens its edges. A wall that is in view also clears the fog above it, because walls rise over the tiles behind them.
- Actors in hidden or remembered tiles are not drawn; in a silhouette tile they are drawn half transparent. The minimap no longer shows zombies the player cannot see.
- `game.js` `updateVisibility()` runs every frame (about 0.6 ms). A new survivor gets a new memory. Console switch for debugging: `game.renderer.fogEnabled = false`.
- The outdoor day radius is now 7 tiles (it was 9, which was not small on a 1366-pixel-wide screen); night 3.5. A tile counts as seen if any of five points in it can be reached, so cones through doors and windows are solid.

Known limits: the minimap still draws the whole local map, not only explored ground; the fog is drawn per ground tile, so tall props (trees, cars, furniture) at the edge of the view can look cut; memory is not yet saved (phase 3); trees, cars and fences do not block sight; all radii, fog darkness values and the light threshold are first guesses for play testing.
