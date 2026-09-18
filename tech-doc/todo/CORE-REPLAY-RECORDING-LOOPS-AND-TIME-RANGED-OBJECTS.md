# Replay Recording Loops and Time-Ranged Object Visibility

Status: proposed architecture and impact analysis

Date: 2026-09-18

Target release: Unplanned

## Objective

This document evaluates two related Replay recording needs:

1. make recording and HQ export loops faster, especially when scene objects
   contain both static and changing parts;
2. allow an object or widget to become visible at a defined time for a defined
   duration during Replay.

The proposal preserves the current Replay boundaries. `ReplayVideoTimeline` and
`ReplayFrameTimeline` remain the time authorities, the published Replay frame
remains the shared input for dynamic consumers, and Draft, HQ, and scrubbing
continue to resolve the same logical visual state.

This is a future-work document. It does not describe an implemented feature.

## Current architectural context

The current architecture already separates three scheduling policies over one
Replay domain:

| Policy | Time source | Main purpose |
| --- | --- | --- |
| Draft recording | Monotonic wall time | Responsive real-time capture |
| HQ export | Fixed video frame timestamps | Deterministic MP4 production |
| Scrubbing | Latest slider request | Manual positioning |

HQ export already uses an isolated render host by default. Dynamic widgets are
expected to consume the canonical Replay frame, while the overlay resolver
decides Replay-driven visibility. The current preparation timeline is a
read-only projection. A persisted editable multi-track authoring model remains
future work.

The main performance constraints are therefore known:

- Cesium rendering and tile readiness can dominate the cost of a frame;
- the Replay trace still uses dynamic Cesium geometry;
- DOM widgets may require canvas snapshots before composition;
- scene readiness must not wait for the full settled budget on every moving
  frame;
- Draft and HQ must not create a second Replay clock while optimizing their
  loops.

See [Replay architecture](../specs/replay-video/CORE-REPLAY-ARCHITECTURE.md),
[Replay implementation status](../specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md),
and [Replay quality validation](../specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md).

## Architectural decision

The recording loop should be split into four phases with different ownership:

1. **Prepare once**: freeze the export context, normalize the timeline, resolve
   static composition, and compile reusable camera, path, and visibility data.
2. **Resolve each logical frame**: derive one complete frame intent from the
   canonical timestamp.
3. **Apply only changed scene state**: update moving subparts and phase changes
   without rebuilding unchanged objects.
4. **Compose and submit**: compose the final frame and submit it to the encoder
   using bounded back-pressure.

The loop must never use the recorder's wall clock to decide the content of an
HQ frame. The recorder or encoder may affect export wall time, but it must not
alter the logical video timestamp, duplicate a visual frame as a timing
workaround, or create a second timeline.

## 1. Improving recording and export loops

### Object classification

Every captured object should be classified before recording. The classification
determines whether it is prepared once or evaluated for each frame.

| Class | Examples | Capture behavior |
| --- | --- | --- |
| Static for the recording | Logo, Credits, fixed widget geometry, crop, immutable scene configuration | Prepare once and reuse |
| Variable by logical frame | Marker position, trace progress, profile marker, dynamic statistics | Update from the published frame state |
| Variable by phase or interval | Clip camera, object visibility, enter/exit effect, stop-clip trace | Update at phase or visibility boundaries and at required frame times |
| Asynchronous resource | Terrain, imagery, 3D Tiles, DOM snapshot, font or icon readiness | Qualify with an explicit bounded policy |

An object that has both static and changing parts must be split conceptually
and, where the renderer permits it, physically:

- keep the object identity, geometry buffers, material definitions, and DOM
  layout stable;
- update only position, visibility, progress, opacity, transform, or text that
  changes for the current frame;
- keep static and dynamic Cesium entities separate when changing one part would
  otherwise recreate the whole entity;
- avoid removing and recreating ground polylines, canvases, or overlay records in
  the frame loop;
- use a dirty flag or revision so an unchanged dynamic value is not written
  again.

The key distinction is between **state evaluation** and **resource creation**.
State evaluation may happen per frame. Resource creation, layout measurement,
DOM snapshot setup, geometry compilation, and scene descriptor construction
should happen before the first captured frame whenever possible.

### Proposed frame loop

