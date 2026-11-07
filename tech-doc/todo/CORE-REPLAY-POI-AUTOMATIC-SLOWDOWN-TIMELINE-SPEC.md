# Automatic POI Slowdown Visualization in the Replay Timeline

**Status:** TODO — architecture and implementation specification (not yet implemented)  
**Date:** 2026-11-07  
**Studio baseline:** `lgs1920/studio`, branch `1.0.0` (not `main`)  
**Timeline baseline:** `lgs1920/timeline`, current package source (version `1.4.1` at the time of this review)  
**Proposed location:** `tech-doc/todo/CORE-REPLAY-POI-AUTOMATIC-SLOWDOWN-TIMELINE-SPEC.md`  
**Release:** To be assigned; this document does not authorize a release, commit, push, or merge.

## 1. Product decision and goal

Preserve the automatic geographic slowdown that Studio `1.0.0` already applies when the Replay approaches an eligible, readable POI. Extend the **same automatic behavior to Expert Replay**. Make the resulting slowdown visible in the generic `@lgs1920/timeline` editor without giving users a speed-curve editor or adding per-POI slowdown settings.

The intended experience is:

1. The Replay approaches an eligible POI, automatically decelerates, reaches an almost stationary crawl around the POI, then accelerates.
2. The extreme crawl is built over **1,000 ms** by the existing speed-profile compiler. The replay clock continues advancing; this is not a `pause()` call and not necessarily an exact zero-speed hold.
3. Eligible journey endpoint POIs can additionally receive an **actual 1,000 ms hold** at the start or end. This is a separate mechanism.
4. POI information remains readable; existing visibility, animation, crop/terrain qualification, and presentation rules continue to govern which POIs participate.
5. Basic **and Expert** use one canonical speed profile and one route-time/playback-time mapping. Expert must not silently bypass slowdowns merely because it is Expert.
6. The timeline visualizes the **compiled** intervals; it does not author, persist, or independently calculate slowdown speed.
7. Interactive preview, seeking, reverse playback, Draft and HQ export must resolve the same geography at a given canonical video timestamp.

### Explicit non-goals

- No `poi.replay.slowdown`, `beforeMeters`, `afterMeters`, `minRate`, `easing`, or speed-control UI.
- No new generic `ReplayTimeMap` or replacement of `ReplayPOISpeedProfile`.
- No second clock, wall-clock freeze, `setTimeout`-based motion control, or independent speed calculations inside the Web Component.
- No change to the currently shipped one-second crawl curve, normal slowdown factor, overlap rule, or endpoint-hold duration as part of the visualization work.
- No editable POI timing clips or editable slowdown regions.
- No unrelated migration of the complete `journey.replay.timeline` authoring model; that remains a separate TODO.

## 2. Verified source baseline and audit findings

Inspect the listed paths in Studio **`1.0.0`**, not the default branch. Code below and APIs are proposals unless labeled *existing*.

| Existing module | Verified responsibility / concern |
| --- | --- |
| `src/core/ui/replay/ReplayPOISpeedProfile.js` | Existing `createReplayPOISpeedProfile()`, `createPOICrawlSegments()`, `replayRouteTimeAtPlaybackTime()`, `replayPlaybackTimeAtRouteTime()`, `isReplayPOICrawlAtPlaybackTime()`, and `isReplayPOISpeedProfileForRoute()`; source of truth for slowdown and its inverse. |
| `src/core/ui/replay/JourneyReplayPOIProjection.js` | Existing `projectReplayPOIsOnSampler()` projects geographic POIs and repeated passages onto the selected logical Replay path. |
| `src/core/ui/replay/JourneyReplayPOISettings.js` | Existing POI eligibility/presentation settings; `REPLAY_ENDPOINT_POI_PAUSE_MILLIS = 1000` and `resolveReplayEndpointPOIPauseMillis()`. |
| `src/core/ui/replay/JourneyReplayRuntime.js` | Existing `currentJourneyReplayPoiBehavior()` differs between Basic and Expert. Expert uses legacy visibility/animation flags rather than the Basic settings object. |
| `src/core/ui/replay/JourneyReplaySessionPlaybackController.js` | Existing Replay configure path calls `syncRuntimeNearbyPOIs()` only for Basic; Expert may therefore lack canonical POI candidates for timing. |
| `src/core/ui/replay/JourneyReplayPlaybackController.js` | Existing configure path constructs `#playbackProfile`, stores `replay.poiPlaybackProfile`, maps elapsed playback time to route time, and marks `poiCameraFreeze` during the extreme crawl. Its `enabled` argument is currently restricted to Basic. |
| `src/core/ui/replay/ReplayVideoTimeline.js` | Existing canonical phases accept `replayProgressProfile` and endpoint holds. `resolveReplayVideoFramePhase()` derives geographic progress from the compiled profile. |
| `src/core/ui/replay/ReplayFrameResolver.js` | Existing `timeAtProgress()` uses the profile's inverse conversion when available. |
| `src/core/ui/replay/ReplayDeferredExporter.js` | Existing profile qualification/reuse and endpoint visibility helpers are currently Basic-gated. Draft/HQ must use the same profile snapshot. |
| `src/core/ui/replay/ReplayPreparationTimeline.js` | Existing controlled editor projection for phases and widget tracks; no derived POI slowdown track projection yet. |
| `src/components/MainUI/video/ReplayTimelinePreview.jsx` | Existing Expert preparation adapter and controlled component integration; `resolveReplayPositionAtTime()` already handles canonical Replay timeline time. |
| `tech-doc/todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md` | Existing general TODO describes derived, read-only POI clips and overlap lanes, but says the crawl is **two seconds**. That text is stale against `ReplayPOISpeedProfile.js` in `1.0.0`, which specifies **one second**. Correct or cross-reference that discrepancy during delivery. |

