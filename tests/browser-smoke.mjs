/** Copy to the dedicated browser machine's /workspace/browser and run there.
 * Requires dev-only cloakbrowser + playwright-core; never part of app runtime.
 * DEADFALL_URL=https://… node browser-smoke.mjs
 */
import { launch } from 'cloakbrowser';
import { firefox, webkit } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.DEADFALL_URL || 'https://deadfall-cwdknte.solid.site';
const browserName = process.env.QA_BROWSER || 'chromium';
const directory = process.env.QA_OUTPUT || `/workspace/browser/artifacts/${browserName}`;
await mkdir(directory, { recursive: true });
const browser = browserName === 'chromium'
  ? await launch({ headless: true, proxy: 'socks5://127.0.0.1:1080', args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] })
  : await ({ firefox, webkit }[browserName]).launch({ headless: true, proxy: { server: 'socks5://127.0.0.1:1080' } });
const report = { url, at: new Date().toISOString(), browserName, browser: browser.version(), checks: [], errors: [], workers: [] };
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('worker', worker => report.workers.push(worker.url()));
const check = async (name, run) => {
  try { const detail = await run(); report.checks.push({ name, passed: true, detail }); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); }
};
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => window.game?.state && window.game?.renderer, null, { timeout: 20000 });
  await page.waitForFunction(() => window.game?.engine?.frame > 2 && window.game?.state?.ai, null, { timeout: 20000 });
  await page.screenshot({ path: `${directory}/01-first-play.png` });

  await check('direct boot and browser worker', async () => {
    assert.equal(await page.locator('#game-canvas').count(), 1);
    assert.equal(await page.evaluate(() => game.state.ai?.worker), true);
    assert.equal(await page.evaluate(() => window.game.state.dead), false);
    return { workers: report.workers };
  });

  await check('E searches starter supplies and updates the journal', async () => {
    const before = await page.evaluate(() => ({ looted: game.state.objectives.looted, items: game.state.player.inventory.reduce((n, i) => n + i.qty, 0) }));
    await page.keyboard.press('e');
    await page.waitForFunction(n => game.state.objectives.looted > n, before.looted);
    const after = await page.evaluate(() => ({ looted: game.state.objectives.looted, items: game.state.player.inventory.reduce((n, i) => n + i.qty, 0) }));
    assert.equal(after.looted, before.looted + 1); assert.ok(after.items > before.items);
    assert.ok(await page.locator('#hud-objectives li.complete').count() >= 1);
    return { before, after };
  });

  await check('keyboard movement and collision', async () => {
    await page.evaluate(() => { window.game.state.paused = false; });
    const before = await page.evaluate(() => ({ x: game.state.player.x, y: game.state.player.y }));
    await page.keyboard.down('d'); await page.waitForTimeout(650); await page.keyboard.up('d');
    const after = await page.evaluate(() => ({ x: game.state.player.x, y: game.state.player.y, passable: game.canMove(game.state.player.x, game.state.player.y) }));
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > .05, 'keyboard should move survivor');
    assert.equal(after.passable, true);
    return { before, after };
  });

  await check('pause freezes simulation and resumes', async () => {
    await page.keyboard.press('p');
    await page.waitForFunction(() => game.state.paused && game.ui.panel === 'pause');
    const before = await page.evaluate(() => ({ paused: game.state.paused, time: game.state.time, elapsed: game.state.elapsed }));
    assert.equal(before.paused, true);
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => ({ time: game.state.time, elapsed: game.state.elapsed }));
    assert.equal(after.time, before.time); assert.equal(after.elapsed, before.elapsed);
    await page.screenshot({ path: `${directory}/02-pause.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !game.state.paused && game.ui.panel === null);
    assert.equal(await page.evaluate(() => game.state.paused), false);
  });

  await check('inventory dialog and consumable action', async () => {
    await page.keyboard.press('i');
    await page.waitForFunction(() => game.state.paused && game.ui.panel === 'inventory');
    assert.equal(await page.evaluate(() => game.state.paused), true);
    await page.screenshot({ path: `${directory}/03-inventory.png` });
    const result = await page.evaluate(async () => {
      game.state.player.thirst = 40;
      const before = game.count('water');
      await game.action('use', 'water');
      return { before, after: game.count('water'), thirst: game.state.player.thirst };
    });
    assert.equal(result.after, result.before - 1); assert.equal(result.thirst, 78);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !game.state.paused && game.ui.panel === null);
    return result;
  });

  await check('persistent inventory and position survive reload', async () => {
    const saved = await page.evaluate(async () => {
      game.state.paused = true;
      // Wait for any action-triggered save to finish before capturing this one.
      while (game.saveBusy) await new Promise(resolve => setTimeout(resolve, 30));
      await game.save();
      return { x: game.state.player.x, y: game.state.player.y, water: game.count('water') };
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.engine?.frame > 2 && window.game?.state?.ai);
    const loaded = await page.evaluate(() => ({ x: game.state.player.x, y: game.state.player.y, water: game.count('water') }));
    assert.deepEqual(loaded, saved);
    return loaded;
  });

  await check('zoom projection remains invertible', async () => {
    const errors = await page.evaluate(() => {
      const r = game.renderer, point = game.state.player, results = [];
      for (const zoom of [.7, 1, 1.5]) {
        r.setZoom(zoom); r.render(game.state, 0);
        const screen = r.worldToScreen(point.x, point.y), world = r.screenToWorld(screen.x, screen.y);
        results.push(Math.hypot(world.x - point.x, world.y - point.y));
      }
      r.setZoom(1); return results;
    });
    assert.ok(errors.every(n => n < 1e-6)); return errors;
  });

  await check('save export downloads a valid versioned snapshot', async () => {
    const event = page.waitForEvent('download');
    await page.evaluate(() => game.action('export'));
    const download = await event;
    await download.saveAs(`${directory}/exported-save.json`);
    const envelope = JSON.parse(await readFile(`${directory}/exported-save.json`, 'utf8'));
    assert.equal(envelope.format, 'deadfall-save'); assert.equal(envelope.version, 1);
    assert.equal(envelope.data.objectives.looted, 1);
    return { name: download.suggestedFilename(), health: envelope.data.player.health };
  });

  await check('file import restores exported inventory, position and health', async () => {
    const envelope = JSON.parse(await readFile(`${directory}/exported-save.json`, 'utf8'));
    await page.evaluate(() => { game.state.player.health = 17; game.state.player.inventory = []; });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.locator('#save-import-input').setInputFiles(`${directory}/exported-save.json`),
    ]);
    await page.waitForFunction(() => window.game?.engine?.frame > 2 && window.game?.state?.ai);
    const restored = await page.evaluate(() => ({ x: game.state.player.x, y: game.state.player.y, hp: game.state.player.health, inventory: game.state.player.inventory }));
    assert.equal(restored.x, envelope.data.player.x); assert.equal(restored.y, envelope.data.player.y);
    assert.equal(restored.hp, envelope.data.player.health); assert.deepEqual(restored.inventory, envelope.data.player.inventory);
    return restored;
  });

  await check('Space and aimed pointer attacks damage a nearby infected', async () => {
    await page.evaluate(() => {
      const p = game.state.player; p.x = 7.5; p.y = 7.5; p.dirX = 1; p.dirY = 0;
      p.stamina = 100; p.attackCooldown = 0; p.equipped = 'bat'; game.state.paused = false;
      game.state.zombies.push({ id: 999999, x: 8.5, y: 7.5, health: 100, mode: 'idle', dirX: -1, dirY: 0, attackCooldown: 10 });
    });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => game.state.zombies.find(z => z.id === 999999)?.health < 100);
    const keyboardHealth = await page.evaluate(() => game.state.zombies.find(z => z.id === 999999).health);
    const point = await page.evaluate(() => {
      const z = game.state.zombies.find(z => z.id === 999999); z.health = 100; z.x = 8.5; z.y = 7.5;
      z.knockbackX = z.knockbackY = 0; game.state.player.attackCooldown = 0; game.state.player.stamina = 100;
      game.state.player.dirX = -1; game.state.player.dirY = 0;
      return game.renderer.worldToScreen(z.x, z.y);
    });
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    try { await page.waitForFunction(() => game.state.zombies.find(z => z.id === 999999)?.health < 100); }
    finally { await page.mouse.up(); }
    const pointerHealth = await page.evaluate(() => {
      const z = game.state.zombies.find(z => z.id === 999999), health = z.health;
      z.health = 0; z.canAttack = false; return health;
    });
    assert.ok(keyboardHealth < 100 && pointerHealth < 100);
    return { keyboardHealth, pointerHealth };
  });

  await check('keyboard barricade changes collision and persists through browser reload', async () => {
    const id = await page.evaluate(() => {
      game.state.player.x = 11.3; game.state.player.y = 7.5; game.state.paused = false;
      return game.nearestOpening().id;
    });
    await page.keyboard.press('b');
    await page.waitForFunction(id => game.world.getProps(12, 7, 2).find(p => p.id === id)?.barricaded > 0, id);
    await page.evaluate(async () => {
      game.state.paused = true;
      while (game.saveBusy) await new Promise(resolve => setTimeout(resolve, 30));
      await game.save();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.engine?.frame > 2 && window.game?.state?.ai);
    const restored = await page.evaluate(id => ({
      barricaded: game.world.getProps(12, 7, 2).find(p => p.id === id)?.barricaded,
      blocked: game.world.isBlocked(12.5, 7.5), objectives: game.state.objectives.barricaded,
    }), id);
    assert.equal(restored.barricaded, 1); assert.equal(restored.blocked, true); assert.equal(restored.objectives, 1);
    return restored;
  });

  await check('1280px viewport and frame sample', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${directory}/04-1280x720.png` });
    const sample = await page.evaluate(async () => {
      game.state.paused = false;
      const frames = []; let previous = performance.now();
      for (let i = 0; i < 90; i++) await new Promise(resolve => requestAnimationFrame(now => { frames.push(now - previous); previous = now; resolve(); }));
      frames.sort((a, b) => a - b);
      return { meanMs: frames.reduce((a, b) => a + b, 0) / frames.length, p95Ms: frames[Math.ceil(frames.length * .95) - 1], samples: frames.length, width: innerWidth, documentWidth: document.documentElement.scrollWidth };
    });
    assert.equal(sample.documentWidth, sample.width, 'page should not overflow horizontally'); return sample;
  });

  await check('death overlay can restart with a fresh survivor', async () => {
    await page.evaluate(() => { game.state.player.health = .001; game.state.player.bleeding = 100; game.state.paused = false; });
    await page.waitForFunction(() => game.state.dead && game.ui.panel === 'death');
    await page.screenshot({ path: `${directory}/05-death.png` });
    await page.evaluate(() => game.action('restart'));
    await page.waitForTimeout(150);
    const fresh = await page.evaluate(() => ({ dead: game.state.dead, hp: game.state.player.health, panel: game.ui.panel, looted: game.state.objectives.looted, x: game.state.player.x, y: game.state.player.y }));
    assert.equal(fresh.dead, false); assert.equal(fresh.hp, 100); assert.equal(fresh.panel, null);
    assert.equal(fresh.looted, 0); assert.equal(fresh.x, 7.5); assert.equal(fresh.y, 7.5);
    return fresh;
  });

  await check('runtime errors absent', () => assert.deepEqual(report.errors, []));
} catch (error) {
  report.errors.push(error.stack);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
} finally {
  await writeFile(`${directory}/browser-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
if (report.errors.length || report.checks.some(check => !check.passed)) process.exitCode = 1;
