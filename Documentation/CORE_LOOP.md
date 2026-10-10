# Eclipse Survival — Core loop (decided)

Oct 10, 2026 · replaces the safehouse-only loop from the Wall Integrity design · five decisions settled Oct 10 · nothing here is built yet

## The loop in one line

By day you build your settlement and your community. By night you choose between sheltering, defending or going out. The story decides when the choice is taken from you.

## Day: two jobs, one clock

- **Scavenge.** Search buildings for tools, food, medicine and ammunition. Spend tools on the walls and, later, on base upgrades.
- **Explore and recruit.** Find survivors, win them over, and bring them home. Each member gives the settlement something (a defender on the walls, a producer, a skill) and costs something (food every cycle, and the risk that they are not who they seem).

The day is one shared clock. Time spent walking a recruit home is time not spent searching. If either job were free, one of them would always win; the clock is what makes the player choose.

## Night: three choices and a fourth that is forced

| Choice | What you do | What you risk | What you gain |
|---|---|---|---|
| **Shelter** | Stay inside and let the walls hold | Nothing, if the walls are strong | Safe, calm, the next dawn |
| **Defend** | If the walls fail, fight at the breach beside your members | Health, members, supplies | Keeping the settlement |
| **Explore** | Go out into the dark | The Apostles hunt you, and the base is under pressure while you are away | Larger loot, and items that do not appear by day |
| **Story** | Later arcs require a night outing | Whatever the arc demands | Story progress; some nights are not optional |

Shelter and defend are the same night: you shelter until the walls fail, then you defend. Exploring is the real fork, so it has to be tempting and costly at the same time.

## Rules this needs

1. **The base is under pressure whether or not you are in it.** Today the walls only wear down while you are inside, so staying outside is free. Under this loop the Apostle works on the walls every Eclipse, and the player's presence changes who defends them.
2. **Members hold the walls while you are away.** Each member assigned to the walls slows the wear. This is what ties recruiting by day to exploring by night: a community lets you leave; a lone survivor cannot.
3. **Night loot is better by a clear margin, not an enormous one.** Proposal: night expeditions yield about 1.75 times the loot and contain items that only appear at night. Enough to be tempting, not enough to make sheltering pointless.
4. **A breach with you outside is a loss of supplies and members, not an instant end.** Coming home to a breached base should hurt and be recoverable. Death should come from the player's own mistakes in the dark.
5. **Exploring at night is optional until the story says otherwise.** Story nights are announced a day ahead so the player can prepare. The very first night outing is the exception: it is taught (decision 5).

## Decisions (Oct 10)

1. **The base takes damage while you are away, reduced by assigned members.** Decided: yes.
2. **Members can die or leave.** Decided: yes. Recruiting has stakes, and the later betrayal has weight.
3. **Scavenging and recruiting share one clock.** Decided: yes.
4. **Danger growth.** Decided: the Apostle's wall pressure keeps rising by cycle, and a second Apostle joins on a later cycle.
5. **The first night expedition is taught, not discovered.** Decided: a guided tutorial that explains how everything works (the clock, the walls, members, the night choice). This replaces my recommendation of an optional, discovered first outing.

Consequence of decision 5: the tutorial must teach rules that exist. It cannot be written before the day clock, the wall pressure while away, and at least one member exist. It belongs at the end of the small slice, not the start.

## Where it fits in the 40-week plan

- **Milestone 1** (now): feel on the phone, the movement rework, assists. The shelter branch already exists. Nothing in this loop needs to be built yet.
- **Tutorial (taught first expedition):** built after the small slice works, in Milestone 2 alongside night loot, since it teaches night rules. A minimal onboarding for movement may come earlier in Milestone 1.
- **Milestone 2:** night loot and night-only items, the stealth rules that make exploring in the dark playable, and crafting.
- **Milestone 3:** recruiting and members, with a hidden-allegiance field from the start (the betrayal in Milestone 6 depends on it).
- **Milestone 4 and 5:** assigning members to walls, upkeep, base upgrades, and the defend branch (the breach state already exists in the core).
- **Milestone 6:** story nights, and the cultist member who sabotages the walls.

## Risks to watch

- **Scope.** This loop touches five milestones. The cheapest test of it is a small slice: one recruit, one night expedition, wall pressure that continues while you are outside. The taught first expedition is added once the slice is fun, so the tutorial is not written around rules that then change. If that slice is not fun, find out before building the rest.
- **A dominant strategy.** If night loot is too good, nobody shelters; if it is too poor, nobody explores. The numbers live in the game data, so they can be tuned without code.
- **The map.** One 10 by 10 street is too small for recruiting and for a night expedition worth the risk. Expect a larger or multi-area map before Milestone 3.
