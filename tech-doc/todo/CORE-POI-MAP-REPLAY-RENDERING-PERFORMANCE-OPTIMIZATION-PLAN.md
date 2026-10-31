# POI Rendering and Replay Performance — Codex Implementation Plan

**Status:** IN PROGRESS — opt-in diagnostics implemented; no performance baseline or optimization is yet validated
**Reviewed source:** lgs1920/studio, branch 1.0.0, static GitHub inspection on 2026-10-31
**Scope:** POI rendering and movement on the interactive Cesium map, interactive Journey Replay, and deterministic Replay MP4 export
**Implementation language:** JavaScript / JSX only
**Intended repository location:** `tech-doc/todo/CORE-POI-MAP-REPLAY-RENDERING-PERFORMANCE-OPTIMIZATION-PLAN.md`

## 1. Codex task

Inspect the current checkout of 1.0.0 and develop a measured, incremental performance improvement for the POI display pipeline. Optimize the interactions between React, Valtio, DOM/SnapDOM capture, Cesium billboards, and Journey Replay. Preserve map behavior, Replay timing, the source of truth for POI state, and captured video pixels.

Do not migrate all POIs to moving DOM elements. The normal geographic representation is already a Cesium entity/billboard. Retain that architecture and use DOM for rich content, editing, and deliberate transient previews only when warranted. When a POI moves on the map, update its Cesium position rather than re-rasterizing unchanged HTML or persisting new geographic coordinates on every frame.

This document is a technical plan and a set of acceptance criteria, not evidence that a particular bottleneck has already been measured. Work through the required project approval and validation workflow. Do not commit, push, open a PR, or change production behavior solely because this TODO exists unless the user separately authorizes that action.

## 2. Mandatory project instructions

Before editing code, read the versions in the actual checkout of:

- `PROJECT_RULES.md` (authoritative)
- `AGENTS.md`, if present
- `skills/lgs-1920-studio-map-poi-management/SKILL.md`
- `skills/lgs-1920-studio-performance-rendering/SKILL.md`
- `skills/lgs-1920-studio-replay-video-export/SKILL.md`
- `skills/lgs-1920-studio-cesium-camera/SKILL.md`
- `skills/lgs-1920-studio-scene-composition/SKILL.md`
- `skills/lgs-1920-studio-testing-workflow/SKILL.md`
- `skills/lgs-1920-studio-browser-webgl/SKILL.md` and `skills/lgs-1920-studio-browser-devtools/SKILL.md` before any actual browser test

Mandatory conventions to preserve:

- User-facing conversation is in French; project specifications, JSDoc, code comments, issues, and documentation are in English.
- Use JavaScript/JSX, never introduce TypeScript. No semicolons; named exports; arrow functions except constructors; private class fields use `#`; use full element and event names, not `el` and `ev`.
- Follow Valtio proxy/snapshot naming, React ref naming, existing subscriptions, project-specific code layout, Web Awesome 3 and Font Awesome requirements.
- Do not introduce a new UI framework or a second Replay clock, independent animation timer, encoder, or data persistence model.
- Do not run `bun run dev`. Follow the repository's targeted test, lint, typecheck, build and browser/WebGL requirements. Use the required WebGL 2 pixel-readback preflight before browser validation.
- Protect uncommitted user changes. Keep edits scoped, reversible, documented, and covered by regression tests. Do not remove existing functionality as an optimization without validating its full ownership contract.
- Place proposals in `tech-doc/todo/`; place verified implementation behavior in the relevant `tech-doc/specs/` document, update technical catalogs, and follow the project's documented PR-to-main workflow for delivery.

## 3. Verified architecture on branch 1.0.0

The following observations come from a static source inspection, not a browser benchmark. Recheck against the working tree before coding, because it may have moved since the review.

### 3.1 Data and rendering ownership

