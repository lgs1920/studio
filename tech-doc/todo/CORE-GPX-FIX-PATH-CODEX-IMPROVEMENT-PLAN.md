# Fix Path — Codex Stabilization and Performance Improvement Plan (`1.0.0`)

**Status:** PROPOSED — implementation requires the project's normal review and approval workflow  
**Repository:** `lgs1920/studio`  
**Target branch:** `1.0.0`  
**Audit reference:** GitHub source inspection on 2026-11-01, branch HEAD `2c418cc71d80b0b799e0a55cdb36c2bb8e907e0b`  
**Scope:** Manual GPX Fix Path editor, editor-only rendering, geometry calculation, selection, persistence, widget ergonomics and regression tests  
**Explicit exclusions:** Unrelated POI startup rendering, Replay camera/clock/export redesign, resolved Replay MP4 export-speed regression, and feature work outside Fix Path

> This document is a Codex implementation brief, not a claim that performance issues have been reproduced in a browser. Distinguish confirmed code structure, plausible bottlenecks and measured defects. No code changes are authorized by this document alone.

## 1. Mission

Audit, measure and incrementally improve the existing Fix Path workflow while retaining the complete current editing contract. Prioritize:

1. Smooth point dragging and responsive Cesium navigation on long GPX tracks.
2. Reliable save/close/reopen semantics and correct handling of redraw failures.
3. Scalable route hit testing, lasso/rectangle selection and editor overlay projection.
4. Reopening the transient widget without unexpectedly losing its preferred dimensions or position, if supported by the widget lifecycle.
5. Deterministic, regression-tested preservation of corrected route data and Replay behavior.

Preserve the source GPX. Fix Path corrections must remain persisted on the Journey and applied only as derived track content. The canonical corrected content from `getCorrectedTrackContent()` must remain authoritative for map drawing, Journey statistics, elevation/profile and Replay path sampling.

## 2. Mandatory repository rules

Read the current working-tree versions of all applicable instructions before editing:

- `.lgs1920/guidance/PROJECT_RULES.common.md` when present
- `PROJECT_RULES.md` and `AGENTS.md`
- `skills/lgs-1920-studio-performance-rendering/SKILL.md`
- `skills/lgs-1920-studio-testing-workflow/SKILL.md`
- `skills/lgs-1920-studio-browser-webgl/SKILL.md` and `skills/lgs-1920-studio-browser-devtools/SKILL.md` for browser verification
- Relevant Cesium, Journey, editor, Replay, camera and widget skills

Project conventions: code, documentation, JSDoc and issues in English; conversational report in French; JavaScript/JSX, no semicolons, named exports, arrow functions, Valtio, existing Web Awesome 3 and Font Awesome patterns. Protect unrelated/uncommitted work. Do **not** run `bun run dev`.

Follow the project's correction approval gate: present the measured root causes and a scoped implementation proposal for validation before production code changes. Do not commit, push, merge, deploy or open a PR without separate explicit authorization.

## 3. Existing implementation — verified by static inspection

| File | Existing behavior / concern |
| --- | --- |
| `src/components/MainUI/FixPathEditor.jsx` | Approximately 3,193 lines. Owns drafts, history, dragging, scans, Cesium overlays, validation, persistence and widget state. |
| `src/components/MainUI/FixPathEditorGeometry.js` | Projects overlays, computes closest route positions, groups screen-space markers and checks terrain visibility. |
| `src/components/MainUI/FixPathEditorPanel.jsx` | Renders the current section's list of points, elevation controls, selection, actions and feedback. |
| `src/components/MainUI/FixPathEditorConfig.js` | Widget is transient, draggable and resizable; `persist: false`. Screen selection budget: 8 ms. |
| `src/Utils/cesium/fixPathCorrections.js` | Normalizes corrections, applies derived geometry, handles insertions/times, fingerprints and caches effective content. |
| `src/Utils/cesium/fixPathCorrectionEditing.js` | Builds/merges/splits sections; translates, inserts, erases and moves control points. |
| `src/Utils/cesium/fixPathScreenSelection.js` | Screen polygon tests, route grouping and an 8 ms yield clock. |
| `tech-doc/specs/cesium/CORE-GPX-FIX-PATH.md` | Existing functional specification; preserve its invariants unless a change is separately approved. |
| `TODO.md` | Explicit outstanding checks on widget dimensions/position persistence and resize handles. |

