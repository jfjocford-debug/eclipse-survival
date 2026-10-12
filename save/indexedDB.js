import { serialize, nextSavedAt, observeSavedAt } from './serializer.js';
import { deserialize, parsePayload, validateEnvelope } from './deserializer.js';
import { SaveError } from './errors.js';
import { SAVE_FORMAT, SAVE_VERSION, MAX_SAVE_BYTES } from './schema.js';

export { serialize, deserialize, SaveError };
export const DATABASE_NAME = 'deadfall';
export const STORE_NAME = 'saves';
export const SAVE_KEY = 'current';
export const LOCAL_STORAGE_KEY = 'deadfall.save.v1';
const TIMEOUT_MS = 2500;
let queue = Promise.resolve();
let status = { backend: null, lastSavedAt: null, error: null, warning: null };

/** Optional HUD hook. Errors are strings; event detail and snapshots are detached. */
export function getSaveStatus() { return { ...status }; }

function report(update) {
  status = { ...status, ...update };
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('deadfall:save-status', { detail: getSaveStatus() }));
  }
}

function queued(operation) {
  const next = queue.then(operation);
  queue = next.catch(() => {});
  return next;
}

function asStorageError(causes, action) {
  const quota = causes.some(error => error?.name === 'QuotaExceededError' || error?.cause?.name === 'QuotaExceededError');
  return new SaveError(quota
    ? `Could not ${action}: browser storage is full. Export a save before closing the game.`
    : `Could not ${action}: browser storage is unavailable. Enable site storage or export a save before closing the game.`,
  quota ? 'STORAGE_FULL' : 'STORAGE_UNAVAILABLE', causes);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    const timer = setTimeout(() => finish(new SaveError('The save database did not open in time.', 'STORAGE_TIMEOUT')), TIMEOUT_MS);
    function finish(error, database) {
      if (settled) { database?.close(); return; }
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(database);
    }
    try {
      if (!globalThis.indexedDB) throw new SaveError('IndexedDB is unavailable.', 'STORAGE_UNAVAILABLE');
      request = globalThis.indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        finish(null, db);
      };
      request.onerror = () => finish(request.error || new SaveError('Could not open the save database.', 'STORAGE_UNAVAILABLE'));
      // A blocked open can succeed after another tab releases its connection.
      // The timeout above keeps gameplay responsive if that never happens.
    } catch (error) { finish(error); }
  });
}

async function databaseOperation(mode, record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    let settled = false;
    const timer = setTimeout(() => {
      try { transaction?.abort(); } catch {}
      finish(new SaveError('The save database did not respond in time.', 'STORAGE_TIMEOUT'));
    }, TIMEOUT_MS);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db.close();
      if (error) reject(error); else resolve(result);
    }
    try {
      transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = mode === 'readonly' ? store.get(SAVE_KEY) : store.put(record, SAVE_KEY);
      request.onsuccess = () => { result = request.result; };
      // A successful request is not durable until its transaction completes.
      transaction.oncomplete = () => finish();
      transaction.onabort = () => finish(transaction.error || request.error || new SaveError('The save transaction was cancelled.', 'SAVE_FAILED'));
      transaction.onerror = () => { /* onabort carries the final transaction result. */ };
    } catch (error) { finish(error); }
  });
}

function localRead() {
  if (!globalThis.localStorage) throw new SaveError('Local storage is unavailable.', 'STORAGE_UNAVAILABLE');
  return globalThis.localStorage.getItem(LOCAL_STORAGE_KEY);
}

function localWrite(record) {
  if (!globalThis.localStorage) throw new SaveError('Local storage is unavailable.', 'STORAGE_UNAVAILABLE');
  globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(record));
}

function candidate(payload, backend) {
  if (payload === undefined || payload === null) return null;
  const envelope = parsePayload(payload);
  if (envelope?.format === SAVE_FORMAT) {
    validateEnvelope(envelope);
    const state = envelope.deleted === true ? null : deserialize(envelope);
    return { state, savedAt: envelope.savedAt, backend, timestamp: Date.parse(envelope.savedAt) };
  }
  // Plain state is supported for prototype migration and predates envelopes.
  return { state: deserialize(envelope), savedAt: null, backend, timestamp: 0 };
}