| Module | Relevant existing behavior |
| --- | --- |
| `src/core/ui/POIManager.js` | Manages POI data, Valtio proxyMap, journey associations, geometry, DB writes, location refreshes, and Replay POI candidates. `updatePOI` mutates the POI, reassigns it in the map, may refresh location and may persist; Replay calls use `skipPersist`. |
| `src/core/stores/main.js` | Defines the POI proxyMap, filtered maps, visibility map and related state. |
| `src/components/MainUI/MapPOI/MapPOIMonitor.jsx` | The currently mounted main UI POI path; renders `MapPOIContent` for entries in the POI list and manages Cesium interaction events. |
| `src/components/MainUI/MapPOI/MapPOIContent.jsx` | Defines the rich DOM appearance, attaches content/size observers, rasterizes map cards with `snapdom()` and `snap.toCanvas()`, and updates the Cesium representation. |
| `src/components/MainUI/MapPOI/poiCanvasRenderQueue.js` | Already limits POI capture concurrency and coalesces pending requests by POI key. Preserve this property. |
| `src/Utils/cesium/POIUtils.js` | Creates/updates Cesium entities and billboards, computes visibility and distance scale, and prevents duplicate entities in different containers. Existing entities have many graphical properties rewritten by `draw()`. |
| `src/components/MainUI/MapPOI/poiHoverPreviewStore.js` | Owns one active transient DOM preview; hides the matching billboard and restores it when the preview closes. |

`src/components/MainUI/MainUI.jsx` mounts `MapPOIMonitor`, which mounts `MapPOICluster`; the cluster creates one `MapPOI` instance for every loaded POI. `src/components/cesium/MapPOI.jsx` therefore has a reachable per-POI `requestAnimationFrame` projection loop in the current main UI. This establishes reachability, not cost: profile it with realistic POI counts before changing the scheduler.

A Shift-hover preview path exists but is currently guarded by `DISABLE_POI_SHIFT_HOVER_FOR_DIAGNOSTIC = true` in `MapPOIContent.jsx`. Do not reactivate it or delete it incidentally; verify its intended product state.

### 3.2 Current POI image path

```text
POI data and display properties
  -> Valtio/React MapPOIContent
  -> HTML/CSS representation
  -> MutationObserver / ResizeObserver / property changes
  -> queued SnapDOM capture (bounded concurrency)
  -> Canvas image
  -> POIUtils.draw()
  -> Cesium Entity/Billboard -> WebGL map
```

`MapPOIContent` already checks whether an asynchronous capture is stale before committing it. The queued capture must continue to reject outdated results after an edit, seek, POI removal, visibility change, Replay phase change, or component unmount.

### 3.3 Replay ownership

| Module | Relevant existing behavior |
| --- | --- |
| `src/core/ui/replay/JourneyReplaySessionPOIController.js` | Prepares nearby POIs and their projected positions along the Journey, computes windows of appearance and crop checks, and triggers expansion/collapse from Replay sample progress. |
| `src/core/ui/replay/JourneyReplayVisibilityController.js` | Applies transient Replay masks, consults POI entities, restores prior visibility, and contains a `startStopClipPOIMaskLoop()` that reapplies visibility in a RAF loop during its active stop-clip lifecycle. Entity lookups now use a bounded Replay-session cache invalidated by entity additions/removals and data-source ownership changes. |
| `src/core/ui/replay/JourneyReplayPOISettings.js` | Resolves Replay POI visibility and animation policy, including Basic/Expert behavior and endpoint special cases. |
| `src/core/ui/replay/JourneyReplaySessionSceneController.js` | Publishes live Replay updates and avoids duplicate interactive-camera updates during deterministic export frames. |
| `src/core/ui/replay/ReplayFramePublisher.js`, `ReplayRenderTarget.js`, `ReplayDeferredExporter.js` | Own logical frame publication, render-target selection, and video export. Inspect rather than duplicate their timing or target selection. |

