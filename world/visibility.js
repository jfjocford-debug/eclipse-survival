/**
 * Visibility rules (docs/VISIBILITY.md). Pure logic: no DOM, no canvas, no randomness.
 *
 * What the player can see comes from five things:
 *   1. Walls and closed or barricaded openings stop sight. Open doors and unbarricaded windows let it through,
 *      so a doorway or a window makes a cone that widens with distance.
 *   2. Indoors you see the room you stand in (its walls stop sight). Other buildings stay hidden.
 *   3. Outdoors the radius is small. It shrinks at night and in bad weather.
 *   4. Light decides detail. A dark room stays dark without a lit lamp. Through a window, a poorly lit tile
 *      shows only a silhouette.
 *   5. Anything seen is remembered, faintly, after the player leaves (VisibilityMemory).
 *
 * The result for a tile is one of: 'visible', 'silhouette', 'remembered', 'hidden'.
 */

export const RULES = Object.freeze({
  dayRadius: 7,          // tiles, clear day outdoors
  nightRadius: 3.5,      // tiles, night outdoors without light
  silhouetteRange: 6,    // tiles, how far a shape can be made out through glass
  nearRadius: 1.5,       // tiles you can always feel around you, even in total darkness
  lampRadius: 5,         // tiles lit by a lit lamp
  litThreshold: 0.25,    // light needed to see detail
  sealedIndoor: 0.12,    // share of daylight reaching a room with no open door or clear window
  openIndoor: 0.6,       // share of daylight reaching a room with an open door or a clear window
  maxRange: 13,          // tiles examined around the player
});

// How much each kind of weather clouds the view, at full intensity.
const CLARITY_LOSS = { clear: 0.2, overcast: 0.25, rain: 0.5, fog: 0.75, storm: 0.6 };

const OPAQUE = 1;
const GLASS = 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const key = (x, y) => `${x},${y}`;

/** 1 on a clear day, lower in bad weather. */
export function clarity(weather) {
  const loss = CLARITY_LOSS[weather?.type] ?? 0.25;
  const intensity = Number.isFinite(weather?.intensity) ? clamp(weather.intensity, 0, 1) : 0.25;
  return clamp(1 - loss * intensity * (weather?.type === 'fog' ? 1.3 : 1), 0.25, 1);
}

/** Outdoor radius in tiles for the given daylight (0.12 night … 1 day) and weather. */
export function outdoorRadius(daylight, weather) {
  const day = clamp(((Number.isFinite(daylight) ? daylight : 1) - 0.12) / 0.88, 0, 1);
  return Math.max(2, (RULES.nightRadius + (RULES.dayRadius - RULES.nightRadius) * day) * clarity(weather));
}

/** Walk the tiles between two points. Reports whether sight is blocked and whether it crossed glass. */
function trace(x0, y0, x1, y1, sight) {
  let tx = Math.floor(x0), ty = Math.floor(y0);
  const endX = Math.floor(x1), endY = Math.floor(y1);
  if (tx === endX && ty === endY) return { blocked: false, glass: false };
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let maxX = dx === 0 ? Infinity : ((stepX > 0 ? tx + 1 - x0 : x0 - tx)) * deltaX;
  let maxY = dy === 0 ? Infinity : ((stepY > 0 ? ty + 1 - y0 : y0 - ty)) * deltaY;
  let glass = false;
  for (let guard = 0; guard < 80; guard++) {
    if (Math.abs(maxX - maxY) < 1e-9) {
      // The ray passes exactly through a corner: it may squeeze past one wall but not between two.
      if (sight.get(key(tx + stepX, ty)) === OPAQUE && sight.get(key(tx, ty + stepY)) === OPAQUE) return { blocked: true, glass };
      tx += stepX; ty += stepY; maxX += deltaX; maxY += deltaY;
    } else if (maxX < maxY) { tx += stepX; maxX += deltaX; }
    else { ty += stepY; maxY += deltaY; }
    if (tx === endX && ty === endY) return { blocked: false, glass };
    const kind = sight.get(key(tx, ty));
    if (kind === OPAQUE) return { blocked: true, glass };
    if (kind === GLASS) glass = true;
  }
  return { blocked: true, glass };
}

/**
 * A tile counts as seen if any of five points in it can be reached, which keeps cones through doors and
 * windows solid instead of speckled. Returns the clearest ray found, or null.
 */
const SAMPLES = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
function clearRay(px, py, cx, cy, sight) {
  let best = null;
  for (const [ox, oy] of SAMPLES) {
    const ray = trace(px, py, cx + ox, cy + oy, sight);
    if (ray.blocked) continue;
    if (!ray.glass) return ray;
    best = ray;
  }
  return best;
}

