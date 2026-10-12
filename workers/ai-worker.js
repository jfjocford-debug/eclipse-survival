import { ZombieSimulation } from './simulation.js';

const simulation = new ZombieSimulation();
self.onmessage = ({ data }) => {
  if (data.type !== 'step') return;
  try { self.postMessage({ type: 'result', ...simulation.step(data) }); }
  catch (error) { self.postMessage({ type: 'error', seq: data.seq, message: error.message }); }
};
