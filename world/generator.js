import { BLOCK_SIZE, makeBlock, terrainInBlock } from './layout.js';

export const CHUNK_SIZE = 16;
const LOAD_RADIUS = 2;
const RETAIN_RADIUS = 3;
const INVALID_TILE = Object.freeze({ x: 0, y: 0, type: 'grass', blocked: true });
const clone = value => JSON.parse(JSON.stringify(value));
const validNumber = Number.isFinite;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const forbidden = key => key === '__proto__' || key === 'constructor' || key === 'prototype';
const PROP_TYPES = new Set(['wall', 'door', 'window', 'tree', 'crate', 'shelf', 'bed', 'table', 'chair', 'sofa', 'counter', 'car', 'lamp', 'debris', 'fence']);

function bounds(px, py, radius) {
  if (!validNumber(px) || !validNumber(py)) return null;
  const r = validNumber(radius) ? Math.max(0, Math.min(256, radius)) : 24;
  return { x0: Math.floor(px - r), y0: Math.floor(py - r), x1: Math.floor(px + r), y1: Math.floor(py + r), radius: r };
}

/** Shared collision rule, including changes made directly on live prop objects. */
export function propBlocks(prop) {
  if (prop.removed || prop.destroyed) return false;
  if (prop.type === 'door') return Number(prop.barricaded || 0) > 0 || !prop.open;
  if (prop.type === 'window') return Number(prop.barricaded || 0) > 0 || !(prop.open || prop.broken);
  return Boolean(prop.blocked);
}

/**
 * Deterministic, unbounded town, streamed in 16×16 chunks.
 *
 * Props are live objects: mutate `open`, `barricaded`, `loot`, `looted`, etc.
 * serialize() and eviction capture every JSON property, including array edits.
 * Snapshots are keyed by stable prop ID and contain only changed props.
 */
export class World {
  constructor(seed = 74219, changes = {}) {
    this.seed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 74219;
    this.chunks = new Map();
    this._blocks = new Map();
    this._props = new Map();
    this._custom = new Map();
    this._changes = Object.create(null);
    this._center = null;
    this._needsEviction = true;
    this.applyChanges(changes);
  }

  _block(bx, by) {
    const key = `${bx},${by}`;
    let block = this._blocks.get(key);
    if (!block) {
      block = makeBlock(this.seed, bx, by);
      this._blocks.set(key, block);
      this._needsEviction = true;
    }
    return block;
  }

  _acquire(blueprint) {
    let entry = this._props.get(blueprint.id);
    if (!entry) {
      const baseline = blueprint.custom ? null : JSON.stringify(blueprint);
      let prop = blueprint.custom ? blueprint : JSON.parse(baseline);
      const change = this._changes[blueprint.id];
      if (change && !blueprint.custom) prop = this._restore(prop, change);
      entry = { prop, baseline, references: 0 };
      this._props.set(blueprint.id, entry);
    }
    entry.references++;
    return entry.prop;
  }

  _restore(baseline, change) {
    // Full snapshots preserve deletion of optional properties. Partial patches
    // are also accepted for integration callers or hand-authored starting state.
    if (own(change, 'id') && own(change, 'type') && own(change, 'x') && own(change, 'y')) return clone(change);
    return { ...baseline, ...clone(change) };
  }

  _capture(entry) {
    const current = JSON.stringify(entry.prop);
    if (current === entry.baseline) delete this._changes[entry.prop.id];
    else this._changes[entry.prop.id] = JSON.parse(current);
  }

  _overlapsChunk(prop, chunk) {
    return prop.x < chunk.x0 + CHUNK_SIZE && prop.y < chunk.y0 + CHUNK_SIZE &&
      prop.x + (prop.w || 1) > chunk.x0 && prop.y + (prop.h || 1) > chunk.y0;
  }

