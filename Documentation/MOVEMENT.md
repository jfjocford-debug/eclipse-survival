# Eclipse Survival — Movement design (draft)

Oct 10, 2026 · Milestone 1 prerequisite · decisions accepted Oct 10 (all four as proposed); core, input and screen work built the same day, see CORE.md Movement.

## What is wrong today

- Stance is one button that cycles through stances. Walk cannot be reached at all, although the help text says "tilt to walk, jog, run".
- Running starts when the stick is pushed past 90%, and only from the standing jog stance. Nothing tells the player where the thresholds are.
- Crouching and crawling cost speed and give no clear benefit, so players do not use them. Switching between stances takes a button press in the middle of a fight, which is the "not fluid" feeling you reported.

## Goal

The movement of Metal Gear Solid and The Last of Us, on a phone: one thumb decides how fast and how quietly you move, and the other thumb fights. Speed should come from how far the stick is pushed, not from menus.

## Proposal

**1. The stick sets speed (analog bands).** Distance from the stick's center, as a share of its full travel:

| Stick travel | Movement | Noise and visibility |
|---|---|---|
| Inside the dead zone | Still | None |
| Dead zone to 40% | Walk (0.95) | Smallest while standing: enemies notice you at 1.4 |
| 40% to 90% | Jog (1.45) | Notice you at 2.25 |
| Past 90% | Run (2.45), drains stamina | Loudest: adds the noise bonus |

A faint ring on the stick marks the 40% and 90% lines so the bands can be felt and learned. Moving between bands is one smooth thumb motion, and the character never needs a button press to change speed.

**2. Crouch is a toggle button.** One tap crouches, one tap stands. The same button, pressed and held for about half a second, goes prone (crawl); a tap then returns to crouch. The stick still sets speed within the stance (crouch walk and crouch jog are the same slow speed; there is no crouch run). Pushing the stick past 90% while crouched stands you up into a jog instead of running at once, so a slip of the thumb never makes noise by accident.

**3. Dodge and attack keep their current gestures.** Dodge always stands the player up. Attacking from a crouch is allowed and, in Milestone 2, becomes a quiet stealth attack with bonus damage. Attacking while prone is not allowed, so crawling is for sneaking past and not for fighting.

**4. Make the stealth cost visible.** While crouched or prone, draw a faint ring around the player at the distance enemies can notice them. This is the one piece of feedback that turns stances into a tactical choice instead of a speed penalty.

## What it needs from the game

- The core: `Stance` becomes (Stand, Crouch, Prone) plus a speed band chosen from stick travel; the band thresholds and crouch hold time go into the player data so they can be tuned. Walk, jog and run stay as speeds, not stances.
- Input: the stance button becomes a crouch toggle with a hold gesture; the stick reports its travel.
- Presentation: the stick ring markers, the visibility ring, and (later) the animator layers for walk, jog, run, crouch and prone. The tired and winded animations from the stamina work share these layers.
- Tests: speed bands at each threshold, crouch and prone transitions, the stand-up on pushing past 90% while crouched, no running when crouched, and visibility per stance.

## Not in this page

What stances are worth to the player in numbers (noise radii, stealth bonuses, line-of-sight rules) belongs to Milestone 2. This page only makes the stances reachable and fluid.

## Four decisions needed

1. Analog speed bands on the stick, as proposed, or separate walk and run buttons.
2. Crouch as a toggle with press-and-hold for prone, or hold-to-crouch.
3. Whether the player may attack while prone (proposal: no).
4. Whether to show the visibility ring (proposal: yes).
