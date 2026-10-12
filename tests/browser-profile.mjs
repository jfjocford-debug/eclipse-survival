import { launch } from 'cloakbrowser';
import { writeFile, mkdir } from 'node:fs/promises';
const directory = process.env.QA_OUTPUT || '/workspace/browser/artifacts/final-profile';
await mkdir(directory, { recursive: true });
const browser = await launch({ headless: true, proxy: 'socks5://127.0.0.1:1080', args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(process.env.DEADFALL_URL || 'https://deadfall-cwdknte.solid.site', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.engine);
  const client = await page.context().newCDPSession(page);
  const browserClient = await browser.newBrowserCDPSession();
  const systemInfo = await browserClient.send('SystemInfo.getInfo');
  await client.send('Profiler.enable'); await client.send('Profiler.start');
  const timings = await page.evaluate(async () => {
    const phases = [], sections = {};
    const wrap = (object, key, label) => {
      const original = object[key];
      object[key] = function (...args) { const t = performance.now(); const result = original.apply(this, args); (sections[label] ||= []).push(performance.now() - t); return result; };
    };
    wrap(game.renderer, 'render', 'render'); wrap(game, 'update', 'update'); wrap(game.ui, 'update', 'ui');
    wrap(game.world, 'getVisibleTiles', 'getVisibleTiles'); wrap(game.world, 'getProps', 'getProps');
    for (const key of ['_floorDetails', '_propShadows', '_windowShafts', '_blood', '_lighting', '_weather', '_vignettePass', '_attack', '_particles'])
      if (typeof game.renderer[key] === 'function') wrap(game.renderer, key, key);
    const frameSample = async label => {
      const frames = []; let last = performance.now();
      for (let i = 0; i < 60; i++) await new Promise(resolve => requestAnimationFrame(now => { frames.push(now - last); last = now; resolve(); }));
      frames.sort((a, b) => a - b);
      phases.push({ label, meanMs: frames.reduce((a, b) => a + b, 0) / frames.length, p95Ms: frames[56] });
    };
    await frameSample('baseline');
    game.renderer.cacheGround = false;
    await frameSample('ground-cache-disabled');
    game.renderer.cacheGround = true;
    await frameSample('ground-cache-reenabled');
    const style = document.createElement('style'); style.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.append(style);
    await frameSample('without-backdrop-filter');
    const originalRender = game.renderer.render; game.renderer.render = () => {};
    await frameSample('without-canvas-render'); game.renderer.render = originalRender;
    return { phases, sections: Object.fromEntries(Object.entries(sections).map(([name, values]) => [name, { calls: values.length, meanMs: values.reduce((a, b) => a + b, 0) / values.length, maxMs: Math.max(...values) }])) };
  });
  const { profile } = await client.send('Profiler.stop');
  await writeFile(`${directory}/cpu-profile.json`, JSON.stringify(profile));
  const samples = new Map();
  for (let i = 0; i < profile.samples.length; i++) samples.set(profile.samples[i], (samples.get(profile.samples[i]) || 0) + profile.timeDeltas[i]);
  const top = profile.nodes.map(node => ({ function: node.callFrame.functionName || '(anonymous)', url: node.callFrame.url, line: node.callFrame.lineNumber + 1, selfMs: (samples.get(node.id) || 0) / 1000 })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 20);
  const report = { browser: browser.version(), gpu: { devices: systemInfo.gpu.devices, featureStatus: systemInfo.gpu.featureStatus }, timings, top };
  await writeFile(`${directory}/profile-summary.json`, JSON.stringify(report, null, 2));
  await page.evaluate(() => {
    game.engine.stop(); game.state.time = 1380;
    game.state.weather = { type: 'rain', intensity: .75, temperature: 12, daylight: .12, wind: .4 };
    game.renderer.render(game.state, 0); game.ui.update(game.state, true);
  });
  await page.screenshot({ path: `${directory}/night-rain.png` });
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
