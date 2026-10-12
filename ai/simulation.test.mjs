import test from 'node:test';
import assert from 'node:assert/strict';
import { AIController } from './controller.js';
import { ZombieSimulation } from '../workers/simulation.js';
import { attack, updateCombat } from '../systems/combat.js';
import { updateNeeds } from '../systems/needs.js';
import { updateWeather } from '../systems/weather.js';

function state() {
  return { seed: 74219, day: 1, time: 540, elapsed: 0, paused: false, dead: false,
    weather: { type: 'overcast', intensity: 0.25, temperature: 16 }, noise: 0,
    player: { id: 1, x: 2.5, y: 2.5, health: 100, dirX: 1, dirY: 0,
      stamina: 100, energy: 100, hunger: 86, thirst: 82, bleeding: 0, infection: 0,
      equipped: 'bat', inventory: [{ id: 'bat', qty: 1 }], skills: { strength: 0, fitness: 0 }, kills: 0 },
    zombies: [], particles: [] };
}
function zombie(overrides = {}) {
  return { id: 101, x: 3.5, y: 2.5, dirX: -1, dirY: 0, health: 80, mode: 'idle', attackCooldown: 0, ...overrides };
}
const openWorld = { isBlocked: () => false };

test('melee sweep obeys facing, reach, cooldown and one-time kill credit', () => {
  const s = state();
  const front = zombie({ health: 1 }), back = zombie({ id: 102, x: 1.5 }), far = zombie({ id: 103, x: 8 });
  s.zombies = [front, back, far];
  assert.deepEqual(attack(s, openWorld), { hit: true, killed: 1, message: 'Infected put down.' });
  assert.equal(back.health, 80); assert.equal(far.health, 80); assert.equal(s.player.kills, 1);
  const stamina = s.player.stamina;
  assert.equal(attack(s, openWorld).hit, false); assert.equal(s.player.stamina, stamina);
  updateCombat(s, 1);
  assert.equal(attack(s, openWorld).hit, false); assert.equal(s.player.kills, 1);
});

test('a wall prevents both melee and pistol hits', () => {
  const world = { isBlocked: (x, y) => Math.floor(x) === 3 && Math.floor(y) === 2 };
  for (const weapon of ['bat', 'pistol']) {
    const s = state(); s.player.equipped = weapon;
    s.player.inventory = [{ id: weapon, qty: 1 }, { id: 'ammo', qty: 3 }];
    s.zombies = [zombie({ x: 4.1 })];
    assert.equal(attack(s, world).hit, false); assert.equal(s.zombies[0].health, 80);
  }
});

test('pistol consumes one round, hits nearest target, and makes loud noise', () => {
  const s = state(); s.player.equipped = 'pistol';
  s.player.inventory = [{ id: 'pistol', qty: 1 }, { id: 'ammo', qty: 1 }];
  s.zombies = [zombie({ x: 6 }), zombie({ id: 102, x: 9 })];
  assert.equal(attack(s, openWorld).hit, true);
  assert.ok(s.zombies[0].health < 80); assert.equal(s.zombies[1].health, 80);
  assert.equal(s.player.inventory.some(item => item.id === 'ammo'), false);
  assert.equal(s.noise, 32);
  updateCombat(s, 1);
  assert.match(attack(s, openWorld).message, /ammunition/);
});

test('explicit aim changes direction while stamina prevents exhausted attacks', () => {
  const s = state(); s.zombies = [zombie({ x: 2.5, y: 3.5 })];
  assert.equal(attack(s, openWorld, { x: 2.5, y: 6 }).hit, true);
  assert.equal(s.player.dirX, 0); assert.equal(s.player.dirY, 1);
  updateCombat(s, 1); s.player.stamina = 0;
  const health = s.zombies[0].health;
  assert.match(attack(s, openWorld).message, /exhausted/); assert.equal(s.zombies[0].health, health);
});

