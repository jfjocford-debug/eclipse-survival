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