/** Load the newest valid record, including clear markers that supersede old saves. */
export async function loadGame() {
  return queued(async () => {
    const reads = await Promise.allSettled([
      databaseOperation('readonly'),
      Promise.resolve().then(localRead),
    ]);
    const candidates = [];
    const errors = [];
    let available = 0;
    for (let i = 0; i < reads.length; i++) {
      const read = reads[i];
      if (read.status === 'rejected') { errors.push(read.reason); continue; }
      available++;
      try {
        const result = candidate(read.value, i === 0 ? 'indexedDB' : 'localStorage');
        if (result) candidates.push(result);
      } catch (error) { errors.push(error); }
    }
    candidates.sort((a, b) => b.timestamp - a.timestamp);
    if (candidates.length) {
      const chosen = candidates[0];
      if (chosen.savedAt) observeSavedAt(chosen.savedAt);
      report({ backend: chosen.backend, lastSavedAt: chosen.state ? chosen.savedAt : null, error: null, warning: errors.length ? 'Recovered using the available browser save storage.' : null });
      return chosen.state;
    }
    const invalid = errors.find(error => ['INVALID_SAVE', 'INVALID_JSON', 'UNSUPPORTED_VERSION', 'SAVE_TOO_LARGE'].includes(error?.code));
    if (invalid || !available) {
      const error = invalid || asStorageError(errors, 'load the game');
      report({ error: error.message });
      throw error;
    }
    report({ backend: reads[0].status === 'fulfilled' ? 'indexedDB' : 'localStorage', lastSavedAt: null, error: null, warning: errors.length ? 'Using the available browser save storage.' : null });
    return null;
  });
}

async function persist(record) {
  // Timestamp when this queued write starts, so a clear followed immediately by
  // a save remains ordered even though saveGame captures its snapshot eagerly.
  record = { ...record, savedAt: nextSavedAt() };
  const errors = [];
  // Write the synchronous mirror before awaiting IndexedDB. On pagehide the
  // browser may discard pending database work as soon as the page is unloaded.
  let fallback = false;
  try { localWrite(record); fallback = true; }
  catch (error) { errors.push(error); }
  let primary = false;
  try { await databaseOperation('readwrite', record); primary = true; }
  catch (error) { errors.push(error); }
  if (!primary && !fallback) {
    const error = asStorageError(errors, record.deleted ? 'clear the save' : 'save the game');
    report({ error: error.message });
    throw error;
  }
  report({ backend: primary ? 'indexedDB' : 'localStorage', lastSavedAt: record.deleted ? null : record.savedAt, error: null,
    warning: primary ? null : 'IndexedDB is unavailable; saved using local storage.' });
}

/** Snapshot immediately; serialize writes so an older autosave cannot win a race. */
export async function saveGame(state) {
  let record;
  try { record = serialize(state); }
  catch (error) { report({ error: error.message }); throw error; }
  return queued(() => persist(record));
}

/** A timestamped clear marker prevents an inaccessible backend resurrecting a save. */
export async function clearSave() {
  return queued(() => persist({ format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: nextSavedAt(), deleted: true }));
}

export async function exportSave(state) {
  const envelope = serialize(state);
  if (typeof document === 'undefined' || typeof globalThis.URL?.createObjectURL !== 'function') {
    throw new SaveError('Save downloads are available in a browser.', 'DOWNLOAD_UNAVAILABLE');
  }
  const json = JSON.stringify(envelope);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `deadfall-day-${envelope.data.day}-${envelope.savedAt.slice(0, 19).replaceAll(':', '-')}.json`;
  anchor.style.display = 'none';
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Give browsers time to start consuming the download before revoking its URL.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

/** Validate only: the caller restores the world and explicitly saves after success. */
export async function importSave(file) {
  if (!file || typeof file.text !== 'function') throw new SaveError('Choose a Deadfall JSON save file.', 'INVALID_FILE');
  if (typeof file.size === 'number' && file.size > MAX_SAVE_BYTES) throw new SaveError('This save exceeds the 20 MB size limit.', 'SAVE_TOO_LARGE');
  let payload;
  try { payload = await file.text(); }
  catch (cause) { throw new SaveError('Could not read the selected save file.', 'FILE_READ_FAILED', cause); }
  return deserialize(payload);
}
