# Replay Implementation Status

Status: current implementation inventory

Date: 2026-09-30

## Purpose

This document separates delivered replay capabilities from partial and planned
work. It must be updated when replay architecture changes. Detailed rationale
and target behavior belong in the current architecture and focused TODO specs.

## Replay user modes

Simple and Expert are user-facing configuration modes for the same Replay
session, frame resolver, camera/runtime, and timeline. They do not select
separate replay engines. Simple applies a restricted preparation and widget
policy and uses the guided camera configuration; Expert exposes the additional
camera, clip, and replay controls. Both modes use the active mode's normalized
camera settings for interactive preparation/playback and the same deterministic
Replay export path. Pitch sets the viewing angle and configured camera height
determines the target-relative range used as zoom. The single `cameraAngle` is
measured from the route tangent:
`0°` is along the trace, `+90°` right, `-90°` left, and `±180°` behind. The
camera always looks back toward the replay anchor. During Simple or Expert
preparation, the cone and camera icon use the current Cesium projection so the
cone remains anchored to the route departure as the map moves. The simulated
departure trace uses sampled terrain height and is reprojected whenever Cesium's
view or frustum changes, keeping it aligned to terrain. The trace, departure marker, and activity icon ease to their new
positions over a short animation. Changing the Cesium camera orientation also
refreshes the guide projection to keep the camera icon aligned to the trace
without changing `cameraAngle`; Cesium navigation cannot write camera settings.
The camera icon follows the local map plane. The journey activity icon stands
perpendicular to that plane and faces the angle camera marker at the cone tip;
both follow the scene projection.
Only dragging the camera icon adjusts its azimuth, while the cone tip adjusts
height. During preparation, dragging the simulated-route arrow changes the
visible source-trace distance from 60 to 1,200 metres. The complete DOM guide is
hidden while either route endpoint is outside the viewport or terrain-occluded.
Start/stop clips can override the camera for their own phases.

Simple and Expert Replay recording use the deferred MP4 exporter, publish
deterministic frame progress to the Replay monitor, and hand the completed MP4
to the standard preview and sharing dialog. All video files are created by
Replay MP4 export. `ReplayMediaCapture` handles still screenshots and media
handoff; it does not encode video.

Simple/Expert support is present but incomplete:

- Expert camera settings are initialized from Simple settings on first entry.
  Camera edits from the drawer and direct map interaction now synchronize with
  `journey.replay.expert.camera` and persist after editing settles. Progression
  and profile-info drawer edits are still not consistently written back to the
  journey configuration.
- Some Simple behavior is keyed to transient
  `replay.simplePreparationActive`, while other behavior reads persisted
  `userMode`. Render plans and context signatures do not consistently include
  the effective mode/configuration, leaving widget policy and cached plans
  vulnerable to stale mode state.
- Simple defaults differ between runtime normalization and
  `public/replay.yaml`; align the defaults so imported and freshly-created
  settings resolve consistently.

## Implemented on `refactor/replay-architecture`

- Versioned replay definition, render plan, frame intent, and frame result
  contracts.
- Shared frame resolution and publication boundaries for Replay playback,
  capture, and scrub.
- Canonical renderer-independent camera definitions and commands.
- Deterministic Cesium camera command application.
- Real-time progress slider with coalesced latest-request-wins scrubbing.
- Asynchronous cancellable settled-frame qualification.
- Explicit replay session ownership and guarded cleanup.
- Canonical camera-command continuity across transitions and clips.
- Explicit owner-scoped viewer, scene, and canvas render targets.
- Isolated no-loop export `CesiumWidget` implementation with scene descriptor
  replication, retained for explicit isolated-render workflows and tests.
- Simple and Expert product MP4 recording renders Replay trace and camera
  frames in the main Studio Cesium viewer, then copies its canvas into the video
  composer. The main Cesium camera is the only product Replay camera source.
- Deterministic Replay MP4 export at fixed frame timestamps, with monitor
  pause/cancel controls and preview/share handoff.
- Unified transient Replay transport and export monitor hosted by
  the generic Widget manager. It retains normal replay scrubbing, playback,
  snapshot, and settings controls, then switches to the exact composed encoder
  frame, progress, dynamic duration/remaining-time metrics, icon-only lifecycle
  actions, inline fallback, and Picture-in-Picture cleanup.
- Logical crop viewport and physical output scaling for export and widgets.
- Visibility-aware widget capture with dirty bitmap reuse, synchronous export
  preparation for Stats/Compass/Profile, bounded cancellable capture, and
  lifecycle restoration of mirror scheduling. Export composition draws directly
  into the working frame with no autonomous compositor loop or intermediate
  full-frame copy. Browser regression scenarios cover real SnapDOM, Cesium
  crop pixel parity, and deterministic MP4 encoding, but complete browser
  validation remains pending: Chromium WebGL initialization is unavailable
  in the current environment. Reference-journey export validation and total
  export-time benchmarks have not been completed.
