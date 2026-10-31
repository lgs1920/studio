# Codex Implementation Brief — Replay & POI Stabilization (`1.0.0`)

**Status:** Action plan — tasks not implemented by this document  
**Assessment date:** 2026-10-31  
**Repository:** `lgs1920/studio`  
**Target branch:** `1.0.0`  
**Reviewed HEAD:** `880fc6dd24a8caa030858763926ed5fac683d40d`  
**Intended audience:** Codex working on the repository

## 1. Mission and scope

Stabilize the **existing** Replay and POI behavior on branch `1.0.0`, resolve reproducible defects, restore confidence in tests and end-of-export handling, and validate the already implemented improvements. Prefer small, independently verifiable corrections rather than a broad rewrite.

### Explicitly closed: export-speed regression

**The user has confirmed that the Replay video export-speed regression is fixed. Treat it as closed and out of scope.** Do not reopen the former “~4 minutes to >10 minutes” investigation, start an export-speed benchmarking campaign, or implement encoder/renderer performance optimizations under this assignment. Preserve existing export quality, determinism, and speed as non-regression properties, but do not spend implementation time on the closed issue.

The separate proposal `tech-doc/todo/CORE-REPLAY-HQ-VIDEO-EXPORT-PERFORMANCE-OPTIMIZATION-PLAN.md` is not an implementation mandate for this work.

### Work boundaries

- Work against **`1.0.0`**, not `main`. Confirm the actual checkout and HEAD before editing.
- Read **`AGENTS.md`**, **`PROJECT_RULES.md`**, and any applicable local guidance/skills in full before changing code.
- Preserve uncommitted work. Never reset, clean, overwrite, or change branches destructively without explicit approval.
- Address verified defects in current `1.0.0` behavior; do not silently import planned `1.1.0` functionality.
- Keep the existing canonical Replay clock and deterministic video export pipeline. Avoid new timing systems, background timers, unrelated UI/architecture work, and broad refactors.
- In source and documentation, use **English** comments, documentation, JSDoc, and issue text. Communicate user-facing progress in **French**.
- Follow project conventions: JavaScript/JSX, arrow functions except constructors, named exports, **no semicolons**, Valtio ownership/naming, Web Awesome 3 components, and project testing guidelines.
- **Do not run `bun run dev`.** Do not push/merge or modify external issues without explicit authorization.

## 2. Verified baseline — do not confuse observations with unresolved defects

At the reviewed branch state, recent changes already cover POI mode switching, animation windows, endpoint holds, canvas/overlay refresh, camera restoration, and safer MP4 handoff. **First reproduce any remaining failure before rewriting those areas.**