The future HQ loop should follow this shape:

```text
prepare export snapshot
prepare static scene and overlay layers
compile reusable camera, path, and interval data

for each fixed frame intent:
    resolve the complete frame state from the canonical timestamp
    diff it against the previous frame state
    apply only changed camera, visibility, geometry, and widget values
    request bounded moving-frame readiness when the scene view changed
    render the active target
    compose static and variable layers
    submit exactly one product frame

await bounded pending submissions
finalize the encoder
```

This loop has one product frame per `ReplayFrameTimeline` frame. A readiness
retry, a render boundary, a codec keep-alive, or an internal diagnostic frame
must never become an additional product frame.

### Preparation work that should leave the hot loop

The following work should be performed once per export context or once per
timeline revision:

- normalize start, Replay, wait, and stop phases;
- calculate the total duration, frame count, frame timestamps, and clip
  signature;
- freeze crop dimensions, output dimensions, FPS, quality profile, and camera
  ownership;
- resolve static widget geometry and capture-safe overlay metadata;
- build the stable track path representation used by the trace;
- compile camera commands or camera trajectory windows when the inputs permit
  deterministic compilation;
- build an interval index for time-ranged object visibility;
- identify frames that require a settled scene qualification, such as first,
  last, phase-boundary, hold, or final frames;
- prewarm only through the dedicated HQ render target and only when the
  benchmark shows that prewarming reduces total export time.

Prewarming must remain bounded. Moving the real scene camera through future
poses is not a passive cache operation and should not be used as a default
optimization for the interactive viewer.

### Dynamic geometry and variable object parts

Dynamic objects should expose a deterministic frame update contract. A suitable
conceptual contract is:

```text
resolveState(objectDefinition, frameTimeMillis) -> objectFrameState
applyState(objectRuntime, objectFrameState) -> changed
```

`resolveState` may use the journey sample, local clip time, or a keyframed
definition. It must not read a private timer, current wall time, mutable React
state, or the interactive camera when rendering HQ.

`applyState` should preserve runtime identity and return whether a visible value
actually changed. It may update:

- a marker's Cartesian position;
- the visible prefix of a precomputed trace path;
- a material uniform or opacity;
- a widget's text, transform, or effect progress;
- a clip camera command;
- an object's `show` state.

The trace is the highest-risk current example. Rebuilding several clamped
polylines for every output frame can spend more time in geometry and Cesium
primitive management than in the logical Replay calculation. The preferred
order is:

1. benchmark a stable mutable representation that updates only the visible
   prefix;
2. retain a separate static completed trace for stop clips and final frames;
3. use a projected 2D trace overlay for phases where Cesium ground geometry is
   not required, provided visual validation accepts the result;
4. keep the chosen representation consistent between Draft and HQ whenever
   pixel parity is required.

The final choice must be benchmarked on imagery, terrain, 3D Tiles, and dense
journeys. A simpler representation is useful only if it preserves the required
camera depth, terrain interaction, and visual quality.

### SnapDOM 3 and DOM-backed widgets

The project uses `@zumer/snapdom` `3.0.0`. SnapDOM 3 changes the optimization
boundary for DOM-backed video widgets and must be included in the recording
design.

SnapDOM 3 provides several relevant behaviors:

- eligible unchanged captures can reuse the previous result automatically;
- safe local changes can trigger differential recapture of affected subtrees;
- web fonts used by the capture are embedded automatically by default;
- resource and style caches are retained with the v3 cache policy;
- `snapdom.preCapture()` replaces the v2 `preCache` concept with intent-based
  preparation;
- a reusable capture result can expose `toCanvas()` without cloning the DOM
  again;
- capture geometry is available through result metadata and must be preserved
  when placing the rasterized widget over the source scene.

These capabilities complement the existing `Widget2Canvas` contract:

- stable widget shells are captured as static zones;
- dynamic zones are captured only when they become dirty;
- canvas roots are copied directly instead of being sent through DOM capture;
- a pending refresh is coalesced so a newer Replay state is not lost while a
  previous snapshot is rasterizing;
- SnapDOM viewBox and content-offset metadata are used to keep the canvas mirror
  aligned with the visible widget.

