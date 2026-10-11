# Eclipse Survival — Vision (decided)

Oct 10, 2026 · decided by Jacques · replaces "a small wall-defence prototype" as the project's definition

## One sentence

An isometric survival sandbox in the spirit of Project Zomboid, rebuilt so that every system produces a story and no system produces a chore, set in a grim world where the Eclipse brings the Apostles.

## The north star

**Self-authored stories.** What you named as Zomboid's strength is the target: every death a narrative moment, every base a record of improvisation, every run a diary of mistakes and luck.

The test for every feature, now and later: **does it create a decision or a consequence worth remembering? If it only creates labour, it is cut or automated.**

## Pillars

1. **Slow dread.** The world is hostile and you are always one mistake from losing everything. Tension comes from attrition, noise, light, and the rhythm of the Eclipse, not from constant fighting.
2. **Earned, explained death.** Permadeath stays and stays harsh. But death must be the result of a decision, and the player must be able to read why it happened. No death from a single unlucky roll.
3. **Chores become decisions.** Time passing, hauling and repetition collapse into single actions. Labour is cut; choices about risk, supplies and people stay.
4. **A simulation that is small and alive.** A few interlocking systems chosen for the stories they create, not a long feature list.
5. **A place that feels real.** A believable town, believable interiors, and loot that makes sense where it is found.
6. **The Berserk twist.** Apostles are not a reskinned horde. They are rare, overwhelming and terrifying, and they change how the player plays.

## Your three frustrations and the design answer

| Frustration | Answer |
|---|---|
| Long waits and repetitive actions | One "pass time" action (sleep, read, wait) that runs safely and stops when something happens. Hauling reduced by larger carry limits plus a base stash, not by per-item micromanagement. |
| Death from one unlucky bite or scratch | A visible **fuse**. A wound starts a clearly shown condition (bleeding, then infection) with a timer and a way to treat it. The player always has a window to act. Death comes at the end of the fuse, not from the first hit. |
| Unclear feedback about why something went wrong | A **death recap** and live cause indicators: what hit you, what state you were in, what you could have done. Every damage source is named on screen. |

## Simulation: what stays, what waits

Chosen for story value per unit of work.

| System | Decision | Why |
|---|---|---|
| Noise, sound propagation, line of sight | **Core** | The engine of slow dread. Already partly built (visibility, stances). |
| Weather, temperature, clothing | **Core, simple** | Cheap, and creates many small stories. |
| Injuries and the fuse | **Core** | Answers your biggest complaint and creates the death stories. |
| Base building and defence | **Core** | Already built in a first form (Wall Integrity). |
| Food and hunger | **Simplified** | Eat or suffer. No nutrition and weight accounting. |
| Community (recruits, loyalty, traitor) | **Core differentiator** | Not in Zomboid. Carries the late-game betrayal. Closest neighbour: State of Decay. |
| Fire spread | **Later** | Strong stories, but add after the core works. |
| Vehicles, farming, electricity, trapping | **Post-1.0 candidates** | Each is large. Do not start any before the core is fun. |
| Modding | **Partial** | The game data is already data-driven, which gives simple modding for free. |

## The Apostles (decided Oct 10)

Something the player avoids, outlasts or outsmarts. Rare, and an early encounter is nearly unwinnable. That keeps the slow dread intact, and the Eclipse is the clock that brings them.

Only once the player has grown strong and mastered their skills could they take the fight to an Apostle. Even for the most skilled it is not an easy fight: Apostles are tough. The fight is a late-game reward for mastery, not a feature of the early game.

A third layer could sit beneath them: weaker corrupted creatures that make up the everyday threat, so ordinary survival still works between Eclipses.

Note: Berserk is someone else's creation. For a personal project that is fine. If the game is ever shown publicly, the Apostles should become original designs and names.

## Art direction (decided Oct 10)

Our own assets, made as a mixture of the reference screenshots: the warm, 1970s radio-station isometric look, Project Zomboid's readable isometric survival view, and State of Decay's fog and mood. The mixture is refined until it becomes this game's own style. The map, the look and the asset pipeline are Milestone 3 work; gameplay systems do not wait for final art.

### Art pipeline (decided Oct 11)
- Format: 2D sprites on an isometric grid, as in Project Zomboid (not 3D models).
- Method: we make the assets first, then adjust them.
- Rule: no asset is made unless a pillar or a decision in the game needs it. The first set is a slice, not the full list (see ART.md).

## What this changes in the plan

- **Map.** A 10 by 10 street cannot carry this vision. A small believable town is needed before the community and the story work.
- **Add early:** the injury fuse, the death recap, and the "pass time" action. They answer your stated frustrations and are cheap compared with the community work.
- **Keep in order:** feel and assists, then night loot, stealth and crafting, then community, then the late story. The core loop decisions from earlier still hold.
- **Defer:** vehicles, farming, electricity, fire.
- **Mobile.** Dropped, as decided. Desktop and keyboard first.

## Risks

- **Breadth.** Your list of what makes Zomboid great is very long. A solo project that tries to match it will not reach a playable game. The table above is the guard.
- **Genre drift.** Strong Apostles invite an action game. The pillars above are how we notice it.
- **Iteration cost.** Each cloud build and test takes about fifteen minutes. Large untested batches of work are risky; small ones are not.

## Decisions (Oct 10)

1. The six pillars stand.
2. The Apostles are avoided, outlasted or outsmarted; only a mastered player can fight one.
3. The core set in the simulation table is what gets built first.
