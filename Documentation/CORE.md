# Deterministic gameplay core

`Assets/Eclipse/Core` is a pure C# port of the Eclipse Survival browser engine.
It preserves the authored 10 × 10 neighborhood, five 6 × 6 interiors, original
loot locations with seeded position jitter, and original gameplay rules. It
does not generate a new world layout. The assembly definition explicitly sets
`noEngineReferences: true`; there are no Unity or third-party dependencies.

## Integration API

The public types and methods follow `Documentation/CONTRACT.md`.

```csharp
using EclipseSurvival.Core;

GameState state = Simulation.Create(seed: 1, quick: false);
Simulation.Start(state);
Simulation.Step(state, deltaSeconds, logicalMove, run: false);
bool swung = Simulation.Attack(state, heavy: false);
Simulation.Dodge(state, logicalSwipeDirection);
Simulation.Interact(state);
Simulation.UseItem(state, Item.Food);
```

`Create` starts in `RunMode.Ready`; the view decides when to call `Start`.
The normal cycle is a 150-second day followed by a 90-second Eclipse. Quick
mode uses 35 and 25 seconds. `Step` performs no work outside `Playing`, including
when paused, dead, or survived. `NextCycle` retains inventory and equipped
weapon, restores up to 20 health, keeps the walls you built (integrity refills), and replenishes authored
loot and human enemies. A fresh run uses a new `Create` result.

The six inventory array indices are fixed:

| Index | Item |
| --- | --- |
| 0 | Crowbar |
| 1 | Pistol |
| 2 | Food |
| 3 | Medicine |
| 4 | Tools |
| 5 | Ammo |

`Context(state)` returns the current interaction **label string**, or `null`.
Interaction priority remains doorway, interior exit, shelter workbench, then
nearby loot. `FindBuilding(id)` supplies authored door positions and hints when
the UI needs more context. A valid `AimTarget` returns an `Enemy`; no target is
`null`. `LockId == -1` means no selected target.

Additional convenience APIs are `ItemName`, `FindBuilding`, `CreateEnemy`,
`Populate`, `Move`, `LineClear`, `NearestLoot`, `CollectLoot`, and `AutoLoot`.
`Move(position, displacement, area)` returns the resulting logical position.
`CollectLoot` is a low-level collection operation: it checks mode, room, and
duplicate status, but callers should use `Interact`, `TapLoot`, or `AutoLoot`
when distance and wall checks are required.

## Coordinates and physics probe

All core positions remain logical `(X, Y)` coordinates. Projection belongs to
the Unity view:

```text
logical (x, y) → Unity world (x - y, -(x + y) × 0.5)
```

`Simulation.CollisionProbe` is optional and has type
`Func<V2, string, bool>`. **Return `true` for a solid collision / blocked point.**
The second argument is the logical area ID, including `"street"`, `"shelter"`,
`"clinic"`, `"market"`, `"workshop"`, or `"house"`.

The Unity root can project the query position and perform its static-wall
`Physics2D` overlap check. The core never references that API. Its behavior is:

1. Reject positions outside the authored world/room bounds.
2. Reject authored exterior building footprints, using the supplied logical
   radius (default `0.13`).
3. Reject positions where the external probe returns `true`.

The external probe can add collision restrictions but cannot remove authored
walls. Leave it `null` for pure core tests. This is a static callback; the host
owns its lifetime and should reset it when replacing a scene or test host. To
retain deterministic simulation, it should query a stable set of static walls,
not moving actors, and should avoid managed allocations.

Movement splits displacement into steps no larger than `0.09` logical tiles
and tests X and Y separately to preserve sliding along walls. Sight/shot/loot
rays retain the browser's 19 interior samples. These use `CanWalk` with a zero
authored-building radius and therefore also use the external probe. The probe
signature does not receive a radius, so any overlap size chosen by the Unity
host applies to both motion and ray queries.

## Preserved gameplay

- Movement: walk `0.95`, jog `1.45`, crouch `0.66`, crawl `0.38`, sprint `2.45`,
  dodge `4.6` logical units per second. Analog magnitude affects movement while
  facing stays normalized. Dodge uses 22 stamina and supports a supplied
  direction.