`syncNearbyPOIsForSample()` processes candidate POIs and builds active expansion sets. `updatePOIExpandedState()` currently uses `POIManager.updatePOI(..., {skipPersist: true, skipLocationUpdate: true})`. Changes may propagate through Valtio and trigger DOM rasterization. This is an optimization opportunity, not proof that captures occur on every video frame.

`applyJourneyReplayPOIVisibility()` can walk a broad candidate set. On a lookup-cache miss, `poiEntities()` searches the selected owner, global viewer and all data sources; later lookups reuse entity references until collection membership, data-source ownership, viewer, or scene identity changes. The RAF mask loop is a potential repeated visibility-resolution cost. Its safety rationale must be established before replacing it.

## 4. Non-negotiable behavior

An optimization must preserve:

1. Identity, stable IDs, journey/track membership, global POIs, search, picking, click/tap, double-click, context menus, editing, drag/move behavior, and persisted POI settings.
2. Cesium terrain clamping, globe/terrain/3D depth behavior, correct map-to-world positioning, `tooClose`, distance-based scale, crop geometry, and scene/terrain replacement.
3. Both Basic and Expert Replay policies, selected journey filtering, global/other-journey visibility, user-hidden POIs, Start/Stop endpoints, special coincident endpoints, animation opt-outs, near-passage windows and repeated passage handling.
4. Forward and reverse playback, pause, scrub/seek, loop, clip transitions, partial/complete export, cancellation, cleanup and restoration of the original live map.
5. Deterministic Replay export: one authoritative frame timestamp and camera, correct POI state for that frame, no wall-clock-dependent POI animation, no stale SnapDOM canvas, no extra post-processing video pipeline.
6. Pixel/visual fidelity of expanded cards: typefaces, icon color, title, category, altitude, date/time, leader/stick geometry, contrast, rotation, borders, sizing, alpha, clipping and widget/Logo/Credits ordering where applicable.
7. Independence of durable POI data from temporary Replay visibility or expansion. Do not persist per-frame movement or transient capture masks.

## 5. Phase 0 — Establish a reproducible baseline (mandatory)

Do not implement a broad rewrite based solely on this document. Start with repeatable measurements on the actual development machine and browser, against the currently checked-out commit.

Instrument a small, opt-in POI performance collector, reusing the existing recording-performance conventions rather than introducing unbounded per-frame logs. Avoid console spam in the hot path. Count and time:

- Mounted `MapPOIContent` instances and active rich DOM capture surfaces.
- `snapdom()` invocation count, duration, `toCanvas()` duration, queue wait, active jobs, superseded and discarded captures, rendered bitmap dimensions and approximate retained canvas bytes.
- MutationObserver and ResizeObserver invalidation counts; reasons for invalidation; cache hit/miss when cache is tested.
- React commits / affected POI component renders; Valtio mutation rates; expanded-state transitions.
- `POIUtils.draw()` calls; billboard image/texture replacements versus position-only and show-only changes; entity-container scans and lookup counts.
- `applyJourneyReplayPOIVisibility()` count, total time and how many entities actually changed; stop-clip mask loop invocations.
- `syncNearbyPOIsForSample()` duration/candidate count, crop projection checks and state transitions.
- Main-thread long tasks, visible FPS, frame-time p50/p95, memory where available, Cesium render cost and MP4 frames-per-second/wall-clock export duration.

Implementation update (2026-10-31): a bounded, disabled-by-default collector is available through `?poiPerf=1` and `window.__lgsPoiPerformance.snapshot()`. It currently measures React POI render invocations, mounted content surfaces, capture request/queue/capture phases and canvas estimates, Cesium draw/entity/image updates, Replay visibility and nearby-POI sync costs, crop checks, and stop-clip mask ticks. It does not measure FPS, long tasks, heap/GPU memory, or export timing; use browser profiling and the existing Replay recording report for those. See [POI performance diagnostics](../specs/poi/POI-PERFORMANCE-DIAGNOSTICS.md). The browser instance checked during implementation had no loaded Studio scene because the backend was unreachable, so a matched baseline remains outstanding.

