# Valtio State Usage Audit and Correction Plan

Status: proposed follow-up; source audit completed, runtime validation pending

Date: 2026-09-20

## Objective

This audit reviews how Studio uses Valtio and identifies places where React
components subscribe to state roots that are larger than the data they render.
The main concern is deep snapshot work during Replay, Journey editing, and
settings persistence.

The document proposes a correction plan. It does not change the Valtio store
contract until the proposed measurements and focused tests confirm the runtime
benefit.

## Scope and method

The audit covers:

- the Valtio stores in [`src/core/stores`](../../src/core/stores);
- the React snapshot helpers in [`ValtioUtils.js`](../../src/Utils/ValtioUtils.js);
- Replay, Main UI, Journey Editor, widget, statistics, and settings consumers;
- imperative `snapshot()` and `subscribe()` calls;
- the installed Valtio 2.3.2 implementation;
- the existing GitNexus store and component relationships.

The source inventory found approximately 326 `useSnapshot` calls in `src`,
with repeated snapshots of the `main`, `ui`, `replay`, editor, widget, metrics,
and configuration roots. No browser performance trace was available, so this
document identifies high-probability costs rather than assigning measured
millisecond values.

## Valtio behavior relevant to this audit

`useSnapshot(root)` subscribes to the supplied proxy root and obtains a snapshot
from that root when the store changes. Valtio recursively visits proxied child
objects while building the snapshot. It uses snapshot caching and structural
sharing, so unchanged branches can be reused, but the root still defines the
scope of the traversal and the subscription.

`proxy-compare` can later determine that a component did not read the changed
path and reuse its previous snapshot. That optimization does not make a large
root equivalent to a small leaf snapshot. A large root is still a poor boundary
for state that changes at frame rate.

## Findings

### P0: Replay root snapshots are used in hot rendering paths

The Replay store combines static state, playback state, frame state, export
state, and preparation data in one object. Its high-churn fields include
`sample`, `progress`, `resolvedFrameState`, `dynamicFrameState`, and playback
flags. See [`replay.js`](../../src/core/stores/replay.js).

Several components subscribe to the complete Replay store:

- [`JourneyReplayProgressBar.jsx:187`](../../src/components/JourneyReplay/JourneyReplayProgressBar.jsx:187)
- [`ReplayTimelinePreview.jsx:450`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx:450)
- [`JourneyReplayDrawer.jsx:408`](../../src/components/JourneyReplay/JourneyReplayDrawer.jsx:408)
- [`JourneyStats.jsx:249`](../../src/components/Stats/JourneyStats.jsx:249)
- video portals, context menus, toolbars, and Replay widgets

The Replay controller publishes frame-related values during playback. This
makes a root snapshot a potentially expensive boundary even when a component
only needs `playing`, `progress`, or the current frame time.

The timeline already uses `subscribeKey` for selected Replay fields in its
imperative synchronization effect. The remaining issue is the root
`useSnapshot` used by the render path.

**Correction:** split Replay consumption into narrow playback, frame, and
static projections. Use leaf snapshots, `subscribeKey`, or scalar selectors for
the values required by each component. Keep the Replay controller as the single
clock owner and continue coalescing visual updates with animation frames.

### P0: The main root can include the complete current Journey

The `main` store contains `theJourney`. A Journey contains tracks, metrics,
points, camera data, and other nested values. The tracks and metrics can contain
large coordinate arrays and GeoJSON structures. See
[`main.js`](../../src/core/stores/main.js) and
[`Journey.js`](../../src/core/Journey.js).

Some components snapshot `main` only to obtain the current Journey:

- [`ReplayTimelinePreview.jsx:451`](../../src/components/MainUI/video/ReplayTimelinePreview.jsx:451)
- [`JourneyReplayClipsTab.jsx:556`](../../src/components/JourneyReplay/JourneyReplayClipsTab.jsx:556)

Several statistics and editor components have already started moving from this
pattern to `useProxyValue`, which is the correct direction.

**Correction:** expose a small reactive projection for Journey identity and
metadata such as slug, title, visibility, and availability. Keep the large
Journey data outside components that only need metadata. Use an explicit data
revision when a component must react to a large domain object.