- Health/stamina, food, medicine, equipment toggling, gun ammunition, attack
  cooldowns, invulnerability, noise, and stance visibility follow the browser.
- Aim is a **soft lock** (changed Oct 10, 2026 after desktop playtesting; the browser
  engine's 30-degree cone made melee miss unless the player faced the enemy
  exactly). Every living enemy in range with a clear line is scored by distance,
  with a penalty for being off to the side, and the lowest score wins. Melee
  accepts a 150-degree cone out to `1.55` tiles (reach `0.95` plus a `0.6`
  lunge) and anything within `0.5` from any direction. Pistol accepts an
  80-degree cone out to `5`. The current lock gets a score bonus and a slightly
  wider range and angle so it does not flicker. Weapon ranges and angles come from
  `GameData`; the scoring dials (`AngleWeight`, `LockBonus`, slack values, point-blank
  distance) remain named constants at the top of `Simulation.cs`.
- A melee swing with a target farther than the stop distance pulls the player
  toward it by up to `0.6` tiles through the normal collision-aware `Move`, then
  hits if the target is within reach. An attack pressed during the last `0.2`
  seconds of the previous cooldown is buffered and fires on recovery; a dodge
  cancels it.
- Heavy attacks multiply damage by `1.9`, use 24 stamina, and impose a `0.95`
  second cooldown. A heavy pistol shot also uses two rounds. Rejected attacks
  spend no ammunition or stamina.
- Auto-loot radius is `1.75` tiles and its interval is `0.38` seconds. Priority
  is food, medicine, tools, ammo, then weapons; distance breaks ties. It stays
  within the current room and checks exterior walls. Automatic weapon pickup
  preserves the equipped weapon unless the player is using fists.
- Human patrol/chase/flee/attack states, scavenger theft and recovery, bandit
  drops, and Apostle telegraph remain intact. The safehouse follows the
  **Wall Integrity** design below; other interiors still give no protection from
  the Eclipse.
- **Wall Integrity** (changed Oct 10, 2026). Each tool spent at the workbench
  adds a permanent `20` to the safehouse capacity (base `40`, three tools, so
  `100`); building is refused during the Eclipse. At dawn integrity refills to
  capacity and the walls you built stay. In the Eclipse the Apostle walks to the
  door (about `4.5` s), then wears the walls down at `0.6` per second, rising `15%`
  each cycle (`WallPressure`). The player takes no damage and has nothing to do
  while the walls hold. A `THE WALLS ARE CRACKING` warning fires at `25%` of
  capacity. At zero integrity the walls breach and the old exposure damage
  (13 every 2.5 s) begins. Measured on cycle 1: no tools breach at 71 s and the
  player dies at 89 s; one tool holds with about 9 left; three tools finish with
  about 49 left. All values come from `GameData.Safehouse` and the Eclipse profile.
- The deterministic LCG uses the same unchecked 32-bit update and random-draw
  order as the browser. Door, room, building, and population data are authored.

The view can observe `Event` and incrementing `EventId` for audio/feedback.
Several events can occur in one simulation update; as in the browser, these
fields retain the most recent event rather than a queued history.
`LastAttack` is `null`, `"light"`, or `"heavy"`. `Shake` and `Enemy.Flash` are
remaining timers. `Effects` contains value-type `Effect` entries with `Kind`,
`Position`, `Time`, and optional `Target` indicated by `HasTarget`. Effect kinds
are `Hit`, `Shot`, `Dodge`, `Hurt`, `Loot`, and `Heavy`.

## Allocation and determinism limits

The regular frame path uses indexed loops, value-type vectors/effects, retained
list capacities, and stable in-place effect compaction. It has no LINQ, sorting,
per-frame enumerator objects, closures, or temporary candidate collections.
Setup, new cycles, the Eclipse spawn, inventory messages, and interaction-label
formatting may allocate; these are discrete gameplay or UI events.

