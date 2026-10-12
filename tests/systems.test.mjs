import test from 'node:test';
import assert from 'node:assert/strict';
import { updateNeeds } from '../systems/needs.js';
import { updateWeather } from '../systems/weather.js';
import { attack, updateCombat } from '../systems/combat.js';
import { makeState, makeZombie, emptyWorld } from './fixtures.mjs';

test('needs deplete with time, sprinting costs more, and depleted needs cause bounded damage', () => {
  const idle = makeState(), sprint = makeState();
  sprint.player.moving = true; sprint.player.running = true;
  for (let i = 0; i < 60; i++) { updateNeeds(idle, 1); updateNeeds(sprint, 1); }
  assert.ok(idle.player.thirst < 82 && idle.player.hunger < 86);
  assert.ok(sprint.player.thirst < idle.player.thirst);
  assert.ok(sprint.player.stamina < idle.player.stamina);
  const depleted = makeState(); depleted.player.hunger = depleted.player.thirst = 0; depleted.player.bleeding = 40;
  updateNeeds(depleted, 10); assert.ok(depleted.player.health < 100);
  updateNeeds(depleted, 100000); assert.equal(depleted.player.health, 0); assert.equal(depleted.dead, true);
  for (const k of ['health', 'hunger', 'thirst', 'energy', 'stamina', 'bleeding', 'infection']) assert.ok(depleted.player[k] >= 0 && depleted.player[k] <= 100);
});

test('paused/dead simulations freeze and day rollover handles midnight', () => {
  for (const flag of ['paused', 'dead']) {
    const state = makeState({ [flag]: true }), before = JSON.stringify(state);
    updateNeeds(state, 60); updateWeather(state, 60); updateCombat(state, 60);
    assert.equal(JSON.stringify(state), before);
  }
  const a = makeState({ time: 1439 }), b = makeState({ time: 1439 });
  updateWeather(a, 1); updateWeather(b, 1);
  assert.equal(a.day, 2); assert.equal(a.time, 4); assert.deepEqual(a.weather, b.weather);
});

test('melee damages in front, respects walls and cooldown, and counts a kill once', () => {
  const state = makeState({ zombies: [makeZombie({ health: 10 }), makeZombie({ id: 3, x: 6.7 })] });
  const first = attack(state, emptyWorld);
  assert.equal(first.hit, true); assert.equal(first.killed, 1); assert.equal(state.player.kills, 1);
  assert.equal(state.zombies[1].health, 100, 'target behind survivor is outside swing');
  assert.equal(attack(state, emptyWorld).hit, false);
  assert.equal(state.player.kills, 1);
  const blocked = makeState({ zombies: [makeZombie({ x: 8.6 })] });
  assert.equal(attack(blocked, { isBlocked: x => x >= 8 && x < 8.4 }).hit, false);
  assert.equal(blocked.zombies[0].health, 100);
});

test('ranged attacks require and consume ammunition, generate noise, and clear feedback', () => {
  const state = makeState({ zombies: [makeZombie({ x: 12.5 })] });
  state.player.equipped = 'pistol'; state.player.inventory.push({ id: 'pistol', qty: 1 });
  assert.match(attack(state, emptyWorld).message, /ammunition/);
  state.player.inventory.push({ id: 'ammo', qty: 1 });
  assert.equal(attack(state, emptyWorld).hit, true);
  assert.equal(state.player.inventory.some(i => i.id === 'ammo'), false);
  assert.ok(state.noise >= 30); assert.ok(state.particles.length > 0);
  for (let i = 0; i < 120; i++) updateCombat(state, 1 / 60);
  assert.equal(state.particles.length, 0); assert.equal(state.player.attackCooldown, 0);
});

test('enemy strikes have cooldowns and cannot damage when current collision blocks attacks', () => {
  const state = makeState({ zombies: [makeZombie({ mode: 'attack', canAttack: true })] });
  updateCombat(state, 1 / 60); const health = state.player.health;
  assert.ok(health < 100);
  updateCombat(state, 1 / 60); assert.equal(state.player.health, health);
  state.zombies[0].attackCooldown = 0; state.zombies[0].canAttack = false; state.player.hurtCooldown = 0;
  updateCombat(state, 1 / 60); assert.equal(state.player.health, health);
});
