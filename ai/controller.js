const STEP = 0.125;
const ACTIVE_RADIUS = 30;

/** Worker computes decisions; the main thread integrates validated movement. */
export class AIController {
  constructor(world) {
    this.world = world;
    this.worker = null;
    this.commands = new Map();
    this.pending = false;
    this.pendingFor = 0;
    this.sinceStep = STEP;
    this.sinceGrid = 1;
    this.sequence = 0;
    this.lastApplied = 0;
    this.gridCenter = null;
    this.destroyed = false;
    this.workerError = null;
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('../workers/aiWorker.js', import.meta.url), { type: 'module', name: 'deadfall-ai' });
        this.worker.onmessage = ({ data }) => {
          this.pending = false; this.pendingFor = 0;
          if (data.type === 'error') { this.failWorker(data.message); return; }
          if (data.type !== 'result' || data.seq < this.lastApplied || this.destroyed) return;
          this.lastApplied = data.seq;
          this.commands = new Map(data.actors.map(actor => [actor.id, actor]));
          this.paths = data.paths;
        };
        this.worker.onerror = event => { event.preventDefault?.(); this.failWorker(event.message || 'Worker unavailable'); };
        this.worker.onmessageerror = () => this.failWorker('Invalid AI worker response');
      }
    } catch (error) { this.failWorker(error.message); }
  }

  failWorker(message) {
    this.worker?.terminate(); this.worker = null;
    this.pending = false; this.commands.clear(); this.workerError = message;
    // Direct collision-aware steering is still playable where module workers are blocked.
    // This fallback does not perform pathfinding on the main thread.
  }

  rasterize(player) {
    const radius = 32, width = radius * 2 + 1;
    const x = Math.floor(player.x) - radius, y = Math.floor(player.y) - radius;
    const cells = new Uint8Array(width * width);
    for (let row = 0; row < width; row++) for (let col = 0; col < width; col++) {
      cells[row * width + col] = this.world.isBlocked(x + col + 0.5, y + row + 0.5) ? 1 : 0;
    }
    this.gridCenter = { x: player.x, y: player.y };
    this.sinceGrid = 0;
    return { x, y, width, height: width, cells };
  }

  clear(x, y, radius = 0.2) {
    return !this.world.isBlocked(x - radius, y - radius) && !this.world.isBlocked(x + radius, y - radius) &&
      !this.world.isBlocked(x - radius, y + radius) && !this.world.isBlocked(x + radius, y + radius);
  }

  rayClear(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 5);
    for (let i = 1; i <= steps; i++) {
      if (!this.clear(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, 0.08)) return false;
    }
    return true;
  }

  fallback(state, zombies) {
    const p = state.player;
    for (const z of zombies) {
      const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy);
      const aware = d < 9 || d < (state.noise || 0);
      const clear = aware && this.rayClear(z.x, z.y, p.x, p.y);
      const attack = clear && d < 0.96;
      this.commands.set(z.id, { id: z.id, mode: attack ? 'attack' : clear ? 'chase' : 'idle',
        vx: clear && !attack ? dx / (d || 1) * 0.72 : 0,
        vy: clear && !attack ? dy / (d || 1) * 0.72 : 0,
        dirX: dx / (d || 1), dirY: dy / (d || 1), canAttack: attack });
    }
  }

  update(state, dt) {
    if (this.destroyed || state.paused || state.dead || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = state.player;
    const active = state.zombies.filter(z => z.health > 0 && Math.hypot(z.x - p.x, z.y - p.y) <= ACTIVE_RADIUS);
    this.sinceStep += dt; this.sinceGrid += dt;
    if (this.pending) {
      this.pendingFor += dt;
      if (this.pendingFor > 3) this.failWorker('AI worker response timed out');
    }
    if (this.sinceStep >= STEP && !this.pending) {
      const stepDt = Math.min(this.sinceStep, 0.5);
      this.sinceStep = 0;
      if (this.worker) {
        const moved = this.gridCenter && Math.hypot(p.x - this.gridCenter.x, p.y - this.gridCenter.y) > 3;
        const grid = !this.gridCenter || this.sinceGrid >= 0.5 || moved ? this.rasterize(p) : undefined;
        const snapshot = { type: 'step', seq: ++this.sequence, dt: stepDt, grid,
          player: { x: p.x, y: p.y }, time: state.time, noise: state.noise || 0,
          weather: { type: state.weather?.type },
          zombies: active.map(z => ({ id: z.id, x: z.x, y: z.y, health: z.health,
            mode: z.mode, dirX: z.dirX, dirY: z.dirY })) };
        this.pending = true; this.pendingFor = 0;
        try { this.worker.postMessage(snapshot, grid ? [grid.cells.buffer] : []); }
        catch (error) { this.failWorker(error.message); this.fallback(state, active); }
      } else this.fallback(state, active);
    }
    for (const z of state.zombies) {
      if (z.health <= 0) { z.vx = z.vy = 0; z.canAttack = false; continue; }
      if (Math.hypot(z.x - p.x, z.y - p.y) > ACTIVE_RADIUS) { z.canAttack = false; z.vx = z.vy = 0; continue; }
      const command = this.commands.get(z.id);
      if (!command) continue;
      z.mode = command.mode;
      // Revalidate close attacks against the current door state, between worker snapshots.
      z.canAttack = command.canAttack && this.rayClear(z.x, z.y, p.x, p.y);
      const stagger = z.hitTimer > 0 ? 0.18 : 1;
      z.vx = command.vx * stagger; z.vy = command.vy * stagger;
      const kx = z.knockbackX || 0, ky = z.knockbackY || 0;
      const dx = (z.vx + kx) * dt, dy = (z.vy + ky) * dt;
      // Axis separation permits sliding along walls; small substeps prevent tunneling.
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.12));
      for (let i = 0; i < steps; i++) {
        if (this.clear(z.x + dx / steps, z.y)) z.x += dx / steps;
        if (this.clear(z.x, z.y + dy / steps)) z.y += dy / steps;
      }
      z.knockbackX = kx * Math.exp(-12 * dt); z.knockbackY = ky * Math.exp(-12 * dt);
      if (Math.hypot(command.dirX, command.dirY) > 0.1) { z.dirX = command.dirX; z.dirY = command.dirY; }
    }
    state.ai = { worker: !!this.worker, active: active.length, paths: this.paths || 0,
      ...(this.workerError ? { error: this.workerError } : {}) };
  }

  destroy() {
    this.destroyed = true;
    this.worker?.terminate(); this.worker = null;
    this.commands.clear(); this.pending = false;
  }
}