SnapDOM 3 does not make rasterization free. Its automatic memoization and
resource cache do not remove the cost of `toCanvas()`, layout-sensitive
captures, canvas readback, or final video composition. The Replay loop should
therefore apply these rules:

1. call `preCapture()` before a user-intended capture workflow, while treating
   it as capture-intent preparation rather than a guarantee that every asset is
   fully rasterized;
2. capture static widget zones once per layout or export-context revision;
3. capture dynamic zones only after the canonical Replay frame marks them dirty;
4. reuse a capture result only while its captured state remains valid;
5. use `invalidate: true` for changes SnapDOM cannot observe, such as certain
   programmatic CSSOM changes;
6. do not rely on the removed v2 `preCache`, `fast`, `burst`, or `compress`
   options;
7. keep application-level latest-wins refresh and cancellation logic around
   SnapDOM promises, even though v3 isolates capture state for concurrent
   captures;
8. preserve explicit final dimensions because v3 gives `width` and `height`
   precedence over `scale` when both are supplied.

SnapDOM 3 applies to DOM-backed overlays and widget mirrors. It does not
optimize Cesium entities, terrain, imagery, 3D Tiles, or the Replay camera.
Those resources still require the separate scene and readiness strategy
described above.

### Faster Draft recording

Draft recording is real-time capture. Its optimization target is responsiveness
and stable duration, not maximum offline throughput.

The current speed mode should continue to:

- submit at most one frame per selected capture interval;
- avoid awaiting encoder writes inside the capture callback;
- keep a bounded set of pending writes;
- allow the recorder to skip a late capture opportunity rather than queueing an
  unbounded backlog;
- keep the Replay publication cadence aligned with the capture contract;
- invalidate stale asynchronous starts when a recording is cancelled or
  replaced.

The main gains should come from reducing work before the compositor is called:

- do not refresh static overlays on every frame;
- snapshot DOM widgets only when their canonical frame state or layout changes;
- rely on SnapDOM 3 differential recapture for eligible unchanged widget
  subtrees, while keeping explicit dirty-zone boundaries in `Widget2Canvas`;
- update dynamic widget mirrors from one Replay frame publication;
- avoid rebuilding scene entities when only a variable field changed;
- reduce expensive camera qualification cadence in long journeys only for Draft,
  while keeping HQ frame application frame-accurate;
- keep output dimensions and pixel budgets explicit so the recorder does not
  accidentally capture high-DPR pixels at an unsustainable rate.

The quality mode may wait for a ready frame, but it should be treated as a
quality-throughput tradeoff. It cannot be the default answer to a slow loop
because waiting for every frame makes the recording slower by design.

### Faster HQ export

HQ export can run faster than real time only after the per-frame work is made
bounded and predictable. The following order is recommended:

1. measure frame time by category: frame resolution, camera, Cesium render,
   tile readiness, dynamic geometry, overlay composition, readback, and
   encoding;
2. remove repeated allocation, layout, entity replacement, and full overlay
   snapshots from the hot loop;
3. use moving-frame readiness budgets for ordinary motion and reserve settled
   budgets for declared quality frames;
4. cache readiness by the exact export view and scene revision, rather than a
   coarse camera position bucket;
5. keep encoder submission asynchronous with bounded back-pressure;
6. only then evaluate an orchestration Worker if main-thread scheduling remains
   the bottleneck.

A Worker can improve workspace responsiveness and may improve export time when
   JavaScript orchestration is the bottleneck. It cannot make network, tile
   loading, GPU rendering, or DOM snapshots intrinsically faster. Full Cesium
   Worker rendering remains a separate high-risk option and requires a
   serializable widget and scene contract.

### If “recording loop” means repeating the Replay

Repeated Replay passes should be represented as repeated logical phases in one
compiled timeline. The recorder must not be stopped and restarted for each
pass.

Each pass should have:

- a stable pass identifier;
- a local Replay time reset to zero;
- an absolute video time range;
- an explicit reset policy for marker, trace progress, dynamic widgets, and
  time-ranged visibility;
- a deterministic boundary frame.

The product video still has one monotonically increasing frame clock. This
avoids codec finalization between passes, repeated UI cleanup, and lifecycle
race conditions. It also makes an object's visibility contract unambiguous:
the same relative interval may be active in every pass, or the author may
select a particular pass.

