# Phone test sheet — Milestone 0

Goal: play one full cycle on a real phone (day, Eclipse, dawn, next day) and report what fails. Nothing in this project has run on a phone yet, so expect surprises; write them down instead of fixing them on the spot.

## Before you play (iPhone, through the Solid link)

The game is built and hosted by Solid's agent, so there is no cable, Mac or Xcode step.

1. Give Solid's agent the latest project zip together with the brief in `SOLID_BRIEF.md`. Ask it to build, host and send back the link, and to report any compile error word for word.
2. Open the link in Safari on the iPhone. Turn on rotation lock off and hold the phone in landscape; Safari cannot force the orientation.
3. If the game is a web build, add it to the Home Screen (Share, then Add to Home Screen) for a fuller screen without the address bar, if the page supports it.
4. Close other apps first. A web build on a phone has less memory than a native app, so a reload or crash during play is a real finding: note when it happened.

Limits of this test: it runs in the browser, so it does not prove the Android or native iOS builds work, and the browser may differ from a native app in frame rate, audio start (the first tap may be needed before sound plays) and multitouch handling. It does answer the question that matters for Milestone 0: does the loop play comfortably with two thumbs on a phone.

## The play-through

Play in landscape with the game's defaults (150 s day, 90 s Eclipse). Mark each line Pass, Fail or Unsure and add a few words.

**Controls (use two fingers at once)**
- [ ] Stick: centered at rest, no drift; full tilt runs
- [ ] Tap attacks once; hold gives a heavy attack; no accidental second swing
- [ ] Swipe dodges in the swipe direction
- [ ] Attack lands without needing to line up with the enemy (the new soft-lock and lunge)
- [ ] Buttons are comfortable to reach with thumbs; none hidden by the notch, the Safari bars or the swipe-up home gesture

**Movement (new)**
- [ ] A small stick push walks, a medium push jogs, pushing to the edge runs; the two faint rings on the stick mark where it changes
- [ ] The speed changes feel smooth, with no jump or stutter at the ring lines
- [ ] Tapping Crouch crouches (button reads "Stand up"); tapping again stands
- [ ] Holding Crouch for half a second goes prone; a tap from prone returns to crouch
- [ ] A ring appears on the ground around you while crouched or prone, and it shrinks as you go lower
- [ ] Pushing the stick to the edge while crouched or prone stands you up and you jog, not sprint; easing off and pushing again then runs
- [ ] Attacking while prone is refused with a message; attacking while crouched works
- [ ] A dodge from crouch or prone stands you up
- [ ] Enemies notice you later when crouched or prone than when jogging

**Survival loop**
- [ ] Enter and leave all five buildings
- [ ] Search containers; tools reinforce the safehouse one at a time
- [ ] The wall meter shows in the safehouse and fills as tools are spent
- [ ] Warning appears before the Eclipse; the Apostle spawns only when the Eclipse starts
- [ ] Inside reinforced walls: no damage, the meter drops, "THE WALLS ARE CRACKING" appears near 25%
- [ ] Surviving to dawn starts the next day (health +20, supplies reshuffled)
- [ ] Dying shows the death screen and a new run starts cleanly

**New this week (look for these specifically)**
- [ ] Swinging with almost no stamina: "Winded. Your swing is weaker." and the stamina bar turns red briefly
- [ ] Walking along every side of a house, especially its east side: the character is never drawn behind the wall
- [ ] The health and stamina bars fill correctly (full at the start)
- [ ] No red errors about game data in the log (see below); the game uses your Game data asset

**Device health**
- [ ] Frame rate feels steady in the street and during the Eclipse fog (note any stutter and where)
- [ ] The phone is not hot after ten minutes
- [ ] Switching to another app and back pauses the game and releases the stick; the page does not reload

## If the data seems ignored

If the game ignores your Game data edits (for example the day length does not change), the asset was probably missing or invalid in the build and the shipped defaults were used. Ask Solid's agent to search the build log for lines starting with "Game data" and send them to you.

## What to send back

The filled-in list above, the iPhone model and iOS version, and the first error line for anything marked Fail. A short screen recording of any control problem helps most.

Done when: one full cycle completes on the phone without a crash, a stuck control, or an unreadable screen.