Follow-up from the first user profile: `mapPOI.projectionTick` included asynchronous terrain sampling and ran for every mounted POI while idle. The projection loop now runs only while that POI owns a hover title or DOM preview. This reduces idle projection and terrain work by construction; the user-provided profile is pre-change, and an after-profile plus hover/Replay validation is still required before claiming a measured gain.

Phase 1 code update: geographic position and height changes now update an existing Cesium entity directly. The capture effect watches longitude/latitude only when coordinates are displayed and height values only when altitude is displayed, so those changes do not rasterize unchanged card content. When the displayed value changes, the normal capture still refreshes the billboard image. The existing card capture path is also separated from this position-only update.

SnapDOM follow-up: identical in-flight capture requests are coalesced. A one-entry-per-mounted-POI canvas cache reuses the latest completed bitmap when its explicit visual signature is unchanged. A shared LRU cache also reuses identical completed or in-flight captures across POIs, capped at 128 entries and 64 MiB estimated RGBA storage. Icon loads and measured layout changes invalidate the local entry; displayed text, style, units, Replay display policy, theme, colors, connector geometry, and measured dimensions are part of the key. Cache hits update Cesium immediately and cancel that POI's obsolete pending raster request. Stale captures check request ownership after SnapDOM and skip `toCanvas()` when outdated. Runtime gain and pixel parity still require the planned browser comparison.

Replay lookup follow-up: POI entity references are cached per Replay session with a 2,048-ID bound. Entity add/remove events invalidate affected IDs; data-source add/remove/move events clear the cache and resynchronize collection listeners. Property-only `changed` events are ignored because they preserve entity identity and can occur during Replay visibility updates. The cache is disposed with the Replay session and recreated if viewer, scene, entity collection, or data-source collection identity changes. This removes repeated container scans after cache warm-up; measured impact and lifecycle regression coverage remain outstanding.

Replay visibility follow-up: `setPOIEntityVisibility()` now resolves the effective visibility once per POI and skips entity/billboard assignments whose current value already matches. Diagnostic counters report candidate counts, container scans, writes, and skipped writes. The existing mask lifecycle and its visibility rules remain intact; browser validation of clip transitions and final cleanup is still required.

Replay candidate follow-up: `POIManager.list` is a getter for the same POI `proxyMap` held in the main store. `replayPOICandidates()` now detects this identity and scans that list only once instead of iterating the full list a second time. `applyJourneyReplayPOIVisibility()` also builds its nearby-ID set during the candidate merge, avoiding a second pass over and resolution of the same nearby entries. It still merges runtime nearby entries and any genuinely separate manager list. The collector reports nearby and POI-list entry counts; the change does not alter candidate membership. Replay-scale impact and regression coverage remain outstanding.

Replay sample follow-up: `syncNearbyPOIsForSample()` now reuses a per-preparation unique nearby-POI array rather than allocating and filling a `Map` on every Replay sample. It is built from the already-projected candidates, preserves the Start POI override at route distance zero, and is cleared when playback state is restored or the Replay session is disposed. The original per-sample deduplication remains as a fallback if sample synchronization runs without preparation. Diagnostic snapshots count cache hits; Replay scale and visual timing still need regression validation.

Repeated-route POI follow-up: POI projection records distinct local passage abscissas on the corrected Replay sampler, including repeated visits when a route retraces the same geometry. Ordinary POIs animate at both the outbound and return passages; each passage has independent crop-entry state and a separate Basic Replay slowdown window. Start/Stop endpoint handling continues to use its existing single primary projection and endpoint rules. Adjacent equal-distance samples are collapsed, repeated projections within 25 m of the closest passage are considered the same POI route, and at most the first and last distinct visits are retained. This needs regression coverage for `A-B-C-B-A`, reverse playback, crop entry, and endpoint boundaries before claiming verified timing.