### Exact baseline timing constants

Existing in `ReplayPOISpeedProfile.js`:

```js
const DEFAULT_POI_PLAYBACK_SPEED_FACTOR = 0.5
const DEFAULT_POI_SLOWDOWN_DURATION_MILLIS = 1000
const POI_CRAWL_SPEED_FACTOR = 0.05
const POI_CRAWL_RAMP_STEPS = 16
const POI_SPEED_RAMP_STEPS = 16
```

`createPOICrawlSegments()` creates two 16-step ramps over the one-second crawl, approaching zero speed near the POI and increasing again. Individual compiled segment speed factors remain finite and positive. `DEFAULT_POI_PLAYBACK_SPEED_FACTOR` controls the surrounding slowdown. The actual effective output duration is read from `profile.playbackDurationMillis`, **not** the nominal route duration plus a manually counted number of POIs.

Existing independent endpoint hold:

```js
export const REPLAY_ENDPOINT_POI_PAUSE_MILLIS = 1000
```

**Do not conflate** the one-second interior crawl, the endpoint hold, the per-POI display duration, and the duration of the surrounding deceleration region.

### Existing package facilities

The generic Timeline package already provides:

- Controlled `tracks` and clips, with `clip.start`/`clip.end` measured in **seconds**.
- Controlled `markers`, with `marker.timeMillis` measured in **milliseconds**; `editable`, `movable`, `removable` and `snap` can be disabled.
- Read-only tracks/clips, generic color styling, and targeted `clip-content` slots.
- A controlled playhead (`currentTimeMillis`) and namespaced `lgs1920-timeline-*` events.

The package does **not** currently expose the `regions` property specified below. This property is proposed, is generic, and must not introduce application-specific concepts.

## 3. Architecture and ownership

```text
STUDIO / APPLICATION DOMAIN
    Journey + selected logical path + POIs + mode-specific presentation policy
                              |
                              v
                 projectReplayPOIsOnSampler()
                              |
                              v
                 createReplayPOISpeedProfile()
                   single immutable/validated snapshot
                 /             |              \
                v              v               v
     Playback controller  ReplayVideoTimeline  HQ export resolver
                \              |               /
                 \             v              /
                  ---- canonical video time ---
                              |
                              v
         createReplayPOITimelineProjection()     [new, Studio-only]
                              |
                    +---------+---------+
                    |         |         |
                    v         v         v
                  tracks    markers   regions
                    \         |         /
                     \        v        /
                       @lgs1920/timeline
                  generic controlled visualization
```

### Responsibilities

**Studio owns:** mode-neutral POI policy, eligible projected passages, terrain/crop qualification, speed-profile compilation, timing/version signatures, endpoint holds, preparation projection, editable Journey data, playback/export state, and timeline event handling.

**Timeline owns:** generic rendering/layout for clips, markers, and read-only time regions; horizontal zoom/scroll; accessibility; clipping; controlled updates; UI lifecycle. It must never know what a POI, route, Replay, Cesium, camera, or export is.

**The canonical clock:** absolute output-video milliseconds. Source/route time, geographic distance and playback time remain separate quantities.

## 4. Decision: one automatic slowdown policy for Basic and Expert

The `1.0.0` implementation has mode-specific gating in **three places**, not just one: nearby-POI preparation, playback profile creation, and export profile reuse. Remove the implicit assumption that only Basic can have a speed profile.

Define one mode-neutral **resolved presentation policy**, compiled from the existing mode-specific UI settings. A suitable internal contract is:

```js
// Proposed normalized runtime policy; not a persisted POI schema
{
    animatePoisDuringJourneyReplay: true,
    poiVisibilityMode: 'user',
    poiAnimationDurationSeconds: 2,
    includeGlobalPois: true,
    globalPoiDistanceMeters: 500,
}
```

The sample values are illustrative. Resolve actual values using current Basic/Expert settings and defaults; do not force users to enter them. In Expert, retain the existing global animation/visibility policy and per-POI `replay.visible`/`replay.animated` gates. An eligible POI that is presented for reading automatically slows the route in **either** mode. Hidden, disabled, out-of-route, or crop/terrain-disqualified POIs must not create misleading speed intervals. Do not introduce a *separate* user slowdown toggle.

