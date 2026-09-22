# Shared LGS1920 project rules

Read this shared baseline before the project-specific `PROJECT_RULES.md`.

## Common directives

- Conversational responses must be in French.
- Code comments, JSDoc, technical documentation, and issue content must be in professional English.
- Keep changes within the requested project scope and preserve unrelated work.
- Make routine reversible decisions from repository conventions and evidence. Ask only when missing information materially changes behavior, scope, an external contract, or an approval requirement.
- Never reset, discard, overwrite, or delete user work without explicit authorization.
- Do not automatically stage or commit changes. Stage and create a commit only
  when the user explicitly requests a commit. Push, publish, deploy, and
  release actions also require an explicit request.
- Do not use semicolons in new or modified source code.
- Use arrow functions for functions, except class constructors.
- Keep new files focused and below 1500 lines.

## Quality

- Add deterministic regression coverage for every behavior change at the public boundary.
- Restore timers, DOM globals, observers, event listeners, mocks, and other process-wide state during test cleanup.
- All named functions, including private helpers, and exported values must have
  concise professional English JSDoc. Add concise English comments around
  delicate phases such as ordering,
  timing, cancellation, retries, backpressure, resource cleanup, or state
  transitions. Do not add comments that merely restate obvious code.
- Validate focused checks first, then the repository checks that cover the changed behavior.
- Keep implementation documentation aligned with the behavior that is actually implemented.