Exploratory profile supplied by the user (hardware, browser version, elapsed capture window, loaded/visible POI totals, and interaction sequence were not included): 3 mounted `MapPOIContent` surfaces; 363 projection ticks taking 339,979 ms cumulatively (936.6 ms average, 2,334 ms p95 among retained samples); five SnapDOM calls taking 20,422 ms total (4,084 ms average); five `toCanvas()` calls taking 1,847 ms total; five requests waited 13,404 ms total in the capture queue; three captures committed and two were discarded. The long awaited projection span is consistent with terrain sampling in `SceneUtils.degreesToPixelsCoordinates()`, but the provided aggregates do not establish that as the sole cause. The capture timings identify SnapDOM as the largest measured capture stage. Follow-up instrumentation now records capture reasons and stale-discard phases; stale captures are checked immediately after SnapDOM so obsolete work skips `toCanvas()`. Treat these numbers as a diagnostic sample, not a comparable baseline or a speedup result.

Test at least 20, 100, 300, and 1,000 loaded POIs where realistic; compare static map, camera orbit/pan/zoom, opening/closing individual and multiple POIs, changing styles, playing Replay, scrubbing, a stop clip, and MP4 export. Test stationary and moving POIs if moving POIs exist in the product. Include cold/warm caches and a complex multi-journey fixture.

Record GPU, browser version, OS, total/visible POI count, journey data, display scale, export dimensions, codec and FPS. Avoid counting an arbitrary number of source elements as a speedup. Store baseline/after results and test methodology in the implementation report. Do not invent percentage gains.

## 6. Phase 1 — Separate POI geometry, visibility and appearance (P0)

This is the recommended first implementation candidate if baseline traces show redundant captures or billboard updates.

### Intended contract

| Change | Minimal target operation | Should it trigger SnapDOM? |
| --- | --- | --- |
| Longitude, latitude or effective runtime position | Update existing Cesium entity position, with correct height reference | No, unless content explicitly displays a changed coordinate |
| Effective visibility / Replay mask | Set entity.show / billboard show when the effective value differs | No |
| Selection, hover-only UI | Update transient interaction layer | Not unless the graphic changes |
| Image appearance, text, style, icon, displayed unit | Capture or reuse the matching image variant, then update billboard image | Yes, if no valid cached variant exists |
| Open/closed card variant | Reuse or build the appropriate precomputed image variant | Only on cache miss |
| Change of parent/scene | Move or recreate entity in correct owner, invalidate stale ownership | Only if graphics became invalid |

Do not confuse changes to geographic data with a temporary runtime animation pose. Persistent edits may legitimately refresh derived address/time-zone information; moving a runtime marker must not.

Introduce narrowly scoped helpers/services only after examining the current component contract. Prefer incremental patches to `POIManager`, `POIUtils` and `MapPOIContent` over replacing the entire rendering layer. Preserve the existing asynchronous stale-capture guards and temporary Replay state behavior.

**Acceptance:** moving or hiding a POI whose appearance did not change causes zero new SnapDOM captures; pixel output remains equivalent to the baseline; tests cover position, visibility and scene replacement.

## 7. Phase 2 — Visual revision tracking and bounded image reuse (P1)

If profiling confirms avoidable captures, add a POI visual revision/signature, derived from only the fields that affect rendered pixels. Inputs may include:

- Collapsed/expanded variant and display style.
- Displayed title, category, visible icon, altitude, location, coordinates, time/date and relevant unit/format settings.
- Color/background, font family/size/weight/style, stick/leader geometry and visual rotation.
- Device pixel ratio or explicit rendering scale, and relevant global design-token/theme revision when it changes pixels.
- Replay-specific hidden-field policy when it changes content rather than merely visibility.

Do not use `JSON.stringify()` on the full POI object for every frame. Either compute a stable, explicit visual key at legitimate invalidation points or maintain a monotonic per-POI appearance revision that invalidates predictably. Use a bounded cache (per POI and/or shared identical variants), with explicit disposal, memory accounting and cache eviction. Do not retain unlimited UHD-scale canvases.

