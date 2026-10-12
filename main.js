/** Native ES-module entry. A failed import or initialization stays visible. */
let bootErrorShown = false;

function showBootError(error) {
  console.error('[Deadfall] The game could not continue:', error);
  if (bootErrorShown) return;
  bootErrorShown = true;
  window.game?.engine?.stop?.();

  const overlay = document.createElement('section');
  overlay.id = 'deadfall-boot-error';
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#111711ed;color:#e9e8dc;font:16px/1.6 system-ui,sans-serif';
  const card = document.createElement('div');
  card.style.cssText = 'width:min(100%,540px);padding:30px;box-sizing:border-box;border:1px solid #697155;background:#1c211b;box-shadow:0 16px 70px #0008';
  const title = document.createElement('h1');
  title.textContent = 'DEADFALL';
  title.style.cssText = 'margin:0 0 12px;color:#d6bd83;letter-spacing:.16em;font-size:24px';
  const message = document.createElement('p');
  message.textContent = 'The game encountered a problem. Reload to try again.';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Technical details';
  const pre = document.createElement('pre');
  pre.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;color:#b9bdac';
  details.append(summary, pre);
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload game';
  reload.style.cssText = 'margin-top:24px;padding:10px 20px;border:1px solid #b7a36f;background:#c4b27e;color:#181c17;cursor:pointer;font:600 14px system-ui';
  reload.addEventListener('click', () => window.location.reload());
  card.append(title, message, details, reload);
  overlay.append(card);
  document.body.append(overlay);
  reload.focus();
}

if (document.readyState === 'loading') {
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

// Resource load errors have no event.error; only actual runtime errors halt play.
window.addEventListener('error', event => {
  if (event.error) showBootError(event.error);
});
window.addEventListener('unhandledrejection', event => showBootError(event.reason));

try {
  // Dynamic import lets failures in any game module reach the recovery panel.
  const { Game } = await import('./game.js');
  const game = new Game();
  await game.init();
  window.game = game;
  game.start();
} catch (error) {
  showBootError(error);
}
