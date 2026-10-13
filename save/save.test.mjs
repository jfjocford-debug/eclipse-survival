import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from './serializer.js';
import { deserialize } from './deserializer.js';
import { MAX_SAVE_BYTES } from './schema.js';

function state() {
  return {
    version: 1, seed: 74219, time: 540, day: 3, elapsed: 63, paused: true, dead: false,
    weather: { type: 'rain', intensity: 0.7, temperature: 12, nextChange: 400 },
    player: { id: 1, x: 7.5, y: 7.5, dirX: 1, dirY: 0, health: 88, hunger: 86,
      thirst: 82, energy: 100, stamina: 62, bleeding: 0, infection: 0,
      inventory: [{ id: 'bat', qty: 1 }, { id: 'water', qty: 2 }], equipped: 'bat',
      skills: { strength: 2, fitness: 0.25, crafting: 3 }, kills: 4 },
    zombies: [{ id: 101, x: 14, y: 8, health: 60, mode: 'chase', dirX: -1,
      dirY: 0, attackCooldown: 0.5, memory: { x: 7.5, y: 7.5 } }],
    particles: [{ x: 1 }], messages: [{ text: 'test', at: 12345 }],
    render: { fps: 60 }, nearby: { type: 'door' }, location: 'Safehouse', saveStatus: 'Saving…',
    worldChanges: { 'door:12:7': { open: false, barricaded: 2 },
      'crate:8:7': { looted: true, loot: [] } },
    objectives: { looted: 2, crafted: 1, barricaded: 2 }, stats: { distance: 54.5 },
    settings: { sound: true }, noise: 4, spawnedChunks: ['0,0', '1,0'],
  };
}

function fakeLocalStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key), clear: () => data.clear() };
}

// This double schedules request and transaction completion separately. Writes
// only become visible on commit, allowing abort and request-success races.
function fakeIndexedDB() {
  const records = new Map();
  const controls = { abortWrites: false, closeCount: 0, commitDelay: 0 };
  const api = {
    records, controls,
    open() {
      const request = {};
      setTimeout(() => {
        const db = {
          objectStoreNames: { contains: () => true },
          close() { controls.closeCount++; },
          transaction(_store, mode) {
            let aborted = false;
            let pending;
            const transaction = {
              error: null,
              abort() {
                if (aborted) return;
                aborted = true;
                transaction.error = new DOMException('Aborted', 'AbortError');
                queueMicrotask(() => transaction.onabort?.());
              },
              objectStore() {
                function operation(key, value) {
                  const operationRequest = {};
                  pending = { key, value };
                  setTimeout(() => {
                    operationRequest.result = mode === 'readonly' ? structuredClone(records.get(key)) : key;
                    operationRequest.onsuccess?.();
                    setTimeout(() => {
                      if (aborted) return;
                      if (mode === 'readwrite' && controls.abortWrites) { transaction.abort(); return; }
                      if (mode === 'readwrite') records.set(pending.key, structuredClone(pending.value));
                      transaction.oncomplete?.();
                    }, controls.commitDelay);
                  }, 0);
                  return operationRequest;
                }
                return { get: key => operation(key), put: (value, key) => operation(key, value) };
              },
            };
            return transaction;
          },
        };
        request.result = db;
        request.onsuccess?.();
      }, 0);
      return request;
    },
  };
  return api;
}

let moduleId = 0;
async function storage(t, indexedDB, localStorage) {
  const priorIDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const priorLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  t.after(() => {
    if (priorIDB) Object.defineProperty(globalThis, 'indexedDB', priorIDB); else delete globalThis.indexedDB;
    if (priorLocal) Object.defineProperty(globalThis, 'localStorage', priorLocal); else delete globalThis.localStorage;
  });
  return import(`./indexedDB.js?test=${++moduleId}`);
}

test('round trip preserves all persistent world, actor and extension fields', () => {
  const original = state();
  const before = structuredClone(original);
  const envelope = serialize(original);
  for (const key of ['particles', 'messages', 'render', 'nearby', 'paused', 'saveStatus', 'location']) assert.equal(key in envelope.data, false);
  const restored = deserialize(JSON.stringify(envelope));
  assert.deepEqual(original, before);
  for (const key of ['worldChanges', 'player', 'zombies', 'weather', 'objectives', 'stats', 'spawnedChunks']) assert.deepEqual(restored[key], original[key]);
  assert.equal(restored.paused, false);
  assert.deepEqual(restored.messages, []);
  assert.deepEqual(restored.particles, []);
  original.player.inventory[0].qty = 99;
  original.worldChanges['door:12:7'].barricaded = 0;
  assert.equal(restored.player.inventory[0].qty, 1);
  assert.equal(envelope.data.worldChanges['door:12:7'].barricaded, 2);
});

