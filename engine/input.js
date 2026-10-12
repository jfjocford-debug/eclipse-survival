const SCROLL_KEYS = new Set([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const normalize = key => key === 'Spacebar' || key === 'Space' ? ' ' : String(key).toLowerCase();

function isEditable(target) {
  return Boolean(target?.isContentEditable || target?.closest?.(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]'
  ));
}

/** Keyboard edges and pointer positions in CSS pixels, independent of canvas DPR. */
export class Input {
  constructor(canvas) {
    if (!canvas?.addEventListener || !canvas?.getBoundingClientRect) {
      throw new TypeError('Input requires a canvas element.');
    }
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, down: false, button: -1, buttons: 0, inside: false };
    this._pressed = new Set();
    this._codes = new Map();
    this._listeners = [];
    this._wheel = 0;
    this._pointerId = null;
    this._document = canvas.ownerDocument ?? globalThis.document;
    this._window = this._document?.defaultView ?? globalThis.window;
    this._oldTabIndex = canvas.getAttribute('tabindex');
    this._oldTouchAction = canvas.style.touchAction;
    if (this._oldTabIndex === null) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';

    this._listen(this._window, 'keydown', event => {
      if (isEditable(event.target) || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = normalize(event.key);
      const interactive = event.target?.closest?.('button, a[href], [role="button"]');
      if (interactive && (key === ' ' || key === 'enter')) return;
      if (SCROLL_KEYS.has(key)) event.preventDefault();
      if (!this.keys.has(key) && !event.repeat) this._pressed.add(key);
      this.keys.add(key);
      if (event.code) this._codes.set(event.code, key);
    });
    this._listen(this._window, 'keyup', event => {
      const key = this._codes.get(event.code) ?? normalize(event.key);
      if (event.code) this._codes.delete(event.code);
      if (![...this._codes.values()].includes(key)) this.keys.delete(key);
    });
    this._listen(this._window, 'blur', () => this.clear());
    this._listen(this._document, 'visibilitychange', () => this.clear());
    this._listen(this._document, 'focusin', event => {
      if (isEditable(event.target)) this.clear();
    });
    this._listen(canvas, 'contextmenu', event => event.preventDefault());
    this._listen(canvas, 'pointerdown', event => {
      if (this._pointerId !== null && this._pointerId !== event.pointerId) return;
      this._pointerId = event.pointerId;
      this._position(event);
      this.pointer.button = event.button;
      this.pointer.buttons = event.buttons;
      this.pointer.down = Boolean(event.buttons & 1);
      this._pressed.add(`mouse${event.button}`);
      canvas.focus({ preventScroll: true });
      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Pointer may have ended. */ }
    });
    this._listen(this._window, 'pointermove', event => {
      if (this._pointerId !== null && this._pointerId !== event.pointerId) return;
      if (event.pointerType === 'touch' && this._pointerId === null) return;
      this._position(event);
      if (this._pointerId !== null) {
        this.pointer.buttons = event.buttons;
        this.pointer.down = Boolean(event.buttons & 1);
      }
    });
    this._listen(this._window, 'pointerup', event => {
      if (this._pointerId !== event.pointerId) return;
      this._position(event);
      this.pointer.buttons = event.buttons;
      this.pointer.down = Boolean(event.buttons & 1);
      if (!event.buttons) this._releasePointer();
    });
    this._listen(this._window, 'pointercancel', event => {
      if (this._pointerId === event.pointerId) this._releasePointer();
    });
    this._listen(canvas, 'lostpointercapture', event => {
      if (this._pointerId === event.pointerId) this._releasePointer();
    });
    this._listen(canvas, 'pointerleave', () => { this.pointer.inside = false; });
    this._listen(canvas, 'wheel', event => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      this._wheel += Math.sign(event.deltaY);
    }, { passive: false });
  }

  _listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._listeners.push([target, type, listener, options]);
  }

  _position(event) {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - bounds.left;
    this.pointer.y = event.clientY - bounds.top;
    this.pointer.inside = this.pointer.x >= 0 && this.pointer.y >= 0 &&
      this.pointer.x < bounds.width && this.pointer.y < bounds.height;
  }

  _releasePointer() {
    const id = this._pointerId;
    this._pointerId = null;
    this.pointer.down = false;
    this.pointer.buttons = 0;
    this.pointer.button = -1;
    try {
      if (id !== null && this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id);
    } catch { /* Browsers may release capture before the event is delivered. */ }
  }

  /** True exactly once per press; a short tap survives until consumed. */
  consume(key) {
    return this._pressed.delete(normalize(key));
  }

  /** Screen directions; the game applies the isometric world transform. */
  movement() {
    const x = Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const y = Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'));
    const length = Math.hypot(x, y);
    return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  }

  /** Signed wheel steps since the last call; positive means zoom out. */
  consumeWheel() {
    const delta = this._wheel;
    this._wheel = 0;
    return delta;
  }

  clear() {
    this.keys.clear();
    this._codes.clear();
    this._pressed.clear();
    this._wheel = 0;
    this._releasePointer();
  }

  destroy() {
    this.clear();
    for (const [target, type, listener, options] of this._listeners) {
      target.removeEventListener(type, listener, options);
    }
    this._listeners.length = 0;
    if (this._oldTabIndex === null) this.canvas.removeAttribute('tabindex');
    else this.canvas.setAttribute('tabindex', this._oldTabIndex);
    this.canvas.style.touchAction = this._oldTouchAction;
  }
}

export default Input;
