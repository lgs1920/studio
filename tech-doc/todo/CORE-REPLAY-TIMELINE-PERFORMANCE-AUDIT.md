# Replay Timeline Performance Audit and Improvement Proposals

Status: proposed

Date: 2026-09-13

## Objective

The Replay Timeline has become slow during playback and interaction. This audit
examines the active path from the React Replay adapter to the generic Timeline
Web Component and proposes changes that preserve the canonical Replay clock,
the controlled projection, the Timeline isolation boundary, and current editing
behavior.

This document is a proposal. It does not describe an implemented optimization.

## Scope and method

The audit covers:

- the React adapter in
  [`ReplayTimelinePreview.jsx`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx);
- the generic Web Component in
  [`LGS1920Timeline.js`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js);
- the renderer and clip editing helpers in
  [`LGS1920TimelineRendering.js`](../../src/webcomponents/lgs1920-timeline/LGS1920TimelineRendering.js)
  and
  [`LGS1920TimelineEditing.js`](../../src/webcomponents/lgs1920-timeline/LGS1920TimelineEditing.js);
- the Replay projection in
  [`ReplayPreparationTimeline.js`](../../src/core/ui/replay/ReplayPreparationTimeline.js);
- the Replay frame publication path and recent timeline changes.

The conclusions are based on source inspection, recent commit comparison, and
focused tests. No production browser trace was available during this audit, so
the exact contribution of each path must be confirmed with the measurement
plan below.

The focused baseline passed:

- 11 unit tests from `replay-preparation-timeline.test.js`;
- 25 UI tests from the Replay Timeline preview and style suites.

The test runner reported an existing Vite configuration warning about the
future `configLoader: 'native'` default. The warning did not affect these
results.

## Current runtime path

```text
Replay frame publication
        |
        v
Valtio replay store
        |
        +--> root store subscription in ReplayTimelinePreview
        |       |
        |       +--> currentTimeMillis assignment
        |       +--> ensureCurrentTimeVisible()
        |       +--> slider DOM update
        |
        v
LGS1920Timeline dynamic DOM updates

Projection or editing change
        |
        v
React controlled effect
        |
        +--> element.timeline = ...
        +--> element.tracks = ...
        |
        v
LGS1920Timeline state comparison and possible full DOM render
```

The active application path uses the generic `LGS1920Timeline` Web Component.
The repository still depends on `@xzdarcy/react-timeline-editor`, but the active
Replay preview does not import that package at runtime. Optimizing that package
is therefore secondary unless another host still mounts it.

## Findings

### P0: the playback subscription observes the whole Replay store

