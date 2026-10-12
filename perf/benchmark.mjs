/** Node-only diagnostic. No hardware-sensitive timing assertions. */
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import { World } from '../world/generator.js';
import { ZombieSimulation } from '../workers/simulation.js';

const percentile = (times, p) => [...times].sort((a, b) => a - b)[Math.ceil(times.length * p) - 1];
const world = new World(74219), updates = [], queries = [];
let maxChunks = 0, visibleProps = 0;
for (let i = 0; i < 60; i++) {
  const x = 7.5 + i * 8, y = 7.5 + i * 4;
  let start = performance.now(); world.update(x, y); updates.push(performance.now() - start);
  start = performance.now(); world.getVisibleTiles(x, y, 24); visibleProps = world.getProps(x, y, 24).length;
  queries.push(performance.now() - start); world.update(x, y); maxChunks = Math.max(maxChunks, world.chunks.size);
}
const grid = { x: 0, y: 0, width: 65, height: 65, cells: new Uint8Array(65 * 65) };
for (let y = 0; y < 50; y++) grid.cells[y * 65 + 32] = 1;
const sim = new ZombieSimulation(), ai = [];
let maxPaths = 0;
for (let i = 0; i < 60; i++) {
  const start = performance.now();
  const result = sim.step({ seq: i, dt: .125, grid: i === 0 ? grid : undefined,
    player: { x: 35.5, y: 30.5 }, noise: 25, time: 720, weather: { type: 'clear' },
    zombies: Array.from({ length: 100 }, (_, id) => ({ id, x: 29.5 - id % 5, y: 25.5 + Math.floor(id / 5) * .5, dirX: 1, dirY: 0, health: 100 })) });
  ai.push(performance.now() - start); maxPaths = Math.max(maxPaths, result.paths);
}
console.log(JSON.stringify({
  node: process.version, cpu: cpus()[0]?.model, logicalCPUs: cpus().length, memoryMB: Math.round(totalmem() / 1048576),
  note: 'Node timings exclude browser rendering and are diagnostic, not device-independent budgets.',
  world: { samples: updates.length, updateP50Ms: percentile(updates, .5), updateP95Ms: percentile(updates, .95), queryP95Ms: percentile(queries, .95), maxRetainedChunks: maxChunks, finalVisibleProps: visibleProps },
  ai: { actors: 100, samples: ai.length, p50Ms: percentile(ai, .5), p95Ms: percentile(ai, .95), maxPathsPerStep: maxPaths },
}, null, 2));
