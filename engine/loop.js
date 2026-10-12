/** Fixed-step simulation with interpolated rendering and bounded catch-up. */
export class Engine {
  constructor({ update, render, step = 1 / 60, maxSteps = 5, onError } = {}) {
    if (typeof update !== 'function' || typeof render !== 'function') {
      throw new TypeError('Engine requires update(dt) and render(alpha) callbacks.');
    }
    if (!Number.isFinite(step) || step <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) {
      throw new RangeError('Engine step must be positive and maxSteps must be a positive integer.');
    }
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxSteps = maxSteps;
    this.onError = onError;
    this.running = false;
    this.fps = 0;
    this.frame = 0;
    this.droppedTime = 0;
    this._request = null;
    this._lastTime = null;
    this._accumulator = 0;
    this._destroyed = false;
    this._document = globalThis.document;
    this._tick = this._tick.bind(this);
    this._visibilityChanged = () => this.resetClock();
    this._document?.addEventListener('visibilitychange', this._visibilityChanged);
  }

  start() {
    if (this._destroyed) throw new Error('A destroyed Engine cannot be restarted.');
    if (this.running) return this;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      throw new Error('Animation frames are unavailable in this environment.');
    }
    this.running = true;
    this.resetClock();
    this._request = globalThis.requestAnimationFrame(this._tick);
    return this;
  }

  stop() {
    this.running = false;
    if (this._request !== null) globalThis.cancelAnimationFrame(this._request);
    this._request = null;
    this.resetClock();
    return this;
  }

  /** Discard elapsed wall time after a pause, visibility change, or load. */
  resetClock() {
    this._lastTime = null;
    this._accumulator = 0;
    this.fps = 0;
  }

  _tick(timestamp) {
    this._request = null;
    if (!this.running) return;
    if (this._document?.hidden) {
      this.resetClock();
      this._schedule();
      return;
    }
    try {
      const elapsed = this._lastTime === null ? 0 : Math.max(0, (timestamp - this._lastTime) / 1000);
      this._lastTime = timestamp;
      if (elapsed > 0) {
        const measured = 1 / elapsed;
        this.fps = this.fps ? this.fps + (measured - this.fps) * 0.08 : measured;
      }
      // At most maxSteps updates per frame. A suspended tab cannot drain needs.
      const budget = this.step * this.maxSteps;
      const delta = Math.min(elapsed, budget);
      this.droppedTime += elapsed - delta;
      this._accumulator += delta;
      let steps = 0;
      while (this._accumulator + 1e-10 >= this.step && steps < this.maxSteps && this.running) {
        this._accumulator = Math.max(0, this._accumulator - this.step);
        this.update(this.step);
        steps += 1;
      }
      if (!this.running) return;
      if (this._accumulator >= this.step) {
        const remainder = this._accumulator % this.step;
        this.droppedTime += this._accumulator - remainder;
        this._accumulator = remainder;
      }
      this.render(Math.min(1, this._accumulator / this.step));
      this.frame += 1;
    } catch (error) {
      this.stop();
      if (typeof this.onError === 'function') this.onError(error);
      else throw error;
      return;
    }
    this._schedule();
  }

  _schedule() {
    if (this.running && this._request === null) {
      this._request = globalThis.requestAnimationFrame(this._tick);
    }
  }

  destroy() {
    this.stop();
    this._document?.removeEventListener('visibilitychange', this._visibilityChanged);
    this._destroyed = true;
  }
}

export default Engine;
