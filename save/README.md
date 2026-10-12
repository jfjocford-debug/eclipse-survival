# Save system

Import the public functions from `save/indexedDB.js`:

- `await loadGame()` returns a validated state, or `null` for an empty/cleared slot.
- `await saveGame(state)` captures an independent snapshot immediately and saves it.
- `await clearSave()` records a new empty slot on all available backends.
- `await exportSave(state)` downloads a versioned JSON save.
- `await importSave(file)` reads and validates a File/Blob, returning state. It does
  not write storage or mutate the running game.
- `serialize(state)` and `deserialize(envelopeOrJSON)` are also exported from their
  own modules. Version-1 plain state is accepted for early prototype migration.
- `getSaveStatus()` returns `{backend,lastSavedAt,error,warning}`. Browser consumers
  can also listen for the `deadfall:save-status` event and read `event.detail`.

Call `world.serialize()` and put its result into the snapshot's `worldChanges`
before saving. Persisted data includes player/inventory/skills, zombies, seed,
worldChanges, day/time/weather, objectives, stats, settings, and JSON extension
fields, including visited `spawnedChunks`. Messages, particles, nearby interaction
references, render data, location/save-status labels and pause state are excluded.
Loading resumes unpaused with empty particles/messages.

All persistence functions return promises. Catch `SaveError` and display its
`message`; do not report success before the promise resolves. Corrupt, unsupported,
oversized or unavailable saves reject. A valid surviving copy is recovered when
possible. A corrupt only copy is preserved and reported instead of silently
starting over. Imports accept only finite, bounded, safe plain JSON data.

IndexedDB database `deadfall`, object store `saves`, key `current` is primary.
The localStorage mirror/fallback key is `deadfall.save.v1`. The newest valid
timestamp wins at load. Requests time out after 2.5 seconds per database stage.
Writes within this module are ordered; database writes resolve only when their
transaction commits. Clear markers prevent an older copy returning after a
temporary backend outage. The localStorage mirror is written before asynchronous
database work, improving save reliability during `pagehide`. Multiple open tabs should not play the same survivor
concurrently: the latest completed snapshot is the survivor that will resume.

Run `node --test save/save.test.mjs` from the project root. No runtime packages
are required. The tests use Node's standard library and a focused asynchronous
IndexedDB test double; a real browser round trip is an integration check.
