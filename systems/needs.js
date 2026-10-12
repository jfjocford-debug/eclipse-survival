const clamp = value => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const positions = new WeakMap();

/** Rates are per real second; food/water matter over several in-game days. */
export function updateNeeds(state, dt) {
  if (state.paused || state.dead || !Number.isFinite(dt) || dt <= 0) return;
  const p = state.player;
  const last = positions.get(p);
  const measuredMovement = last && Math.hypot(p.x - last.x, p.y - last.y) > 0.001;
  positions.set(p, { x: p.x, y: p.y });
  const moving = p.moving ?? measuredMovement ?? false;
  const running = !!(p.running ?? state.running) && moving;
  const resting = !!p.resting && !moving;
  const exertion = running ? 1.9 : moving ? 1.2 : 1;
  const heat = Math.max(0, (state.weather?.temperature ?? 16) - 24) * 0.025;
  p.hunger = clamp((p.hunger ?? 100) - dt * 0.043 * exertion);
  p.thirst = clamp((p.thirst ?? 100) - dt * 0.065 * (exertion + heat));
  // The game owns rest energy/health bonuses so they are not applied twice.
  if (!resting) p.energy = clamp((p.energy ?? 100) - dt * (running ? 0.13 : moving ? 0.055 : 0.026));
  else p.energy = clamp(p.energy ?? 100);
  const fitness = Math.min(10, Math.max(0, p.skills?.fitness || 0) / 100);
  if (running) p.stamina = clamp((p.stamina ?? 100) - dt * Math.max(5.8, 9 - fitness * 0.25));
  else {
    const fed = p.hunger > 15 && p.thirst > 15 ? 1 : 0.45;
    const rested = p.energy > 15 ? 1 : 0.55;
    const recovering = (p.attackCooldown || 0) > 0 ? 0.15 : 1;
    const recovery = (resting ? 23 : moving ? 9 : 16) * fed * rested * recovering;
    p.stamina = clamp((p.stamina ?? 100) + dt * recovery);
  }
  p.bleeding = clamp(p.bleeding || 0);
  p.infection = clamp(p.infection || 0);
  let harm = p.bleeding * 0.009;
  if (p.hunger <= 0) harm += 0.085;
  if (p.thirst <= 0) harm += 0.22;
  if (p.infection > 0) {
    p.infection = clamp(p.infection + dt * 0.004);
    if (p.infection >= 45) harm += (p.infection - 40) * 0.0015;
  }
  p.health = clamp((p.health ?? 100) - harm * dt);
  p.exhausted = p.stamina < 10 || p.energy < 12;
  if (p.health <= 0) state.dead = true;
}
