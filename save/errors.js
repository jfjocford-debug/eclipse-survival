/** Errors are safe to show directly in the game's save notification. */
export class SaveError extends Error {
  constructor(message, code = 'SAVE_FAILED', cause) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}
