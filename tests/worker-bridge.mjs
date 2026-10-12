// Browser-worker globals bridged to a real Node worker for protocol testing.
import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: data => parentPort.postMessage(data) };
await import('../workers/ai-worker.js');
parentPort.on('message', data => self.onmessage({ data }));
parentPort.postMessage({ type: 'ready' });