Refactor the current Basic-specific normalization paths so the `ReplayPOISpeedProfile` compiler can accept the **resolved** policy. Keep a compatibility adapter if necessary, but avoid silently normalizing Expert through `settings.basic`.

**Required edits to audit:**

1. Ensure `syncRuntimeNearbyPOIs()` is called as needed for both modes before building a profile; preserve mode-specific POI visibility rules.
2. Replace the Basic-only `enabled` condition passed to `createReplayPOISpeedProfile()` with an eligibility check derived from the common policy.
3. Unify `isReplayPOISpeedProfileForRoute()` validity checks and timing-policy signature. Currently it accepts `basicSettings`; the target must compare the resolved policy, not Basic-only settings. Avoid stale qualified profiles after a mode switch.
4. Remove the Basic-only early return in `ReplayDeferredExporter.resolveReplayPOISpeedProfile()` and its visibility qualification path. Preserve route, Journey, direction, duration, settings, passage signature and camera/crop qualification checks.
5. Preserve the existing `resolveReplayEndpointPOIPauseMillis()` rules and its independent start/end holds for both modes when endpoints are eligible.
6. Both modes must reuse the **same existing speed constants and formulas**. Do not create a second Expert curve.
7. If visible POI qualification is unavailable, do **not** claim a slowdown occurred: requalify through the canonical preparation path or explicitly mark the profile unqualified. Do not silently export nominal linear progress when interactive playback used a slowdown.

**Implementation caution:** `currentJourneyReplayPoiBehavior()` currently returns `poiAnimationDurationSeconds: null` for Expert. Give Expert a normalized duration appropriate to its existing animation policy rather than passing `null` through the Basic normalizer. Preserve the current presentation semantics and document the chosen compatibility rule.

## 5. Existing profile is the time map: no new timing engine

### Existing profile data (representative)

```js
{
    routeDurationMillis,
    playbackDurationMillis,
    direction,
    shouldSlowdown,
    speedFactor,
    poiPresentationWindows: [
        {
            poiId,
            passageIndex,
            routeStartMillis,
            routeEndMillis,
        },
    ],
    segments: [
        {
            routeStartMillis,
            routeEndMillis,
            playbackStartMillis,
            playbackEndMillis,
            speedFactor,
            poiCrawl, // true for the extreme crawl
        },
    ],
}
```

The `segments` array is an **ordered partition** of the route. If two POI presentation windows overlap, the compiler merges timing windows and applies the slowest applicable speed rather than adding two independent durations.

### Existing conversion functions

```js
replayRouteTimeAtPlaybackTime(profile, playbackMillis)
replayPlaybackTimeAtRouteTime(profile, routeMillis)
isReplayPOICrawlAtPlaybackTime(profile, playbackMillis)
```

Use these functions for all visual projection. Never reconstruct the profile by integrating a new curve in the timeline adapter.

### Absolute time conversion

For a source route timestamp `routeMillis` (expressed in traversal order):

```js
const replayPhase = videoTimeline.replayPhase
const startHoldMillis = videoTimeline.endpointPOIPauseMillis?.start ?? 0
const absoluteTimeMillis = replayPhase.startMillis
    + startHoldMillis
    + replayPlaybackTimeAtRouteTime(profile, routeMillis)
```

For a geographic POI passage on a path of length `totalDistanceMeters`:

```js
const routeFraction = clamp(projectedAbscissa / totalDistanceMeters, 0, 1)
const traversalFraction = direction < 0 ? 1 - routeFraction : routeFraction
const poiRouteMillis = traversalFraction * profile.routeDurationMillis
const poiTimeMillis = replayPhase.startMillis
    + startHoldMillis
    + replayPlaybackTimeAtRouteTime(profile, poiRouteMillis)
```

Guard zero-length paths and invalid projected positions. Reverse playback transforms geographic route progress into traversal progress **before** conversion. Do not reverse absolute video time or shift endpoint holds twice.

`profile.playbackDurationMillis` is the effective duration of the traversed route. `replayPhase.durationMillis` may also contain the start/end endpoint holds. `videoTimeline.durationMillis` additionally contains pre-Replay and post-Replay clips. Do not calculate total duration by summing individual POI clips or visual regions.

## 6. Studio-only timeline projection

Introduce a pure, independently testable module, e.g.:

`src/core/ui/replay/ReplayPOITimelineProjection.js`

Proposed function:

```js
export const createReplayPOITimelineProjection = ({
    videoTimeline,
    profile,
    projectedPOIs,
    totalDistanceMeters,
    direction,
}) => ({
    tracks: [],
    markers: [],
    regions: [],
    signature: '',
})
```

Only **valid, qualified, current** profile inputs may produce regions. Its output is derived, serializable, application-owned **view data**. Never persist this output as editable Journey authoring clips.

