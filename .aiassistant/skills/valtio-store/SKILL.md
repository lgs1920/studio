---
name: valtio-store
description: Design, modify, synchronize, or debug Valtio stores in LGS1920. Use for state ownership, proxy and snapshot contracts, derived state, local database synchronization, hydration, and stale reactive UI.
---

# Valtio Store

Use this skill for application state changes. Inspect the owning store, its consumers, persistence layer, and existing store contract tests before editing.

Rules:

- Name proxy variables with a `$` prefix and snapshots with the raw name.
- Keep mutations at explicit store actions or lifecycle boundaries.
- Avoid storing derived values when a selector or pure function is sufficient.
- Preserve initialization, hydration, reset, and scene replacement semantics.
- Treat browser database synchronization as asynchronous and failure-prone.
- Do not read a snapshot where a live proxy is required, or mutate a snapshot.

Workflow:

1. Define the source of truth and the lifecycle that owns each mutation.
2. Trace all `useSnapshot` consumers and imperative readers.
3. Add or update store contract tests for shape, defaults, hydration, reset, and refresh timing.
4. Verify no stale proxy survives replacement and no async write overwrites newer state.

Follow repository naming and no-semicolon rules. Run the smallest relevant tests before lint and build.
