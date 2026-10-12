/** Optional bounded frame sampler. No DOM writes occur unless an overlay is mounted. */
export class PerfMonitor {
  constructor({ capacity = 300, budgetMs = 1000 / 60, now = () => performance.now() } = {}) {
    this.capacity = Math.max(2, Math.floor(capacity));
    this.budgetMs = budgetMs;
    this.now = now;
    this.samples = new Float64Array(this.capacity);
    this.count = 0;
    this.cursor = 0;
    this.lastFrame = null;
    this.sections = new Map();
    this.started = new Map();
    this.overlay = null;
    this.overlayAt = 0;
  }

  frame(at = this.now()) {
    if (this.lastFrame !== null) {
      const duration = at - this.lastFrame;
      // Tab suspension should not distort active rendering statistics.
      if (duration > 0 && duration < 1000) this.record(duration);
    }
    this.lastFrame = at;
    if (this.overlay && at - this.overlayAt >= 500) {
      const s = this.snapshot();
      this.overlay.textContent = `${s.fps.toFixed(0)} fps · p95 ${s.p95Ms.toFixed(1)} ms · ${s.overBudgetPercent.toFixed(0)}% over budget`;
      this.overlayAt = at;
    }
  }

  record(duration) {
    if (!Number.isFinite(duration) || duration < 0) return;
    this.samples[this.cursor] = duration;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  begin(name) { this.started.set(name, this.now()); }

  end(name) {
    if (!this.started.has(name)) return 0;
    const duration = Math.max(0, this.now() - this.started.get(name));
    this.started.delete(name);
    const previous = this.sections.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
    previous.count++;
    previous.totalMs += duration;
    previous.maxMs = Math.max(previous.maxMs, duration);
    this.sections.set(name, previous);
    return duration;
  }

  snapshot() {
    const sorted = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    const meanMs = this.count ? sorted.reduce((sum, n) => sum + n, 0) / this.count : 0;
    const percentile = (p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] || 0;
    const sections = Object.fromEntries(Array.from(this.sections, ([name, s]) => [name, {
      count: s.count, meanMs: s.totalMs / s.count, maxMs: s.maxMs,
    }]));
    return {
      samples: this.count, meanMs, fps: meanMs ? 1000 / meanMs : 0,
      p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99),
      maxMs: sorted.at(-1) || 0,
      overBudgetPercent: this.count ? sorted.filter(n => n > this.budgetMs).length / this.count * 100 : 0,
      sections,
    };
  }

  mount(parent = document.body) {
    if (this.overlay) return this.overlay;
    const el = document.createElement('output');
    el.setAttribute('aria-label', 'Developer performance statistics');
    el.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:9999;padding:5px 8px;background:#10150ee8;color:#d9dfb9;font:11px monospace;pointer-events:none';
    parent.append(el);
    this.overlay = el;
    return el;
  }

  reset() {
    this.samples.fill(0);
    this.count = this.cursor = 0;
    this.lastFrame = null;
    this.sections.clear();
    this.started.clear();
  }

  destroy() { this.overlay?.remove(); this.overlay = null; this.reset(); }
}
