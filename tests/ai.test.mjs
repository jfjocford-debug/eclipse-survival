import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { findPath, lineOfSight, blocked } from '../workers/pathfinding.js';
import { ZombieSimulation } from '../workers/simulation.js';
import { makeZombie } from './fixtures.mjs';

function grid(width = 12, height = 12) { return { x: 0, y: 0, width, height, cells: new Uint8Array(width * height) }; }
function snapshot(collision, zombies, extra = {}) {
  return { type: 'step', seq: 1, dt: .125, grid: collision, player: { x: 8.5, y: 5.5 }, zombies, time: 720, weather: { type: 'clear' }, noise: 0, ...extra };
}

test('A* navigates the only wall opening with legal steps and a reachable goal', () => {
  const g = grid();
  for (let y = 0; y < 12; y++) if (y !== 9) g.cells[y * 12 + 5] = 1;
  const path = findPath(g, 2.5, 5.5, 8.5, 5.5);
  assert.ok(path.length > 6, 'detour should be longer than a straight route');
  assert.deepEqual(path.at(-1), { x: 8.5, y: 5.5 });
  let previous = { x: 2.5, y: 5.5 };
  for (const point of path) {
    assert.equal(blocked(g, point.x, point.y), false);
    assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) <= Math.SQRT2 + 1e-8);
    assert.equal(lineOfSight(g, previous.x, previous.y, point.x, point.y), true);
    previous = point;
  }
  assert.ok(path.some(p => p.x === 5.5 && p.y === 9.5));
});

test('blocked corners prevent pathfinding and sight from cutting diagonally', () => {
  const g = grid(2, 2); g.cells[1] = 1; g.cells[2] = 1;
  assert.deepEqual(findPath(g, .5, .5, 1.5, 1.5), []);
  assert.equal(lineOfSight(g, .5, .5, 1.5, 1.5), false);
  assert.deepEqual(findPath(g, -.5, .5, 1.5, 1.5), []);
});

test('visible survivors trigger pursuit; a solid wall prevents sight and attacks', () => {
  const g = grid();
  const zombie = makeZombie({ x: 3.5, y: 5.5, dirX: 1, dirY: 0 });
  const open = new ZombieSimulation().step(snapshot(g, [zombie])).actors[0];
  assert.equal(open.mode, 'chase'); assert.ok(open.vx > 0); assert.equal(open.canAttack, false);
  for (let y = 0; y < 12; y++) g.cells[y * 12 + 5] = 1;
  const hidden = new ZombieSimulation().step(snapshot(g, [zombie])).actors[0];
  assert.notEqual(hidden.mode, 'chase'); assert.equal(hidden.canAttack, false);
});

test('noise creates an investigation target behind cover and repaths stay bounded', () => {
  const g = grid();
  for (let y = 1; y < 10; y++) g.cells[y * 12 + 5] = 1;
  const zombies = Array.from({ length: 30 }, (_, i) => makeZombie({ id: i + 10, x: 2.5 + (i % 3) * .3, y: 3.5 + Math.floor(i / 3) * .4 }));
  const result = new ZombieSimulation().step(snapshot(g, zombies, { noise: 20 }));
  assert.ok(result.paths > 0 && result.paths <= 7);
  assert.ok(result.actors.some(z => Math.hypot(z.vx, z.vy) > 0));
  assert.ok(result.actors.every(z => !z.canAttack));
});

test('a real worker returns sequenced actor decisions and ignores unrelated messages', { timeout: 5000 }, async () => {
  const worker = new Worker(new URL('./worker-bridge.mjs', import.meta.url));
  try {
    const [ready] = await once(worker, 'message'); assert.equal(ready.type, 'ready');
    const reply = once(worker, 'message');
    worker.postMessage({ type: 'ignored' });
    worker.postMessage(snapshot(grid(), [makeZombie({ x: 7.8, y: 5.5 })], { seq: 42 }));
    const [result] = await reply;
    assert.equal(result.type, 'result'); assert.equal(result.seq, 42);
    assert.equal(result.actors[0].mode, 'attack');
    assert.equal(result.actors[0].canAttack, true);
  } finally { await worker.terminate(); }
});
