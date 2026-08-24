# Replay Architecture

Status: current implementation

Date: 2026-08-24

## Purpose

This document is the canonical description of the replay implementation. It
describes the code that currently exists. Historical findings and the rationale
for the ongoing refactoring remain in [`REPLAY-AUDIT.md`](REPLAY-AUDIT.md).
Planned work is tracked in the replay status document and in explicitly marked
TODO specifications stored beside the current replay documentation.

## Functional architecture

Replay has three scheduling policies over the same journey and camera domain:

| Policy | Time source | Render target | Primary purpose |
| --- | --- | --- | --- |
| Draft playback | Monotonic wall time | Interactive Studio viewer | Immediate preview and controls |
| HQ export | Fixed video frame timestamps | Isolated HQ Cesium host by default | Deterministic MP4 production |
| Scrubbing | Latest slider request | Interactive Studio viewer | Real-time manual positioning |

The policies must resolve equivalent visual state for the same logical time.
They are not independent replay engines.

The functional frame contains:

- journey sample and progress;
- active start, replay, wait, or stop phase;
- canonical camera pose and command;
- trace and marker state;
- dynamic widget and overlay state;
- scene-readiness and quality outcome.

## Runtime authorities

### Timeline and frame resolution

`ReplayVideoTimeline` and `ReplayFrameTimeline` enumerate HQ timestamps and
start/replay/stop phases. `ReplayFrameResolver` resolves a canonical frame intent
for a requested logical time. `ReplayFramePublisher` publishes complete resolved
frames to consumers.

The Valtio replay store and recorder events are projections for UI and legacy
integration. They are not authoritative clocks for rendering.

### Session and lifecycle

`JourneyReplaySessionController` remains the public replay facade. The session
controllers coordinate playback, scene state, camera state, clips, rendering,
and cleanup. `ReplaySessionOwnership` prevents obsolete asynchronous cleanup
from restoring or moving the camera after a newer session owns replay.

`JourneyReplayRunner` is a legacy authority still required by existing
consumers. New replay behavior must not be added to it.

### Camera

The current camera stack resolves the nominal tracking view, crop containment,
terrain visibility, pitch correction, and transitions. Canonical
`ReplayCameraCommand` values cross the Draft, HQ, scrub, and clip boundary.
`ReplayCesiumCameraAdapter` is the deterministic Cesium application boundary.

Draft may use live camera behavior. HQ must use logical frame time and apply a
camera result for every deterministic frame. Wall-clock throttling must never
decide whether an HQ camera frame is applied.

### Trace and marker

`JourneyReplayCesiumRenderer` owns replay trace and marker entities in one
`CustomDataSource`. It resolves its viewer and scene from the session's explicit
render target, falling back to the Studio viewer for interactive replay.

Draft may throttle expensive geometry updates. HQ must force frame-accurate
geometry because its frames are generated faster than wall time. A wall-clock
throttle can otherwise leave the encoded trace empty or stale.

### Render targets

`ReplayRenderTarget` associates a replay session with an explicit viewer, scene,
and canvas without replacing global Studio objects.

`IsolatedHqReplayRenderHost` owns a no-loop `CesiumWidget`, an independent
camera, and independent Cesium runtime resources. It reproduces the active
imagery, terrain, base 3D Tiles layer, and environment from a
`ReplaySceneDescriptor`. The exporter falls back explicitly to the visible
Studio scene if isolated initialization fails.

Camera, trace, clip, visibility, prewarming, readiness, and capture operations
must resolve the active session render target. They must not access the global
viewer directly when a target-aware call is available.

### Scene qualification and readiness

Transient slider requests apply immediately and coalesce to the latest request.
A settled request uses `ReplaySceneFrameQualifier`, supports cancellation, and
waits within bounded readiness budgets.

HQ scene readiness belongs to the HQ host. Moving replay and clip frames use
bounded moving-frame readiness; holds and final frames may request settled
quality. Readiness delays export wall time but never changes logical video time.

### Composition and encoding

`ReplayDeferredExporter` orchestrates HQ preparation, frame rendering,
readiness, overlay composition, encoding, cancellation, and cleanup.
`ReplayVideoOverlayComposer` maps logical widget and crop coordinates to the
physical output surface. Mediabunny encodes the product frame timeline and must
not become a replay clock.

### Replay transport and recording monitor

`ReplayRecordingMonitorWidget` is the single transient Replay surface outside the
captured widget board and is hosted by the generic `Widget` component. During
ordinary Replay it hosts the canonical transport, real-time scrub slider,
snapshot action, and settings action. During Draft or HQ recording it switches
to the latest final composed frame, recording progress, runtime metrics, and
icon-only lifecycle actions.

The surface is a read-only projection of replay and recording authorities. It
does not resolve frames, drive the replay clock, move either camera, qualify the
scene, or participate in composition. Widget reduction, positioning, and
removal belong to the widget manager; the monitor has no private close or
minimize controls. Explicit cancellation stops recording and exits
Picture-in-Picture before terminal cleanup.

## Required invariants

- One logical timestamp resolves one complete visual frame.
- Draft, HQ, and scrub consume the same canonical camera contract.
- HQ camera and trace updates are independent of wall-clock pacing.
- An isolated HQ export never moves the interactive Studio camera.
- A render owner writes camera and entities only to its active render target.
- Obsolete sessions cannot restore camera or scene state.
- Cancellation and every terminal exporter path release the target and destroy
  isolated Cesium resources.
- Dynamic widgets consume the published logical frame instead of private timers.
- The video-board compass consumes the published HQ camera pose while HQ is
  active; it never reads the interactive Studio camera for HQ composition.
- Replay transport and recording progress are not duplicated across independent
  floating HUDs.

## TODO architecture extensions

Future replay architecture is documented in focused specifications within this
directory. A TODO specification is not a description of current behavior. The
authoritative status and target release for every extension is maintained in
[Replay Implementation Status](CORE-REPLAY-IMPLEMENTATION-STATUS.md#todo-roadmap).

## Related documents

- [Replay implementation status](CORE-REPLAY-IMPLEMENTATION-STATUS.md)
- [Replay quality validation](CORE-REPLAY-QUALITY-VALIDATION.md)
- [Replay audit](REPLAY-AUDIT.md)
- [Camera tracking zones](REPLAY_CAMERA_TRACKING_ZONES.md)