## 2. Time-ranged object visibility

### User-facing meaning

The proposed feature supports statements such as:

> Show object `A` at 12 seconds into the Replay and keep it visible for 4
> seconds.

The authored values should be stored in milliseconds at the domain boundary.
The editor may display seconds, but conversion to seconds should happen only at
the package-facing timeline boundary.

### Time bases

The model must distinguish two time bases:

| Time base | Meaning | Suitable for |
| --- | --- | --- |
| `replay` | Offset from the beginning of the main Replay phase | Objects tied to journey progress |
| `video` | Offset from the beginning of the complete video timeline | Intro, outro, or production-wide overlays |

The canonical runtime resolves both to absolute video time before a frame is
rendered. This avoids hidden shifts when start clips are inserted or their
durations change.

For example, with a 3-second start clip, an object authored at 12 seconds in
`replay` time becomes active at 15 seconds in absolute video time. If the start
clip changes to 5 seconds, the object remains at 12 seconds into the Replay
and moves to 17 seconds in the complete video. An object authored in `video`
time remains at the same absolute video timestamp.

### Proposed normalized item

The future normalized timeline can represent a visibility item with fields of
this form:

```js
{
  id: 'object-visibility-1',
  kind: 'object-visibility',
  trackId: 'widget-track-1',
  targetId: 'dynamic-stats-widget#abc123',
  timeBase: 'replay',
  startMillis: 12000,
  durationMillis: 4000,
  endMillis: 16000,
  enabled: true,
  visibility: 'visible',
  enterEffect: {
    type: 'none',
    durationMillis: 0,
  },
  exitEffect: {
    type: 'none',
    durationMillis: 0,
  },
}
```

`endMillis` is derived from `startMillis + durationMillis` and should not become
an independently edited value. The domain model should keep the canonical
millisecond values even when the timeline package receives seconds.

The same shape can represent a map object, widget, POI, label, trace layer, or
other capture participant if that participant has a registered resolver and
renderer. The generic Timeline Web Component must remain domain-neutral. Replay
semantics belong in the application projection and adapter.

### Interval semantics

Visibility intervals should use half-open ranges:

```text
startMillis <= frameTimeMillis < endMillis
```

This gives deterministic behavior when one item ends exactly as another starts:

- the item is visible on its first frame at `startMillis`;
- it is hidden on the first frame at `endMillis`;
- an enter or exit effect may extend the visual transition without changing the
  logical visibility range;
- a zero-duration item is invalid for visibility and should be rejected or
  normalized to disabled.

The final video frame remains governed by the canonical timeline's explicit
final-frame policy. It must not silently extend every visibility interval by
one frame.

### Frame payload

The canonical frame should expose resolved active items to consumers:

```js
{
  frameTimeMillis: 15000,
  phase: 'replay',
  replayTimeMillis: 12000,
  activeObjectClips: [
    {
      clipId: 'object-visibility-1',
      targetId: 'dynamic-stats-widget#abc123',
      localTimeMillis: 3000,
      progress: 0.75,
      visible: true,
      effectState: {
        opacity: 1,
      },
    },
  ],
}
```

The payload is derived for the current frame. It is not a second store and it
does not own playback. Dynamic widgets, overlays, POIs, and future object
renderers consume it through explicit adapters.

### Visibility precedence

The final visibility decision should preserve the existing separation between
user configuration and transient capture state:

1. the object must be enabled and user-visible;
2. its time-ranged item must be active, when the object has timeline items;
3. Replay or capture masking may temporarily hide it for a declared phase;
4. the active render target must accept the resulting state.

Timeline visibility must not overwrite persisted user visibility when the item
ends. When no timeline item exists for a widget, current backward-compatible
global video-widget behavior may remain in effect until the object is explicitly
assigned to a timeline track.

### Variable state while visible

Visibility is only one dimension. A visible object may also change during its
interval. The item should therefore resolve a local time:

```text
localTimeMillis = frameTimeMillis - absoluteStartMillis
```

Variable properties can then be derived from local time:

- opacity or scale effects;
- a progress value from 0 to 1;
- a value or label sampled from the Replay frame;
- a camera or POI state;
- a partial trace or chart marker.

The object renderer must use the canonical frame time. It must not start an
object-local `setInterval`, `requestAnimationFrame` loop, or animation clock.