`ReplayTimelinePreview` subscribes to `lgs.stores.replay` at
[`ReplayTimelinePreview.jsx:697-717`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx#L697).
The Replay controller publishes several fields during a frame update, including
`liveSample`, `dynamicStatsTick`, `replayFramePhase`, and
`dynamicFrameState`, as shown at
[`JourneyReplayPlaybackController.js:570-605`](../../src/core/ui/replay/JourneyReplayPlaybackController.js#L570).

The Timeline only needs the latest published frame time and the playing state,
but the root subscription is eligible to wake the callback for any mutation in
that store, subject to Valtio batching. The callback then performs the same
Timeline update even when the logical time has not changed.

Proposal: subscribe to the narrow frame and playback fields through an explicit
Timeline adapter, and coalesce frame notifications to at most one visual update
per animation frame. Keep Replay as the clock owner. The adapter must continue
to use the existing scrub scheduler for user seeks and must not create another
playback clock.

Expected benefit: fewer callbacks, fewer redundant DOM writes, and less React
or store work during Draft playback.

### P0: `ensureCurrentTimeVisible()` was added to the per-frame path

Commit `c9f5346f` added `ensureCurrentTimeVisible()` to both the initial
controlled synchronization and the playback subscription. The current playback
callback calls it for every published frame at
[`ReplayTimelinePreview.jsx:702-712`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx#L702).

The method reads viewport dimensions and scroll metrics at
[`LGS1920Timeline.js:1190-1215`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L1190).
When the playhead reaches an edge it also updates the fixed ruler, viewport
margins, and all custom scrollbar geometry. During normal playback this work is
usually unnecessary because the playhead remains inside the current viewport.

Proposal: remove this call from the steady-state frame callback. Keep it for:

- initial mount and controlled projection changes;
- an explicit user seek or slider change;
- zoom, resize, and range changes;
- a throttled edge-follow path that runs only when the playhead is near or beyond
  the viewport edge.

This is the first change to validate because it is recent, local, reversible, and
directly connected to the reported regression.

### P1: every current-time assignment performs a dynamic DOM pass

The `currentTimeMillis` setter always calls `#updateDynamicState()` at
[`LGS1920Timeline.js:858-861`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L858).
That method performs multiple `querySelector` calls, recalculates scale values,
updates the playhead, updates range handles, and updates transport button state
at [`LGS1920Timeline.js:5518-5561`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L5518).

Proposal:

1. Return early when the normalized time is equal to the current time.
2. Cache references to the playhead, time labels, range handles, and transport
   buttons after a structural render.
3. Split the update into a lightweight playhead update and an occasional
   metadata update. The lightweight path should only update the position and
   the required ARIA value.
4. Use a compositor-friendly transform for the moving playhead if profiling
   confirms that `left` causes layout or paint work. Apply `will-change` only
   while playback or scrubbing is active.

The cached references must be invalidated when `#render()` replaces the shadow
DOM. They must remain owned by the Web Component and be cleared in its teardown.

### P1: a controlled update can trigger more than one synchronization pass

The React controlled effect assigns `element.timeline` and `element.tracks`
sequentially at
[`ReplayTimelinePreview.jsx:646-650`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx#L646).
Both setters enter `#syncPublicProps()` and can reach `#applyState()` in
[`LGS1920Timeline.js:1045-1125`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L1045).
When the structure changes, `#applyState()` calls the full renderer.

Proposal: add one generic `applyControlledState()` method to the Web Component
or queue property updates until the current microtask completes. The method
should accept the timeline configuration, tracks, current time, playing state,
and clip options as one explicit state transaction, compare the structural
signature once, and render at most once. The React adapter should call that
method when available and retain the individual properties as a compatibility
path for generic hosts.

This preserves the controlled boundary while removing intermediate states that
are never visible to the user.

### P1: full structural rendering remains expensive

`#render()` rebuilds the timeline structure and replaces the shadow DOM children
at [`LGS1920Timeline.js:1616-1681`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L1616).
Afterward it reapplies the split-panel width, scroll positions, fixed ruler,
scrollbars, dynamic state, selection, copy presentation, and snap presentation.
This is appropriate for changes to rows, duration, scale, or structure, but it
should never run for ordinary playback ticks.

Proposal: make the rendering boundary explicit:

- `renderStructure()` for row, clip, duration, zoom, and slot changes;
- `patchPlaybackState()` for the playhead, labels, and playback button;
- `patchInteractionState()` for selection, drag ghosts, snap guides, and drop
  state;
- `patchScrollState()` for scrollbars and ruler alignment.

Keep the structural render as the fallback for complex changes. The first
acceptance criterion is that steady playback produces zero structural renders.

### P1: comparison logic serializes rows repeatedly

The Web Component computes row and placement signatures with `JSON.stringify`
at [`LGS1920Timeline.js:191-205`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L191).
The controlled-state patch test serializes normalized row shapes again at
[`LGS1920Timeline.js:1136-1164`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L1136).
This cost is modest for the current small projection, but it grows with clip
count and is paid on controlled assignments even when no visible change exists.

Proposal: carry stable revision or signature values from the adapter and compare
structural fields directly. Keep a deep comparison only as a compatibility
fallback for unversioned generic callers. Do not use a second persisted domain
model to solve this problem.

### P2: clip drag presentation scans the whole timeline

`#updateClipInteractionPresentation()` rebuilds maps from all clips, tracks, and
legend rows and then loops through every row and action at
[`LGS1920Timeline.js:5569-5684`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L5569).
This is appropriate for a committed edit or a changed row set, but it is a
costly path for every pointer movement during a clip drag.

Proposal: keep a DOM index by row and clip identifier, update only the moving
clip, its previous and current track, affected markers, and the two relevant
legend rows. Rebuild the index only after a structural render. Retain the full
scan as a recovery path when an indexed element is missing.

The existing collision and ripple calculations remain authoritative. This
proposal changes presentation work only.

### P2: resize and scrollbar infrastructure is reinstalled frequently

Structural rendering disconnects and reinstalls the `ResizeObserver` through
`#installResizeObserver()` at
[`LGS1920Timeline.js:1721`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L1721)
and [`LGS1920Timeline.js:5253-5259`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L5253).
Scrollbar updates walk nested shadow-DOM queries at
[`LGS1920Timeline.js:3843-3853`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js#L3843).

Proposal: install the host observer once in `connectedCallback()`, disconnect it
once in `disconnectedCallback()`, and schedule one layout refresh per animation
frame when several resize notifications arrive together. Cache scrollbar rails,
thumbs, and associated views after structure creation.

This should be implemented after the playback path because it primarily affects
resize, zoom, and structural edit scenarios.

### P2: the projection is safe but should remain outside hot rendering paths

`buildReplayPreparationTimeline()` generates canonical phase and widget actions
and computes a JSON signature at
[`ReplayPreparationTimeline.js:527-603`](../../src/core/ui/replay/ReplayPreparationTimeline.js#L527).
The React adapter already protects most of this work with `useMemo`, so it is
unlikely to be the main source of per-frame lag. It can still be recalculated
when broad snapshot identities change, especially because widget ordering is
resolved from the reactive widget list.

Proposal: keep projection construction tied to explicit structural inputs and
expose a stable projection revision. Narrow the widget-store observation to
video-board entries that can change the projection. Add projection timing only
if browser traces show that projection work is significant.

Moving this computation to a worker is not recommended as a first step. The
projection is small in normal use, and a worker would add serialization and
lifecycle complexity to the Timeline boundary.

## Recommended implementation order

### Phase 0: measure and isolate the regression

Add development-only counters or performance marks for:

- Replay store callback count;
- `currentTimeMillis` assignments;
- `ensureCurrentTimeVisible()` calls and calls that actually scroll;
- structural `#render()` calls;
- dynamic DOM update duration;
- React commits for `ReplayTimelinePreview`.

Capture traces for a short replay and a long replay at 30 and 60 FPS. Compare
the current branch with the same scenario after removing the per-frame
`ensureCurrentTimeVisible()` call. This gives a concrete baseline before a
larger refactor.

### Phase 1: reduce playback work

Implement the narrow subscription, latest-frame coalescing, same-value guards,
and the separation between edge-follow scrolling and ordinary playhead updates.
Add tests that verify:

- unrelated Replay store mutations do not update the Timeline;
- repeated identical frame times do not update the dynamic presentation;
- an edge crossing still scrolls the viewport;
- scrub requests still pass through `ReplayScrubScheduler`.

### Phase 2: make controlled rendering transactional

Add the generic controlled-state transaction and split structural rendering from
playback and interaction patches. Add tests that count render calls and verify
that timeline and track assignments produce one consistent update.

### Phase 3: optimize editing and layout support

Add indexed clip presentation, persistent resize-observer ownership, cached
scrollbar references, and frame-coalesced layout refreshes. Validate clip move,
resize, ripple, row reorder, zoom, vertical scroll, drawer resize, and detached
window behavior.

## Measurement and acceptance criteria

The exact thresholds should be recorded from a representative baseline, but the
following criteria are suitable for acceptance:

- steady playback produces no structural Timeline render;
- visual playback updates are capped at one update per animation frame;
- unrelated Replay store mutations do not invoke the Timeline frame adapter;
- `ensureCurrentTimeVisible()` is absent from the ordinary per-frame path and
  runs only for initial positioning, explicit seeks, layout changes, or edge
  following;
- no long task over 50 ms is introduced during a 30-second playback trace;
- the 95th percentile Timeline update stays below one quarter of the 60 FPS
  frame budget, approximately 4 ms, on the reference machine;
- clip drag and resize remain responsive with the full current test fixture;
- focused unit and UI tests pass, followed by the affected Vitest projects.

The 4 ms target is a performance budget for the Timeline update itself, not a
claim about the total Replay or Cesium frame budget. It should be adjusted if
the reference hardware and representative data set change.

## Risks and safeguards

- Coalescing frame updates must not change the canonical Replay clock. The
  Timeline is a visual consumer and must continue to accept an explicit seek
  immediately when the interaction settles.
- Edge-follow scrolling must preserve the current horizontal zoom and the
  visible time anchor.
- Cached DOM references must be rebuilt after every structural replacement and
  cleared during disconnection.
- The generic Web Component must remain domain-neutral. Replay-specific logic
  belongs in the React adapter or another explicit application adapter.
- Any new Timeline public method needs generic naming, lifecycle ownership, and
  focused tests for controlled updates and teardown.

## Related implementation references

- [Replay Timeline preparation implementation](../specs/replay-video/CORE-REPLAY-TIMELINE-IMPLEMENTATION.md)
- [Timeline Web Component specification](../specs/replay-video/CORE-LGS1920-TIMELINE-WEBCOMPONENT-SPEC.md)
- [Replay timeline preview tests](../../src/__tests__/ui/components/replay-timeline-preview.test.jsx)
- [Timeline Web Component tests](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.test.js)
