import { blocked, clearPassage, findPath, lineOfSight } from './pathfinding.js';

function hash(value) {
  let n = typeof value === 'number' ? value : [...String(value)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Pure worker-owned state, exported to exercise the actual AI in Node tests. */
export class ZombieSimulation {
  constructor() { this.memories = new Map(); this.grid = null; this.clock = 0; this.revision = 0; this.cursor = 0; }

  step(snapshot) {
    if (snapshot.grid) { this.grid = snapshot.grid; this.revision++; }
    const grid = this.grid;
    if (!grid) return { seq: snapshot.seq, actors: [], paths: 0 };
    this.clock += Math.max(0, Math.min(1, snapshot.dt || 0.125));
    const now = this.clock, player = snapshot.player;
    const actors = snapshot.zombies.filter(z => z.health > 0);
    const alive = new Set(actors.map(z => z.id));
    for (const id of this.memories.keys()) if (!alive.has(id)) this.memories.delete(id);
    const buckets = new Map(), senses = new Map();
    const bucketKey = (x, y) => `${Math.floor(x / 4)},${Math.floor(y / 4)}`;
    const hour = (snapshot.time || 720) / 60;
    const dark = hour < 6 || hour >= 20;
    const sightRange = (dark ? 7 : 11) * (snapshot.weather?.type === 'fog' ? 0.68 : 1);
    const rain = snapshot.weather?.type === 'rain' || snapshot.weather?.type === 'storm';
    const noise = Math.max(0, snapshot.noise || 0) * (rain ? 0.78 : 1);
    for (const zombie of actors) {
      const key = bucketKey(zombie.x, zombie.y);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(zombie);
      const dx = player.x - zombie.x, dy = player.y - zombie.y, distance = Math.hypot(dx, dy);
      const facing = ((zombie.dirX || 0) * dx + (zombie.dirY || 0) * dy) / (distance || 1);
      const visible = distance < sightRange && (distance < 2.8 || facing > -0.28 || zombie.mode === 'chase') &&
        lineOfSight(grid, zombie.x, zombie.y, player.x, player.y);
      const heard = noise > 0 && distance < noise * (visible ? 1 : 0.7);
      senses.set(zombie.id, { visible, heard, distance });
    }
    const results = [];
    let paths = 0;
    // Rotate priority so large crowds share the bounded pathfinding budget fairly.
    const ordered = actors.slice(this.cursor).concat(actors.slice(0, this.cursor));
    this.cursor = actors.length ? (this.cursor + 7) % actors.length : 0;
    for (const zombie of ordered) {
      let mem = this.memories.get(zombie.id);
      if (!mem) {
        mem = { until: 0, target: null, path: [], repath: 0, wanderAt: now + hash(zombie.id) * 4, random: 0 };
        this.memories.set(zombie.id, mem);
      }
      const sense = senses.get(zombie.id);
      let alarm = false;
      if (!sense.visible && !sense.heard) {
        const bx = Math.floor(zombie.x / 4), by = Math.floor(zombie.y / 4);
        for (let ox = -1; ox <= 1 && !alarm; ox++) for (let oy = -1; oy <= 1 && !alarm; oy++) {
          for (const neighbor of buckets.get(`${bx + ox},${by + oy}`) || []) {
            if (neighbor.id !== zombie.id && senses.get(neighbor.id).visible &&
              Math.hypot(neighbor.x - zombie.x, neighbor.y - zombie.y) < 4.5 &&
              lineOfSight(grid, zombie.x, zombie.y, neighbor.x, neighbor.y)) { alarm = true; break; }
          }
        }
      }
      if (sense.visible || sense.heard || alarm) {
        mem.target = { x: player.x, y: player.y };
        mem.until = now + (sense.visible ? 8 : 5);
        mem.alert = sense.visible || alarm || (mem.alert && now < mem.until);
      }
      const pursuing = mem.target && now < mem.until;
      let mode = pursuing ? (mem.alert ? 'chase' : 'wander') : 'idle';
      const canAttack = sense.visible && sense.distance < 0.96 &&
        clearPassage(grid, zombie.x, zombie.y, player.x, player.y, 0.12);
      if (canAttack) mode = 'attack';
      if (!pursuing && now >= mem.wanderAt) {
        const rand = hash((Number(zombie.id) || 19) * 131 + ++mem.random * 997);
        const angle = rand * Math.PI * 2, distance = 1.4 + hash(mem.random * 41) * 3.5;
        const target = { x: Math.floor(zombie.x + Math.cos(angle) * distance) + 0.5,
          y: Math.floor(zombie.y + Math.sin(angle) * distance) + 0.5 };
        mem.wander = blocked(grid, target.x, target.y) ? null : target;
        mem.wanderUntil = now + 5;
        mem.wanderAt = now + 6 + rand * 8;
        mem.path = []; mem.repath = 0;
      }
      const target = pursuing ? mem.target : now < mem.wanderUntil ? mem.wander : null;
      let vx = 0, vy = 0;
      if (target && mode !== 'attack' && Math.hypot(target.x - zombie.x, target.y - zombie.y) > 0.25) {
        if (mode === 'idle') mode = 'wander';
        let waypoint = null;
        if (clearPassage(grid, zombie.x, zombie.y, target.x, target.y)) {
          waypoint = target; mem.path = [];
        } else {
          const goalKey = `${Math.floor(target.x)},${Math.floor(target.y)}`;
          if (paths < 7 && (now >= mem.repath || mem.goalKey !== goalKey)) {
            mem.path = findPath(grid, zombie.x, zombie.y, target.x, target.y);
            mem.goalKey = goalKey; mem.repath = now + 0.65 + hash(zombie.id) * 0.6; paths++;
          }
          while (mem.path.length && Math.hypot(mem.path[0].x - zombie.x, mem.path[0].y - zombie.y) < 0.24) mem.path.shift();
          waypoint = mem.path[0];
          // A closed door may invalidate a cached path before its normal refresh.
          if (waypoint && blocked(grid, waypoint.x, waypoint.y)) { mem.path = []; mem.repath = 0; waypoint = null; }
        }
        if (waypoint) {
          const dx = waypoint.x - zombie.x, dy = waypoint.y - zombie.y, distance = Math.hypot(dx, dy) || 1;
          const speed = (mode === 'chase' ? 0.76 : 0.3) * (0.82 + hash(zombie.id) * 0.36);
          vx = dx / distance * speed; vy = dy / distance * speed;
          // Local separation stops a crowd from collapsing into one silhouette.
          const bx = Math.floor(zombie.x / 4), by = Math.floor(zombie.y / 4);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            for (const other of buckets.get(`${bx + ox},${by + oy}`) || []) {
              if (other.id === zombie.id) continue;
              const sx = zombie.x - other.x, sy = zombie.y - other.y, d = Math.hypot(sx, sy);
              if (d > 0.001 && d < 0.57) { vx += sx / d * (0.57 - d) * 0.8; vy += sy / d * (0.57 - d) * 0.8; }
            }
          }
          const speedNow = Math.hypot(vx, vy);
          if (speedNow > speed * 1.2) { vx *= speed * 1.2 / speedNow; vy *= speed * 1.2 / speedNow; }
        }
      }
      const aimX = mode === 'attack' ? player.x - zombie.x : vx;
      const aimY = mode === 'attack' ? player.y - zombie.y : vy;
      const aimLength = Math.hypot(aimX, aimY) || 1;
      results.push({ id: zombie.id, mode, vx, vy, canAttack, dirX: aimX / aimLength, dirY: aimY / aimLength });
    }
    return { seq: snapshot.seq, actors: results, paths };
  }
}