Keep `poiCanvasRenderQueue` bounded and keyed. Ensure a new request supersedes a pending outdated one, and an asynchronous capture may never commit after its owner changes or after its logical render frame has advanced. Benchmark whether early dropping of stale work helps.

Do not cache data that is actually time-dependent without a time/frame dependency in its key. Validate fonts/icons/async image readiness and responsive layout. Preserve exact visual appearance in export.

**Acceptance:** repeated display of an unchanged variant reuses its image; a genuine style/text update produces the new image exactly once per required revision (subject to fallback and retries); memory is bounded.

## 8. Phase 3 — Reduce unnecessary mounted DOM and reactive work (P1/P2)

`MapPOIMonitor` currently builds `MapPOIContent` for every loaded POI, even if only a subset requires a new rich capture. Investigate separating lightweight persistent Cesium entity ownership from heavyweight DOM capture/editor ownership.

Possible staged approach:

1. Keep normal Cesium billboards alive independently of the rich React tree.
2. Mount a POI's capture surface when its appearance is first needed or invalidated; mount rich interactive DOM when expanded/edited/previewed.
3. Reuse a previously captured surface when no visual revision changed; do not remount unnecessarily.
4. Scope Valtio subscriptions to the particular POI and minimal Replay-derived state. Avoid having all POI components rerender because the global Replay sample advanced.
5. Precompute a map/set of nearby and animated POI IDs outside individual component renders; avoid `replay.nearbyPois.find(...)` for every POI on every relevant global update.
6. Preserve Cesium picking and event bindings even when rich DOM is not mounted.

This is a larger architecture change. Perform it only after the smaller Phase 1/2 optimizations have been measured and explicitly approved. Confirm no hidden dependency on mounted DOM for image lifecycle, location refresh, icon load or canvas events.

The `MapPOICluster`/`src/components/cesium/MapPOI.jsx` RAF loop is reachable in the current application. Use the opt-in projection tick metrics and browser traces to establish its cost. If measurements justify a change, replace per-POI async projection/terrain work with an event-driven, single-owner scheduler for the small subset of active DOM overlays, not with one RAF for every POI. Avoid awaiting terrain sampling on every animation frame.

## 9. Phase 4 — Differential Replay visibility (P1)

Profile the `startStopClipPOIMaskLoop()` safety role before changing it. Determine exactly which code may re-show POIs behind the Replay's back (render commits, observer/capture, other journeys, scene replacement).

Replace unconditional global per-frame reevaluation only if all competing visibility writers can be reconciled. A proposed effective-visibility resolver should be deterministic and use at least:

```text
persisted POI visibility
+ journey and track visibility
+ hidden-other-journeys setting
+ Replay mode / active phase / Start-Stop special rules
+ temporary animated-ID set
+ tooClose and scene/crop rules where applicable
= effective entity visibility for the current Replay frame
```

Keep an ephemeral `poiId -> last effective visibility` map scoped to the active Replay/render target. Invalidate on scene reload, POI add/remove, parent change, Replay entry/exit and viewer target change. Do not change stored `poi.visible`. Preserve visibility before playback and correct cleanup for normal stop, cancel, errors, clip transitions and exported final frame. For isolated HQ output, confirm visibility updates target the owned scene rather than only the main viewer.

Do not change stored `poi.visible`. Preserve visibility before playback and correct cleanup for normal stop, cancel, errors, clip transitions and exported final frame. For isolated HQ output, confirm visibility updates target the owned scene rather than only the main viewer.

**Acceptance:** unchanged Replay frames produce no redundant entity show writes; all masks and restores remain identical under unit and browser tests.

## 10. Phase 5 — Replay candidate and animation-window efficiency (P2)

`getJourneyReplayPOIsForJourney()` already precomputes nearest path projection and sorts candidates. Build on that work rather than repeating geometry calculations on each sample.

