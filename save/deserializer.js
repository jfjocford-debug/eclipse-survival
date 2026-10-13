import { SaveError } from './errors.js';
import { SAVE_FORMAT, SAVE_VERSION, READABLE_VERSIONS, normalizeState, checkSize } from './schema.js';

export function parsePayload(payload) {
  if (typeof payload === 'string') {
    checkSize(payload);
    try { return JSON.parse(payload); }
    catch (cause) { throw new SaveError('This file is not valid save JSON.', 'INVALID_JSON', cause); }
  }
  return payload;
}

export function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.format !== SAVE_FORMAT) {
    throw new SaveError('This file is not a Deadfall save.', 'INVALID_SAVE');
  }
  if (!READABLE_VERSIONS.includes(envelope.version)) throw new SaveError(`Save version ${envelope.version} is not supported by this version of Deadfall.`, 'UNSUPPORTED_VERSION');
  if (typeof envelope.savedAt !== 'string' || !Number.isFinite(Date.parse(envelope.savedAt))) {
    throw new SaveError('Invalid save: the save date is missing or damaged.', 'INVALID_SAVE');
  }
}

/** Accept current envelopes or plain version-1 state for early prototype saves. */
export function deserialize(payload) {
  const parsed = parsePayload(payload);
  let data = parsed;
  if (parsed && typeof parsed === 'object' && ('format' in parsed || 'data' in parsed)) {
    validateEnvelope(parsed);
    if (parsed.deleted === true) throw new SaveError('This save slot has been cleared.', 'EMPTY_SAVE');
    data = parsed.data;
  }
  const state = normalizeState(data);
  checkSize(JSON.stringify(state));
  state.paused = false;
  state.particles = [];
  state.messages = [];
  return state;
}