/** Which tile keys block sight, and which are glass, from the live props near the viewer. */
function sightMap(props) {
  const sight = new Map();
  const rise = new Map();   // how tall each sight-stopping tile is, in height units (the renderer needs it)
  for (const prop of props) {
    if (prop.removed || prop.destroyed) continue;
    let kind = 0;
    if (prop.type === 'wall') kind = OPAQUE;
    else if (prop.type === 'door') kind = prop.open && !prop.barricaded ? 0 : OPAQUE;
    else if (prop.type === 'window') kind = prop.barricaded ? OPAQUE : GLASS;
    if (!kind) continue;
    for (let y = prop.y; y < prop.y + (prop.h || 1); y++) {
      for (let x = prop.x; x < prop.x + (prop.w || 1); x++) {
        const k = key(x, y);
        if (sight.get(k) !== OPAQUE) sight.set(k, kind);
        rise.set(k, Math.max(rise.get(k) || 0, prop.cutaway ? 0.3 : prop.type === 'wall' ? 2.5 : 2.2));
      }
    }
  }
  return { sight, rise };
}

/** The result of one visibility computation. */
export class VisibilityField {
  constructor(origin, tiles, memory, info) {
    this.origin = origin;      // {x, y} tile of the viewer
    this.tiles = tiles;        // Map key -> {state: 'visible'|'silhouette', light}
    this.memory = memory;
    Object.assign(this, info); // mode, buildingId, radius, clarity
  }
  /** 'visible', 'silhouette', 'remembered' or 'hidden' for the tile containing (x, y). */
  state(x, y) {
    const k = key(Math.floor(x), Math.floor(y));
    const entry = this.tiles.get(k);
    if (entry) return entry.state;
    return this.memory?.has(Math.floor(x), Math.floor(y)) ? 'remembered' : 'hidden';
  }
  /** The stored entry for a tile ({state, light, indoor, fade}) or undefined. */
  entry(x, y) { return this.tiles.get(key(Math.floor(x), Math.floor(y))); }
  /** 0 (dark) to 1 (bright) for a visible tile, otherwise 0. */
  light(x, y) { return this.tiles.get(key(Math.floor(x), Math.floor(y)))?.light ?? 0; }
  /** What to draw for an actor or loot item: 'full', 'shape' (silhouette only) or 'none'. */
  entityState(x, y) {
    const s = this.state(x, y);
    return s === 'visible' ? 'full' : s === 'silhouette' ? 'shape' : 'none';
  }
}

