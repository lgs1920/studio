# Replay Architecture

Status: current implementation inventory; see the implementation status for known gaps

Date: 2026-08-24

## Purpose

This document is the canonical description of the replay implementation. It
describes the code that currently exists. Planned work is tracked in the replay
status document and in explicitly marked
TODO specifications stored beside the current replay documentation.

## Simple and Expert modes

Simple and Expert are user-facing Replay configurations over the same Replay
session, frame resolver, and camera/runtime. Simple provides a guided
preparation with a restricted set of controls and widgets. Expert exposes
additional camera, clip, and Replay controls. The selected mode changes
configuration and preparation policy, not the Replay engine or video renderer.
Both modes use the configured Replay camera and the same playback and MP4
export path. The current camera configuration controls heading/angle, pitch,
and camera height. Cesium range (the perceived zoom) is derived from camera
height and pitch, then carried in the same camera command used for interactive
playback and export. Start/stop clips may define their own camera movement.
Completed videos open in the standard preview and sharing dialog.
`ReplayMediaCapture` handles screenshots and completed-media handoff.

## Functional architecture

Replay resolves one journey and camera domain for interactive playback,
scrubbing, and capture. The following are execution paths, not user-facing
Replay modes:

| Policy | Time source | Render target | Primary purpose |
| --- | --- | --- | --- |
| Interactive playback | Monotonic wall time | Interactive Studio viewer | Immediate preview and controls |
| Deferred Replay capture | Fixed video frame timestamps | Main Studio Cesium viewer and canvas | Deterministic MP4 production |
| Scrubbing | Latest slider request | Interactive Studio viewer | Real-time manual positioning |

Each path must resolve equivalent visual state for the same logical time. They
are not independent replay engines.

The functional frame contains:

- journey sample and progress;
- active start, replay, wait, or stop phase;
- canonical camera pose and command;
- trace and marker state;
- dynamic widget and overlay state;
- scene-readiness and quality outcome.

## Runtime authorities

### Timeline and frame resolution

`ReplayVideoTimeline` and `ReplayFrameTimeline` enumerate deferred-export timestamps and
start/replay/stop phases. `ReplayFrameResolver` resolves a canonical frame intent
for a requested logical time. `ReplayFramePublisher` publishes complete resolved
frames to consumers.

The Valtio replay store and media handoff events are projections for UI and
integration. They are not authoritative clocks for rendering.

### Session and lifecycle

`JourneyReplaySessionController` remains the public replay facade. The session
controllers coordinate playback, scene state, camera state, clips, rendering,
and cleanup. `ReplaySessionOwnership` prevents obsolete asynchronous cleanup
from restoring or moving the camera after a newer session owns replay.

`JourneyReplayRunner` remains a compatibility authority for existing
consumers. New replay behavior must not be added to it.

### Camera

The current camera stack resolves the nominal tracking view, crop containment,
terrain visibility, pitch correction, and transitions. Canonical
`ReplayCameraCommand` values cross interactive playback, export, scrub, and
clip boundaries.
`ReplayCesiumCameraAdapter` is the deterministic Cesium application boundary.

Interactive playback may use live camera behavior. Deferred export uses
logical frame time and applies a camera result for every deterministic frame.
Wall-clock throttling must never decide whether an export camera frame is
applied.

### Trace and marker

`JourneyReplayCesiumRenderer` owns replay trace and marker entities in one
`CustomDataSource`. It resolves its viewer and scene from the session's explicit
render target, falling back to the Studio viewer for interactive replay.

Interactive playback may throttle expensive geometry updates. Deferred export
must force frame-accurate geometry because its frames are generated faster
than wall time. A wall-clock throttle can otherwise leave the encoded trace
empty or stale.

### Render targets

`ReplayRenderTarget` associates a replay session with an explicit viewer, scene,
and canvas without replacing global Studio objects. Interactive playback and
the product MP4 export both use the main Studio Cesium viewer. During MP4
export, the frame renderer advances Replay on that viewer, draws the trace
there, and copies the main Cesium canvas into the video composer for each fixed
frame timestamp. The main viewer is the sole camera authority; the video
composer receives pixels and overlays, not a second Cesium camera.

`IsolatedReplayRenderHost` remains an available off-screen host for explicit
isolated-render workflows and tests. It owns a no-loop `CesiumWidget`, a
separate camera, and independent Cesium runtime resources. It is not selected
by the Simple or Expert product MP4 flow.

Camera, trace, clip, visibility, prewarming, readiness, and capture operations
must resolve the active session render target. They must not access the global
viewer directly when a target-aware call is available.

### Scene qualification and readiness

Transient slider requests apply immediately and coalesce to the latest request.
A settled request uses `ReplaySceneFrameQualifier`, supports cancellation, and
waits within bounded readiness budgets.

Export scene readiness belongs to the active render target. Product MP4 export
qualifies frames on the main Studio viewer; explicit isolated-render workflows
qualify frames on their isolated host. Moving replay and clip frames use
bounded moving-frame readiness; holds and final frames may request settled
quality. Readiness delays export wall time but never changes logical video
time.

### Composition and encoding

`ReplayDeferredExporter` contains the deferred-export orchestration for
preparation, frame rendering,
readiness, overlay composition, encoding, cancellation, and cleanup.
`ReplayVideoOverlayComposer` maps logical widget and crop coordinates to the
physical output surface. Mediabunny encodes the product frame timeline and must
not become a replay clock.

### Replay transport and recording monitor

`ReplayRecordingMonitorWidget` is the single transient Replay surface outside the
captured widget board and is hosted by the generic `Widget` component. During
ordinary Replay it hosts the canonical transport, real-time scrub slider,
snapshot action, and settings action. During linked Replay export it switches
to the latest final composed frame, recording progress, runtime metrics, and
icon-only lifecycle actions. Each composed frame is copied synchronously into
the monitor preview before the exporter reuses its working canvas, preventing
the monitor from displaying an intermediate cleared frame. The monitor retains a
stable snapshot of that frame and reconnects its preview whenever React mounts a
new canvas, including when the surface moves to or returns from Document PiP.
Canvas recognition accepts same-origin canvases from the PiP window realm.

The surface is a read-only projection of replay and recording authorities. It
does not resolve frames, drive the replay clock, move either camera, qualify the
scene, or participate in composition. Widget reduction, positioning, and
removal belong to the widget manager; the monitor has no private close or
minimize controls. Explicit cancellation stops recording and exits
Picture-in-Picture before terminal cleanup.

## Required invariants

- One logical timestamp resolves one complete visual frame.
- Playback, capture, and scrub consume the same canonical camera contract.
- Deferred-export camera and trace updates are independent of wall-clock pacing.
- Product MP4 export resolves and applies each frame camera command on the main
  Studio viewer before copying its canvas into the video composer.
- An explicitly isolated render target never moves the interactive Studio
  camera.
- A render owner writes camera and entities only to its active render target.
- Obsolete sessions cannot restore camera or scene state.
- Cancellation and every terminal exporter path release the target and destroy
  isolated Cesium resources.
- Dynamic widgets consume the published logical frame instead of private timers.
- The video-board compass consumes the published export camera pose while an
  export is active; it never reads the interactive Studio camera for composition.
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
- [Camera tracking zones](REPLAY_CAMERA_TRACKING_ZONES.md)
