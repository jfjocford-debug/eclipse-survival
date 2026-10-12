import { SAVE_FORMAT, SAVE_VERSION, normalizeState, checkSize } from './schema.js';

let lastTimestamp = 0;

export function nextSavedAt() {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
  return new Date(lastTimestamp).toISOString();
}

export function observeSavedAt(savedAt) {
  const time = Date.parse(savedAt);
  if (Number.isFinite(time)) lastTimestamp = Math.max(lastTimestamp, time);
}

/** Create a versioned JSON envelope without retaining references to live state. */
export function serialize(state) {
  const envelope = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: nextSavedAt(),
    data: normalizeState(state),
  };
  checkSize(JSON.stringify(envelope));
  return envelope;
}