The caller supplies time and input. `Step` clamps finite delta time to `[0, 0.1]`
seconds, matching the browser's frame clamp. Nonfinite delta time is ignored,
and nonfinite movement input is treated as zero. Coordinates and gameplay timers
use `float` to match the Unity-facing contract. Seeded runs are deterministic
for the same inputs, time steps, and collision results, but are not promised to
be bit-identical to JavaScript's double-precision trajectories or between all
floating-point backends. Phase boundaries may differ by one update near a
floating-point threshold. Use fixed time steps for replay comparisons.

This core does not own gesture recognition, UI, rendering, projection, Unity
collider creation, scene loading, persistence, audio, or application builds.
The host should call `Start` and `NextCycle` only from the appropriate UI states,
as those explicit lifecycle operations intentionally override the current mode.

## Standalone harness

The harness requires a .NET 8 SDK and no NuGet packages. It compiles the exact
same `Assets/Eclipse/Core/*.cs` files; there is no copied test implementation.
From the project root:

```sh
dotnet run --project Tests/CoreHarness/CoreHarness.csproj -c Release
```

It prints one `PASS` or `FAIL` per scenario and returns a nonzero exit code if
any scenario fails. Its 27 scenarios include all 15 original browser gameplay
tests; the three browser gesture tests belong to the Unity input/UI work.
Additional checks cover seeded replay, the original browser loot/RNG fixture,
external collision probes and occlusion, warm-frame managed allocation counts,
stance speeds and visibility, aim ranges, auto-loot equipment/throttling,
paused actions, all five enter/exit paths, directional dodge, timer clamping,
and in-place effect cleanup.

The lead agent compiled and executed this harness on the existing auxiliary
machine with **.NET SDK 8.0.425**: **27 passed, 0 failed**. This includes the full
day/Eclipse cycle, all five interiors, the original browser RNG fixture, and
the zero-managed-allocation check for warmed `Step` updates.

This validates the pure C# gameplay core. Unity Editor, scene, physics-probe
integration, and device/build validation are separate checks owned by the
Unity integration work. The harness itself does not require Unity, a graphics
device, a browser, or downloaded test frameworks.

## Event bus

Added Oct 10, 2026. The old single `Event` string was overwritten whenever two things happened in
one step, so a swing and its hit could not both be heard. Events are now typed and logged.

- `Simulation` appends a `GameEvent` (`Id`, `Kind`, `Source`, `Subject`, `Value`,
  `Amount`, `Position`) to `GameState.Events`, a log bounded to 64 entries. It never calls
  back into the host, so the simulation stays deterministic.
- `EventBus` (`Core/Events.cs`) delivers the log to subscribers. The host calls
  `Pump(state)` once per frame after stepping; `GameController.LateUpdate` does this.
  Each event is delivered once, in order, to subscribers of its kind and then to
  subscribers of everything. Handlers must not step the simulation or subscribe from
  inside a handler. `Missed` counts events trimmed before delivery.
- Kinds: Start, Door, Build, Loot, Equip, Heal, Dodge, Empty, Swing, Shot, Heavy, Hit,
  HeavyHit, ShotHit, Hurt, Dead, Warning, Eclipse, EclipseEnded, DayStarted, Snarl, Siege,
  Cracking, Breach, EnemyState, Winded. Append new kinds before `Count`.
- `EventSource` names who caused an event (Player, Bandit, Scavenger, Apostle). Siege,
  Cracking and Breach, and the exposure damage after a breach, name the Apostle, so later
  sources such as sabotage can be told apart.
- `EnemyState` fires only when an enemy's AI state actually changes (`Subject` is the enemy
  id, `Value` the new `AiState`).
- `Event` and `EventId` remain as a legacy view of the latest event. Nothing in the Unity
  project reads them any more (`AudioDirector` now subscribes to the bus), so they can be
  removed once nothing outside the project depends on them.

## Movement: posture and speed bands

Added Oct 10, 2026, from the Movement design page (`MOVEMENT.md`). The player has a `Posture` (Stand, Crouch,
Prone) and the stick sets the speed within it.

- Standing: stick travel up to `WalkBandMax` (0.4) walks, up to `RunBandMin` (0.9) jogs, above that runs and drains
  stamina. Crouched and prone speeds are fixed (0.66 and 0.38); there is no crouch run. Speed no longer scales with
  how far the stick is pushed inside a band.
