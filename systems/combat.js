export const WEAPONS = Object.freeze({
  unarmed: { name: 'Shove', range: 1.15, damage: 12, stamina: 6, cooldown: 0.55, arc: 0.25, knockback: 3.2, targets: 1, noise: 3 },
  bat: { name: 'Baseball bat', range: 1.75, damage: 36, stamina: 9, cooldown: 0.58, arc: 0.2, knockback: 2.7, targets: 2, noise: 6 },
  axe: { name: 'Fire axe', range: 1.6, damage: 57, stamina: 15, cooldown: 0.82, arc: 0.35, knockback: 1.8, targets: 2, noise: 7 },
  pistol: { name: 'Pistol', range: 13, damage: 62, stamina: 3, cooldown: 0.42, arc: 0.965, knockback: 1.1, targets: 1, noise: 32, ranged: true },
});

function random(value) {
  let x = Math.imul((value | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ x >>> 13, 0xc2b2ae35);
  return ((x ^ x >>> 16) >>> 0) / 4294967296;
}

function addParticle(state, particle) {
  state.particles ||= [];
  if (state.particles.length >= 220) state.particles.shift();
  state.particles.push(particle);
}

function blood(state, x, y, dx, dy, count, seed) {
  for (let i = 0; i < count; i++) {
    const angle = random(seed + i * 37) * Math.PI * 2;
    const speed = 0.5 + random(seed + i * 41) * 1.8;
    const life = 0.35 + random(seed + i * 43) * 0.65;
    addParticle(state, { type: 'blood', x, y, z: 0.55, vx: Math.cos(angle) * speed + dx * 0.5,
      vy: Math.sin(angle) * speed + dy * 0.5, vz: 0.5 + random(seed + i) * 1.2,
      life, maxLife: life, size: 1.5 + random(seed + i * 13) * 2.5,
      color: i % 3 === 0 ? '#802b23' : '#57221d' });
  }
}

function clearShot(world, ax, ay, bx, by) {
  if (!world?.isBlocked) return true;
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 8));
  let lx = ax, ly = ay;
  for (let i = 1; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
    if (world.isBlocked(x, y)) return false;
    if (Math.floor(lx) !== Math.floor(x) && Math.floor(ly) !== Math.floor(y) &&
      (world.isBlocked(x, ly) || world.isBlocked(lx, y))) return false;
    lx = x; ly = y;
  }
  return true;
}

/** Resolve a deliberate swing or shot, with optional world-coordinate aiming. */
export function attack(state, world, target) {
  const p = state.player, miss = { hit: false, killed: 0 };
  if (state.paused || state.dead || p.health <= 0 || (p.attackCooldown || 0) > 0) return miss;
  const owned = (p.inventory || []).some(item => item.id === p.equipped && item.qty > 0);
  const weaponId = owned && WEAPONS[p.equipped] ? p.equipped : 'unarmed';
  const weapon = WEAPONS[weaponId];
  if ((p.stamina ?? 100) < weapon.stamina * 0.45) return { ...miss, message: 'Too exhausted. Back away and catch your breath.' };
  let ammo;
  if (weapon.ranged) {
    ammo = p.inventory.find(item => item.id === 'ammo' && item.qty > 0);
    if (!ammo) return { ...miss, message: 'No ammunition. Equip a melee weapon.' };
  }
  if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
    const dx = target.x - p.x, dy = target.y - p.y, length = Math.hypot(dx, dy);
    if (length > 0.01) { p.dirX = dx / length; p.dirY = dy / length; }
  }
  let dirX = p.dirX || 0, dirY = p.dirY || 0;
  const facingLength = Math.hypot(dirX, dirY);
  if (facingLength < 0.01) dirX = 1;
  else { dirX /= facingLength; dirY /= facingLength; }
  const fatigue = 0.63 + Math.min(100, p.stamina ?? 100) * 0.0037;
  p.stamina = Math.max(0, (p.stamina ?? 100) - weapon.stamina);
  p.attackCooldown = weapon.cooldown * ((p.energy ?? 100) < 15 ? 1.25 : 1);
  p.attackDuration = weapon.ranged ? 0.15 : 0.28;
  p.attackTimer = p.attackDuration;
  p.attackWeapon = weaponId;
  p.attackCount = (p.attackCount || 0) + 1;
  p.resting = false;
  state.noise = Math.max(state.noise || 0, weapon.noise);
  state.lastAttack = { x: p.x, y: p.y, dirX, dirY, weapon: weaponId, range: weapon.range,
    ttl: p.attackDuration, duration: p.attackDuration };
  if (ammo) {
    ammo.qty--;
    p.inventory = p.inventory.filter(item => item.qty > 0);
    addParticle(state, { type: 'muzzle', x: p.x + dirX * 0.45, y: p.y + dirY * 0.45,
      z: 0.72, life: 0.09, maxLife: 0.09, size: 8, color: '#ffe4a3', vx: 0, vy: 0, vz: 0 });
  }
  const candidates = [];
  for (const z of state.zombies || []) {
    if (z.health <= 0) continue;
    const dx = z.x - p.x, dy = z.y - p.y, distance = Math.hypot(dx, dy);
    if (distance > weapon.range) continue;
    const facing = distance < 0.05 ? 1 : (dx * dirX + dy * dirY) / distance;
    // The pistol has a narrow reticle; melee attacks sweep a broad forward arc.
    const aim = weapon.ranged ? facing >= weapon.arc && Math.abs(dx * dirY - dy * dirX) < 0.4 : facing >= weapon.arc;
    if (!aim || !clearShot(world, p.x, p.y, z.x, z.y)) continue;
    candidates.push({ z, distance, facing });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  let killed = 0, hits = 0;
  for (const { z, distance } of candidates.slice(0, weapon.targets)) {
    const seed = (state.seed || 74219) + p.attackCount * 941 + (Number(z.id) || 0);
    const skill = Math.min(12, Math.max(0, p.skills?.strength || 0) / 50);
    const sweep = hits > 0 ? 0.6 : 1;
    const falloff = weapon.ranged ? Math.max(0.68, 1 - distance * 0.018) : 1;
    const damage = Math.round((weapon.damage + skill) * fatigue * sweep * falloff * (0.93 + random(seed) * 0.14));
    z.health = Math.max(0, z.health - damage);
    z.hitTimer = 0.3;
    z.knockbackX = dirX * weapon.knockback;
    z.knockbackY = dirY * weapon.knockback;
    z.canAttack = false;
    z.attackCooldown = Math.max(z.attackCooldown || 0, 0.45);
    blood(state, z.x, z.y, dirX, dirY, z.health <= 0 ? 12 : 7, seed);
    if (z.health <= 0) {
      killed++;
      z.mode = 'idle'; z.vx = z.vy = 0; z.deathTimer = 0;
      z.deathDirection = Math.atan2(dirY, dirX);
      p.kills = (p.kills || 0) + 1;
    }
    hits++;
  }
  if (hits) {
    p.skills ||= { strength: 0, fitness: 0, crafting: 0 };
    p.skills.strength = (p.skills.strength || 0) + hits * 0.8;
  }
  return { hit: hits > 0, killed, ...(killed ? { message: killed > 1 ? `${killed} infected put down.` : 'Infected put down.' } : {}) };
}

