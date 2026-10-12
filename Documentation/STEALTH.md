# Sight, hearing, cover and the Survivor screen (batch 1, Oct 10)

## How enemies find you

- An enemy sees you only if you are inside its **range**, inside the **cone** in front of it (or within 0.9 tiles of it), and nothing solid is between you. Buildings, cars, crates and trees block sight.
- Noticing is **gradual**: suspicion rises while you are seen, faster the closer you are, and drains in 1.5 seconds once you are out of sight. A suspicious enemy stops and looks (a yellow `?`). Inside 0.6 tiles it notices you at once.
- A noticed player is chased to the **last place the enemy saw or heard you**, not to where you really are. There it **searches** (an orange `?`) for a few seconds (6 for people, 10 for the Apostle), then gives up and goes back to patrolling.
- **Noise** is heard without a line of sight: running about 3.5 tiles, a melee swing about 4.3, a pistol shot about 8.5. A heard noise sends an enemy to look at where it came from.

## What changes how far you are seen

| Situation | Effect on range |
|---|---|
| Walking (the base) | x 1.0 |
| Jogging / running | larger (running also makes noise) |
| Crouching / crawling | smaller (set in game data) |
| Standing still | x 0.8 |
| Crouched or prone in grass (not on the road) | x 0.65 |
| Making noise | +2 tiles |

The ring on the ground is your real range. The wedge on the ground in front of each enemy is where it looks. **Both are hidden by default (Oct 11 decision); press F3 to show them while tuning.** Project Zomboid shows no such markings, so the world has to carry this information.

## The safehouse

- The Apostle still walks to the door and wears the walls down, **even when you are not inside**, unless it has noticed you elsewhere. Drawing it away from the door stops the damage.
- There is a **back window** in the safehouse (press E at the window, on the east side of the safehouse room). You climb out on the north side, crouched, with the whole building between you and the Apostle at the door. Press E at the same spot outside to climb back in.
- Indoors you cannot see the street. Instead: a text warning says something is outside, how near and toward which side of the screen; scratching sounds grow louder and quicker as it nears; each blow on the walls plays a thump, shakes the screen and flashes it.

## Survivor screen

Tab or I. Time stops while it is open. Left: a body figure that colours each wounded part, with a list of wounds (place, severity, source, age), health and stamina. Right: every item with its count, what it does, a hotkey, and a button (Equip, Unequip, Eat, Treat). The weapon in your hands is marked EQUIPPED.

Hunger, thirst and sleep are not in this build. Wounds have no lasting effect yet; that is the injury fuse in Milestone 2.

## Tuning

Per-enemy numbers (notice time, view angle, search time) are in the enemy data. Shared rules (0.9 close sense, 0.6 point-blank, 1.5 s fade, 0.8 still, 0.65 grass, 1.4 s between wall blows) are constants at the top of `Core/Simulation.cs`.
