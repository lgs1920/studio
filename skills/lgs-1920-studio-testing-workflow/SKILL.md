---
name: lgs-1920-studio-testing-workflow
description: Create, repair, and run reliable LGS1920 tests with Vitest, React Testing Library, jsdom, and store contract tests. Use for regressions, interactive components, rendering lifecycles, async state, and capture workflows.
---

# Testing Workflow

Use this skill whenever a feature or bug fix changes behavior. Read neighboring tests and the affected implementation before writing assertions.

Workflow:

1. Reproduce the behavior with the smallest realistic test.
2. Test observable behavior rather than implementation details.
3. For React, cover user interaction, disabled or loading state, cleanup, and rerender or replacement.
4. For Valtio, cover proxy shape, defaults, mutation boundaries, hydration, persisted-versus-transient state, and derived refresh timing.
5. For widgets, cover hide/show, rehydration, selection clearing, stacking order, board isolation, and capture visibility when relevant.
6. For Replay and capture, cover the preparation timeline projection, camera preparation, state transitions, synchronization, latest-request-wins scrubbing, cancellation, and final cleanup.
7. Run the focused test file, then the relevant project suite, `bun run lint`, and `bun run build` when risk warrants it.

Prefer deterministic fixtures and fake timers only when necessary. Do not weaken assertions merely to make a regression pass. Never run `bun run dev`.