### P1: UI root snapshots are wider than required

Components often read only `drawers`, `video`, or `mainUI` while subscribing to
the complete UI store. Examples include:

- [`MainUI.jsx:79`](../../src/components/MainUI/MainUI.jsx:79)
- [`ToolsUI.jsx:37`](../../src/components/MainUI/ToolsUI.jsx:37)
- [`TracksEditor.jsx:83`](../../src/components/TracksEditor/TracksEditor.jsx:83)
- [`JourneyGroupsDrawer.jsx:471`](../../src/components/TracksEditor/groups/JourneyGroupsDrawer.jsx:471)
- [`JourneyReplayProgressBar.jsx:189`](../../src/components/JourneyReplay/JourneyReplayProgressBar.jsx:189)

**Correction:** snapshot the smallest available branch, for example
`lgs.stores.ui.drawers`, `lgs.stores.ui.video`, or
`lgs.stores.ui.mainUI`. Use a scalar selector for a single boolean, identifier,
or string.

### P1: Editor, widget, configuration, and metrics snapshots can be deep

`useOptionalSnapshot` is useful when a source may be absent, but it still calls
`useSnapshot` on the complete source. Current consumers pass editor state,
widget configuration, metrics, and settings sections through this helper.

The following values deserve particular review:

- `$editor` and `$journeyEditor`, which may contain live Journey, Track, or POI
  objects;
- `$metrics` and `lgs.theJourney.metrics`, which may contain point arrays;
- widget configuration trees;
- complete widget lists and caches.

**Correction:** move components to leaf snapshots or primitive selectors. Split
large editor surfaces into row or property components. Keep list snapshots at
the collection boundary and avoid passing the complete collection snapshot to
every row.

### P1: Settings persistence serializes complete sections for every change

[`SettingsSection.js`](../../src/core/settings/SettingsSection.js) subscribes to
the section root and serializes the full content on every nested mutation. The
returned unsubscribe function is also ignored during initialization.

The dynamic settings getters in
[`Settings.js:58`](../../src/core/settings/Settings.js:58) create a complete
snapshot of a section for external reads.

This is valid at a persistence boundary, but it is inefficient when a user
changes several fields quickly or when a large widget configuration changes.

**Correction:** debounce and coalesce writes, keep the unsubscribe function,
prevent duplicate subscriptions, and limit full snapshots to persistence or
external serialization boundaries.

### P1: `MainUI` leaves subscriptions active after unmount

[`MainUI.jsx:206`](../../src/components/MainUI/MainUI.jsx:206) subscribes to
drawers and menu settings without retaining the unsubscribe functions. The
effect cleanup removes DOM listeners but not the Valtio subscriptions.

Repeated mounting can therefore leave stale callbacks active.

**Correction:** store both unsubscribe functions and call them from the effect
cleanup.

### P1: Full Journey snapshots are used for camera persistence

[`CameraManager.js:269`](../../src/core/ui/CameraManager.js:269) serializes a
full snapshot of the current Journey when saving camera information.

This is appropriate for an explicit Journey persistence operation, but it is
too broad if triggered by frequent camera updates.

**Correction:** persist camera state independently, or perform full Journey
serialization only after an explicit domain change. Use a Journey revision to
decide whether the full object needs to be written.

### P2: `useProxyValue` is useful but currently too generic

The new helper in
[`ValtioUtils.js:54`](../../src/Utils/ValtioUtils.js:54) avoids creating a deep
React snapshot, and the current migrations use it effectively for scalar values.
There are still design risks:

- it subscribes to the complete source root;
- inline selectors can be recreated on every render;
- it depends on Valtio's private `unstable_getInternalStates` API;
- selectors can accidentally return mutable or large objects;
- plain objects silently use the fallback and do not become reactive;
- selector purity and return-value stability are not enforced.

**Correction:** keep this helper limited to scalar projections, stabilize the
selector contract, prefer `subscribeKey` for direct fields, and isolate proxy
detection in one adapter module. Add tests for render count, selector calls,
plain-object behavior, and subscription cleanup.

### P2: Proxy identity and state access are not fully canonical

