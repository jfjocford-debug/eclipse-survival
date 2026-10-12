import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './generator.js';

test('built barriers span chunk and town-block seams, survive reload, and clear on destruction', () => {
  const world = new World(74219);
  const barrier = world.placeProp({ x: 31, y: 28, w: 3, h: 1, type: 'fence', health: 100, label: 'Wooden barrier' });
  assert.ok(barrier);
  for (const x of [31, 32, 33]) assert.equal(world.isBlocked(x, 28), true);
  assert.equal(world.getProps(32, 28, 4).filter(prop => prop.id === barrier.id).length, 1);
  assert.equal(world.damageProp(barrier.id, 40).health, 60);
  world.update(-1000, 1000);
  const restored = new World(74219, world.serialize());
  const prop = restored.getProps(32, 28, 4).find(candidate => candidate.id === barrier.id);
  assert.equal(prop.health, 60);
  assert.equal(restored.damageProp(prop.id, 60).destroyed, true);
  const destroyed = new World(74219, restored.serialize());
  for (const x of [31, 32, 33]) assert.equal(destroyed.isBlocked(x, 28), false);
  assert.ok(!destroyed.getProps(32, 28, 4).some(candidate => candidate.id === barrier.id));
  assert.ok(destroyed.placeProp({ x: 31, y: 28, type: 'fence' }), 'destroyed footprint can be rebuilt');
});

test('placement rejects blocked footprints without storing a custom object', () => {
  const world = new World(74219);
  assert.equal(world.placeProp({ x: 12, y: 7, type: 'fence' }), null, 'closed door occupies tile');
  assert.equal(world.placeProp({ x: 11, y: 7, w: 2, type: 'fence' }), null, 'the entire footprint is checked');
  assert.equal(world.placeProp({ x: NaN, y: 7, type: 'fence' }), null);
  assert.equal(world.placeProp({ x: 11, y: 7, type: 'unknown' }), null);
  assert.deepEqual(world.serialize(), {});
});

test('destroyed generated walls persist and create a traversable opening', () => {
  const world = new World(74219);
  assert.equal(world.isBlocked(12, 6), true);
  assert.equal(world.damageProp('wall:12:6', 40).destroyed, false);
  assert.equal(world.isBlocked(12, 6), true);
  assert.equal(world.destroyProp('wall:12:6').destroyed, true);
  assert.equal(world.isBlocked(12, 6), false);
  world.update(2000, 2000);
  world.update(7.5, 7.5);
  assert.equal(world.isBlocked(12, 6), false);
  const restored = new World(74219, world.serialize());
  assert.equal(restored.isBlocked(12, 6), false);
});

test('all landmark entrances connect to the street and their loot is accessible', () => {
  const world = new World(74219);
  const buildings = world.getBuildings(7, 7, 52);
  assert.ok(buildings.length >= 9);
  for (const building of buildings) {
    const props = world.getProps(building.x + building.w / 2, building.y + building.h / 2, 10)
      .filter(prop => prop.buildingId === building.id);
    for (const prop of props) if (prop.type === 'door') prop.open = true;
    const door = props.find(prop => prop.type === 'door' && prop.side === 'east');
    assert.ok(door, building.name);
    for (let x = door.x; x <= Math.floor(door.x / 32) * 32 + 21; x++) {
      assert.equal(world.isBlocked(x, door.y), false, `${building.name} approach at ${x},${door.y}`);
    }
    const queue = [[door.x, door.y]];
    const reached = new Set([`${door.x},${door.y}`]);
    for (let index = 0; index < queue.length; index++) {
      const [x, y] = queue[index];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (nx < building.x || ny < building.y || nx >= building.x + building.w || ny >= building.y + building.h || reached.has(key) || world.isBlocked(nx, ny)) continue;
        reached.add(key); queue.push([nx, ny]);
      }
    }
    for (const prop of props.filter(candidate => candidate.loot?.length)) {
      let accessible = false;
      for (let y = prop.y - 1; y <= prop.y + (prop.h || 1); y++) {
        for (let x = prop.x - 1; x <= prop.x + (prop.w || 1); x++) if (reached.has(`${x},${y}`)) accessible = true;
      }
      assert.ok(accessible, `${building.name}: ${prop.label} is trapped`);
    }
  }
});

test('applyChanges preserves references and changes made to nested loot arrays', () => {
  const world = new World(74219);
  const door = world.getProps(12, 7, 0).find(prop => prop.type === 'door');
  world.applyChanges({ [door.id]: { open: true, barricaded: 0 } });
  assert.equal(door.open, true);
  assert.equal(world.isBlocked(12, 7), false);
  world.applyChanges({ [door.id]: { barricaded: 1 } });
  assert.equal(door.open, true, 'later field patches preserve earlier changes');
  assert.equal(world.isBlocked(12, 7), true);
  world.update(1000, 1000);
  world.applyChanges({ [door.id]: { barricaded: 0 } });
  assert.equal(world.isBlocked(12, 7), false, 'unloaded patches preserve saved state');
  const crate = world.getNearby(7.5, 7.5).find(prop => prop.type === 'crate');
  crate.loot[0].qty = 1;
  delete crate.label;
  const snapshot = world.serialize();
  const fresh = new World(74219, snapshot);
  snapshot[crate.id].loot[0].qty = 99;
  const restored = fresh.getNearby(7.5, 7.5).find(prop => prop.id === crate.id);
  assert.equal(restored.loot[0].qty, 1);
  assert.equal(restored.label, undefined);
});

test('unmodified exploration stores no changes and evicts distant query chunks', () => {
  const world = new World(74219);
  for (let index = 0; index < 15; index++) world.update(index * 97, index * -79);
  world.update(7.5, 7.5);
  world.getTile(-3000.2, 5000.5);
  world.update(7.5, 7.5);
  assert.ok(world.chunks.size <= 49);
  for (const chunk of world.chunks.values()) assert.ok(Math.abs(chunk.cx) <= 3 && Math.abs(chunk.cy) <= 3);
  assert.deepEqual(world.serialize(), {});
});