### 6.1 Read-only POI timing clips

Build a clip for each eligible **POI passage** from `profile.poiPresentationWindows`, not merely one clip per unique POI ID. A route may encounter the same POI more than once. Compute each clip's absolute start/end using `replayPlaybackTimeAtRouteTime()`; express clip `start` and `end` in **seconds**, preserving millisecond source fields in Studio as needed.

Suggested generated clip shape passed to Timeline:

```js
{
    id: 'poi:<stablePoiId>:<passageIndex>',
    kind: 'annotation',
    label: '<POI display label>',
    start: startMillis / 1000,
    end: endMillis / 1000,
    editable: false,
    selectable: false,
    resizable: false,
    metadata: {
        sourceKind: 'computed-poi-passage',
        poiId: '<stablePoiId>',
        passageIndex: 0,
    },
}
```

Stable IDs must use the actual POI identity and passage index, and resolve collisions deterministically. Arrange overlapping **presentation** clips on separate automatically allocated POI lanes using a stable interval-partition algorithm; reuse the earliest freed lane. Never change route timing or sum overlapping intervals while allocating lanes. Keep the main Replay track at its existing bottom position. All generated POI lanes are locked, non-droppable, and non-persisted; they do not replace editable widget tracks.

### 6.2 Global POI markers

Use existing `timeline.markers`, one per eligible projected passage, at the exact geographic POI traversal time:

```js
{
    id: 'poi:<stablePoiId>:<passageIndex>',
    timeMillis: poiTimeMillis,
    label: '<POI display label>',
    icon: 'diamond',
    editable: false,
    movable: false,
    removable: false,
    snap: false,
    expanded: false,
}
```

The host owns selection/open-POI actions, if any. Do not enable the package's marker relocation, rename, add or delete actions for these computed markers. Existing user-authored markers, if present, must be preserved; namespace computed IDs and merge controlled arrays explicitly.

### 6.3 Read-only slowdown and crawl regions on the Replay row

Project actual `profile.segments` to absolute video-time **regions**, with `trackId` targeting the main Replay track:

- `speedFactor < 1`, `poiCrawl !== true`: subdued slowdown regions.
- `poiCrawl === true`: stronger near-stop region; merge contiguous adjacent crawl segments for display.
- Additional start/end hold regions are calculated **only** from canonical `endpointPOIPauseMillis`, with a distinct hold label/tone.
- Merge adjacent segments with equivalent visual category when no POI-specific boundary needs to be preserved. Avoid thousands of one-pixel elements for dense profiles; optimize for visible time range and zoom.
- Overlapping POI windows must never multiply the effective duration or produce fabricated extra holds.

Example **proposed** generic data:

```js
{
    id: 'computed:slow:42',
    trackId: 'replay',
    startMillis: 12000,
    endMillis: 14500,
    label: 'Reduced movement',
    color: 'orange',
    emphasis: 'subtle',
    metadata: {sourceKind: 'computed-speed'},
}
```

A crawl region uses `emphasis: 'strong'` and an endpoint hold uses a distinct `label`, but the Timeline package interprets none of these semantic labels. `metadata` is pass-through data, never parsed as application behavior by the package.

### 6.4 Integration and lifecycle

1. Build the canonical qualified profile before preparing the visible timeline; do not use the nominal duration as a silent fallback if a profile is still pending. A temporary *unqualified* state may show no derived POI overlays while retaining the correct baseline UI.
2. Reuse `ReplayPreparationTimeline.buildReplayPreparationTimeline()` for total duration, phase boundaries, and existing widget tracks. Inject/compose the computed POI tracks and regions **after** canonical time resolution, without an independent timeline calculation.
3. In `ReplayTimelinePreview.jsx`, apply controlled `tracks`, `markers`, `regions`, `currentTimeMillis`, and `playing`. Synchronize their revision and view changes; avoid resetting vertical scroll, zoom, playhead, or user-authored clips when computed timing changes.
4. Ensure the projection signature changes with qualified profile segments, passage identity/position, direction, duration, endpoint holds, relevant presentation policy, and route/camera/crop qualification revision. Do not make profile/region source changes appear as user-authored edit events.
5. Existing timeline storage (`journey.replay.videoTimeline`) must **not** acquire persisted computed POI clips or regions. Keep persisted authoring/editor state separate from volatile compiled timing. Preserve saved widget row order and clip edits when regenerating the POI projection.
6. Export uses a frozen qualified speed profile from the same logical route as interactive playback; UI re-rendering never changes frame geography. Qualify/refresh before export as needed, and invalidate stale cached profiles.
7. Expert is the primary timeline editing surface in `1.0.0`; Basic still has automatic slowdown even if it does not expose the editor. Do not introduce an Expert-only clock or Basic-only export behavior.

## 7. Timeline package API: generic controlled time regions