Important positive foundations already exist: source fingerprints; immutable source GPX; retained extra coordinate dimensions and timestamps; exact moved-source anchors; undo/redo; section merging and splitting; terrain-aware marker visibility; a chunked area scan; and source-to-derived geometry mapping. **Do not replace these mechanisms without evidence that they are defective.**

### 3.1 Likely drag/redraw hot path — not yet benchmarked

In `FixPathEditor.jsx`:

- Pointer movement builds and publishes `dragPreview` (approximately lines 1900–1934).
- `displayCorrectionsByTrack` recomputes the changed draft while a preview exists (approximately lines 723–744).
- The display-content override effect applies `applyFixPathCorrections()` to correction-bearing tracks and can call `TrackUtils.draw()` (approximately lines 746–785).
- The effect fires independently of whether an older asynchronous draw is still pending.

This is a credible source of repeated geometry work and concurrent redraw churn on large tracks. It is **not** proof that this path is the observed runtime bottleneck: profile it first. Determine whether `TrackUtils.draw()`, React state propagation, `applyFixPathCorrections()`, Cesium entity churn, or another stage dominates.

### 3.2 Candidate save/close lifecycle defect

`close()` currently checks `draftNeedsPersistenceRef.current`, invokes `persistDraftCorrectionsRef.current?.(...)` and returns without an explicit success-to-close continuation in that branch (approximately lines 694 onward). Test whether the first Close click merely saves and requires a second click.

The persistence flow validates fingerprints and corrections, updates Journey state, calls `Utils.updateJourney(...)` and redraws changed tracks. It distinguishes save failure from redraw failure. Do not report a data-loss defect without reproducing it. Confirm state and retry behavior if the data is saved but map redraw fails.

### 3.3 Long-track search, scan and overlay concerns

- `findClosestRoutePosition()` linearly scans source route intervals for each candidate hit.
- `journeyMapHit()` may apply corrections and search multiple tracks during mouse interactions (approximately lines 879–944).
- Continuous hover can call route hit resolution periodically (approximately lines 1018–1064).
- Lasso/rectangle scans already yield at roughly an 8 ms budget (approximately lines 1243–1369); retain cancellation via `scanGenerationRef`.
- `projectEditOverlay()` projects current correction markers, groups nearby points in screen cells and queries terrain visibility. It is invoked from a `postRender` listener with an approximately 80 ms throttle. Validate actual CPU cost and interaction correctness before changing it.
- `FixPathEditorPanel.jsx` renders the full active section point list. The row count may be large; measure DOM and layout costs before choosing virtualization.

## 4. Non-negotiable correctness boundaries

Every change must preserve:

1. The source GPX geometry, features, coordinate dimensions and timestamp data without in-place mutation.
2. Existing `fixPathCorrectionData` normalization, revision/fingerprint safety, `fixPathEnabled` behavior and stable section/point identities.
3. The distinction between section membership, `fixed`, `removed` and inserted points; exact moved anchors, interpolation, source ordering, antimeridian and high-latitude support.
4. Undo/Redo for movement, elevation, section membership, merges, splits, addition, erase, reset and deletion.
5. Native Cesium navigation outside gestures owned by Fix Path; pointer capture, cancellation, window blur and tab hiding must not leave a stuck drag.
6. Existing color/shape conventions for active/inactive, moved/unmodified, selected/removed markers; selection and panel synchronization.
7. Fix Path visibility-eye behavior as **editor-only presentation**, never a change to accepted corrections or Replay state.
8. Journey persistence and derived route updates for map drawing, statistics, elevation/profile and Replay.
9. Deterministic Replay Basic/Expert behavior, camera ownership, logical timing, POI visibility/animation and MP4 export output. Do not modify the Replay scheduler or export pipeline for this task.
10. Reliable disposal of observers, event listeners, pointers, asynchronous work, display overrides and Cesium resources.

## 5. Phase 0 — Reproducible performance and correctness baseline (P0)

