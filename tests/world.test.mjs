import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../world/generator.js';

test('world seed is deterministic across positive and negative chunk boundaries', () => {
  const a = new World(74219), b = new World(74219);
  for (const [x, y] of [[7.5, 7.5], [-16.1, -32.7], [511.5, 128.5]]) {
    a.update(x, y); b.update(x, y);
    assert.deepEqual(a.getVisibleTiles(x, y, 4), b.getVisibleTiles(x, y, 4));
    assert.deepEqual(a.getProps(x, y, 10), b.getProps(x, y, 10));
    const tile = a.getTile(x, y);
    assert.equal(tile.x, Math.floor(x)); assert.equal(tile.y, Math.floor(y));
  }
});

test('safehouse has clear spawn, reachable loot and an east exit with live collision', () => {
  const world = new World(74219); world.update(7.5, 7.5);
  assert.equal(world.isBlocked(7.5, 7.5), false);
  assert.ok(world.getTile(7.5, 7.5).room);
  assert.ok(world.getNearby(7.5, 7.5, 2).some(p => p.loot?.length), 'starter supplies are within two tiles');
  const door = world.getProps(12, 7, 1).find(p => p.type === 'door' && p.x === 12 && p.y === 7);
  assert.ok(door, 'east exit at contract position');
  door.open = false; assert.equal(world.isBlocked(12.5, 7.5), true);
  door.open = true; assert.equal(world.isBlocked(12.5, 7.5), false);
  door.barricaded = 1; assert.equal(world.isBlocked(12.5, 7.5), true);
});

test('loot mutations and door state persist through streaming and fresh world restore', () => {
  const world = new World(74219); world.update(7.5, 7.5);
  const prop = world.getNearby(7.5, 7.5, 2).find(p => p.loot?.length);
  const id = prop.id; prop.loot.splice(0); prop.looted = true;
  const door = world.getProps(12, 7, 1).find(p => p.type === 'door' && p.x === 12 && p.y === 7);
  const doorId = door.id; door.open = true;
  world.update(500, -500); world.update(7.5, 7.5);
  const streamed = world.getProps(7.5, 7.5, 20);
  assert.equal(streamed.find(p => p.id === id).looted, true);
  assert.deepEqual(streamed.find(p => p.id === id).loot, []);
  assert.equal(streamed.find(p => p.id === doorId).open, true);
  const snapshot = world.serialize(), fresh = new World(74219, snapshot);
  snapshot[id].looted = false;
  assert.equal(fresh.getProps(7.5, 7.5, 20).find(p => p.id === id).looted, true);
  assert.equal(fresh.isBlocked(12.5, 7.5), false);
});

test('streaming retains a bounded chunk set and props are unique across seams', () => {
  const world = new World(74219);
  for (let step = 0; step < 30; step++) {
    const x = step * 16 - 160, y = step * 8 - 80;
    world.update(x, y); world.getVisibleTiles(x, y, 26);
    world.update(x, y);
    assert.ok(world.chunks.size <= 49, `retained ${world.chunks.size} chunks`);
    const props = world.getProps(x, y, 26);
    assert.equal(new Set(props.map(p => p.id)).size, props.length);
  }
});