### Overlap and stacking

The initial authoring model should reject overlapping visibility items for the
same target unless the target explicitly supports layered items. This keeps
visibility resolution deterministic and avoids silently choosing one item.

Separate targets may overlap. Their order follows the existing widget stack and
explicit track order. Effects should be resolved per target before final
composition.

## Impact on the timeline and clip system

The existing start and stop clips define ordered Replay phases. Time-ranged
object items are a different concept:

- start and stop clips can move the absolute start of the Replay and change the
  camera state;
- object visibility items consume the resolved absolute timeline and affect
  object composition;
- the Replay phase remains mandatory;
- object items must not create a new clock or change Replay duration unless the
  authoring model explicitly defines that behavior.

When the editable timeline is introduced, moving or resizing an object item
must update its normalized range, invalidate the timeline signature, and cause
Draft and HQ to rebuild their derived plans. It must not mutate a live capture
in progress. A timeline change during recording should either be rejected or
apply only to the next recording lifecycle.

The current read-only preparation projection can display these intervals once
the application projection supplies them. The generic timeline component
should only render ranges and emit generic interaction events.

## Recommended delivery order

### Phase 0: benchmark the current loop

Record, for representative imagery, terrain, 3D Tiles, and dense journeys:

- total export wall time and encoded duration;
- frame count and effective FPS;
- per-frame time for resolution, camera, Cesium render, readiness, geometry,
  composition, readback, and encoding;
- number of entity or primitive creations and removals;
- DOM snapshot count and widget refresh count;
- peak memory, pending encoder writes, and cancellation latency;
- visual quality of first, transition, moving, and final frames.

The benchmark must distinguish Draft real-time capture from HQ offline export.

### Phase 1: compile and classify

Introduce the export snapshot and the static, phase, dynamic, and asynchronous
object classifications. Add the interval index and canonical active-item
resolution without changing visible behavior.

### Phase 2: reduce hot-loop work

Preserve runtime object identity, add dirty-state updates, freeze static
overlays, remove redundant DOM snapshots, and replace repeated geometry rebuilds
with the benchmark-selected mutable representation.

### Phase 3: add time-ranged visibility

Add normalized items, replay-relative and video-relative time bases, half-open
interval resolution, effect progress, overlay-resolver integration, and Draft/HQ
frame payload parity.

### Phase 4: expose authoring

Extend the future editable multi-track timeline with item creation, movement,
resizing, overlap validation, duration display, and stable navigation to the
target object's editor. Keep the current read-only preparation timeline
transient until the persisted authoring model is ready.

### Phase 5: consider worker isolation

Only after the benchmark shows that main-thread orchestration remains a major
cost should the project evaluate a Worker for scheduling and encoding. A full
Cesium Worker renderer is a separate decision that requires a serializable scene,
widget, and capture contract.

## Acceptance criteria

The feature and optimization work should be considered valid only when all of
the following are demonstrated:

- one logical timestamp resolves one complete, reproducible frame;
- Draft and HQ resolve identical object visibility at selected timestamps;
- an item authored at `X` seconds for `Y` seconds is visible throughout its
  declared interval and hidden at its end boundary;
- start and stop clip duration changes update absolute object timing correctly;
- repeated Replay passes reset local state without restarting the recorder;
- variable object parts update without recreating unchanged resources;
- no private object timer or second Replay clock is introduced;
- HQ frame count and encoded duration remain unchanged by readiness retries or
  encoder back-pressure;
- moving-frame readiness is bounded and settled qualification is reserved for
  declared quality frames;
- output visual quality is validated on imagery, terrain, 3D Tiles, and dense
  journeys;
- cancellation, stale recording starts, and export cleanup remain idempotent.

## Open decisions

The following decisions require product or benchmark evidence before
implementation:

- whether `replay`-relative or `video`-absolute time should be the default in
  the authoring UI;
- whether a time-ranged item may extend into start or stop clips;
- which object types are supported in the first version;
- whether overlapping items for one target should be rejected or composited;
- whether enter and exit effects are limited to `none` and `fade` initially;
- which trace representation meets the visual-quality and speed targets;
- whether faster HQ export or lower main-thread impact is the primary product
  objective for Worker evaluation.