- `Actor.Stance` is now derived each step (Walk, Jog, Crouch, Crawl) and drives speed and visibility; do not set it.
  A standing player who is not moving counts as Walk for visibility (1.4), where before they counted as Jog (2.25).
- `ToggleCrouch` (tap: stand to crouch, crouch to stand, prone to crouch) and `GoProne` (hold). Both announce a
  `Posture` event. A dodge always stands the player up. A prone player cannot attack. Posture cannot change during a
  dodge or while paused.
- Pushing to run while crouched or prone stands the player up and sets `RunBlocked`: they jog until the stick eases
  below the run threshold, then a new push runs. The keyboard run key does the same.
- Tapped-point travel is a jog. The input layer scales keyboard movement to `JogTilt` (the middle of the jog band)
  and to full tilt with the run key; `ProneHoldSeconds` (0.5) is the crouch button's hold time.
- Unity: `CrouchButton` (tap and hold, cancelled by sliding off), `StickGuide` (rings on the stick at the band edges;
  the stick output is now linear so the rings are accurate) and `VisibilityRing` (a ground ring at the distance
  enemies can notice a crouched or prone player).

## Draw order

Added Oct 10, 2026. `Core/Depth.cs` decides the isometric sort value for moving actors so they are not drawn behind a building they are standing beside. A building is one sprite sorted at its front corner; `Depth.ActorOrder` raises an actor above every building it is east or south of and lowers it below every building it is north or west of (diagonal positions are unconstrained). `WorldView` uses it for the player and enemies, and `Depth.BuildingOrder` for buildings. Props and loot still use the plain `x + y` depth.

## Game data

Added Oct 10, 2026. Every number a designer tunes lives in `GameData` (`Core/Data.cs`), not in
`Simulation`. `Simulation.Create(seed, quick, data)` takes the data (default
`GameData.CreateDefault()`), refuses it with an `ArgumentException` if `Validate()` reports a
problem, calls `Prepare()` and stores it in `GameState.Data`. The simulation reads only from there.
A state built without data falls back to the shipped defaults.

- `Items` (name, use, weapon granted, restore amounts, loot priority), `Weapons` (damage, heavy
  multiplier, reach, lunge, range, aim angle, cooldowns, stamina and ammo costs, noise),
  `Player` (maximums, stance speeds and visibility, running, dodge, hurt invulnerability, dawn
  healing), `Enemies` (health, speeds, detection, attack ranges, damage, windup, cooldown, flee
  threshold, drops, defeat text), `Safehouse` (base integrity, per tool, max tools, warning
  share), `Clock` (day and Eclipse seconds, normal and quick) and `Eclipses`.
- An `EclipseProfile` holds the warning time, Eclipse length scale, spawns, exposure damage and
  interval, and wall pressure with its growth. The profile in force is the one with the highest
  `FromCycle` not above the current cycle (`EclipseFor`), so later cycles can bring a harsher
  Eclipse without code. List order does not matter.
- Winded swings: a light melee swing with less stamina than its cost still goes out at `WindedDamageScale` (default 0.5) of its damage, drains the remaining stamina, emits `Winded` and sets `Actor.Winded` for 0.5 s so the HUD can flash the stamina bar. Heavy attacks are still refused. Added Oct 10, 2026.
- What stays in code: behavior that depends on a kind (a scavenger steals, a bandit drops loot),
  the aim-feel dials, the attack buffer window, the auto-loot radius and the siege snap time.
- The shipped defaults reproduce the previous behavior exactly; the original 36 tests pass
  unchanged. New tests cover validation, per-cycle profile selection and edits changing behavior.
- Unity: `GameDataAsset` (`Resources/Config/GameData.asset`, created by Eclipse > Set up project
  assets) holds the data for the Inspector. `GameDataAsset.Load()` returns a validated copy for each
  run, or the defaults with an error in the console if the asset is missing or invalid. The day and
  Eclipse lengths on `SurvivalConfig` were removed; edit `Clock` in the game data instead.
