import { SaveError } from './errors.js';

export const SAVE_FORMAT = 'deadfall-save';
export const SAVE_VERSION = 2;
/** Versions this build can read. Version 1 predates explored-ground memory and is migrated on load. */
export const READABLE_VERSIONS = [1, 2];
export const MAX_SAVE_BYTES = 20 * 1024 * 1024;
const TRANSIENT_KEYS = new Set(['particles', 'messages', 'render', 'nearby', 'paused', 'saveStatus', 'location']);
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function invalid(path, detail) {
  throw new SaveError(`Invalid save: ${path} ${detail}.`, 'INVALID_SAVE');
}

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, 'must be an object');
  }
  return value;
}

function number(value, path, min = -Infinity, max = Infinity, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(path, 'contains an invalid number');
  }
}

function text(value, path, max = 256) {
  if (typeof value !== 'string' || !value.length || value.length > max) invalid(path, 'contains invalid text');
}

/** Copy only JSON data; reject cycles, oversized trees and unsafe property names. */
function copyJSON(value, path, context, depth = 0) {
  if (++context.nodes > 500000 || depth > 64) invalid(path, 'is too complex');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    number(value, path);
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > 1000000) invalid(path, 'is too long');
    return value;
  }
  if (typeof value !== 'object') invalid(path, 'must contain only JSON data');
  if (context.parents.has(value)) invalid(path, 'contains a circular reference');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) invalid(path, 'must contain plain objects');
  context.parents.add(value);
  let result;
  if (Array.isArray(value)) {
    if (value.length > 100000) invalid(path, 'has too many entries');
    result = Array.from(value, (entry, index) => copyJSON(entry, `${path}[${index}]`, context, depth + 1));
  } else {
    result = {};
    for (const key of Object.keys(value)) {
      if (UNSAFE_KEYS.has(key) || key.length > 512) invalid(path, 'contains an unsafe property');
      // Optional properties are omitted just as they are by JSON.stringify.
      if (value[key] !== undefined) result[key] = copyJSON(value[key], `${path}.${key}`, context, depth + 1);
    }
  }
  context.parents.delete(value);
  return result;
}

function inventory(items, path) {
  if (!Array.isArray(items) || items.length > 10000) invalid(path, 'must be an item list');
  items.forEach((item, index) => {
    const name = `${path}[${index}]`;
    object(item, name);
    text(item.id, `${name}.id`);
    number(item.qty, `${name}.qty`, 0, 1000000, true);
  });
}

function position(actor, path) {
  object(actor, path);
  number(actor.x, `${path}.x`, -1000000, 1000000);
  number(actor.y, `${path}.y`, -1000000, 1000000);
}

function defaultNumber(target, key, fallback, path, min, max, integer = false) {
  if (target[key] === undefined) target[key] = fallback;
  number(target[key], `${path}.${key}`, min, max, integer);
}

/** Explored-ground memory: {exterior: [[y, x0, x1]…], interior: {buildingId: [[y, x0, x1]…]}}. */
function runs(value, path) {
  if (!Array.isArray(value) || value.length > 100000) invalid(path, 'must be a list of tile runs');
  value.forEach((run, index) => {
    if (!Array.isArray(run) || run.length !== 3 || !run.every(Number.isInteger) || run[2] < run[1] || run[2] - run[1] > 4096) invalid(`${path}[${index}]`, 'is not a tile run');
  });
}
function explored(state) {
  if (state.explored === undefined) state.explored = { exterior: [], interior: {} };
  const e = object(state.explored, 'state.explored');
  if (e.exterior === undefined) e.exterior = [];
  if (e.interior === undefined) e.interior = {};
  runs(e.exterior, 'state.explored.exterior');
  object(e.interior, 'state.explored.interior');
  for (const [id, list] of Object.entries(e.interior)) runs(list, `state.explored.interior.${id}`);
}

