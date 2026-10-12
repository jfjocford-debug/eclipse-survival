# Export validation — 12 October 2026

The full Node suite was rerun against the working source while preparing this handoff: 80 tests passed, 0 failed or skipped. Raw result: `node-results.tap`. All copied runtime and test source files were checked against that source.

The optimized packager was executed from the staged export, independently of the original checkout. It validated the complete module/worker/resource graph: 39 runtime files, 347614 raw bytes, 175191 Gzip bytes, 164274 Brotli bytes. All 39 runtime SHA-256 checksums matched the previously tested release.

The ZIP was checked for corruption and its members against HANDOFF_MANIFEST.json. Browser gameplay/visual reports are historical baseline evidence in tests/RESULTS.md; browser tests were not rerun for this documentation/package-only handoff. No runtime game behavior was changed.