Studio accesses the current Journey through both `lgs.theJourney` and
`lgs.stores.main.theJourney`. Editor state is also available through several
proxy references. `cleanEditor()` replaces the editor proxy in place of
resetting its content, as shown in
[`LGS1920Context.js:401`](../../src/core/LGS1920Context.js:401).

Replacing a proxy can leave existing consumers or subscriptions attached to the
old identity.

**Correction:** keep stable proxy identities and reset their contents through
explicit store actions. Define one canonical reactive access path for the
current Journey and editor state.

## Current strengths

The following patterns are sound and should be preserved:

- snapshots of small branches such as camera, drawers, and device state;
- `proxyMap` for stable reactive collections;
- explicit snapshots at export and persistence boundaries;
- the current migration of scalar reads to `useProxyValue`;
- `subscribeKey` for selected Replay fields;
- central store ownership through `StoresManager`.

## Correction plan

### Phase 0: establish a baseline

Measure before broad refactoring:

- React render count and commit duration for Replay and Journey Editor screens;
- Replay callbacks and frame synchronization work per second;
- snapshot and selector call counts in development builds;
- settings serialization time and IndexedDB write frequency;
- dropped frames during Draft playback;
- behavior with a Journey containing several thousand coordinates.

The baseline should distinguish initial mount, editing, normal playback, and
high-frequency camera updates.

### Phase 1: define the Valtio access contract

Document these rules in the store guidelines:

1. `useSnapshot` targets the smallest useful proxy branch.
2. Root snapshots of `main`, `ui`, `replay`, and editor stores are prohibited in
   frame-rate or frequently mounted components.
3. `useProxyValue` returns primitives or deliberately stable projections.
4. Full snapshots are limited to persistence, export, and explicit one-time
   conversion operations.
5. Store proxies keep a stable identity across reset and hydration.

Create small adapters such as `useReplayPlaybackState`,
`useReplayFrameState`, and `useCurrentJourneyMeta` instead of duplicating
inline selectors throughout components.

### Phase 2: refactor the Replay and Journey hot paths

Prioritize:

1. `ReplayTimelinePreview`;
2. `JourneyReplayProgressBar`;
3. `JourneyReplayDrawer`;
4. `JourneyStats`;
5. `VideoSceneWidgetsPortal`;
6. `DockedWidgetDrawer`;
7. `JourneyReplayClipsTab`.

Replace broad Replay and Main snapshots with field or projection access. Keep
the current frame update scheduler and avoid creating a second playback clock.

### Phase 3: narrow UI, editor, and widget consumers

- replace UI root snapshots with `drawers`, `video`, `mainUI`, or other leaf
  branches;
- review `$editor`, `$journeyEditor`, `$metrics`, and widget configuration
  consumers;
- split list rendering into collection and row subscriptions;
- ensure large geometry and metrics do not enter unrelated UI snapshots;
- define explicit revisions for large domain data when necessary.

### Phase 4: repair lifecycle and persistence

- fix the `MainUI` unsubscribe leak;
- retain and dispose settings subscriptions;
- debounce settings writes and coalesce pending saves;
- avoid full Journey serialization for camera-only changes;
- make proxy replacement and hydration preserve stable identities.

### Phase 5: add regression coverage and guardrails

Add focused tests for:

- scalar selectors ignoring unrelated geometry changes;
- selector render counts and selector invocation counts;
- subscription cleanup after component unmount;
- settings save coalescing and latest-write-wins behavior;
- stable proxy identity after editor reset;
- Replay frame updates without unrelated component renders.

Add a static review rule or lint check for new root snapshots of `main`, `ui`,
and `replay` in known hot-path directories. Update this document as each
finding moves from proposed to measured, implemented, and validated.

## Acceptance criteria

The correction is ready for implementation review when:

- Replay hot components no longer depend on complete root snapshots for scalar
  or single-field reads;
- a large geometry mutation does not rerender components that only read metadata;
- settings writes are coalesced and subscriptions are disposed correctly;
- proxy identity remains stable after editor reset and hydration;
- focused tests pass;
- browser profiling shows no regression in initial mount, editing, or Replay
  playback.
