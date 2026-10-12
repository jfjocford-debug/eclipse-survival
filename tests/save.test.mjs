import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from '../save/serializer.js';
import { deserialize } from '../save/deserializer.js';
import { saveGame, loadGame, clearSave, importSave, getSaveStatus, LOCAL_STORAGE_KEY } from '../save/indexedDB.js';
import { makeState, makeZombie } from './fixtures.mjs';

test('save round-trip retains persistent world, actors, skills and objectives without aliases', () => {
  const state = makeState({ zombies: [makeZombie()], worldChanges: { 'door:12,7': { open: true, barricaded: 0 }, 'crate:6,7': { loot: [], looted: true } }, spawnedChunks: ['0,0', '1,0'] });
  state.player.skills.crafting = 23;
  state.objectives.looted = 3;
  state.particles = [{ x: 1, life: .2 }]; state.messages = [{ text: 'temporary', at: 1 }];
  state.render = { fps: 60 }; state.nearby = { id: 'door:12,7' }; state.paused = true;
  const before = JSON.stringify(state), envelope = serialize(state), loaded = deserialize(JSON.stringify(envelope));
  assert.equal(JSON.stringify(state), before, 'serialization must not mutate live state');
  assert.deepEqual(loaded.player, state.player);
  assert.deepEqual(loaded.zombies, state.zombies);
  assert.deepEqual(loaded.worldChanges, state.worldChanges);
  assert.deepEqual(loaded.spawnedChunks, state.spawnedChunks);
  assert.deepEqual(loaded.objectives, state.objectives);
  for (const key of ['particles', 'messages', 'render', 'nearby', 'paused']) assert.equal(key in envelope.data, false);
  assert.deepEqual(loaded.particles, []); assert.deepEqual(loaded.messages, []); assert.equal(loaded.paused, false);
  loaded.player.inventory[0].qty = 99;
  assert.equal(state.player.inventory[0].qty, 1);
});

test('invalid JSON, future versions, nonfinite health and duplicate actors are rejected', () => {
  assert.throws(() => deserialize('{broken'), /JSON/);
  const future = serialize(makeState()); future.version = 99;
  assert.throws(() => deserialize(future), /version 99/i);
  const malformed = makeState(); malformed.player.health = NaN;
  assert.throws(() => serialize(malformed), /invalid number/i);
  assert.throws(() => serialize(makeState({ zombies: [makeZombie(), makeZombie()] })), /unique/);
  const polluted = JSON.stringify(makeState()).replace('"stats":{', '"stats":{"__proto__":{},');
  assert.throws(() => deserialize(polluted), /unsafe property/i);
});

test('localStorage fallback snapshots eagerly, orders saves, and clears durably', async () => {
  const store = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key),
  } });
  try {
    assert.equal(await loadGame(), null);
    const state = makeState(); state.player.health = 81;
    const pending = saveGame(state); state.player.health = 12; await pending;
    assert.equal((await loadGame()).player.health, 81);
    assert.equal(getSaveStatus().backend, 'localStorage');
    state.player.health = 55; const first = saveGame(state);
    state.player.health = 62; const second = saveGame(state);
    await Promise.all([first, second]); assert.equal((await loadGame()).player.health, 62);
    await clearSave(); assert.equal(await loadGame(), null);
    assert.equal(JSON.parse(store.get(LOCAL_STORAGE_KEY)).deleted, true);
    await Promise.all([clearSave(), saveGame(makeState())]);
    assert.equal((await loadGame()).player.health, 100, 'a later new game supersedes a clear marker');
    store.set(LOCAL_STORAGE_KEY, '{broken');
    await assert.rejects(loadGame(), /JSON/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('storage failures are reported and imported files are validated before use', async () => {
  await assert.rejects(saveGame(makeState()), /storage is unavailable/i);
  assert.ok(getSaveStatus().error);
  const file = { size: 100, text: async () => JSON.stringify(serialize(makeState())) };
  assert.equal((await importSave(file)).player.health, 100);
  await assert.rejects(importSave({ size: 21 * 1024 * 1024, text: async () => '{}' }), /20 MB/);
});
