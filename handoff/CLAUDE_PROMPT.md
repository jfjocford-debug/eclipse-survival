# Paste this into the new Claude session

I want you to continue developing Deadfall, the working browser survival prototype in the attached project. Preserve the current game and visual direction while improving it incrementally.

Read `CLAUDE.md`, `handoff/PROJECT_HANDOFF.md`, `handoff/NEXT_STEPS.md`, `handoff/PORTABILITY.md`, and `tests/RESULTS.md`. Inspect the actual code and the included daylight/night screenshots before proposing structural or visual changes. If only the text bundle is available, use its file boundaries and state which files or capabilities you still need.

First establish the baseline: run the game locally and the Node tests if your environment allows it. Distinguish tests you actually execute from the handoff's recorded results. Summarize the architecture, the main remaining gaps, and a short prioritized iteration plan. Unless I give a different priority, begin with the baseline and profiling milestone in `handoff/NEXT_STEPS.md`, then make the smallest useful improvement justified by what you find. Do not replace the project with a new scaffold.

Keep automatic save/resume, save import/export and compatibility, world mutations after streaming, worker pathfinding, input/pause behavior, and the isometric projection working. Preserve the warm cutaway interiors, gritty muted palette, and readable tactical UI. The game currently has no runtime dependencies or backend; explain any proposed change to that.

Work in small reviewable changes. For each completed iteration give me: the concrete behavior changed, the edited files or patch, how you checked it, remaining risks or limitations, and the next recommended step. If you cannot execute code, say so and provide exact changes and verification instructions instead of claiming tests passed.