Candidate design:

- Precompute stable route abscissae and candidate presentation windows when the Journey, route geometry, POI positions, Replay settings or playback direction is changed.
- Use a time/distance window index to select possible active POIs; evaluate dynamic crop entry and exact presentation state only for relevant candidates plus currently open POIs.
- Rebuild or invalidate the index on seek, reverse direction, timeline duration or speed change, crop/camera mode change, POI edit, Journey change or reroute.
- Account for start/stop endpoint behavior, co-located endpoints, `MAX_REPLAY_POI_APPEARANCES`, multiple visits to the same POI, animated opt-outs and open-card display timers.
- Preserve the behavior that a POI admitted early by crop entry may stay visible until the route marker reaches it, with time-based closure afterward. A simple fixed window threshold is not a correct replacement.

Do not replace the canonical Replay clock with `Date.now()`, a new RAF clock, or timer-based UI animation. A jump directly to an arbitrary timestamp must yield the same POI image and visibility state as rendering that timestamp in a sequential export, subject to the existing explicit appearance-state semantics. Document any unavoidable state-history behavior and test it.

**Acceptance:** per-frame candidate work scales mainly with the active/relevant subset on a large replay, with no changed first/last appearance frame.

## 11. Phase 6 — Entity lookup, map density and optional DOM overlay work (P2/P3)

### Entity ownership and lookup

`POIUtils.draw()` can reassign all billboard properties on existing entities. `removeEntityFromOtherContainers()` checks the main entity collection and every data source; `JourneyReplayVisibilityController.poiEntities()` scans these collections on cache miss and reuses session-cached entity references afterward. Profile the remaining ownership scans in `POIUtils.draw()`.

Where useful, maintain a validated, session-scoped lookup for `poiId -> {entity, container, viewer/target, scene revision}`. Invalidate on removal, data-source migration, scene replacement, target handoff, and disposal. Do not keep dead Cesium entities or accidentally leak the main viewer into isolated HQ export.

### Density, culling and collision

Existing `scaleByDistance` already reduces billboard scale with distance. If dense map scenes remain GPU-bound, prototype Cesium-supported grouping/culling or a category/priority-based display policy, while preserving selected, edited, active Replay and Start/Stop POIs. This is a separate visual product change, requiring explicit approval and tests; do not silently hide user-visible markers.

### DOM hover and movement

Keep HTML overlay previews transient and limited in number. If active, project only selected/hovered/expanded overlays from the correct camera in one coordinator, update CSS transform only when the projected coordinates change, and hide offscreen/occluded overlays. No per-POI React `setState` at full camera FPS for hundreds of POIs. Ensure overlay coordinates are measured relative to the map canvas rather than global window dimensions and remain accurate with panels, zoom, resize and DPR.

## 12. Replay video export parity

The Replay export is already a deterministic Cesium + compositing + MediaBunny pipeline. Do not introduce a new video encoder or resize/re-encode after MP4 finalization to make POIs look correct.

Verify all POI state that affects the encoded image is applied before the WebGL render/Canvas composition and `CanvasSource.add()` for that frame. Await only the necessary asynchronous captures and scene readiness. Use one authoritative Replay sample and timestamp for camera, positions, visibility, expanded variants and transient overlays. When possible, reuse cached POI visual variants, not a low-resolution bitmap stretched as fake extra detail.

Test both normal map and isolated export-target ownership, even if source/crop dimensions change. Preserve 720p/1080p/1440p/UHD/custom work described in the existing video-resolution TODOs. A separate specification owns general video resizing: do not duplicate its resolution semantics here.

## 13. Required tests and validation

### Focused unit tests (Vitest)

