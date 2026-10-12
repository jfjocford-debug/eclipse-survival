import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../engine/loop.js';
import { Input } from '../engine/input.js';

test('fixed simulation step caps catch-up after a long frame and renders a valid alpha', () => {
  const requests = new Map(); let requestId = 0;
  const oldRAF = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = cb => { requests.set(++requestId, cb); return requestId; };
  globalThis.cancelAnimationFrame = id => requests.delete(id);
  const updates = [], renders = [];
  const engine = new Engine({ update: dt => updates.push(dt), render: alpha => renders.push(alpha) });
  const tick = time => { const [id, cb] = requests.entries().next().value; requests.delete(id); cb(time); };
  try {
    engine.start(); engine.start();
    assert.equal(requests.size, 1, 'repeated start must not create two loops');
    tick(0); tick(1000 / 60); tick(10000);
    assert.equal(updates.length, 6, 'one normal step plus at most five catch-up steps');
    assert.ok(updates.every(dt => dt === 1 / 60));
    assert.ok(renders.every(alpha => alpha >= 0 && alpha <= 1));
    engine.stop(); assert.equal(requests.size, 0);
  } finally { engine.destroy(); globalThis.requestAnimationFrame = oldRAF; globalThis.cancelAnimationFrame = oldCancel; }
});

function fakeDOM() {
  const win = new EventTarget(), doc = new EventTarget(), canvas = new EventTarget();
  doc.defaultView = win; canvas.ownerDocument = doc;
  canvas.style = { touchAction: 'auto' };
  const attributes = new Map();
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

test('input normalizes diagonal speed, preserves tap edges and clears keys after blur', () => {
  const { win, canvas, emit } = fakeDOM(); const input = new Input(canvas);
  try {
    emit(win, 'keydown', { key: 'W', code: 'KeyW' });
    emit(win, 'keydown', { key: 'd', code: 'KeyD' });
    assert.ok(Math.abs(Math.hypot(...Object.values(input.movement())) - 1) < 1e-9);
    emit(win, 'keyup', { key: 'W', code: 'KeyW' });
    assert.equal(input.consume('w'), true);
    assert.equal(input.consume('w'), false);
    emit(win, 'blur'); assert.deepEqual(input.movement(), { x: 0, y: 0 });
  } finally { input.destroy(); }
});

test('typing is ignored and pointer uses CSS coordinates rather than backing pixels', () => {
  const { win, canvas, emit } = fakeDOM(); const input = new Input(canvas);
  try {
    emit(win, 'keydown', { key: 'i', target: { closest: () => ({}) } });
    assert.equal(input.consume('i'), false);
    emit(canvas, 'pointerdown', { pointerId: 1, button: 0, buttons: 1, clientX: 110, clientY: 220 });
    assert.equal(input.pointer.x, 100); assert.equal(input.pointer.y, 200);
    assert.equal(input.pointer.down, true);
    emit(win, 'pointerup', { pointerId: 1, buttons: 0, clientX: 110, clientY: 220 });
    assert.equal(input.pointer.down, false);
  } finally { input.destroy(); }
});
