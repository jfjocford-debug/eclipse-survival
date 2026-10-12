import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../engine/loop.js';
import { Input } from '../engine/input.js';
import { ECS } from '../ecs/world.js';

function animation(t) {
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, document: globalThis.document };
  const requests = new Map(); let id = 0;
  const doc = new EventTarget(); doc.hidden = false;
  globalThis.document = doc;
  globalThis.requestAnimationFrame = callback => { requests.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = id => requests.delete(id);
  t.after(() => Object.assign(globalThis, previous));
  return { requests, doc, tick(time) { const entry = requests.entries().next().value; assert.ok(entry); requests.delete(entry[0]); entry[1](time); } };
}

test('two seconds of movement is identical at 30, 60 and 144Hz', t => {
  const frames = animation(t);
  for (const hz of [30, 60, 144]) {
    let x = 0, count = 0;
    const engine = new Engine({ update: dt => { x += dt * 2; count++; }, render: () => {} });
    engine.start();
    for (let i = 0; i <= hz * 2; i++) frames.tick(i * 1000 / hz);
    assert.equal(count, 120);
    assert.ok(Math.abs(x - 4) < 1e-9);
    engine.destroy();
    assert.equal(frames.requests.size, 0);
  }
});

test('hidden tabs skip simulation and resume without offline drain', t => {
  const frames = animation(t); let updates = 0;
  const engine = new Engine({ update: () => updates++, render: () => {} });
  engine.start(); frames.tick(0); frames.tick(1000 / 60);
  assert.equal(updates, 1);
  frames.doc.hidden = true; frames.doc.dispatchEvent(new Event('visibilitychange'));
  frames.tick(15000);
  assert.equal(updates, 1);
  frames.doc.hidden = false; frames.doc.dispatchEvent(new Event('visibilitychange'));
  frames.tick(30000); assert.equal(updates, 1);
  frames.tick(30000 + 1000 / 60); assert.equal(updates, 2);
  engine.destroy();
});

test('stop from a callback and error callbacks leave no scheduled work', t => {
  const frames = animation(t); let renders = 0;
  const engine = new Engine({ update: () => engine.stop(), render: () => renders++ });
  engine.start(); frames.tick(0); frames.tick(1000);
  assert.equal(renders, 1); assert.equal(frames.requests.size, 0);
  engine.destroy();
  let failure;
  const failing = new Engine({ update: () => { throw new Error('expected'); }, render: () => {}, onError: error => { failure = error; } });
  failing.start(); frames.tick(0); frames.tick(17);
  assert.equal(failure.message, 'expected'); assert.equal(failing.running, false);
  assert.equal(frames.requests.size, 0); failing.destroy();
});

function fakeDOM() {
  const win = new EventTarget(), doc = new EventTarget(), canvas = new EventTarget();
  doc.defaultView = win; canvas.ownerDocument = doc;
  canvas.style = { touchAction: 'pan-x' };
  const attributes = new Map([['tabindex', '3']]);
  canvas.getAttribute = key => attributes.get(key) ?? null;
  canvas.setAttribute = (key, value) => attributes.set(key, value);
  canvas.removeAttribute = key => attributes.delete(key);
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
  canvas.focus = () => {};
  const emit = (target, type, props = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event); return event;
  };
  return { win, doc, canvas, emit };
}

test('Z sneak remains available while browser modifier shortcuts are ignored', () => {
  const { win, canvas, emit } = fakeDOM(); const input = new Input(canvas);
  emit(win, 'keydown', { key: 'z', code: 'KeyZ' });
  emit(win, 'keydown', { key: 'w', code: 'KeyW' });
  assert.equal(input.keys.has('z'), true);
  assert.deepEqual(input.movement(), { x: 0, y: -1 });
  emit(win, 'keydown', { key: 'r', code: 'KeyR', ctrlKey: true });
  emit(win, 'keydown', { key: 'i', code: 'KeyI', altKey: true });
  assert.equal(input.consume('r'), false);
  assert.equal(input.consume('i'), false);
  emit(win, 'keyup', { key: 'w', code: 'KeyW' });
  emit(win, 'keyup', { key: 'z', code: 'KeyZ' });
  assert.equal(input.keys.size, 0); input.destroy();
});

test('holding a shortcut cannot repeat its edge and editing focus releases held controls', () => {
  const { win, doc, canvas, emit } = fakeDOM(); const input = new Input(canvas);
  emit(win, 'keydown', { key: 'i', code: 'KeyI' });
  assert.equal(input.consume('i'), true);
  emit(win, 'keydown', { key: 'i', code: 'KeyI', repeat: true });
  assert.equal(input.consume('i'), false);
  emit(doc, 'focusin', { target: { isContentEditable: true } });
  assert.equal(input.keys.size, 0);
  emit(win, 'keydown', { key: 'w', target: { isContentEditable: true } });
  assert.deepEqual(input.movement(), { x: 0, y: 0 }); input.destroy();
});

test('cancelled pointers stop attacks; wheel and context menu handling stay on canvas', () => {
  const { win, canvas, emit } = fakeDOM(); const input = new Input(canvas);
  emit(canvas, 'pointerdown', { pointerId: 2, button: 0, buttons: 1, clientX: 110, clientY: 220 });
  assert.equal(input.consume('mouse0'), true); assert.equal(input.pointer.down, true);
  emit(win, 'pointercancel', { pointerId: 2 }); assert.equal(input.pointer.down, false);
  assert.equal(emit(canvas, 'wheel', { deltaY: 50 }).defaultPrevented, true);
  assert.equal(input.consumeWheel(), 1); assert.equal(input.consumeWheel(), 0);
  assert.equal(emit(canvas, 'contextmenu').defaultPrevented, true);
  input.destroy();
  assert.equal(canvas.style.touchAction, 'pan-x'); assert.equal(canvas.getAttribute('tabindex'), '3');
  emit(win, 'keydown', { key: 'w' }); assert.equal(input.keys.size, 0);
  assert.equal(emit(canvas, 'contextmenu').defaultPrevented, false);
});

test('ECS keeps actor references, intersects sparse components, and removes all traces', () => {
  const world = new ECS(); const player = { x: 7.5, y: 7.5, health: 100 };
  const survivor = world.create({ survivor: player, position: player });
  const zombie = world.add('z1', { zombie: { health: 80 }, position: { x: 8, y: 8 } });
  world.add('only-health', 'health', undefined);
  assert.equal(world.has('only-health', 'health'), true);
  assert.deepEqual([...world.query('zombie', 'position')].map(row => row[0]), [zombie]);
  player.x += 1; assert.equal(world.get(survivor, 'position').x, 8.5);
  world.get(zombie, 'zombie').health = 0;
  for (const [id, actor] of world.query('zombie')) if (actor.health <= 0) world.remove(id);
  assert.equal(world.has(zombie), false); assert.equal(world.get(zombie, 'position'), undefined);
  assert.equal([...world.query('zombie')].length, 0);
  assert.equal(world.size, 2);
  world.clear(); assert.equal(world.size, 0); assert.equal(world.components.size, 0);
  assert.notEqual(world.create(), survivor);
});