Add a **generic**, optional `regions` property to `lgs1920-timeline` and the React adapter. No Studio imports, POI keywords, geographic assumptions, or timing calculations may appear in the package source, documentation, tests, or CSS.

Proposed public schema:

```js
const regions = [
    {
        id: 'range-a',
        trackId: 'track-1',
        startMillis: 12500,
        endMillis: 13750,
        label: 'Marked interval',
        color: 'orange',
        emphasis: 'subtle', // 'subtle' | 'strong'
        metadata: {source: 'external'},
    },
]

element.regions = regions
```

**Contract:**

- `id` stable and unique within the region collection; `trackId` names an existing public track; both are opaque to the package.
- `startMillis`/`endMillis` are **absolute timeline milliseconds**, not clip-local time. Reject or ignore non-finite, empty and reversed ranges; clip visible portions to the current timeline interval without mutating the host arrays.
- `label` supports an accessible description. `color` follows the package's existing palette/color convention; `emphasis` is a generic presentation modifier.
- The property is controlled. Assigning a new value updates the visualization; it does not emit edit commands or change current time.
- Regions render on the targeted track and align with the time ruler, zoom, scroll and track visibility. They must remain visible **on top of the clip fill and below readable clip labels/handles**, with restrained contrast.
- Regions are **read-only and pointer-transparent**: they never steal clicks, hover, pointer capture, drag, trim, snap, context-menu, keyboard focus, or transport actions.
- Multiple overlapping regions are supported; deterministic layering and clipping must not overflow adjacent tracks or the viewport.
- A missing/hidden target track, empty region collection, or absent property is harmless and preserves the current rendering behavior.
- Do not introduce an application clock, source parser, persistence, playback rate control, or independent zoom mapping.
- Update `applyControlledState()` (if appropriate), `timelineReact.jsx`, API docs, demo, CSS parts/tokens, and regression tests. Preserve existing package exports and behavior when `regions` is absent.

**Implementation guidance:** inspect `src/LGS1920Timeline.js`, `src/timelineRendering.js`, `src/timelineLayoutMixin.js`, `src/timelineState*.js`, `src/timelineReact.jsx`, and `src/timeline.css`. Use one shared geometry calculation for clips and regions; do not derive time positions using unrelated DOM measurements. Keep rendering efficient when the host supplies many tiny adjacent intervals.

**Backward-compatible integration option:** Studio can first land read-only POI clips plus existing markers. Add the `regions` assignment when the generic API is available. Do not duplicate `ReplayPOISpeedProfile` logic just to work around an older installed Timeline package.

## 8. Proposed repository change inventory

### Studio (`1.0.0` baseline)

| Path | Required change |
| --- | --- |
| `src/core/ui/replay/JourneyReplayRuntime.js` and `JourneyReplayPOISettings.js` | Normalize the effective POI animation/visibility policy across Basic and Expert without adding speed settings. |
| `src/core/ui/replay/JourneyReplaySessionPlaybackController.js` | Prepare eligible POIs and perform canonical visibility qualification for both modes before speed-profile creation. |
| `src/core/ui/replay/JourneyReplayPlaybackController.js` | Enable the existing profile for both modes; validate, publish, and reuse its exact compiled segments. |
| `src/core/ui/replay/ReplayPOISpeedProfile.js` | Minimal mode-neutral policy input/validation adjustment if needed; **do not change** one-second crawl or speed formulas. |
| `src/core/ui/replay/ReplayDeferredExporter.js` | Remove Basic-only profile reuse/qualification gate; preserve export parity and qualified signature. |
| `src/core/ui/replay/ReplayVideoTimeline.js` and `ReplayFrameResolver.js` | Prefer existing mapping; change only where necessary to preserve shared timing and endpoint holds. |
| `src/core/ui/replay/ReplayPOITimelineProjection.js` | **New** pure derived projection for read-only POI clips/markers/regions and stable signature. |
| `src/core/ui/replay/ReplayPreparationTimeline.js` | Compose the derived tracks with existing canonical video-phase and widget tracks. |
| `src/components/MainUI/video/ReplayTimelinePreview.jsx` | Bind computed markers/regions and prevent their persistence as user-authored edits. |
| `tech-doc/todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md` | Correct or cross-reference its outdated two-second crawl claim. |
| Matching unit/UI/integration tests | Validate policy, timing, rendering, seek, export parity, persistence, and cleanup. |

### Timeline package

| Path | Required change |
| --- | --- |
| `src/LGS1920Timeline.js` | New controlled `regions` getter/setter and state synchronization. |
| `src/timelineRendering.js` and relevant layout modules | Generic time-aligned read-only region rendering, hit-test transparency and clipping. |
| `src/timelineReact.jsx` | Forward the optional controlled `regions` prop. |
| `src/timeline.css` | Generic accessible styles, tokens/parts and subdued/strong region treatments. |
| `src/README.md`, `docs/specifications.md`, demo | Describe and demonstrate the generic API without POI- or Replay-specific language. |
| `test/` | Geometry, scroll/zoom, controlled updates, overlap, accessibility, cleanup and backward-compatibility tests. |