test('enemy strikes require range and attack permission and respect invulnerability', () => {
  const s = state();
  s.zombies = [zombie({ x: 3.1, mode: 'attack', canAttack: false })];
  updateCombat(s, 0.016); assert.equal(s.player.health, 100);
  s.zombies[0].canAttack = true;
  s.zombies.push(zombie({ id: 102, x: 2.9, mode: 'attack', canAttack: true }));
  updateCombat(s, 0.016);
  assert.ok(s.player.health >= 88 && s.player.health <= 93);
  const health = s.player.health;
  updateCombat(s, 0.016); assert.equal(s.player.health, health);
});

test('fatal enemy damage sets death and expired feedback is removed', () => {
  const s = state(); s.player.health = 1;
  s.zombies = [zombie({ x: 3.1, mode: 'attack', canAttack: true })];
  updateCombat(s, 0.016); assert.equal(s.dead, true); assert.equal(s.player.health, 0);
  const t = state(); t.particles = [{ x: 0, y: 0, life: 0.1 }]; t.lastAttack = { ttl: 0.1 };
  updateCombat(t, 0.2); assert.equal(t.particles.length, 0); assert.equal(t.lastAttack, undefined);
});

test('running drains stamina and hydration faster; standing restores stamina', () => {
  const rest = state(), run = state(); run.player.moving = true; run.player.running = true;
  updateNeeds(rest, 5); updateNeeds(run, 5);
  assert.ok(run.player.stamina < rest.player.stamina);
  assert.ok(run.player.thirst < rest.player.thirst);
  run.player.running = false; run.player.moving = false;
  const stamina = run.player.stamina; updateNeeds(run, 1); assert.ok(run.player.stamina > stamina);
  assert.ok(run.player.stamina <= 100);
});

test('bleeding and unmet needs are harmful and pause freezes all systems', () => {
  const s = state(); s.player.bleeding = 30; s.player.hunger = s.player.thirst = 0;
  updateNeeds(s, 5); assert.ok(s.player.health < 100);
  s.paused = true;
  const before = JSON.stringify(s);
  updateNeeds(s, 10); updateCombat(s, 10); updateWeather(s, 10); attack(s, openWorld);
  assert.equal(JSON.stringify(s), before);
});

test('needs do not duplicate rest health/energy bonuses and always bound values', () => {
  const s = state(); Object.assign(s.player, { resting: true, health: 70, energy: 60, stamina: 90 });
  updateNeeds(s, 10);
  assert.equal(s.player.health, 70); assert.equal(s.player.energy, 60); assert.equal(s.player.stamina, 100);
  s.player.bleeding = 100; s.player.health = 0.01; updateNeeds(s, 1);
  assert.equal(s.dead, true); assert.equal(s.player.health, 0);
});

test('clock rolls across multiple days and deterministic weather survives serialization', () => {
  const a = state(); a.time = 1435;
  updateWeather(a, 2); assert.equal(a.time, 5); assert.equal(a.day, 2);
  const b = JSON.parse(JSON.stringify(a));
  updateWeather(a, 600); updateWeather(b, 600);
  assert.deepEqual(a.weather, b.weather); assert.equal(a.day, 4); assert.equal(a.time, 125);
  assert.ok(a.weather.intensity >= 0 && a.weather.intensity <= 1);
});

test('noise investigation routes around a closed wall and uses the opening', () => {
  const grid = { x: 0, y: 0, width: 12, height: 12, cells: new Uint8Array(144) };
  for (let y = 0; y < 12; y++) if (y !== 8) grid.cells[y * 12 + 5] = 1;
  const simulation = new ZombieSimulation();
  const z = zombie({ x: 3.5, y: 5.5, dirX: 1 });
  const first = simulation.step({ seq: 1, dt: 0.125, grid, player: { x: 7.5, y: 5.5 }, zombies: [z], time: 720, noise: 16 });
  assert.equal(first.actors[0].mode, 'wander'); assert.equal(first.actors[0].canAttack, false);
  assert.ok(first.paths > 0);
  for (let i = 0; i < 400; i++) {
    const command = simulation.step({ seq: i + 2, dt: 0.125, player: { x: 7.5, y: 5.5 }, zombies: [z], time: 720, noise: 16 }).actors[0];
    z.mode = command.mode; z.dirX = command.dirX; z.dirY = command.dirY;
    z.x += command.vx * 0.125; z.y += command.vy * 0.125;
    assert.equal(grid.cells[Math.floor(z.y) * 12 + Math.floor(z.x)], 0, 'route enters a blocked tile');
  }
  assert.ok(Math.hypot(z.x - 7.5, z.y - 5.5) < 1.1);
});

