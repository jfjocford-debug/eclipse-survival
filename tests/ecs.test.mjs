import test from 'node:test';
import assert from 'node:assert/strict';
import { ECS } from '../ecs/world.js';

test('ECS joins requested components, preserves falsy values, and removes entities', () => {
  const ecs = new ECS();
  const player = ecs.create({ position: { x: 1, y: 2 }, health: 0 });
  const prop = ecs.create({ position: { x: 3, y: 4 } });
  assert.deepEqual([...ecs.query('health', 'position')], [[player, 0, { x: 1, y: 2 }]]);
  ecs.add(prop, 'health', 10); assert.equal([...ecs.query('health', 'position')].length, 2);
  ecs.remove(player); assert.equal(ecs.get(player, 'position'), undefined);
  ecs.remove(prop, 'health'); assert.deepEqual([...ecs.query('health')], []);
  assert.equal(ecs.has(prop), true);
});