- Latest reviewed CI run: [Continuous integration — 2026-10-31](https://github.com/lgs1920/studio/actions/runs/41219952332), **failed**; reported **71 failed and 2,236 passed tests** (2,307 total) in the test project stage. Dependent checks were not all executed. Earlier runs were also red; do not label all 71 failures as new regressions.
- The repository `TODO.md` still records: Expert/Basic drawer parity; a zero-duration trace that remains visible; inability to move an expanded POI; POI visibility/animation checks; video-loss/end-dialog behavior; restart after Replay end failure; and a newly added POI sometimes missing from animation until application restart.
- `tech-doc/todo/CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md` targets **`1.1.0`** and issue [#395](https://github.com/lgs1920/studio/issues/395). Its comprehensive new requirements are *not automatically part of this `1.0.0` fix list*.
- `tech-doc/todo/CORE-REPLAY-TIMELINE-PERFORMANCE-AUDIT.md` says multiple baseline improvements are **already implemented**; further optimization requires an observed browser bottleneck.
- `tech-doc/specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md` is the current functional inventory. Reconcile its relevant claims against the code before reporting anything complete.

### Key sources to inspect

- `TODO.md`
- `src/core/ui/replay/JourneyReplaySessionPOIController.js`
- `src/core/ui/replay/JourneyReplayPOISettings.js`
- `src/core/ui/replay/JourneyReplayVisibilityController.js`
- `src/core/ui/replay/JourneyReplayPlaybackController.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/replay/ReplayRecordingMonitor.js`
- `src/components/MainUI/MapPOI/MapPOIContent.jsx`
- `src/components/cesium/MapPOI.jsx`
- `src/components/MainUI/video/ReplayTimelinePreview.jsx`

These are investigation entry points, **not a prescription to modify every file**. Locate current callers/tests first.

## 3. Prioritized execution backlog

### P0-01 — Diagnose and repair the Replay/POI test failures

**Problem:** CI is red; the test project stage blocks a clean quality signal.

**Instructions for Codex**

1. Record branch, HEAD, dirty working-tree state, and the failed CI job referenced above.
2. Reproduce the relevant failures locally using the repository’s existing Vitest projects. Group failures by shared root cause: broken mocks or component contracts, obsolete expectations, genuine runtime regressions, and unrelated baseline failures.
3. Prioritize the Replay/POI suites, then fix shared test infrastructure where it causes multiple failures. In particular, investigate any missing internal-call mock methods (for example `syncRuntimeNearbyPOIs`) and incomplete Web Awesome component mocks (for example `WaTooltip`) when present in actual failing traces.
4. Do not merely remove assertions, suppress failing tests, or replace real behavior with permissive test doubles. Correct implementation defects at the appropriate ownership boundary and update tests only when intended behavior demonstrably changed.
5. Rerun each repaired suite and the related unit/UI/integration projects. Track what remains outside the target scope.

**Acceptance criteria**

- All selected Replay/POI tests pass locally.
- Every affected test has an identified cause and a durable fix or is explicitly documented as an unrelated pre-existing blocker.
- Existing behavior and coverage are not weakened to obtain a green result.
- Report whether the full CI is green; if not, list exact remaining failures and their provenance without claiming complete success.

### P0-02 — Validate Replay completion and MP4 handoff on both success and failure

**Problem:** `TODO.md` reports a lost video/end dialog and an end-of-Replay failure that restarts playback from the beginning. Recent commits improved handoff and cleanup ordering; their behavior must be validated, not recreated blindly.

**Instructions for Codex**

1. Trace the sequence **final frame → encoder finalization → completed media handoff → UI notification/dialog → scene/session cleanup**.
2. Reproduce standard successful export and failure cases: encoder or handoff error, overlay/dialog error, Replay ending while UI state changes, and a repeated Replay after success/failure.
3. Confirm that a successfully completed MP4 remains accessible to its intended consumer even if subsequent UI handling fails, and that cleanup cannot invalidate a handed-off artifact.
4. Confirm that an export failure does not silently restart playback or replace an already completed video with an empty/invalid result.
5. Inspect existing UI behavior before choosing new end-dialog semantics. If the expected choices when video is lost are not established by existing design, record the decision needed instead of inventing a new user contract.
6. Add focused tests around lifecycle ordering, success/failure isolation, and repeat sessions.

**Acceptance criteria**

- A successful MP4 is preserved through session teardown and UI errors.
- Failure handling is explicit and does not trigger an unexpected playback restart.
- Repeated Replay sessions do not reuse stale export state or discard a previously completed result.
- The user-facing dialog behavior is verified or an unresolved product decision is reported precisely.

### P1-03 — Fix POIs added to the active Journey being absent until restart

**Problem:** A POI created after the Journey is loaded may be missing from the next Replay animation until the application restarts.

**Instructions for Codex**

1. Reproduce with a current Journey, create a POI, prepare and run Replay without reloading the app, then repeat after editing and removing POIs.
2. Identify whether the defect comes from POI source collection subscription, derived projection/cache invalidation, Replay-session POI snapshot creation, or runtime visibility/animation state.
3. Invalidate/rebuild only the necessary derived state at the appropriate Journey/Replay ownership boundary; avoid arbitrary full reloads or a second observer/timer path.
4. Verify both Basic and Expert Replay with the existing visibility modes, including POI-level opt-out.
5. Add regression tests covering newly inserted, updated, and removed POIs in the same app session.

**Acceptance criteria**

- A newly created eligible POI animates in the next Replay without restarting the app.
- Edits and deletions are reflected without stale or duplicate animations.
- Existing POI identifiers and persisted Journey content are preserved.

### P1-04 — Correct current POI interaction and visibility regressions

**Problems:** Moving an expanded POI is reported to fail, and all-hidden/all-shown transitions need explicit validation.

**Instructions for Codex**

1. Reproduce drag/move behavior for a collapsed and expanded POI, outside and inside Replay where applicable. Determine whether pointer ownership, expansion overlay capture, or Cesium interaction is responsible.
2. Exercise the existing Replay visibility modes (`yes`, `no`, `user`) at preparation, playback start, playback stop, seek, and return to normal mode.
3. Check endpoint start/stop visibility and current `tooClose` behavior as a *correctness regression suite*; preserve the existing one-second endpoint holds and canonical Replay time.
4. Confirm that stopping, canceling, or switching Replay mode restores pre-Replay POI visibility, expansion, and scene interaction state.
5. Add targeted tests; do not use wall-clock timers to patch inconsistencies in a replay-time-driven path.

**Acceptance criteria**

- An expanded POI can be moved where the product currently permits POI movement.
- Existing visibility settings are honored without stale overlays or unwanted POI exposure.
- No Cesium navigation lock, dangling pointer capture, or un-restored POI state remains after Replay.

### P1-05 — Reconcile Expert/Basic settings and zero-duration trace behavior

**Problems:** Expert drawer should reuse established Simple/Basic behavior instead of duplicating divergent logic. A trace may remain visible when configured duration is zero.

**Instructions for Codex**

1. Compare the effective normalized settings and event flow in Basic and Expert, not just their visual arrangement.
2. Reuse shared behavior where the existing architecture supports it, while preserving mode-specific controls and a single Replay session/clock.
3. Reproduce the zero-duration trace case; locate the owner of visibility/disposal and fix the transition that leaves the trace visible.
4. Test entry/exit, mode switch, zero/nonzero duration, repeated preparation, and no-journey/short-journey edge cases.

**Acceptance criteria**

- Equivalent settings behave consistently across Basic and Expert where intended.
- Switching modes does not duplicate controls, leak subscriptions, reset unrelated user settings, or create a second playback path.
- A zero-duration trace is not left visible after its owning phase ends.

### P2-06 — Verify Timeline responsiveness; optimize only if a current bottleneck is proven

**Problem:** The Timeline audit identifies partially completed optimizations and residual browser-validation work, but it does not establish a current performance regression.

**Instructions for Codex**

1. Inspect the present `ReplayTimelinePreview.jsx` and the installed generic Timeline package before proposing changes.
2. Verify the current narrow subscriptions, controlled-state batching, DOM/layout caching, and frame-coalesced playhead rendering already described by the audit.
3. Run a focused browser interaction check: playback, scrub, seek, zoom, resize, side-panel changes, clip selection and editor interaction.
4. **Only if a reproducible defect or measured bottleneck exists**, capture a browser trace, identify the actual hot path, implement the smallest change, and demonstrate before/after evidence.
5. Keep the generic Timeline component domain-neutral. Replay must remain the sole clock owner.

**Acceptance criteria**

- No unnecessary reimplementation of existing optimizations.
- No playback or scrub correctness regression.
- Any actual optimization is supported by reproducible, comparable measurements; otherwise report “validated/no change.”

### P2-07 — Browser/WebGL end-to-end verification and documentation

**Instructions for Codex**

1. Follow project browser/WebGL preflight and test skills. Do not treat unit-test success alone as proof of visual correctness.
2. Validate real Cesium terrain, tile/overlay readiness, camera restore, endpoint POI positioning, and Replay UI teardown under Basic and Expert.
3. Confirm MP4 visual output includes expected map imagery/POIs/widgets where appropriate. This is a **correctness** check, not an export-speed benchmark.
4. Update the implementation-status inventory and `TODO.md` **only for items demonstrably resolved**; keep project documentation in English.
5. Submit a concise evidence report with failures, screenshots or recorded observations if available, and remaining gaps.

**Acceptance criteria**

- Browser checks cover all changed paths, and observed limitations are documented.
- Task status matches tests and reproducible behavior, not inferred commit history.
- No unresolved source changes are misrepresented as completed.

## 4. Functional validation matrix

Use this matrix selectively for each affected task; expand it when the root cause needs more coverage.

| Dimension | Required cases |
| --- | --- |
| Replay mode | Basic; Expert; change mode before/after a run |
| POI visibility | `yes`; `no`; `user`; POI-level animation opt-out |
| POI lifecycle | Existing; newly added; edited; removed; expanded; collapsed |
| Endpoints | Distinct start/stop; `tooClose` co-located endpoints |
| Playback state | Prepare; start; play; pause/resume; seek; end; cancel; repeat |
| Media handoff | Successful MP4; finalization failure; UI/dialog failure; subsequent Replay |
| Rendering | Cesium camera restoration; POI/map overlays; zero-duration trace; Timeline resize |
| Persistence | Original Journey/POI data unchanged by transient Replay state |

## 5. Recommended command sequence

Use the installed tools and exact conventions required by `PROJECT_RULES.md`; verify the local repository setup first.

```bash
git status --short --branch
git rev-parse HEAD
bun run test:unit
bun run test:ui
bun run test:integration
bun run test:browser
bun run typecheck
bun run lint
bun run build
```

For efficiency, first run only the failing/affected Vitest files with the project's supported runner syntax; broaden tests after a fix. Never assume a command passed unless it was actually executed. Browser and build commands may require additional environment prerequisites; document any blockers and run the remaining available checks.

## 6. Explicitly deferred / not authorized for `1.0.0` under this brief

These are tracked future design/optimization items, **not residual defects to implement automatically here**:

- **Export-speed regression:** closed by user confirmation. Do not reopen.
- **Further video export performance optimizations:** separate proposed investigation; no implementation without new scope and current profiling.
- **Comprehensive `1.1.0` POI animation spec, issue #395:** per-POI `pauseReplay`, complete configurable hidden fields including date/time, fully paired endpoint presentation with transient full stop-data snapshot, deterministic pause-aware scheduling, and broader clip-duration rules. Do not implement as incidental stabilization.
- **Major Timeline or Replay architecture changes**, multitrack persistence, new output profiles, unrelated UI designs, or renderer/worker overhauls.

If a current `1.0.0` bug cannot be fixed without one of these changes, provide evidence, the smallest proposed scope expansion, and the user decision required **before** introducing it.

## 7. Definition of done and Codex reporting format

Deliver implementation as small, reviewable changes in priority order. Each completed item must include a reproduction case, root cause, changed files, focused tests, and observed result. Do not conflate a merged commit with proof of correct behavior.

At the end, respond to the user **in French** with:

1. **Completed:** task IDs, problem corrected, files changed, and evidence.
2. **Validation:** exact commands executed with pass/fail/skipped counts; latest CI status if available.
3. **Remaining:** unresolved bugs, unrelated baseline test failures, browser limitations, and product decisions required.
4. **Out of scope respected:** confirm no work was performed on the already resolved export-speed regression or deferred `1.1.0` features.

**Success for this brief means stable existing Replay/POI behavior, truthful test status, and robust MP4 end-of-session handling — not a broader feature release.**

## 8. Repository reference links

- [Branch `1.0.0`](https://github.com/lgs1920/studio/tree/1.0.0)
- [Reviewed commit](https://github.com/lgs1920/studio/commit/880fc6dd24a8caa030858763926ed5fac683d40d)
- [Failed CI run](https://github.com/lgs1920/studio/actions/runs/41219952332)
- [Active TODO](https://github.com/lgs1920/studio/blob/1.0.0/TODO.md)
- [Replay implementation status](https://github.com/lgs1920/studio/blob/1.0.0/tech-doc/specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md)
- [POI Replay animation spec — target `1.1.0`](https://github.com/lgs1920/studio/blob/1.0.0/tech-doc/todo/CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md)
- [Replay Timeline audit](https://github.com/lgs1920/studio/blob/1.0.0/tech-doc/todo/CORE-REPLAY-TIMELINE-PERFORMANCE-AUDIT.md)
- [Export performance proposal — not this task](https://github.com/lgs1920/studio/blob/1.0.0/tech-doc/todo/CORE-REPLAY-HQ-VIDEO-EXPORT-PERFORMANCE-OPTIMIZATION-PLAN.md)