test('controller fallback preserves player position and respects a closing door', () => {
  let closed = false;
  const world = { isBlocked: (x, y) => closed && Math.floor(x) === 3 && Math.floor(y) === 2 };
  const ai = new AIController(world), s = state();
  s.player.x = 4.5; s.zombies = [zombie({ x: 2.5 })];
  for (let i = 0; i < 3; i++) ai.update(s, 0.1);
  assert.ok(s.zombies[0].x > 2.5); assert.equal(s.player.x, 4.5);
  closed = true;
  for (let i = 0; i < 60; i++) ai.update(s, 0.1);
  assert.ok(s.zombies[0].x < 2.81); assert.equal(s.zombies[0].canAttack, false);
  ai.destroy(); const x = s.zombies[0].x; ai.update(s, 1); assert.equal(s.zombies[0].x, x);
});

test('stale worker decisions cannot move through a newly closed door', () => {
  const s = state(); s.player.x = 5.5; s.zombies = [zombie({ x: 2.7 })];
  const world = { isBlocked: x => Math.floor(x) === 3 };
  const ai = new AIController(world);
  ai.worker = { postMessage() {}, terminate() {} }; ai.sinceStep = 0; ai.sinceGrid = 0;
  ai.commands.set(101, { id: 101, mode: 'chase', vx: 0.9, vy: 0, dirX: 1, dirY: 0, canAttack: false });
  for (let i = 0; i < 15; i++) ai.update(s, 0.1);
  assert.ok(s.zombies[0].x < 2.81); assert.equal(s.player.x, 5.5);
  ai.destroy();
});

test('a visible alerted neighbor recruits a zombie facing away from the survivor', () => {
  const grid = { x: 0, y: 0, width: 12, height: 12, cells: new Uint8Array(144) };
  const player = { x: 8.5, y: 5.5 };
  const facingAway = zombie({ id: 101, x: 3.5, y: 5.5, dirX: -1 });
  const lookout = zombie({ id: 102, x: 5.5, y: 5.5, dirX: 1 });
  const alone = new ZombieSimulation().step({ seq: 1, grid, player, zombies: [facingAway], time: 720, noise: 0 });
  assert.notEqual(alone.actors[0].mode, 'chase');
  const group = new ZombieSimulation().step({ seq: 1, grid, player, zombies: [facingAway, lookout], time: 720, noise: 0 });
  assert.equal(group.actors.find(z => z.id === 101).mode, 'chase');
});

test('pursuit memory expires after losing both sight and sound', () => {
  const grid = { x: 0, y: 0, width: 20, height: 20, cells: new Uint8Array(400) };
  const sim = new ZombieSimulation(), z = zombie({ x: 3.5, y: 5.5, dirX: 1 });
  const first = sim.step({ seq: 1, grid, player: { x: 8.5, y: 5.5 }, zombies: [z], time: 720, noise: 0 });
  assert.equal(first.actors[0].mode, 'chase');
  let result;
  for (let i = 0; i < 10; i++) result = sim.step({ seq: i + 2, dt: 1, player: { x: 18.5, y: 18.5 }, zombies: [z], time: 720, noise: 0 });
  assert.notEqual(result.actors[0].mode, 'chase');
  assert.equal(result.actors[0].canAttack, false);
});