Before changing code, choose representative small, 10,000-point and 100,000-point GPX fixtures (or the largest representative supported track size). Record source vertex count, number of modified sections, active section size, viewport, loaded terrain, browser, machine and rendering backend. Use the same inputs before/after.

Capture, at minimum:

- Main-thread long tasks and total blocking time; frame-time p50/p95 during drag and map navigation.
- `pointermove` event frequency and drag-preview React updates.
- `applyFixPathCorrections()` invocations and durations, by affected track and event reason.
- `TrackUtils.draw()` start/completion count, concurrent in-flight count and stale-completion count.
- Number of Cesium entities/data-source updates per drag.
- Route-hit query count, scanned segment count, max/p95 query duration.
- Area scan duration, slice durations, cancellation and selection-result correctness.
- Overlay projection duration, visibility checks and SVG marker counts.
- Save latency and reopen correctness, including failure injection.

Prefer an opt-in bounded diagnostic collector or browser Performance marks, not unbounded logs inside a hot loop. A successful `vitest` run cannot substitute for a browser/Cesium performance profile.

**Exit gate:** publish baseline observations and identify the actual hot path. If the likely hot path is not dominant, change the plan to match measured evidence.

## 6. Phase 1 — Smooth, latest-only drag preview (P0)

**Goal:** a point drag provides immediate, accurate visual feedback while avoiding redundant full-track work.

### Proposed approach (validate against measurements)

1. Keep immediate input ownership and the drag-preview feedback path intact, including multiselection translation and altitude offsets.
2. Coalesce high-frequency drag updates to at most the latest relevant preview per render opportunity. Do not drop the final pointer position.
3. Separate inexpensive transient marker/segment feedback from the expensive complete route rebuild wherever geometry permits; prefer local affected-section updates and reuse unchanged track/segment data.
4. Do not redraw every corrected track when only one track's draft changed. Scope display overrides by track identity, correction revision and preview generation.
5. Ensure the latest drag generation wins. Prevent an older asynchronous `TrackUtils.draw()` from overwriting a newer preview or committed result. Investigate existing draw ownership and cancellation semantics before adding a second scheduler.
6. On pointerup, commit exactly the final valid position through the existing validation/persistence pathway. On pointercancel, loss of capture, blur or hide, discard only the transient preview and restore valid camera gestures.
7. Keep route correction preview visually faithful to the current editor; do not leave a permanently simplified or stale route.
8. Avoid new hot-path allocations or unbounded caches. Do not introduce timers that can starve edits during continuous Cesium movement.

**Do not assume a Worker is required.** A Worker can calculate pure, transferable geometry if a measured hotspot warrants it. DOM work, Cesium scene manipulation, picking and display must remain in their appropriate owner. Reject any Worker design that introduces late/stale geometry commits or larger copying cost than the work saved.

**Acceptance:** dragging remains responsive on representative long GPX, final coordinate is exact, only the last committed preview persists, no lost/duplicated markers, and Cesium navigation remains responsive.

## 7. Phase 2 — Save, close, failure recovery and revision ordering (P0)

1. Reproduce the Close-while-dirty scenario and verify whether it closes after the first successful save.
2. If reproduced, model a clear save-and-close transition: await persistence; close exactly once after confirmed success; keep the editor and actionable feedback open on validation/persistence failure.
3. Differentiate **saved data, failed redraw** from **unsaved data**. Never issue a false success or silently discard edits.
4. Verify that retry after a successful save but failed redraw does not create unnecessary changes or duplicate transformations. Prefer idempotent refresh/retry semantics.
5. Serialize overlapping save/section-preference writes appropriately; prevent stale completions from restoring older section state or Journey data.
6. Preserve Undo/Redo, active section, selection and cancellation behavior; do not reset an editor draft while a still-valid save is completing.
7. Test switch Journey/track, unmount and tab changes during pending save/redraw without corrupting another Journey.

**Acceptance:** first Close click saves and closes on success, failure stays editable, persisted corrections survive reopen, no stale or duplicated revision, and the displayed route eventually matches persisted derived content.

## 8. Phase 3 — Scalable route hit testing and area selection (P1)