test('transient objects may be circular and are never traversed', () => {
  const original = state();
  original.nearby.state = original;
  original.render.canvas = original;
  assert.doesNotThrow(() => serialize(original));
});

test('plain prototype state receives missing optional defaults', () => {
  const restored = deserialize({ seed: 42, time: 60, player: { x: 1, y: 2, health: 100, inventory: [] } });
  assert.equal(restored.version, 2);
  assert.equal(restored.day, 1);
  assert.equal(restored.player.stamina, 100);
  assert.deepEqual(restored.zombies, []);
  assert.equal(restored.paused, false);
});

test('invalid values, unsafe keys, cycles and unsupported versions are rejected', () => {
  for (const mutate of [
    s => { s.player.x = NaN; }, s => { s.player.health = 200; },
    s => { s.player.inventory[0].qty = -1; }, s => { s.time = 'noon'; },
    s => { s.zombies.push({ ...s.zombies[0] }); }, s => { s.worldChanges.self = s.worldChanges; },
    s => { s.worldChanges = JSON.parse('{"__proto__":{"polluted":true}}'); },
    s => { s.worldChanges = new Map(); }, s => { s.weather.intensity = Infinity; },
    s => { s.spawnedChunks = {}; }, s => { s.spawnedChunks = ['invalid-chunk']; },
  ]) {
    const input = state(); mutate(input);
    assert.throws(() => serialize(input), { code: 'INVALID_SAVE' });
  }
  assert.throws(() => deserialize('{bad json'), { code: 'INVALID_JSON' });
  const future = serialize(state()); future.version = 99;
  assert.throws(() => deserialize(future), { code: 'UNSUPPORTED_VERSION' });
  assert.equal({}.polluted, undefined);
});

test('zero health resumes as dead even when a stale death flag is false', () => {
  const input = state(); input.player.health = 0;
  assert.equal(deserialize(serialize(input)).dead, true);
});

test('IndexedDB round trip commits, mirrors and closes connections', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage();
  const api = await storage(t, db, local);
  assert.equal(await api.loadGame(), null);
  await api.saveGame(state());
  assert.ok(db.records.has(api.SAVE_KEY));
  assert.ok(local.data.has(api.LOCAL_STORAGE_KEY));
  assert.equal(api.getSaveStatus().backend, 'indexedDB');
  assert.deepEqual((await api.loadGame()).worldChanges, state().worldChanges);
  assert.equal(db.controls.closeCount, 3);
});

test('unavailable IndexedDB uses localStorage and reports the fallback', async t => {
  const local = fakeLocalStorage();
  const api = await storage(t, undefined, local);
  await api.saveGame(state());
  assert.equal(api.getSaveStatus().backend, 'localStorage');
  assert.match(api.getSaveStatus().warning, /local storage/);
  assert.deepEqual((await api.loadGame()).spawnedChunks, ['0,0', '1,0']);
  await api.clearSave();
  assert.equal(await api.loadGame(), null);
});