/** Returns an independent validated persistent snapshot, preserving extension data. */
export function normalizeState(input) {
  object(input, 'state');
  const persistent = {};
  for (const key of Object.keys(input)) {
    if (UNSAFE_KEYS.has(key)) invalid('state', 'contains an unsafe property');
    if (!TRANSIENT_KEYS.has(key) && input[key] !== undefined) persistent[key] = input[key];
  }
  const state = copyJSON(persistent, 'state', { nodes: 0, parents: new Set() });
  if (state.version === undefined) state.version = SAVE_VERSION;
  if (!READABLE_VERSIONS.includes(state.version)) throw new SaveError(`Save version ${state.version} is not supported by this version of Deadfall.`, 'UNSUPPORTED_VERSION');
  // Migration 1 -> 2: a version-1 survivor has explored nothing yet.
  state.version = SAVE_VERSION;
  number(state.seed, 'state.seed', -2147483648, 4294967295, true);
  number(state.time, 'state.time', 0, 1440);
  defaultNumber(state, 'day', 1, 'state', 1, 1000000, true);
  defaultNumber(state, 'elapsed', 0, 'state', 0, Number.MAX_SAFE_INTEGER);
  defaultNumber(state, 'noise', 0, 'state', 0, 1000000);
  position(state.player, 'state.player');
  const player = state.player;
  if (player.id === undefined) player.id = 1;
  if ((typeof player.id !== 'number' && typeof player.id !== 'string') || player.id === '') invalid('state.player.id', 'must be an actor ID');
  number(player.health, 'state.player.health', 0, 100);
  inventory(player.inventory, 'state.player.inventory');
  for (const key of ['hunger', 'thirst', 'energy', 'stamina']) defaultNumber(player, key, 100, 'state.player', 0, 100);
  for (const key of ['bleeding', 'infection']) defaultNumber(player, key, 0, 'state.player', 0, 100);
  defaultNumber(player, 'dirX', 1, 'state.player', -1, 1);
  defaultNumber(player, 'dirY', 0, 'state.player', -1, 1);
  defaultNumber(player, 'kills', 0, 'state.player', 0, Number.MAX_SAFE_INTEGER, true);
  if (player.equipped === undefined) player.equipped = null;
  if (player.equipped !== null) text(player.equipped, 'state.player.equipped');
  if (player.skills === undefined) player.skills = {};
  object(player.skills, 'state.player.skills');
  for (const key of ['strength', 'fitness', 'crafting']) defaultNumber(player.skills, key, 0, 'state.player.skills', 0, 1000000000);
  if (state.dead === undefined) state.dead = player.health <= 0;
  if (typeof state.dead !== 'boolean') invalid('state.dead', 'must be a boolean');
  if (player.health <= 0) state.dead = true;
  if (state.zombies === undefined) state.zombies = [];
  if (!Array.isArray(state.zombies) || state.zombies.length > 10000) invalid('state.zombies', 'must be a zombie list');
  const ids = new Set();
  state.zombies.forEach((zombie, index) => {
    const path = `state.zombies[${index}]`;
    position(zombie, path);
    if ((typeof zombie.id !== 'string' && typeof zombie.id !== 'number') || zombie.id === '' || ids.has(zombie.id)) invalid(`${path}.id`, 'must be unique');
    ids.add(zombie.id);
    number(zombie.health, `${path}.health`, -1000000, 1000000);
    if (zombie.mode === undefined) zombie.mode = 'idle';
    if (!['idle', 'wander', 'chase', 'attack', 'dead'].includes(zombie.mode)) invalid(`${path}.mode`, 'is unknown');
    defaultNumber(zombie, 'dirX', 1, path, -1, 1);
    defaultNumber(zombie, 'dirY', 0, path, -1, 1);
    defaultNumber(zombie, 'attackCooldown', 0, path, 0, 1000000);
  });
  if (state.worldChanges === undefined) state.worldChanges = {};
  object(state.worldChanges, 'state.worldChanges');
  if (state.spawnedChunks !== undefined) {
    if (!Array.isArray(state.spawnedChunks)) invalid('state.spawnedChunks', 'must be a chunk list');
    state.spawnedChunks.forEach((key, index) => {
      text(key, `state.spawnedChunks[${index}]`);
      if (!/^-?\d+,-?\d+$/.test(key)) invalid(`state.spawnedChunks[${index}]`, 'must identify a chunk');
    });
  }
  explored(state);
  if (state.weather === undefined) state.weather = { type: 'overcast', intensity: 0.25, temperature: 16 };
  object(state.weather, 'state.weather');
  if (state.weather.type === undefined) state.weather.type = 'overcast';
  text(state.weather.type, 'state.weather.type', 64);
  defaultNumber(state.weather, 'intensity', 0.25, 'state.weather', 0, 1);
  defaultNumber(state.weather, 'temperature', 16, 'state.weather', -200, 200);
  for (const [key, defaults] of Object.entries({ objectives: { looted: 0, crafted: 0, barricaded: 0 }, stats: { distance: 0 } })) {
    if (state[key] === undefined) state[key] = {};
    object(state[key], `state.${key}`);
    for (const [field, value] of Object.entries(defaults)) defaultNumber(state[key], field, value, `state.${key}`, 0, Number.MAX_SAFE_INTEGER);
  }
  if (state.settings === undefined) state.settings = { sound: true };
  object(state.settings, 'state.settings');
  if (state.settings.sound === undefined) state.settings.sound = true;
  if (typeof state.settings.sound !== 'boolean') invalid('state.settings.sound', 'must be a boolean');
  return state;
}

export function checkSize(json) {
  // UTF-8 size, not UTF-16 code units; Blob is available in all target browsers.
  const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(json).byteLength : json.length * 3;
  if (bytes > MAX_SAVE_BYTES) throw new SaveError('This save exceeds the 20 MB size limit.', 'SAVE_TOO_LARGE');
}
