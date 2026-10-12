export function makeState(overrides = {}) {
  const state = {
    version: 1, seed: 74219, time: 540, day: 1, elapsed: 0, paused: false, dead: false,
    weather: { type: 'overcast', intensity: .25, temperature: 16 },
    player: { id: 1, x: 7.5, y: 7.5, dirX: 1, dirY: 0, health: 100, hunger: 86, thirst: 82, energy: 100, stamina: 100, bleeding: 0, infection: 0,
      inventory: [{ id: 'bat', qty: 1 }, { id: 'water', qty: 2 }, { id: 'beans', qty: 2 }, { id: 'bandage', qty: 2 }, { id: 'plank', qty: 4 }, { id: 'nails', qty: 8 }, { id: 'hammer', qty: 1 }], equipped: 'bat', skills: { strength: 0, fitness: 0, crafting: 0 }, kills: 0 },
    zombies: [], particles: [], messages: [], worldChanges: {},
    objectives: { looted: 0, crafted: 0, barricaded: 0 }, stats: { distance: 0 }, settings: { sound: true }, noise: 0,
  };
  return Object.assign(state, overrides);
}

export function makeZombie(overrides = {}) {
  return { id: 2, x: 8.2, y: 7.5, health: 100, mode: 'idle', dirX: -1, dirY: 0, attackCooldown: 0, ...overrides };
}

export const emptyWorld = { isBlocked: () => false, getNearby: () => [], getTile: (x, y) => ({ x: Math.floor(x), y: Math.floor(y), type: 'grass', blocked: false }) };