/** Tiles the player has seen. Only fully visible tiles are remembered, never silhouettes. */
export class VisibilityMemory {
  constructor() { this.rows = new Map(); this.count = 0; }
  has(x, y) { return this.rows.get(y)?.has(x) === true; }
  add(x, y) {
    let row = this.rows.get(y);
    if (!row) this.rows.set(y, row = new Set());
    if (!row.has(x)) { row.add(x); this.count++; }
  }
  record(field) {
    for (const [k, v] of field.tiles) {
      if (v.state !== 'visible') continue;
      const [x, y] = k.split(',').map(Number);
      this.add(x, y);
    }
  }
  /** Compact form for saving: [[y, x0, x1], …], one entry per run of adjacent tiles. */
  serialize() {
    const out = [];
    for (const [y, row] of this.rows) {
      const xs = [...row].sort((a, b) => a - b);
      let start = xs[0], prev = xs[0];
      for (let i = 1; i <= xs.length; i++) {
        if (xs[i] === prev + 1) { prev = xs[i]; continue; }
        out.push([y, start, prev]);
        start = prev = xs[i];
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  static deserialize(runs) {
    const memory = new VisibilityMemory();
    if (!Array.isArray(runs)) return memory;
    for (const run of runs) {
      if (!Array.isArray(run) || run.length !== 3 || !run.every(Number.isInteger) || run[2] < run[1] || run[2] - run[1] > 4096) continue;
      for (let x = run[1]; x <= run[2]; x++) memory.add(x, run[0]);
    }
    return memory;
  }
}

export class Visibility {
  /** `world` needs getTile(x, y) -> {room?, buildingId?} and getProps(x, y, radius). */
  constructor(world, memory = new VisibilityMemory()) {
    this.world = world;
    this.memory = memory;
    this.field = null;
  }

  /**
   * Compute what the viewer sees. `view` is {x, y, daylight, weather}. Remembers what is seen.
   * daylight is 0.12 (night) to 1 (day), the same value the weather system already keeps.
   */
  update(view) {
    const { world } = this;
    const px = view.x, py = view.y;
    const daylight = Number.isFinite(view.daylight) ? view.daylight : 1;
    const weather = view.weather;
    const here = world.getTile(px, py);
    const indoors = Boolean(here.room);
    const buildingId = here.buildingId ?? null;
    const props = world.getProps(px, py, RULES.maxRange + 2);
    const { sight, rise } = sightMap(props);
    const lamps = props.filter(p => p.type === 'lamp' && p.lit !== false && !p.removed && !p.destroyed);
    const open = outdoorRadius(daylight, weather);
    const far = RULES.dayRadius * clarity(weather);

    // Daylight reaching each building: more through an open door or a clear window.
    const bright = new Map();
    const indoorAmbient = id => {
      if (!bright.has(id)) {
        const letsLightIn = props.some(p => p.buildingId === id &&
          ((p.type === 'door' && p.open && !p.barricaded) || (p.type === 'window' && !p.barricaded)));
        bright.set(id, daylight * (letsLightIn ? RULES.openIndoor : RULES.sealedIndoor));
      }
      return bright.get(id);
    };
    const lampLight = (x, y, id) => {
      let total = 0;
      for (const lamp of lamps) {
        if ((lamp.buildingId ?? null) !== id) continue;
        const d = Math.hypot(lamp.x + 0.5 - x, lamp.y + 0.5 - y);
        if (d < RULES.lampRadius) total += 1 - d / RULES.lampRadius;
      }
      return total;
    };

    const tiles = new Map();
    const tx0 = Math.floor(px), ty0 = Math.floor(py);
    tiles.set(key(tx0, ty0), { state: 'visible', light: clamp(this._tileLight(here, px, py, daylight, indoorAmbient, lampLight), 0.15, 1), indoor: indoors, fade: 0, rise: 0 });
    const reach = Math.ceil(RULES.maxRange);
    for (let ty = ty0 - reach; ty <= ty0 + reach; ty++) {
      for (let tx = tx0 - reach; tx <= tx0 + reach; tx++) {
        if (tx === tx0 && ty === ty0) continue;
        const cx = tx + 0.5, cy = ty + 0.5;
        const dist = Math.hypot(cx - px, cy - py);
        if (dist > RULES.maxRange) continue;
        const ray = clearRay(px, py, cx, cy, sight);
        if (!ray) continue;
        const tile = world.getTile(tx, ty);
        const tileIndoors = Boolean(tile.room);
        const light = clamp(this._tileLight(tile, cx, cy, daylight, indoorAmbient, lampLight), 0, 1);
        const lamp = lampLight(cx, cy, tile.buildingId ?? null);
        let state = null;
        if (tileIndoors) {
          // Inside the viewer's own building the whole room is in range; elsewhere the distance cap applies.
          const sameRoom = indoors && tile.buildingId === buildingId;
          const inRange = sameRoom || dist <= far;
          if (inRange && light >= RULES.litThreshold) state = 'visible';
          else if (dist <= RULES.nearRadius) state = 'visible';
        } else if (dist <= open || (lamp >= 0.3 && dist <= far) || dist <= RULES.nearRadius) {
          state = 'visible';
        }
        if (!state && ray.glass && dist <= RULES.silhouetteRange * clarity(weather)) state = 'silhouette';
        if (state) {
          // Outdoors the edge of the radius fades out instead of ending in a hard line.
          const fade = !tileIndoors && lamp < 0.3 && state === 'visible' ? clamp((dist - open * 0.6) / (open * 0.4), 0, 1) : 0;
          tiles.set(key(tx, ty), { state, light, indoor: tileIndoors, fade, rise: rise.get(key(tx, ty)) || 0 });
        }
      }
    }
    // Seen from inside, the outer corners of the room's walls count as seen too; the ray to them grazes two walls.
    if (indoors) {
      for (const [k, kind] of sight) {
        if (kind !== OPAQUE || tiles.has(k)) continue;
        const [wx, wy] = k.split(',').map(Number);
        if (world.getTile(wx, wy).buildingId !== buildingId) continue;
        let touchesRoom = false;
        for (let dy = -1; dy <= 1 && !touchesRoom; dy++) for (let dx = -1; dx <= 1; dx++) {
          const n = tiles.get(key(wx + dx, wy + dy));
          if (n && n.state === 'visible' && n.rise === 0 && n.indoor) { touchesRoom = true; break; }
        }
        if (touchesRoom) tiles.set(k, { state: 'visible', light: 0.5, indoor: true, fade: 0, rise: rise.get(k) || 0 });
      }
    }
    const field = new VisibilityField({ x: tx0, y: ty0 }, tiles, this.memory, {
      mode: indoors ? 'indoor' : 'outdoor', buildingId, radius: open, clarity: clarity(weather),
    });
    this.memory.record(field);
    this.field = field;
    return field;
  }

  _tileLight(tile, x, y, daylight, indoorAmbient, lampLight) {
    const id = tile.buildingId ?? null;
    const ambient = tile.room ? indoorAmbient(id) : daylight;
    return ambient + lampLight(x, y, id);
  }
}
