# Running and validating outside the original workspace

## Runtime and Node tests

The game is static browser code. Copy the whole `deadfall/` directory, including `assets/` and `workers/`. No Solid credential, remote machine ID, relay or environment variable is needed to run it.

From the extracted root, with Python 3:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. Use `python` if that is the Python 3 command on your machine. Any correct static HTTP server works; a single-page-app fallback is unnecessary. Modules/workers must receive JavaScript, not an HTML fallback. Serve over localhost or HTTPS. `file://` is not supported.

With Node 20+ and a shell that expands these globs:

```sh
node --test tests/*.test.mjs save/*.test.mjs ai/*.test.mjs world/*.test.mjs render/*.test.mjs
node perf/benchmark.mjs
node build/optimized/build.mjs
```

If the shell does not expand file globs, pass the individual `.test.mjs` paths to `node --test`. Tests and packaging use Node's standard library; no npm install is required. Packaging validates module/worker/resource references and generates raw assets, Gzip/Brotli sidecars and SHA-256 checksums under `build/optimized/site/`. Do not treat old `build-results.json` as the result of a newly executed build.

## Browser automation needs environment adaptation

The checked-in browser scripts are the real scripts used for the original reports. Their launchers import development-only `cloakbrowser`/`playwright-core`, route traffic through SOCKS on `127.0.0.1:1080`, and default output paths to `/workspace/browser/artifacts`. That relay has been removed. They are not ready-to-run generic CI scripts. This is a tooling limitation, not a dependency of the game.

In the new environment, adapt only the launch/configuration section first:

1. Choose the locally available automation/browser installation and install its development dependencies outside the runtime bundle.
2. Set the target to the local server, for example `DEADFALL_URL=http://localhost:8080`.
3. Remove the old SOCKS proxy and Chromium host-resolver override, or replace them with the new environment's actual network configuration. Do not assume port 1080 is available.
4. Resolve artifact paths inside the new checkout. `browser-smoke.mjs` and `browser-profile.mjs` support `QA_OUTPUT`; `browser-render-check.mjs` currently embeds its output directory and needs an edit.
5. Preserve the scenario bodies: they exercise real input, actual reload/storage, file import/download and module workers. Wait for `game.engine.frame > 2` and `game.state.ai` before interacting; fixed short sleeps caused false startup failures in slow WebKit.
6. Run browsers sequentially for uncontended measurements. Keep each context isolated. Record actual browser versions, new results and any unexecuted engines.

`browser-profile.mjs` uses Chromium CDP for CPU/GPU diagnostics and is not an engine-neutral profiler. The controlled night/rain screenshot explicitly sets time/weather; it does not establish that a full day was played. Node Canvas mocks verify geometry/API use but do not establish real rendering correctness. Do not represent launcher adaptation as a fresh browser pass until it actually executes.

## Hosting a new build

The generated static `build/optimized/site/` can be hosted independently. Serve originals normally; only serve `.gz`/`.br` sidecars when the server negotiates encoding and sets `Content-Encoding` correctly. Preserve relative asset and module-worker paths. Revalidate nonhashed entry/module filenames to avoid mixing versions.

`deploy/server.py` is the previous Python production server. It defaults to `/workspace/deadfall`, binds loopback port 8080, and supports precompressed assets. To use it elsewhere, set `DEADFALL_ROOT` to the absolute directory being served. For simple local development, the standard Python HTTP command above is easier. The original persistent service/tunnel configuration and API helpers are intentionally not part of this export.

The preview URL belongs to the existing hosted deployment. Editing the exported copy or running the packager will not update it. Deploy to your own chosen hosting target when ready; keep that a separate step from local verification.

## Moving a survivor and reference material

Browser saves belong to their origin and profile. Export from the hosted game's pause menu, then import on the new origin. No personal browser save is included in the handoff. Keep an untouched exported file when validating migration behavior. Changing ports also changes the local browser origin.

The ZIP includes runtime images, final game screenshots and the original supplied references. `DEADFALL_CLAUDE_SOURCE.txt` contains text only; it cannot reproduce binary PNG assets by itself and is not a runnable substitute for the ZIP. The context brief is a reading aid; the real source remains authoritative.