1. Benchmark linear `findClosestRoutePosition()` before choosing a spatial data structure.
2. If needed, build/reuse a lightweight route-segment spatial index keyed to immutable source/derived geometry identity and relevant correction revision; invalidate it on track replacement, drag commits and editor disposal.
3. Use fast candidate narrowing, followed by the existing exact nearest-segment and screen-space visibility/tolerance checks. Preserve correct behavior at the antimeridian, poles/high latitudes, zero-length segments and repeated route passages.
4. Prefer scene picking when reliable, with a bounded fallback rather than an automatic full search on every pointer event.
5. Preserve the existing chunked lasso/rectangle scan with cancellation and visible-source-point semantics. Do not reintroduce blocking full-route projection.
6. If pure indexing is materially expensive, investigate a Worker with transferable inputs and generation tokens. Keep Cesium APIs and depth readback on the main thread.
7. Test a camera move or terrain tile change occurring mid-scan: results must not be published against an incompatible viewport/scene.

**Acceptance:** exact same selected source indices/sections and hit behavior, with measurable improvement on large tracks and no selection starvation.

## 9. Phase 4 — Overlay and large-section list responsiveness (P1)

- Profile `projectEditOverlay()`, screen-cell depth checks, marker SVG creation and React rerenders while moving the camera.
- Reuse stable source world coordinates when valid; recalculate screen positions only when camera/viewport or correction geometry changes.
- Cull genuinely offscreen markers before expensive visual checks while preserving overlapping-marker closest-hit behavior and selection visibility.
- Consider list virtualization only if actual row count/layout costs justify it. Preserve full keyboard navigation, Ctrl/Cmd+A, row focus, selected-row scroll, screen-reader names and altitude controls; do not break height editing `onInput` / `onChange` semantics.
- Do not replace native Cesium picking or terrain occlusion with unverified approximations.

**Acceptance:** no misplaced markers, focus/selection bugs, delayed altitude commits or extra map redraws; lower measured UI work under representative load.

## 10. Phase 5 — Widget re-open geometry and UX audit (P1/P2)

`FIX_PATH_WIDGET_CONFIG` currently sets `persist: false`. `TODO.md` explicitly asks whether dimensions and position survive close/reopen.

1. Document the actual existing widget lifecycle and verify reopen, Journey switch, browser resize, constrained viewports and corner/side resize handles in a real browser.
2. Propose the smallest compatible session-preference persistence for Fix Path dimensions/position if the existing widget manager supports it. Do not persist transient editor content or a second correction model.
3. Keep the widget onscreen when the viewport shrinks; avoid changing normal Journey toolbar visibility or saved UI preferences.
4. Clarify and test `Remove` versus `Erase` versus `Reset` feedback. Preserve the documented semantics and keyboard shortcuts; change wording only when behavior and docs are updated together.
5. Treat optional enhancements (profile-linked point selection, richer before/after comparison) as separate proposals, not required scope for this stabilization task.

**Acceptance:** predictable widget reopen, no misplaced handles, no change to saved correction data or map camera orientation, and stable keyboard/pointer operation.

## 11. Targeted test matrix

### Existing suites to inspect and extend

- `src/__tests__/unit/utils/fix-path-corrections.test.js`
- `src/__tests__/unit/utils/fix-path-correction-editing.test.js`
- `src/__tests__/unit/utils/fix-path-editor-geometry.test.js`
- `src/__tests__/unit/utils/fix-path-screen-selection.test.js`
- `src/__tests__/ui/main-ui/fix-path-editor-input-lock.test.jsx`
- `src/__tests__/ui/main-ui/fix-path-editor-selection-replacement.test.jsx`
- `src/__tests__/ui/main-ui/fix-path-editor-panel-feedback.test.jsx`
- `src/__tests__/browser/fix-path-editor-layout.browser.test.jsx`
- Relevant Journey settings, track drawing, profile/statistics and Replay-corrected-track tests.

### Required regressions

