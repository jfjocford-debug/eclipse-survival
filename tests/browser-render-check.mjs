/** Small visual regression pass after renderer-only changes. */
import { launch } from 'cloakbrowser';
import { firefox, webkit } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const reports = [];
for (const name of ['chromium', 'firefox', 'webkit']) {
  const directory = `/workspace/browser/artifacts/render-${name}`;
  await mkdir(directory, { recursive: true });
  const browser = name === 'chromium'
    ? await launch({ headless: true, proxy: 'socks5://127.0.0.1:1080', args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] })
    : await ({ firefox, webkit }[name]).launch({ headless: true, proxy: { server: 'socks5://127.0.0.1:1080' } });
  const report = { browser: name, version: browser.version(), passed: false, errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(process.env.DEADFALL_URL || 'https://deadfall-cwdknte.solid.site', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.engine?.frame > 2 && window.game?.state?.ai);
    await page.screenshot({ path: `${directory}/daylight.png` });
    const initial = await page.evaluate(() => ({ x: game.state.player.x, y: game.state.player.y, zoom: game.renderer.zoom, cache: game.renderer.cacheGround }));
    assert.equal(initial.cache, true);
    await page.keyboard.down('d'); await page.waitForTimeout(750); await page.keyboard.up('d');
    await page.waitForFunction(p => Math.hypot(game.state.player.x - p.x, game.state.player.y - p.y) > .05, initial);
    await page.keyboard.press('=');
    await page.waitForFunction(zoom => game.renderer.zoom > zoom, initial.zoom);
    await page.screenshot({ path: `${directory}/movement-zoom.png` });
    report.geometry = await page.evaluate(() => {
      const p = game.state.player, screen = game.renderer.worldToScreen(p.x, p.y), world = game.renderer.screenToWorld(screen.x, screen.y);
      return { error: Math.hypot(p.x - world.x, p.y - world.y), passable: game.canMove(p.x, p.y), zoom: game.renderer.zoom, x: p.x, y: p.y };
    });
    assert.ok(report.geometry.error < 1e-6); assert.equal(report.geometry.passable, true);
    await page.evaluate(() => {
      game.engine.stop(); game.state.time = 1380;
      game.state.weather = { type: 'rain', intensity: .75, temperature: 12, daylight: .12, wind: .4 };
      game.renderer.render(game.state, 0); game.ui.update(game.state, true);
    });
    await page.screenshot({ path: `${directory}/night-rain.png` });
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) { report.errors.push(error.stack); }
  finally { await browser.close(); await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); }
  reports.push(report);
}
console.log(JSON.stringify(reports, null, 2));
if (reports.some(r => !r.passed)) process.exitCode = 1;
