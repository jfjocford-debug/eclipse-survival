# Deadfall engine and actor storage

The browser loads `main.js`, waits for the document, dynamically imports `Game`,
awaits `game.init()`, exposes `window.game`, and calls `game.start()`. Loading and
runtime failures show a readable recovery panel. Dynamic import allows missing
or invalid game modules to reach that panel too. Native ES modules are served
as static files; there are no runtime package dependencies.

## Simulation loop

```js
import { Engine } from './engine/loop.js';
const engine = new Engine({
  update: dt => game.update(dt),
  render: alpha => game.render(alpha),
});
engine.start();
```

`update` receives seconds at a fixed 1/60 step. `render` receives interpolation
alpha in `[0, 1]` once per animation frame. At most five updates run per frame;
excess elapsed time is discarded and counted in `engine.droppedTime`. This
keeps a slow or suspended browser from running an unbounded simulation backlog.
Hidden documents do not update or render; visibility changes reset elapsed time.

`start()` and `stop()` are idempotent. `resetClock()` discards the accumulator;
`destroy()` also removes the visibility listener and prevents future restarts.
Public diagnostics are `running`, `fps` (smoothed), `frame`, and `droppedTime`.
Constructor options `step`, `maxSteps`, and `onError(error)` are optional.
Callback failures stop the loop; without `onError`, they propagate to the
browser error handler. Game pause and death rules remain in `Game` so menus
can continue rendering while simulation actions are paused.

## Input

`new Input(canvas)` exposes lowercase held keyboard `keys`, `movement()` and
`consume(key)`. Movement is normalized in screen directions: up is `(0, -1)`;
`Game` converts to world directions before collision checks. Space is `' '`.
A press edge survives key release until consumed. Repeated keydown events do
not retrigger a consumed edge. Call `clear()` when dismissing a modal or
restarting so gameplay commands pressed during a pause do not execute later.

Typing, text composition, and Ctrl/Meta/Alt shortcuts are ignored. The game uses
Z for sneak, keeping browser shortcuts available. Blur, hidden-tab transitions,
and entering an editable field clear held controls and queued press edges.

`pointer.x/y` are CSS pixels relative to the canvas bounding rectangle, independent
of the canvas backing resolution. `pointer.down` means primary-button held;
`buttons`, `button`, and `inside` supply additional state. Pointer capture keeps
releases reliable outside the canvas. Cancellation and lost capture stop held
attacks. `consume('mouse0')` reads a primary-click edge; other buttons follow
`mouse1`, `mouse2`, etc. `consumeWheel()` returns signed wheel steps (positive
means zoom out). Only the canvas intercepts wheel scrolling and context menus.

`destroy()` removes every listener and restores the canvas's previous tab index
and touch action. Input never owns gameplay actions or camera projection.

## Entity/component storage

```js
import { ECS } from './ecs/world.js';
const actors = new ECS();
const id = actors.create({ survivor: state.player, position: state.player });
actors.add(id, 'tag', 'player');
for (const [id, survivor, position] of actors.query('survivor', 'position')) {
  // Component values are the same objects supplied by Game.
}
```

`create(components)` allocates an ID. `add(id, name, value)` sets a component;
`add(id, components)` adds a batch, and `add(components)` allocates an entity.
`get(id, name)` retrieves a value. `has(id, name?)` tests a component or entity.
`remove(id, name?)` removes a component or the complete entity and returns a
boolean. `clear()` empties the registry without recycling automatically issued
IDs. `size`, `entities` (Set), and `components` (Map of component Maps) are public.

`query(...names)` yields `[id, ...values]` in the requested component order,
using the smallest component store as its candidate set. `query()` visits all
entities; `query(['a', 'b'])` is also supported. Queries are live and deletion of
the current entity is safe. The game owns the plain JSON component values, so
player/zombie mutations are immediately visible to systems and persistence.

## Checks and packaging

Run `node --test tests/*.test.mjs save/*.test.mjs` (or `npm test` when npm is installed). QA owns
the repository tests. `npm run check` checks the engine entry-point syntax.
`node build/optimized/build.mjs` validates the static module graph and prepares
compressed assets; QA owns that packager. `python3 -m http.server 8080` serves a
local development copy. Production deployment belongs to the coordinator.