- Single and multiselect drag, final pointer coordinate, interrupted drag, cancellation and overlapping markers.
- Drag over 10k/100k vertices; repeated movement while Cesium camera moves; latest draw wins.
- Lasso/rectangle selection on long multi-track/multi-section routes, on terrain, at antimeridian and for removed/unmodified points.
- Inserted points, source-point movement, removed-only sections, section merge/split and Undo/Redo.
- Manual altitude edit/commit and unit conversion.
- Dirty Close, validation failure, persistence rejection, redraw failure, retry, reopen and Journey replacement.
- Widget reopen geometry, resizing and viewport reduction.
- Derived track parity across live Cesium rendering, statistics, elevation profile and Replay. Verify that editor-only eye visibility never affects Replay.
- Replay entry/exit and deterministic export smoke coverage whenever the shared correction path, cache identity or revision handling changes.

Use deterministic test fixtures and completion signals rather than arbitrary sleeps or chained animation-frame waits. Restore all mocked globals, timers, observers and event listeners.

## 12. Required validation workflow

1. Inspect `git status` and current `1.0.0` HEAD; protect local changes.
2. Profile existing behavior before optimization; record fixture and environment.
3. Propose the smallest scoped fix and receive the project's required approval.
4. Add focused tests alongside each authorized change.
5. Run focused Vitest tests, the affected test project with CI-like parallelism, `bun run lint`, `bun run typecheck`, and `bun run build` as appropriate. Do not run `bun run dev`.
6. Before **any** real browser testing, run `bun skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs ensure` and verify actual WebGL 2 pixel readback. For a distinct browser test runner, validate WebGL in that browser too.
7. Compare matched browser traces before/after. Report p50/p95 frame time, long tasks, edit latency, draw count and maximum pending work; do not invent speedup percentages.
8. Verify all canonical Fix Path and Replay preservation requirements.
9. Update `tech-doc/specs/cesium/CORE-GPX-FIX-PATH.md` and applicable tests only for behavior that actually changed. Keep outstanding proposals in `tech-doc/todo/`.

### Suggested performance goals (not measured facts)

- Aim for responsive pointer interaction and no new Fix Path-attributable main-thread task exceeding 50 ms during drag where practical.
- On a 60 Hz target, use approximately 16.7 ms/frame as a reference, not an unconditional pass threshold across all hardware.
- Avoid p95 frame-time regressions versus the matched baseline; substantiate any observed gains on both short and long routes.
- Ensure correctness even when rendering is slower or when the camera keeps moving.

## 13. Definition of Done

A phase can be marked completed only when:

- Its failure or bottleneck was reproduced or explicitly disproved.
- The implementation is narrowly scoped, deterministic, cleaned up and covered by relevant tests.
- Browser behavior is validated for Cesium with a verified WebGL context where required.
- The source GPX remains unchanged and saved corrections survive reopen.
- All users of corrected derived track content (map, metrics, profile, Replay) remain consistent.
- No regressions in normal Cesium navigation, selection ownership, Replay or MP4 export are found.
- Before/after results, limitations and any CI failures unrelated to the change are reported transparently.

## 14. Codex report format (in French)

Provide:

1. **Baseline and findings:** confirmed vs hypothesized hotspots, reproduction, commit and fixture.
2. **Changes by phase:** filenames, architectural choice, impact and rollback considerations.
3. **Validation:** named test commands/results; browser/WebGL preflight; before/after measured values.
4. **Compatibility:** source GPX, corrected geometry, map/profile/statistics, Replay and export checks.
5. **Remaining risks:** existing unrelated CI failures, blocked verifications, open approval decisions.
6. **Delivery state:** proposed-only, implemented locally, or committed only when explicitly requested.

## Reference links

- [Fix Path functional specification](../specs/cesium/CORE-GPX-FIX-PATH.md)
- [Fix Path editor](../../src/components/MainUI/FixPathEditor.jsx)
- [Fix Path geometry](../../src/components/MainUI/FixPathEditorGeometry.js)
- [Fix Path editor panel](../../src/components/MainUI/FixPathEditorPanel.jsx)
- [Fix Path widget configuration](../../src/components/MainUI/FixPathEditorConfig.js)
- [Fix Path correction engine](../../src/Utils/cesium/fixPathCorrections.js)
- [Fix Path correction editing](../../src/Utils/cesium/fixPathCorrectionEditing.js)
- [Fix Path screen selection](../../src/Utils/cesium/fixPathScreenSelection.js)
- [Repository project rules](../../PROJECT_RULES.md)