/** Advance attack feedback, enemy strikes, noise, and short-lived particles. */
export function updateCombat(state, dt) {
  if (state.paused || state.dead || !Number.isFinite(dt) || dt <= 0) return;
  const p = state.player;
  for (const key of ['attackCooldown', 'attackTimer', 'hurtCooldown', 'hurtTimer']) p[key] = Math.max(0, (p[key] || 0) - dt);
  state.noise = Math.max(0, (state.noise || 0) - dt * 4.5);
  if (state.lastAttack) {
    state.lastAttack.ttl -= dt;
    if (state.lastAttack.ttl <= 0) delete state.lastAttack;
  }
  for (const z of state.zombies || []) {
    z.hitTimer = Math.max(0, (z.hitTimer || 0) - dt);
    z.attackTimer = Math.max(0, (z.attackTimer || 0) - dt);
    z.attackCooldown = Math.max(0, (z.attackCooldown || 0) - dt);
    if (z.health <= 0) { z.deathTimer = (z.deathTimer || 0) + dt; continue; }
    if (z.mode !== 'attack' || z.canAttack === false || z.attackCooldown > 0 || z.hitTimer > 0.12 ||
      Math.hypot(z.x - p.x, z.y - p.y) > 1.05) continue;
    z.attackCooldown = 1.5 + random(Number(z.id) || 13) * 0.45;
    z.attackTimer = 0.32;
    if (p.hurtCooldown > 0 || p.health <= 0) continue;
    p.damageEvents = (p.damageEvents || 0) + 1;
    const seed = (state.seed || 74219) + p.damageEvents * 491 + (Number(z.id) || 13);
    const roll = random(seed);
    const damage = 7 + Math.floor(random(seed + 71) * 6);
    p.health = Math.max(0, p.health - damage);
    p.hurtCooldown = 0.48;
    p.hurtTimer = 0.42;
    if (roll < 0.38) p.bleeding = Math.min(100, (p.bleeding || 0) + 7 + Math.floor(roll * 20));
    if (roll < 0.035) p.infection = Math.min(100, (p.infection || 0) + 6);
    blood(state, p.x, p.y, p.x - z.x, p.y - z.y, 6, seed);
    p.resting = false;
  }
  if (p.health <= 0) { p.health = 0; state.dead = true; }
  const particles = state.particles || [];
  let write = 0;
  for (const particle of particles) {
    particle.life = (particle.life ?? 0.5) - dt;
    if (particle.life <= 0) continue;
    particle.x += (particle.vx || 0) * dt;
    particle.y += (particle.vy || 0) * dt;
    if (Number.isFinite(particle.z)) {
      particle.z = Math.max(0, particle.z + (particle.vz || 0) * dt);
      if (particle.type === 'blood' || particle.type === 'dust') particle.vz = (particle.vz || 0) - dt * 4;
      if (particle.z === 0) { particle.vx = 0; particle.vy = 0; particle.vz = 0; }
    }
    particles[write++] = particle;
  }
  particles.length = write;
}