test('both storage backends unavailable reject with an actionable error', async t => {
  const api = await storage(t, undefined, undefined);
  await assert.rejects(api.saveGame(state()), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(api.loadGame(), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(api.clearSave(), { code: 'STORAGE_UNAVAILABLE' });
  assert.match(api.getSaveStatus().error, /export a save/i);
});

test('quota failures are reported and a rejected operation does not poison the queue', async t => {
  const local = fakeLocalStorage();
  const goodWrite = local.setItem;
  local.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  const api = await storage(t, undefined, local);
  await assert.rejects(api.saveGame(state()), { code: 'STORAGE_FULL' });
  local.setItem = goodWrite;
  await api.saveGame(state());
  assert.equal((await api.loadGame()).day, 3);
});

test('snapshot is captured before waiting; overlapping writes preserve invocation order', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage();
  db.controls.commitDelay = 8;
  const api = await storage(t, db, local);
  const first = state();
  const one = api.saveGame(first);
  first.player.x = 999;
  const second = state(); second.day = 4;
  const two = api.saveGame(second);
  second.day = 99;
  await Promise.all([one, two]);
  const restored = await api.loadGame();
  assert.equal(restored.day, 4);
  assert.equal(restored.player.x, 7.5);
});

test('transaction abort after request success rejects without fallback', async t => {
  const db = fakeIndexedDB(); db.controls.abortWrites = true;
  const api = await storage(t, db, undefined);
  await assert.rejects(api.saveGame(state()), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(db.records.size, 0);
});

test('an aborted database transaction still recovers the synchronous mirror', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage(); db.controls.abortWrites = true;
  const api = await storage(t, db, local);
  await api.saveGame(state());
  assert.equal(api.getSaveStatus().backend, 'localStorage');
  assert.equal((await api.loadGame()).day, 3);
});

test('load chooses the newest valid copy and preserves a corrupt only copy', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage();
  const api = await storage(t, db, local);
  const older = serialize(state());
  const newerState = state(); newerState.day = 7;
  const newer = serialize(newerState);
  db.records.set(api.SAVE_KEY, older);
  local.setItem(api.LOCAL_STORAGE_KEY, JSON.stringify(newer));
  assert.equal((await api.loadGame()).day, 7);
  local.setItem(api.LOCAL_STORAGE_KEY, '{broken');
  assert.equal((await api.loadGame()).day, 3);
  db.records.clear();
  await assert.rejects(api.loadGame(), { code: 'INVALID_JSON' });
  assert.equal(local.getItem(api.LOCAL_STORAGE_KEY), '{broken');
});

test('clear marker supersedes a stale database after a temporary write outage', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage();
  const api = await storage(t, db, local);
  await api.saveGame(state());
  db.controls.abortWrites = true;
  await api.clearSave();
  assert.ok(db.records.get(api.SAVE_KEY).data);
  assert.equal(await api.loadGame(), null);
});

test('a queued clear followed by a save produces a later timestamp even if one backend fails', async t => {
  const db = fakeIndexedDB(), local = fakeLocalStorage();
  const api = await storage(t, db, local);
  const first = api.clearSave();
  const second = api.saveGame(state());
  await Promise.all([first, second]);
  const saved = db.records.get(api.SAVE_KEY);
  assert.ok(saved.data);
  assert.equal((await api.loadGame()).day, 3);
  assert.equal(saved.savedAt, JSON.parse(local.getItem(api.LOCAL_STORAGE_KEY)).savedAt);
});

test('import validates before storage and handles oversized or unreadable files', async t => {
  const local = fakeLocalStorage();
  const api = await storage(t, undefined, local);
  const file = new Blob([JSON.stringify(serialize(state()))], { type: 'application/json' });
  assert.equal((await api.importSave(file)).day, 3);
  assert.equal(local.data.size, 0);
  await assert.rejects(api.importSave(new Blob(['nope'])), { code: 'INVALID_JSON' });
  await assert.rejects(api.importSave({ size: MAX_SAVE_BYTES + 1, text() {} }), { code: 'SAVE_TOO_LARGE' });
  await assert.rejects(api.importSave({ async text() { throw Error('Unreadable'); } }), { code: 'FILE_READ_FAILED' });
  await assert.rejects(api.importSave(null), { code: 'INVALID_FILE' });
});

test('a version-1 save loads and is migrated with empty explored ground', () => {
  const old = { format: 'deadfall-save', version: 1, savedAt: '2026-10-01T10:00:00.000Z',
    data: { version: 1, seed: 74219, time: 540, day: 3, elapsed: 63, player: { x: 4, y: 5, health: 90, inventory: [] } } };
  const restored = deserialize(JSON.parse(JSON.stringify(old)));
  assert.equal(restored.version, 2);
  assert.deepEqual(restored.explored, { exterior: [], interior: {} });
  assert.equal(restored.player.x, 4);
});

test('explored ground survives a save round trip', () => {
  const explored = { exterior: [[5, 3, 9], [6, 20, 21]], interior: { 'morrow-house': [[7, 4, 6]] } };
  const back = deserialize(JSON.parse(JSON.stringify(serialize({ ...state(), explored }))));
  assert.deepEqual(back.explored, explored);
});

test('damaged explored ground is rejected', () => {
  for (const explored of [{ exterior: 'x' }, { exterior: [[1, 5, 2]] }, { exterior: [], interior: { a: [[1, 'x', 3]] } }, 7]) {
    assert.throws(() => serialize({ ...state(), explored }), /Invalid save/);
  }
});