- Distinguish appearance changes from position-only/show-only edits; zero unnecessary capture calls.
- Visual-signature invalidation, distinct card variants, unit/style/theme revisions and safe stale-capture rejection.
- Queue concurrency limit, latest-request supersession, errors/cancellation and bounded cache eviction.
- Effective Replay POI visibility: Basic/Expert, yes/no/user, `tooClose`, global/other journeys, hidden endpoints, animated opt-outs, cleanup.
- Replay animation windows: forward/reverse/seek/scrub/loop, crop entry, co-located Start/Stop, repeated passages and final-frame boundary.
- Entity cache invalidation after parent moves, removal, scene replacement and viewer/isolated-target disposal.

Existing useful coverage to review/extend:

- `src/__tests__/unit/replay/poi-utils-replay-visibility.test.js`
- `src/__tests__/ui/replay/main-ui-replay-mask.test.jsx`
- Existing Replay clip/timeline/export tests in `src/__tests__/unit/replay/` and `src/__tests__/integration/replay/`

Add new tests near the relevant owner, with fake clocks/controlled promises for asynchronous race conditions. Do not assert only that a method was called; assert final state and pixel/capture correctness where possible.

### Browser / WebGL acceptance

Follow the exact in-repository browser/WebGL skills and WebGL 2 readback preflight. Compare before/after on a real Cesium viewer with real map POIs, multiple Journeys, terrain, screenshots and GPU profiling:

- Stationary map, orbit/pan/zoom, 20/100/300/1000 POIs.
- Expanded/collapsed POIs, long text, Font Awesome and SVG icons, font loading, leader geometry and style editing.
- Terrain switching and entity-owner reassignment.
- Replay start, animation windows, reverse and scrub, close/open transitions, stop clips and restoration.
- Deterministic MP4 export including UHD or custom ratio when supported; compare exact frame count, timestamps, POI visibility and crop alignment.
- Cancellation and multiple exports in the same session; verify memory does not grow without bound.

Run focused tests first, then the relevant project Vitest suites and applicable `bun run lint`, `bun run typecheck`, `bun run build` and configuration checks, as required by the current project rules. Never report browser validation as passed if the actual WebGL 2/pixel-readback preflight fails.

## 14. Definition of done / performance report

For each approved and implemented change provide:

1. The tested Git commit SHA, browser/hardware fixture, capture resolution and number of POIs.
2. Baseline vs after: wall-clock Replay export duration, live FPS/frame p50/p95, capture counts and durations, Cesium entity update counts, memory and perceived UI responsiveness.
3. A separate statement for measured gains, statistically inconclusive changes, and untested hypotheses. Avoid speedup percentages not backed by matched before/after runs.
4. Visual parity evidence (images or documented frame comparisons) and any explicitly approved UI differences.
5. Passing tests, exact commands, browser preflight result, and remaining risks.
6. Updated current technical docs/catalogs for implemented behavior, with this TODO changed or closed only when work is verified and delivered through the project PR workflow.

A change that appears faster but causes a stale POI, an incorrect Replay timestamp, lost clicks, incorrect hidden POIs, an invalid crop or a memory leak fails acceptance.

## 15. Recommended execution order for Codex

1. Re-read rules/skills and inspect actual checkout. Verify which POI components are mounted.
2. Instrument and benchmark without changing visible behavior.
3. Present a short findings report ranking real bottlenecks.
4. Implement the smallest proven improvement first: position/visibility updates without rasterizing unchanged POI appearance.
5. Validate + benchmark. If worthwhile, introduce bounded visual revisions/cache.
6. Validate + benchmark. Only then evaluate reducing rich DOM mounts and broad Valtio subscriptions.
7. Validate Replay visibility-loop ownership, then implement differential updates if safe.
8. Evaluate candidate-window indexing and entity lookup cache if measurements still justify them.
9. Treat clustering, broad architecture changes, Workers or all-DOM conversion as independent, explicitly approved proposals.
10. Document actual outcomes and maintain the repository catalogs/PR process.

**Expected Codex output:** a concise architecture map, profiling evidence, prioritized implementation changes with file references, regression test evidence, and a clear distinction between changes completed and TODO items not yet approved or validated.