  _indexProp(chunk, prop) {
    const px0 = Math.max(chunk.x0, Math.floor(prop.x));
    const py0 = Math.max(chunk.y0, Math.floor(prop.y));
    const px1 = Math.min(chunk.x0 + CHUNK_SIZE, Math.ceil(prop.x + (prop.w || 1)));
    const py1 = Math.min(chunk.y0 + CHUNK_SIZE, Math.ceil(prop.y + (prop.h || 1)));
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) chunk.occupancy[(y - chunk.y0) * CHUNK_SIZE + x - chunk.x0].push(prop);
    }
  }

  _attachCustom(prop) {
    for (const chunk of this.chunks.values()) {
      if (!this._overlapsChunk(prop, chunk) || chunk.props.some(existing => existing.id === prop.id)) continue;
      const live = this._acquire(prop);
      chunk.props.push(live);
      this._indexProp(chunk, live);
    }
  }

  _loadChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;
    // BLOCK_SIZE is a multiple of CHUNK_SIZE; a chunk belongs to one town block.
    const block = this._block(Math.floor(x0 / BLOCK_SIZE), Math.floor(y0 / BLOCK_SIZE));
    const tiles = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const occupancy = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => []);
    const props = [];
    chunk = { key, x: cx, y: cy, cx, cy, x0, y0, blockKey: block.key, tiles, props, occupancy };
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        tiles[y * CHUNK_SIZE + x] = terrainInBlock(block, x0 + x, y0 + y, this.seed);
      }
    }
    for (const blueprint of [...block.props, ...this._custom.values()]) {
      if (!this._overlapsChunk(blueprint, chunk)) continue;
      const prop = this._acquire(blueprint);
      props.push(prop);
      this._indexProp(chunk, prop);
    }
    this.chunks.set(key, chunk);
    this._needsEviction = true;
    return chunk;
  }

  _releaseChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    for (const prop of chunk.props) {
      const entry = this._props.get(prop.id);
      if (!entry) continue;
      if (--entry.references === 0) {
        this._capture(entry);
        this._props.delete(prop.id);
      }
    }
    this.chunks.delete(key);
  }

  /** Preload five chunks across; retain a one-chunk margin to avoid edge churn. */
  update(px, py) {
    if (!validNumber(px) || !validNumber(py)) return;
    const cx = Math.floor(px / CHUNK_SIZE);
    const cy = Math.floor(py / CHUNK_SIZE);
    const moved = !this._center || this._center.x !== cx || this._center.y !== cy;
    // Queries can load distant chunks between updates, so still evict after a
    // stationary update if the working set grew beyond the retention envelope.
    if (!moved && !this._needsEviction) return;
    this._center = { x: cx, y: cy };
    for (let y = cy - LOAD_RADIUS; y <= cy + LOAD_RADIUS; y++) {
      for (let x = cx - LOAD_RADIUS; x <= cx + LOAD_RADIUS; x++) this._loadChunk(x, y);
    }
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - cx) > RETAIN_RADIUS || Math.abs(chunk.cy - cy) > RETAIN_RADIUS) this._releaseChunk(key);
    }
    const usedBlocks = new Set(Array.from(this.chunks.values(), chunk => chunk.blockKey));
    for (const key of this._blocks.keys()) if (!usedBlocks.has(key)) this._blocks.delete(key);
    this._needsEviction = false;
  }

  /** Integer and fractional world positions are accepted, including negatives. */
  getTile(x, y) {
    if (!validNumber(x) || !validNumber(y)) return INVALID_TILE;
    x = Math.floor(x);
    y = Math.floor(y);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const chunk = this._loadChunk(cx, cy);
    const index = (y - chunk.y0) * CHUNK_SIZE + x - chunk.x0;
    const tile = chunk.tiles[index];
    tile.blocked = chunk.occupancy[index].some(propBlocks);
    return tile;
  }

  isBlocked(x, y) {
    return this.getTile(x, y).blocked;
  }

  /** A square tile region; isometric renderers perform their own screen culling. */
  getVisibleTiles(px, py, radius = 24) {
    const region = bounds(px, py, radius);
    if (!region) return [];
    const tiles = [];
    for (let y = region.y0; y <= region.y1; y++) {
      for (let x = region.x0; x <= region.x1; x++) tiles.push(this.getTile(x, y));
    }
    return tiles;
  }

  /** Live props overlapping the region, once each even across chunk seams. */
  getProps(px, py, radius = 24) {
    const region = bounds(px, py, radius);
    if (!region) return [];
    const result = [];
    const seen = new Set();
    for (let cy = Math.floor(region.y0 / CHUNK_SIZE); cy <= Math.floor(region.y1 / CHUNK_SIZE); cy++) {
      for (let cx = Math.floor(region.x0 / CHUNK_SIZE); cx <= Math.floor(region.x1 / CHUNK_SIZE); cx++) {
        const chunk = this._loadChunk(cx, cy);
        for (const prop of chunk.props) {
          if (seen.has(prop.id) || prop.removed || prop.destroyed) continue;
          if (prop.x > region.x1 || prop.y > region.y1 ||
              prop.x + (prop.w || 1) <= region.x0 || prop.y + (prop.h || 1) <= region.y0) continue;
          seen.add(prop.id);
          result.push(prop);
        }
      }
    }
    return result;
  }

  /** Nearby object centers, sorted by distance. Wide objects use their footprint. */
  getNearby(x, y, radius = 2) {
    if (!validNumber(x) || !validNumber(y)) return [];
    radius = validNumber(radius) ? Math.max(0, radius) : 2;
    const distance = prop => {
      const dx = Math.max(prop.x + 0.5 - x, 0, x - (prop.x + (prop.w || 1) - 0.5));
      const dy = Math.max(prop.y + 0.5 - y, 0, y - (prop.y + (prop.h || 1) - 0.5));
      return dx * dx + dy * dy;
    };
    return this.getProps(x, y, radius).filter(prop => distance(prop) <= radius * radius)
      .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  }

  /** Optional HUD/minimap information with no simulation-side dependencies. */
  getLocation(x, y) {
    if (!validNumber(x) || !validNumber(y)) return 'Unknown';
    const tile = this.getTile(x, y);
    if (tile.room) return tile.room;
    const bx = Math.floor(x / BLOCK_SIZE);
    const by = Math.floor(y / BLOCK_SIZE);
    const street = ['Juniper', 'Morrow', 'Hollis', 'Briar', 'Cedar'][((bx % 5) + 5) % 5];
    if (tile.type === 'road' || tile.type === 'sidewalk') return `${street} ${Math.abs(by) % 2 ? 'Avenue' : 'Street'}`;
    return `${this._block(bx, by).buildings[0].name} · grounds`;
  }

  getBuildings(px, py, radius = 48) {
    const region = bounds(px, py, radius);
    if (!region) return [];
    const result = [];
    for (let by = Math.floor(region.y0 / BLOCK_SIZE); by <= Math.floor(region.y1 / BLOCK_SIZE); by++) {
      for (let bx = Math.floor(region.x0 / BLOCK_SIZE); bx <= Math.floor(region.x1 / BLOCK_SIZE); bx++) {
        for (const building of this._block(bx, by).buildings) {
          if (building.x <= region.x1 && building.y <= region.y1 && building.x + building.w > region.x0 && building.y + building.h > region.y0) {
            result.push({ ...building });
          }
        }
      }
    }
    return result;
  }

  /**
   * Add a persistent player-built prop. Returns the live prop, or null when the
   * footprint is occupied/invalid. Callers consume materials only on success.
   */
  placeProp(input) {
    if (!input || !PROP_TYPES.has(input.type) || !validNumber(input.x) || !validNumber(input.y)) return null;
    const x = Math.floor(input.x);
    const y = Math.floor(input.y);
    const w = input.w === undefined ? 1 : input.w;
    const h = input.h === undefined ? 1 : input.h;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 8 || h > 8) return null;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) if (this.isBlocked(tx, ty)) return null;
    }
    let id = input.id;
    if (id !== undefined && (typeof id !== 'string' || forbidden(id) || this._props.has(id) || own(this._changes, id))) return null;
    if (!id) {
      let sequence = 0;
      do { id = `built:${x}:${y}:${sequence++}`; } while (this._custom.has(id) || own(this._changes, id));
    }
    const tile = this.getTile(x, y);
    const prop = {
      blocked: !['lamp', 'debris'].includes(input.type), rotation: 0,
      color: '#89704f', health: input.type === 'wall' ? 120 : 60,
      ...clone(input), id, x, y, w, h, custom: true,
      destroyed: false, removed: false,
      ...(tile.room ? { room: tile.room, buildingId: tile.buildingId } : {}),
    };
    if (prop.type === 'door' || prop.type === 'window') {
      prop.open = Boolean(prop.open);
      prop.barricaded = Number(prop.barricaded) || 0;
    }
    this._custom.set(id, prop);
    this._changes[id] = clone(prop);
    this._attachCustom(prop);
    return prop;
  }

  _findProp(id) {
    let entry = this._props.get(id);
    if (entry) return entry.prop;
    const snapshot = this._changes[id];
    if (snapshot && validNumber(snapshot.x) && validNumber(snapshot.y)) {
      this._loadChunk(Math.floor(snapshot.x / CHUNK_SIZE), Math.floor(snapshot.y / CHUNK_SIZE));
    } else if (typeof id === 'string') {
      const match = /^[^:]+:(-?\d+):(-?\d+)$/.exec(id);
      if (match) this._loadChunk(Math.floor(Number(match[1]) / CHUNK_SIZE), Math.floor(Number(match[2]) / CHUNK_SIZE));
    }
    entry = this._props.get(id);
    return entry?.prop || this._custom.get(id) || null;
  }

  /** Destruction immediately clears collision and survives saving and streaming. */
  damageProp(id, amount = 25) {
    const prop = this._findProp(id);
    if (!prop || !validNumber(amount) || amount <= 0) return { hit: false, destroyed: false, health: prop?.health ?? 0 };
    if (prop.destroyed || prop.removed) return { hit: false, destroyed: true, health: 0, prop };
    const maximum = { wall: 120, door: 80, window: 35, tree: 90, car: 180, fence: 60 }[prop.type] || 50;
    prop.health = Math.max(0, (validNumber(prop.health) ? prop.health : maximum) - amount);
    if (prop.health === 0) {
      prop.destroyed = true;
      prop.blocked = false;
      prop.barricaded = 0;
    }
    return { hit: true, destroyed: prop.health === 0, health: prop.health, prop };
  }

  destroyProp(id) {
    return this.damageProp(id, Number.MAX_SAFE_INTEGER);
  }

  /** Return detached JSON data; saving cannot mutate or alias live world state. */
  serialize() {
    for (const entry of this._props.values()) this._capture(entry);
    for (const [id, prop] of this._custom) this._changes[id] = clone(prop);
    return clone(this._changes);
  }

  /** Merge persistent changes, preserving references held by the game/UI. */
  applyChanges(changes = {}) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return;
    const entries = changes.props && typeof changes.props === 'object' && !Array.isArray(changes.props) ? changes.props : changes;
    for (const [id, change] of Object.entries(entries)) {
      if (forbidden(id) || !change || typeof change !== 'object' || Array.isArray(change)) continue;
      const incoming = clone(change);
      if (own(incoming, 'id') && incoming.id !== id) continue;
      const complete = own(incoming, 'id') && own(incoming, 'type') && own(incoming, 'x') && own(incoming, 'y');
      let snapshot = complete ? incoming : { ...this._changes[id], ...incoming };
      const entry = this._props.get(id);
      if (entry) {
        const restored = this._restore(entry.prop, incoming);
        for (const key of Object.keys(entry.prop)) delete entry.prop[key];
        Object.assign(entry.prop, restored);
        snapshot = clone(entry.prop);
        if (entry.prop.custom) this._custom.set(id, entry.prop);
      }
      this._changes[id] = snapshot;
      if (!entry && snapshot.custom && PROP_TYPES.has(snapshot.type) && validNumber(snapshot.x) && validNumber(snapshot.y)) {
        this._custom.set(id, snapshot);
        this._attachCustom(snapshot);
      }
    }
  }
}
