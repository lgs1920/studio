---
name: lgs-1920-studio-testing-workflow
description: Create, repair, and run reliable LGS1920 tests with Vitest, React Testing Library, jsdom, and store contract tests. Use for regressions, interactive components, rendering lifecycles, async state, and capture workflows.
---

# Testing Workflow

Use this skill whenever a feature or bug fix changes behavior. Read neighboring tests and the affected implementation before writing assertions.

Workflow:

1. Reproduce the behavior with the smallest realistic test.
2. Classify the test in the matching Vitest project (`unit`, `ui`, or `integration`) and keep environment-dependent tests out of the unit project.
3. Test observable behavior rather than implementation details.
4. For React, cover user interaction, disabled or loading state, cleanup, and rerender or replacement.
5. For Valtio, cover proxy shape, defaults, mutation boundaries, hydration, persisted-versus-transient state, and derived refresh timing.
6. For widgets, cover hide/show, rehydration, selection clearing, stacking order, board isolation, and capture visibility when relevant.
7. For Replay and capture, cover the preparation timeline projection, camera preparation, state transitions, synchronization, latest-request-wins scrubbing, cancellation, and final cleanup.
8. For asynchronous tests, prefer explicit completion signals. Use microtasks for synchronous callback delivery and fake timers only for behavior that depends on a controlled clock or scheduler. Do not add arbitrary sleeps or chained animation-frame promises merely to wait for rendering.
9. Restore fake timers, globals, browser API stubs, observers, event listeners, DOM nodes, and module mocks in test cleanup. A failure that disappears with `--no-file-parallelism` is a test-isolation defect to investigate, not an assertion to weaken.
10. Run the focused test file, then the affected project with the intended CI parallelism. Run `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test:lint-config` when the change affects shared configuration, test infrastructure, or build behavior.

Prefer deterministic fixtures and fake timers only when necessary. Do not weaken assertions merely to make a regression pass. Never run `bun run dev`.
