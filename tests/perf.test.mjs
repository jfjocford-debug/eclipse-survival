import test from 'node:test';
import assert from 'node:assert/strict';
import { PerfMonitor } from '../perf/monitor.js';

test('frame samples remain bounded and report percentiles', () => {
  const m = new PerfMonitor({ capacity: 4, budgetMs: 20 });
  for (const duration of [999, 10, 20, 30, 40]) m.record(duration);
  const s = m.snapshot();
  assert.equal(s.samples, 4);
  assert.equal(s.meanMs, 25);
  assert.equal(s.fps, 40);
  assert.equal(s.p95Ms, 40);
  assert.equal(s.overBudgetPercent, 50);
});

test('tab suspension is ignored and named timings can be reset', () => {
  let now = 0;
  const m = new PerfMonitor({ now: () => now });
  m.frame(0); m.frame(16); m.frame(5016); m.frame(5032);
  assert.equal(m.snapshot().samples, 2);
  m.begin('render'); now = 5; m.end('render');
  assert.equal(m.snapshot().sections.render.meanMs, 5);
  m.reset();
  assert.equal(m.snapshot().samples, 0);
  assert.deepEqual(m.snapshot().sections, {});
});