## 9. Architecture decision record (ADR)

| ID | Decision | Reason / alternative rejected |
| --- | --- | --- |
| ADR-01 | Reuse `ReplayPOISpeedProfile` as the only route-to-playback time map. | A new integration-based `ReplayTimeMap` would duplicate and potentially change an existing, production-tested one-second near-stop behavior. |
| ADR-02 | Apply the same compiled slowdown to eligible POIs in Basic and Expert. | Mode-specific playback/export gates are an implementation artifact, not a reason for Expert to skip the reading pause. |
| ADR-03 | Keep slowdown automatic and read-only. | No speed automation editing, per-POI `minRate`, or new saved domain schema is necessary to represent existing motion. |
| ADR-04 | Model the near-zero crawl and endpoint holds separately. | The crawl advances the clock and route through positive-speed segments; endpoint holds keep route position constant. Treating both as a manual pause would break inverse mapping. |
| ADR-05 | Render POI passages as generated read-only clips and existing markers; render speed as generic regions. | Tracks/clips preserve per-passage identity (including overlaps), while target-track regions reveal the actual speed profile on the Replay clip itself. |
| ADR-06 | Add a domain-neutral, controlled `regions` API to the Timeline package. | Hardcoding POI-aware overlays in the generic Web Component or relying on Studio-owned DOM measurements would violate the component boundary. |
| ADR-07 | Store computed visual timing only in transient preparation projections. | Persisting generated POI clips in `journey.replay.videoTimeline` would mix derived motion with user-authored clips and destabilize editing history. |
| ADR-08 | Use the exact qualified runtime/export snapshot and invalidate it when relevant inputs change. | Calculating approximate markers from nominal distance while exporting a warped profile would misalign editing and the final video. |
| ADR-09 | Keep Studio and Timeline separately deliverable. | Studio can use existing read-only clips/markers before adopting the new region API; no automatic package publish or cross-repo commit is implied. |

### Reference projection algorithm (proposed)

The following illustrates the authoritative timing conversion. The emitted region shape is generic; input metadata stays application-owned. `coalesceAdjacentRegions` and `makeStableId` are proposed pure helpers, not existing APIs.

```js
export const projectReplaySpeedRegions = ({videoTimeline, profile}) => {
    if (!profile?.segments || !videoTimeline?.replayPhase) return []

    const startMillis = videoTimeline.replayPhase.startMillis
        + (videoTimeline.endpointPOIPauseMillis?.start ?? 0)

    const regions = profile.segments
        .filter(segment => segment.speedFactor < 1)
        .map((segment, index) => ({
            id: `computed-speed-${index}`,
            trackId: 'replay',
            startMillis: startMillis + segment.playbackStartMillis,
            endMillis: startMillis + segment.playbackEndMillis,
            label: segment.poiCrawl ? 'Near-stop interval' : 'Reduced movement',
            color: 'orange',
            emphasis: segment.poiCrawl ? 'strong' : 'subtle',
        }))

    return coalesceAdjacentRegions(regions)
}
```

The complete adapter must also project endpoint holds, ensure stable IDs across rebuilds, validate qualified profile revisions, and avoid dropping a region when numerical floating-point boundaries differ by less than the selected tolerance. The example is not a substitute for those safeguards.

## 10. Acceptance criteria

### Behavior and correctness

- [ ] `1.0.0` Basic automatic POI slowdown is unchanged: default factor, ramp formula, one-second near-zero crawl and eligible endpoint one-second holds.
- [ ] The same eligible POI and route produce the same automatic slowdown in Expert; no new manual speed field or per-POI editing UI is exposed.
- [ ] Disabled, invisible, too-distant, unqualified, and repeated POI passages follow existing eligibility rules in both modes.
- [ ] All active speed segments have finite positive speeds, ordered route and output times, and a monotone invertible time mapping.
- [ ] Overlaps are combined once by the canonical profile; output duration is not the sum of POI clip durations.
- [ ] Timeline shows computed POI passage clips, fixed markers and restrained slowdown/crawl/endpoint-hold regions at the exact canonical output times.
- [ ] Timeline seeks inside a near-zero crawl resolve the same geographic position as the canonical Replay frame; reverse direction, mid-route starts, looping, pause/resume and clip boundaries remain consistent.
- [ ] Draft, Expert/Basic interactive playback and HQ export resolve the same route progress for matching frame times and the same qualified profile.
- [ ] Derived POI overlays never become editable Journey clips or corrupt persisted `journey.replay.videoTimeline` or user widget edits.
- [ ] When `regions` is unset, `@lgs1920/timeline` behaves exactly as before. Regions never intercept editing or navigation interactions.

### Recommended focused regression cases