- Crop-aware isolated export camera frustums and readiness identity for 2D,
  terrain, and 3D Tiles capture.
- Frame-accurate export trace updates and deterministic Navigation camera updates.
- Moving clip readiness separated from settled waits.
- Linked-video Replay preparation timeline with a normalized transient
  multi-track projection, controlled playhead and scrubbing, widget visibility
  tracks, widget-row ordering, local clip edits, a resizable track-title legend,
  bounded ruler zoom, and throttled transient scrubbing.
  See
  [Replay timeline preparation implementation](CORE-REPLAY-TIMELINE-IMPLEMENTATION.md).

These items describe the current branch, not a released version. They remain
subject to the validation gates below.

## Partial implementation

- The canonical frame contract coexists with mutable session controllers and
  compatibility store projections.
- Camera qualification still uses parts of the reactive runtime correction
  stack instead of a fully compiled qualified trajectory.
- The trace still uses Cesium entities and dynamic geometry rather than one
  benchmark-selected immutable capture representation.
- Scene descriptor replication covers the active supported environment but is
  not yet a generic clone of every possible Cesium primitive or provider.
- Automated tests cover contracts and routing, but fixed visual reference
  journeys and video artifact comparison are not complete.
- `JourneyReplayRunner` remains in the application for compatibility consumers.
- The delivered timeline is a transient preparation projection. Persisted
  editable timeline authoring, domain-level item trimming and overlap
  validation, and complete timeline-driven Replay authoring remain future
  work.

## TODO roadmap

| Status | Target | Work item | Detailed specification |
| --- | --- | --- | --- |
| PARTIAL / TODO | 1.0.0 | Complete synchronized replay-start camera editing while preserving the implemented canonical camera and clip continuity | [Start camera editor](../../todo/CORE-REPLAY-START-CAMERA-EDITOR-SPEC.md) |
| TODO | 1.0.0 | Validate isolated Replay export on fixed imagery, terrain, and 3D Tiles journeys; prove camera parity, resource teardown, and visual quality | [Replay quality validation](CORE-REPLAY-QUALITY-VALIDATION.md) |
| IMPLEMENTED | 1.0.0 | Deliver linked Replay preparation as a compact controlled Timeline preview | [Timeline implementation](CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) |
| PARTIAL / TODO | 1.0.0 follow-up | Connect remaining Timeline domain commands, Action Mode, clip double-click navigation, and persisted visibility/order changes | [Timeline implementation](CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) |
| TODO | 1.1.0 | Replace separated clip controls with the normalized editable multi-track replay timeline | [Track timeline editor](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) |
| TODO | 1.1.0 | Persist timeline authoring and make Replay playback and export consume the edited domain model | [Track timeline editor](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) |
| PARTIAL | Unplanned | Finish Simple/Expert settings ownership, effective-mode propagation, and consistent Simple defaults | [Replay user modes](#replay-user-modes) |
| TODO | 1.1.0 | Drive POI animation and displayed fields from canonical replay time | [POI animation](../../todo/CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md) |
| TODO | 1.1.0 | Align clip altitude inputs and continuity across reordered sequences | [Clip altitude alignment](../../todo/CORE-CLIP-ALTITUDE-DATA-ALIGNMENT-SPEC.md) |
| TODO | 1.1.0 | Add explicit Automatic, 720p, 1080p, and 4K Replay output profiles with capability checks | [Replay resolution profiles](../../todo/REPLAY_VIDEO_RESOLUTION_PROFILES_SPEC.md) |
| TODO | 1.1.0 | Implement the replay-synchronized repeatable Video Widget | [Video Widget](../../todo/VIDEO_WIDGET_SPEC.md) |
| TODO | 1.1.0 | Implement the Three.js drone path editor over the serializable runtime evaluator | [Drone camera editor](../../todo/CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md) |
| TODO | Unplanned | Validate and schedule the Three.js HPR orientation sphere widget | [HPR sphere widget](../../todo/CORE-CAMERA-HPR-THREEJS-SPHERE-WIDGET-SPEC.md) |

Additional 1.1.0 architecture work remains to complete capture-time camera
qualification, migrate every dynamic consumer to canonical frame time, and
retire `JourneyReplayRunner` after all compatibility consumers have moved.

## Completion gates

Replay work is not complete merely because unit tests pass. The applicable
checks in [Replay Quality Validation](CORE-REPLAY-QUALITY-VALIDATION.md) must pass,
including a real Replay/capture visual run for changes that affect pixels,
timing, camera, scene readiness, overlays, or encoding.
