# Performance tooling

`PerfMonitor` in `monitor.js` is optional and has no dependencies. Call `frame()`
once per rendered frame and `begin('render')` / `end('render')` around work to
measure it. `snapshot()` provides a bounded sample window and separate section
timings. `mount()` adds a small developer overlay; do not enable it for players
by default. This tool does not change simulation rate or visual quality.

`node build/optimized/build.mjs` verifies relative module and worker references
and creates `build/optimized/site/` containing native modules, precompressed
Gzip/Brotli sidecars and a SHA-256 manifest. It does not rewrite code. A server
must negotiate `Accept-Encoding` and set the correct `Content-Encoding` to use
the sidecars. Serving the original files remains valid. HTML and unchanged
module filenames should revalidate; do not apply immutable caching to them.

Compare browser frame samples using the same viewport, zoom, scene, browser,
and machine. Headless software rendering does not predict real GPU performance.
Node generation timings detect regressions in world generation, not rendering.

The executed browser profile is `profile-results.json`; `../tests/RESULTS.md`
records the hardware, browser matrix, sample sizes and interpretation. The
final software-rendered Chromium cache comparison measured 22–23 ms average
frames with caching and 43 ms without. This is a bounded scene measurement,
not a 60-fps guarantee or a test on a physical GPU.
