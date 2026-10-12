import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../game.js';
import { World } from '../world/generator.js';
import { AIController } from '../ai/controller.js';
import { serialize, loadGame } from '../save/indexedDB.js';

function gameFixture() {
  const game = new Game();
  game.state.settings.sound = false;
  game.world = new World(game.state.seed); game.world.update(7.5, 7.5);
  game.initEntities();
  game.ai = new AIController(game.world);
  game.input = { keys: new Set(), pointer: { down: false }, consume: () => false, consumeWheel: () => 0, movement: () => ({ x: 0, y: 0 }), clear() {} };
  game.ui = { update() {}, notify() {}, toggle() {} };
  game.save = async () => { game.saved = JSON.parse(JSON.stringify(game.state)); };
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) game.spawned.add(`${x},${y}`);
  return game;
}

test('game interaction loots starter container once and crafting consumes the required materials', async () => {
  const game = gameFixture(); const prop = game.findLoot(); assert.ok(prop);
  const contents = structuredClone(prop.loot), before = Object.fromEntries(contents.map(i => [i.id, game.count(i.id)]));
  await game.action('interact');
  for (const item of contents) assert.equal(game.count(item.id), before[item.id] + item.qty);
  assert.equal(prop.looted, true); assert.equal(game.state.objectives.looted, 1);
  await game.action('loot'); assert.equal(game.state.objectives.looted, 1);
  game.addItem('cloth', 2);
  const cloth = game.count('cloth'), bandages = game.count('bandage');
  await game.action('craft', 'bandage');
  assert.equal(game.count('cloth'), cloth - 2); assert.equal(game.count('bandage'), bandages + 1);
  assert.equal(game.state.objectives.crafted, 1);
  game.ai.destroy();
});

test('real game movement stops at a closed exit and passes after opening it', async () => {
  const game = gameFixture(); game.state.player.x = 11.5;
  game.input.movement = () => ({ x: Math.SQRT1_2, y: Math.SQRT1_2 });
  for (let i = 0; i < 90; i++) game.update(1 / 60);
  assert.ok(game.state.player.x < 11.8, `closed-door position ${game.state.player.x}`);
  assert.equal(game.canMove(game.state.player.x, game.state.player.y), true);
  await game.action('interact');
  assert.equal(game.world.isBlocked(12.5, 7.5), false);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.ok(game.state.player.x > 12.8, `opened-door position ${game.state.player.x}`);
  assert.ok(game.state.stats.distance > 1);
  game.ai.destroy();
});

test('barricade consumes materials and stays collidable after snapshot restore', async () => {
  const game = gameFixture(); game.state.player.x = 11.4;
  const planks = game.count('plank'), nails = game.count('nails');
  await game.action('barricade');
  const opening = game.nearestOpening(); assert.equal(opening.barricaded, 1);
  assert.equal(game.count('plank'), planks - 1); assert.equal(game.count('nails'), nails - 4);
  assert.equal(game.state.objectives.barricaded, 1);
  const fresh = new World(game.state.seed, game.world.serialize());
  assert.equal(fresh.isBlocked(12.5, 7.5), true);
  await game.action('barricade'); assert.equal(opening.barricaded, 0); assert.equal(game.count('plank'), planks);
  game.ai.destroy();
});

test('paused game cannot move or deplete needs; fatal needs are saved once', () => {
  const game = gameFixture(); game.state.paused = true;
  game.input.movement = () => ({ x: 1, y: 0 });
  const before = structuredClone(game.state);
  game.update(1 / 60); assert.deepEqual(game.state, before);
  game.state.paused = false; game.input.movement = () => ({ x: 0, y: 0 });
  game.state.player.health = .001; game.state.player.bleeding = 100;
  let saves = 0; game.save = async () => { saves++; };
  game.update(1 / 60); assert.equal(game.state.dead, true); assert.equal(saves, 1);
  game.update(1 / 60); assert.equal(saves, 1);
  game.ai.destroy();
});

test('building and dismantling update resources, collision and the persistent world', async () => {
  const game = gameFixture(), planks = game.count('plank'), nails = game.count('nails');
  await game.action('build');
  const barrier = game.world.getNearby(7.5, 7.5, 2).find(p => p.built);
  assert.ok(barrier); assert.equal(game.world.isBlocked(8.5, 7.5), true);
  assert.equal(game.count('plank'), planks - 2); assert.equal(game.count('nails'), nails - 4);
  let restored = new World(game.state.seed, game.world.serialize());
  assert.equal(restored.isBlocked(8.5, 7.5), true);
  for (let i = 0; i < 4; i++) { game.state.player.attackCooldown = 0; await game.action('dismantle'); }
  assert.equal(game.world.isBlocked(8.5, 7.5), false);
  assert.equal(game.count('plank'), planks - 1);
  restored = new World(game.state.seed, game.world.serialize());
  assert.equal(restored.isBlocked(8.5, 7.5), false);
  game.ai.destroy();
});

test('import cannot be overwritten by the old survivor during pagehide autosave', async () => {
  const game = gameFixture(), storage = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  let pagehideSave;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
  } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { reload: () => { pagehideSave = game.save(); } } });
  try {
    const imported = JSON.stringify(serialize(game.state));
    game.state.player.health = 17; game.state.player.inventory = [];
    game.save = Game.prototype.save.bind(game);
    await game.action('import', { size: imported.length, text: async () => imported });
    await pagehideSave;
    assert.equal((await loadGame()).player.health, 100);
    assert.ok((await loadGame()).player.inventory.length > 0);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage;
    if (oldLocation) Object.defineProperty(globalThis, 'location', oldLocation); else delete globalThis.location;
    game.ai.destroy();
  }
});