1. One center-route POI at 30 FPS and 60 FPS; verify almost stationary one-second crawl and exact end progress.
2. Two intersecting visibility/presentation windows; verify the slowest speed wins and no duplicate duration is counted.
3. Repeated passes of one POI with stable distinct markers/clips.
4. Reverse traversal with asymmetric near-POI visibility; markers and holds maintain correct chronological order.
5. Start and stop POIs with separate true holds; zero-length path, no POIs, all hidden POIs, and POI outside the crop.
6. Basic versus Expert using equivalent effective animation/visibility policies: compare compiled segment arrays, durations and frame-to-progress samples.
7. Editor re-projection after POI relocation, path/scope changes, mode switch, camera crop change and animation policy change, with stale profile invalidation.
8. Read-only region click-through with existing clip resize/move handles; no listener leaks or overflow during zoom and scrolling.
9. Timeline persistence/restore preserves user-authored clip edits while never saving generated POI rows, markers or regions.

## 11. Delivery and dependency order

1. Implement the **generic Timeline `regions` API** in the Timeline repository, independently of Studio. Test and document it. Do not publish a release without explicit authorization.
2. Implement the **mode-neutral Studio speed-profile wiring** and verify Basic/Expert/Draft/HQ parity before enabling new visuals.
3. Implement Studio's pure POI projection and bind existing `markers`, generated read-only `tracks`, and the new `regions` API. If the Timeline API is not yet integrated into Studio's installed version, keep a feature-detected compatibility path for the existing clips/markers until dependency adoption is explicitly authorized.
4. Correct or link the outdated two-second wording in the general Replay Timeline TODO.
5. Run targeted and applicable repository tests; document any browser/WebGL limitations. Studio documentation updates require the repository's standard PR-to-`main` delivery workflow, subject to normal explicit Git authorization.

**Do not** stage, commit, push, publish, release, or merge as an implicit side effect of this specification.

---

## 12. Codex prompt A — Studio (`lgs1920/studio`, branch `1.0.0`)

Copy the following complete prompt into Codex **in the Studio repository**:

> Implement the dedicated specification `tech-doc/todo/CORE-REPLAY-POI-AUTOMATIC-SLOWDOWN-TIMELINE-SPEC.md` in the `lgs1920/studio` repository, using branch `1.0.0` as the baseline. Read `PROJECT_RULES.md`, the dedicated specification, and `tech-doc/todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md` before editing. Do not switch to or infer implementation from `main`.
>
> **Approved product requirements:** (1) Preserve the existing automatic geographic slowdown for eligible POIs, including the exact one-second near-zero crawl in `ReplayPOISpeedProfile.js`, the surrounding speed curve, and separate eligible one-second endpoint holds. (2) Extend precisely the same automatic behavior to **Expert**, not only Basic. (3) No new POI slowdown settings, editable speed graph, or per-POI speed controls. (4) Show derived, read-only POI passage clips, markers and slowdown/crawl/hold regions in the preparation timeline using canonical output-video milliseconds. (5) Keep interactive playback, seeking, reverse travel and HQ export consistent.
>
> **First audit the actual `1.0.0` implementation** of `JourneyReplayRuntime.currentJourneyReplayPoiBehavior()`, `JourneyReplaySessionPlaybackController.configure()`, `JourneyReplayPlaybackController.configure()`, `ReplayPOISpeedProfile`, `ReplayDeferredExporter.resolveReplayPOISpeedProfile()`, `ReplayVideoTimeline`, `ReplayFrameResolver`, `ReplayPreparationTimeline`, and `ReplayTimelinePreview.jsx`. Identify Basic-only assumptions at nearby-POI collection, policy normalization, qualified-profile validation, playback and export. Preserve existing POI visibility and crop/terrain eligibility semantics; do not allow Expert's legacy policy to be accidentally replaced with a Basic-only setting.
>
> Implement a single **mode-neutral resolved POI policy** fed to the **existing** speed-profile compiler. Keep its numerical formulas, one-second crawl and existing route/playback conversion functions unchanged. Correct profile validity/signatures for Expert and mode switching. Ensure the same qualified immutable logical profile is consumed by the live Replay and HQ export; do not silently discard it when Expert is selected or when the export cannot qualify it. Do not build a second `ReplayTimeMap`.
>
> Add a pure, unit-tested Studio module `ReplayPOITimelineProjection.js` that converts profile `segments`, `poiPresentationWindows`, projected passage distances and endpoint holds into (a) read-only generated POI clip lanes, (b) read-only existing Timeline markers, and (c) generic absolute-millisecond `regions` targeted at the Replay track. Use `replayPlaybackTimeAtRouteTime()` for every conversion and offset by Replay phase start plus the start endpoint hold exactly once. Distinguish slowdown, `poiCrawl`, and true endpoint holds. Support repeated passes, overlapping windows, reverse direction, no POIs, unqualified profiles, stable IDs and deterministic overlap-lane allocation. Never sum visual intervals to calculate output duration.
>
> Compose the generated rows with the canonical preparation projection, keep the Replay track position and existing widget tracks unchanged, and bind controlled `tracks`, `markers`, `regions`, `currentTimeMillis` and `playing` through the Studio adapter. Generated timing is never persisted in `journey.replay.videoTimeline` as authored clips. Preserve user edits, playback position, zoom and scroll across re-projections. If the installed Timeline package lacks `regions`, feature-detect and support clips/markers without inventing a private duplicate rendering engine; coordinate adoption of the new generic API with the Timeline repository.
>
> Update the stale reference to a two-second crawl in `CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md` so it agrees with the one-second compiler, without modifying unrelated TODO scope. Add focused Vitest unit/UI/integration tests for Basic/Expert parity, POI qualification, actual output-time mapping, overlap, reverse playback, endpoint holds, timeline persistence, scrub/resume and HQ export. Follow the Studio browser/WebGL preflight skill before any actual browser tests. Run focused tests and the relevant lint/typecheck/build checks. Report changed files, tests, remaining limitations and cross-repository dependencies. **Do not stage, commit, push, publish, or merge without explicit authorization.** Keep new source comments/JSDoc and documentation in English; follow the no-semicolon, arrow-function and named-export rules.

