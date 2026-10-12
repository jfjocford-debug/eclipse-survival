# AI and simulation integration

Public exports follow `CONTRACT.md`:

- `AIController` from `ai/controller.js`: construct with the live World; call `update(state, dt)` with seconds; call `destroy()` on restart/disposal.
- `updateNeeds(state, dt)` from `systems/needs.js`.
- `updateWeather(state, dt)` from `systems/weather.js`.
- `attack(state, world, target?)` and `updateCombat(state, dt)` from `systems/combat.js`. An optional attack target is `{x, y}` in world coordinates. `WEAPONS` is also exported.

All functions leave paused/dead simulation unchanged. Normal integration order is input and player movement, world update, weather, needs, AI, combat. The AI never moves the player. The game owns `state.elapsed`, spawning, inventory use, rest energy/health bonuses, notifications, persistence, and corpse cleanup.

## Worker behavior

The canonical native module-worker entry is `workers/aiWorker.js`; `AIController` loads that entry with `{type:'module'}`. It imports the existing `workers/ai-worker.js` handler, which remains available for compatibility. The worker receives plain actor snapshots every 0.125 seconds and a transferred 65×65 collision grid every 0.5 seconds or after significant player movement. Grid occupancy is sampled at tile centers using `world.isBlocked`. No main-thread A* is imported or executed. Only living zombies within 30 tiles are active. Live corner collision and attack rays are revalidated on the main thread, so old worker results cannot walk or attack through a recently closed door.

The worker uses eight-direction A* with no diagonal corner cutting, a binary priority heap, a 2,400-node search limit, cached paths, and a maximum of seven searches per snapshot. Priority rotates through the crowd. Visual perception includes facing, close-range awareness, occlusion, daylight, and fog. Sound attracts nearby zombies through cover, rain reduces hearing, visible alerted neighbors draw groups into pursuit, and last-known positions expire. Idle actors wander. Local steering separates crowds. Pursuit moves slower than the walking survivor to make positioning and stamina meaningful.

`state.ai` exposes `{worker, active, paths, error?}` for diagnostics. If workers cannot start or stop responding, direct sight-based steering keeps movement playable; obstacle pathfinding and worker perception are unavailable in that fallback. Actors still obey live collision. There is no door-breaking behavior.

The simulation covers local survival encounters. Zombies beyond the active radius remain dormant; there is no town-wide migration, persistent offscreen pursuit, or scent tracking. Hearing currently uses the survivor's position and a scalar noise radius rather than independent world sound sources. Search limits bound the work for crowds, so actors can briefly wait for a route when many need new paths at once.

`workers/simulation.js` exports pure `ZombieSimulation.step(snapshot)` for tests. `workers/pathfinding.js` exports `findPath`, `blocked`, `lineOfSight`, and `clearPassage`. The worker protocol is `{type:'step', seq, dt, grid?, player:{x,y}, zombies, time, noise, weather}` → `{type:'result', seq, actors, paths}`. Grid is `{x,y,width,height,cells:Uint8Array}`, with 0 walkable and 1 blocked. Returned actors have `{id,mode,vx,vy,dirX,dirY,canAttack}`.

## Simulation ownership and feedback

- Needs owns hunger, thirst, energy depletion, stamina drain/recovery, bleeding and infection damage, and death from those causes. Set `player.moving`, `player.running`, and `player.resting`. Rest stamina recovers faster; rest energy and health bonuses remain in `game.js`.
- Weather advances five game minutes per second, handles midnight/multiple-day rollover, and stores deterministic six-hour weather periods in `weather.period`. Intensity and temperature ease smoothly. `weather.daylight` and `weather.wind` are available for rendering.
- Combat owns attack/hurt cooldowns, enemy strikes, particle physics/lifetimes, and noise decay. Noise is an approximate audible radius in tiles: bat 6, axe 7, pistol 32. Movement and interactions can raise `state.noise` with `Math.max`.
- Bats and axes sweep a forward cone and can hit two targets, with reduced secondary damage. Pistols consume ammunition, hit the nearest aimed target, and obey walls/range. All attacks cost stamina and obey cooldowns. Damage, knockback, skill gains, kill counts, bleeding, infection chances, death, and short invulnerability are resolved here.
- Player visual fields: `attackTimer`, `attackDuration`, `attackWeapon`, `hurtTimer`. Zombie fields: `hitTimer`, `attackTimer`, `knockbackX`, `knockbackY`, `deathTimer`, `deathDirection`. Dead zombies retain `health:0` for the game's ECS cleanup.
- `state.lastAttack` is `{x,y,dirX,dirY,weapon,range,ttl,duration}`. Particles are `{type,x,y,z,vx,vy,vz,life,maxLife,size,color}`. Seconds are used for all timers. The transient particle count is capped at 220.
- Needs/combat set `state.dead=true` on lethal damage. The game should detect the transition with its own flag if it needs a death notification or immediate save.

## Validation

Run `node --test ai/simulation.test.mjs tests/ai.test.mjs tests/systems.test.mjs` from the project root. The owned suite exercises combat, needs, clock/weather, full pursuit around an obstacle, shared group awareness, fallback collision, and stale-worker collision. QA's suite covers A* legality, supercover corner blocking, hearing, and a real Node worker bridge executing the browser worker protocol.

An integration probe using the generated world confirmed that the closed safehouse east door blocks sight and routing; opening its live prop enables both sight and the six-tile route to the spawn room. Browser validation is coordinated separately; the Node worker check is not a browser test.
