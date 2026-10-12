# Exporting Deadfall to another development environment

This handoff is a complete source snapshot plus continuation context, prepared on 12 October 2026. The game is an original Project Zomboid-inspired browser survival foundation. It is already playable; the purpose of the handoff is to help another developer extend it without losing its working systems.

## What to give Claude

**For a session that can work with files:** extract `deadfall-claude-handoff.zip`, open the enclosed `deadfall/` directory in that environment, and provide the text in `handoff/CLAUDE_PROMPT.md`. Ask Claude to read `CLAUDE.md` first. The project does not need the original machine or service credentials.

**For a chat session without a filesystem:** provide `DEADFALL_CLAUDE_CONTEXT.md` and the prompt. Supply `DEADFALL_CLAUDE_SOURCE.txt` when source inspection is needed. It contains the text source and tests with explicit file boundaries. Attach the daylight and night/rain screenshots separately when discussing visuals. If a session cannot handle the full text bundle, supply the brief and relevant individual files from the ZIP instead. Chat suggestions still need to be applied and executed in a development environment.

Download these files yourself before uploading them to another service. Workspace attachment links use your workspace access; another model cannot be assumed to fetch them. The public preview is supplementary, not a replacement for the source.

## Included files

| Location | Purpose |
| --- | --- |
| `CLAUDE.md` | Concise continuation instructions and invariants |
| `handoff/CLAUDE_PROMPT.md` | Ready-to-paste first message |
| `handoff/PROJECT_HANDOFF.md` | Architecture, data flow, APIs, fixed bugs, current limits |
| `handoff/NEXT_STEPS.md` | Suggested priorities with acceptance criteria |
| `handoff/PORTABILITY.md` | Setup, hosting, browser-test adaptation, save transfer |
| `handoff/screenshots/` | Actual final daylight and night/rain game captures |
| `handoff/references/` | Original user-supplied visual references and sprite study |
| `tests/RESULTS.md` | Scope and results of the executed verification |
| `tests/browser-results.json`, `perf/profile-results.json` | Compact verification evidence |
| `HANDOFF_MANIFEST.json` | File sizes and SHA-256 checksums for the exported snapshot |

The complete runtime source and eight character PNGs are included. Large raw profiler captures, generated compressed build output, machine credentials, and workspace management helpers are omitted. The original user references are design inputs, not runtime dependencies.

## First local run

In a terminal opened in the extracted `deadfall/` directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. On systems where Python is named `python`, use that command instead. Do not double-click `index.html`: native modules and module workers need HTTP(S). Click the world, press E to collect the starter supplies, then use WASD, click/Space, and I. H opens controls.

The development terminal must stay open while serving. The existing hosted version is at https://deadfall-cwdknte.solid.site; local edits do not change that deployment.

## Verification and saves

With Node 20+ available, run the full command in `CLAUDE.md`. These Node checks do not need npm install. Browser automation has additional development dependencies and environment assumptions documented in `PORTABILITY.md`.

Your personal running survivor is stored in your browser and is **not** embedded in the source archive. To continue that survivor locally, use Pause → Export in the hosted game, keep the downloaded JSON, then use Pause → Import on the local copy. Different hostnames or ports have different browser storage. Keep the original export while changing persistence code.

The software is a foundation. The source has no open-source license grant; `package.json` currently says `UNLICENSED`. Asset provenance is documented in `assets/README.md`. Confirm redistribution terms for the supplied imagery before a wider release.