---

## 13. Codex prompt B — Timeline (`lgs1920/timeline`)

Copy the following complete prompt into Codex **in the Timeline repository**:

> Implement the generic controlled **time regions** API described in the specification `CORE-REPLAY-POI-AUTOMATIC-SLOWDOWN-TIMELINE-SPEC.md` (provided with this request) in `lgs1920/timeline`. Read `PROJECT_RULES.md`, `src/README.md`, `docs/specifications.md` and the actual component/rendering/React code before editing. The new capability must be **strictly domain neutral**: do not introduce POI, Replay, Studio, camera, route, geography, or export concepts anywhere in Timeline source, documentation, demos or tests.
>
> Add `element.regions` as an optional controlled array of `{id, trackId, startMillis, endMillis, label, color, emphasis, metadata}`. All time coordinates are absolute timeline milliseconds, unlike clip `start`/`end` in seconds. Regions are non-editable time-range decorations targeting a public track ID. Accept valid finite positive intervals, safely ignore malformed intervals, clip to timeline bounds/viewport, support overlap with deterministic layering, and preserve host data and metadata without mutation or interpretation. Render them aligned to the existing ruler/clip geometry during horizontal scrolling, zooming, vertical track reordering/scrolling and controlled updates. Place the visual overlay over the clip surface but beneath readable labels and resize controls. Ensure region surfaces never intercept pointer, keyboard, selection, dragging, snapping, context-menu or transport interactions. Keep accessible labels/descriptions and subdued/strong visual emphasis; respect existing palette, theme and contrast conventions.
>
> Integrate the property with `src/LGS1920Timeline.js`, the renderer/layout and state synchronization mechanisms, `applyControlledState()` where appropriate, `src/timelineReact.jsx`, `src/timeline.css`, the public API docs and an independent **generic** demo. Preserve `markers`, track/clip editing, existing `lgs1920-timeline-*` events, `currentTimeMillis` and the package exports. Avoid any internal clock, persistence, DOM-leaking observers or new host dependencies. Keep the absent/empty `regions` case backward compatible and inexpensive; avoid excessive DOM nodes for large interval arrays.
>
> Add deterministic tests for controlled updates and clearing, invalid inputs, overlap, hidden/missing tracks, zoom/scroll geometry, clipping, keyboard and pointer pass-through, read-only behavior, disconnect cleanup, React prop forwarding and old projects that never set `regions`. Run focused tests, then `bun run verify` and `bun run pack:check` as required by the repository. Report the API, implementation files, tests and limitations. **Do not stage, commit, push, publish, or release without explicit authorization.** Use English documentation/JSDoc/comments, no semicolons, and arrow functions except constructors.

## 14. Implementation references

- [Studio `1.0.0` — POI speed compiler](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/ReplayPOISpeedProfile.js)
- [Studio `1.0.0` — POI projection on sampler](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/JourneyReplayPOIProjection.js)
- [Studio `1.0.0` — POI settings and endpoint holds](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/JourneyReplayPOISettings.js)
- [Studio `1.0.0` — Playback controller](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/JourneyReplayPlaybackController.js)
- [Studio `1.0.0` — Canonical video timeline](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/ReplayVideoTimeline.js)
- [Studio `1.0.0` — Exporter](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/ReplayDeferredExporter.js)
- [Studio `1.0.0` — Preparation projection](https://github.com/lgs1920/studio/blob/1.0.0/src/core/ui/replay/ReplayPreparationTimeline.js)
- [Studio `1.0.0` — General timeline TODO](https://github.com/lgs1920/studio/blob/1.0.0/tech-doc/todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md)
- [Timeline repository](https://github.com/lgs1920/timeline)
- [Timeline public API reference](https://github.com/lgs1920/timeline/blob/main/src/README.md)