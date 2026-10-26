# Replay Implementation Status

Status: current implementation inventory

Date: 2026-10-22

## Purpose

This document separates delivered replay capabilities from partial and planned
work. It must be updated when replay architecture changes. Detailed rationale
and target behavior belong in the current architecture and focused TODO specs.

## Replay user modes

Basic and Expert are user-facing configuration modes for the same Replay
session, frame resolver, and camera/runtime. They do not select separate replay
engines. Basic applies a restricted preparation and widget policy and uses the
guided camera configuration; Expert exposes the additional camera, clip, and
Replay controls. The linked preparation Timeline is available in Expert; Basic
Replay has no Timeline. Both modes use the active mode's normalized
camera settings for interactive preparation/playback and the same deterministic
Replay export path. Pitch sets the viewing angle and configured camera height
determines the target-relative range used as zoom. The single `cameraAngle` is
measured from the route tangent:
`0°` is along the trace, `+90°` right, `-90°` left, and `±180°` behind. The
camera always looks back toward the replay anchor. During Basic or Expert
preparation, the guide anchor and bearing follow the current Cesium projection.
The cone has a fixed CSS-pixel display length independent of map zoom and
Replay camera height. A final screen-space
layout fits its rounded base, tip, and camera icon inside the live crop. It
preserves the departure anchor when enough room remains and otherwise moves
the display into the crop instead of collapsing its length. This display
constraint never changes the Cesium camera or persisted Replay settings.
Mounting and crop-element replacement resolve the live crop even when React
has not yet supplied its element reference.
The simulated departure trace uses sampled terrain height and is reprojected whenever Cesium's
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
Basic Replay disables camera diagnostics and adds a configurable-duration
trace-centroid focus phase after playback, rotating at one turn every five
seconds. Expert Replay exposes the camera diagnostics setting and uses configured
start/stop clips that can override the camera for their own phases.

Basic and Expert Replay recording use the deferred MP4 exporter, publish
deterministic frame progress to the Replay monitor, and hand the completed MP4
to the standard preview and sharing dialog. All video files are created by
Replay MP4 export. `ReplayMediaCapture` handles still screenshots and media
handoff; it does not encode video.

Basic Replay additionally has an opt-in Dry run setting. It walks the complete
configured timeline with camera, trace, and logical widget updates. Tile
prewarming remains enabled, with readiness checks bounded to 250 ms at phase
boundaries and final frames. Intermediate frames do not synchronously flush
Cesium or wait for tiles. Widget capture readiness,
bitmap capture, output image composition, and encoding are skipped. Its compact
monitor displays integer progress and frame counts without an image preview.
Saved video quality and FPS preferences remain unchanged.
Product export and Dry run apply each controller seek through the guarded frame
callback rather than also invoking the interactive scrub listener beforehand.
Supplied trace guides are converted once per installation instead of once per
property evaluation. A CPU-only 5,000-point, 421-frame synthetic scenario with
the production controller, renderer, and a real Cesium Camera reduced the
profiled Dry-run frame-work interval from 22.9 s to 2.0 s. This excludes WebGL
rendering, tile loading, bitmap capture, and encoding; it is not an end-to-end
recording benchmark or visual validation.
The Basic settings popup also exposes border/fill colors, a border toggle, and
four fixed trace/marker presets, with reactive previews and Journey persistence.
The thin preset reduces the trace scale to 0.65 while keeping the marker at the
small preset's baseline. Its duration choices include 45 seconds and one minute.

Basic/Expert support is present but incomplete:

- Expert camera and progression settings are initialized from Basic settings
  on first entry. Camera edits from the drawer and direct map interaction, plus
  progression edits from the drawer, synchronize with `journey.replay.expert`
  and persist after editing settles. Profile-info edits still need a matching
  journey writeback.
- Replay mode resolution keeps Basic authoritative while its preparation is active,
  then prefers the saved mode over the runtime store's default. Remaining
  render-plan and context signatures still need to include the effective
  mode/configuration consistently. Replay now resolves the selected journey
  from the main store before the legacy global reference and keeps the live
  camera pitch when Basic preparation rebuilds its sampler.
- Basic defaults differ between runtime normalization and
  `public/replay.yaml`; align the defaults so imported and freshly-created
  settings resolve consistently.

## Implemented on `refactor/replay-architecture`

- Opt-in Basic Replay Dry run over the complete deterministic timeline, with
  camera/trace/widget-state updates, tile prewarming and bounded tile readiness.
  It skips widget bitmap capture, image composition, and media output; its
  compact monitor reports progress and frame counts without a preview. Record
  and Dry run share worker-prepared route samples in frame order, with small
  batches allowing frame rendering to start before the full route is sampled.
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
- Optional isolated no-loop `CesiumWidget` implementation with scene descriptor
  replication for explicit off-screen render targets.
- Basic and Expert product MP4 recording keeps the main Cesium scene visible,
  temporarily suspends its default render loop, and updates the viewer's entity
  visualizers before explicitly rendering each capture. Pending terrain/3D Tiles
  waits advance the same driver on bounded browser tasks. Success, cancellation,
  and encoding failure restore the original render-loop setting. The video
  composer copies this main canvas. A real Chromium WebGL regression exports a
  six-frame, 320-by-180 MP4 with a 4,096-point ground polyline and moving marker;
  inspected first/final captures retain the expected progression. This synthetic
  ellipsoid scene does not establish hardware export throughput or replace the
  pending fixed-provider reference-journey and covered-window validations.
- Deterministic Replay MP4 export at fixed frame timestamps, with monitor
  pause/cancel controls and preview/share handoff.
- Deferred MP4 export follows the Replay preparation timeline's selected start
  and end range while keeping frame timestamps local to the output and phase
  resolution anchored to the canonical source timeline.
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
- Shared Replay camera-motion smoothing for Basic and Expert playback and
  export. Heading anticipation and a short camera-anchor smoothing window scale
  with Replay duration. The smoothing-pass offset stays within one quarter of
  the projected crop width; the trace, marker, and visibility constraints use
  the original route sample. Tight alternating turns still use the separate
  camera-only chord rule when their cross-track spread is below half the
  projected crop width. Basic has a minimum Ease of `0.3`; Expert uses its
  saved Ease. Long untimed journeys at short playback durations still need
  visual export validation.
- Dynamic tracking confirms a sustained exit with two future route projections
  and starts its correction before the marker reaches the trigger boundary.
  Navigation retains its confirmed predictive collision check with a
  3-second base transition horizon. Live tolerance and visibility corrections
  use a cubic ease-in/out camera flight of at least 3 seconds, preserving any
  longer duration from the active camera Ease. Deterministic Basic Replay
  capture interpolates hard Navigation corrections for at least 3 replay-time
  seconds. Normal frame tracking and clip timing keep their existing behavior.
- Tracking anticipation uses the selected Replay duration for both timed and
  untimed GPX routes. Navigation confirms beyond its predicted exit. Production
  export invokes camera-anchor smoothing explicitly. Navigation transitions
  interpolate orientation through the canonical Cesium command adapter instead
  of rotating to the final target on their first frame. Real-Cesium-camera
  regression tests inspect every frame of a three-second correction; real video
  validation remains pending while the automated browser cannot create WebGL.
- Navigation capture preserves its held camera pose between corrections and
  reserves the final three Replay seconds for a smooth exact endpoint. Camera
  timing follows Replay progress independently of GPX recording duration and
  absolute clip-offset timestamps. A numerical run of the supplied 9,566-point,
  178.7 km untimed route at 30 FPS measured maximum direction changes of 0.67
  degrees per sample for a 10-second Replay and 0.75 degrees for a 30-second
  Replay with flat terrain, height 3454 m, pitch -30 degrees, and angle 65 degrees.
  This camera-only measurement is not a rendered video validation.
- Crop containment remains active through Navigation transitions and held
  poses. Tracking anticipation now includes the Replay height/pitch-derived
  visible ground span and route speed. Candidate projections distinguish the
  full CSS canvas from an offset crop. Safety corrections translate without
  changing orientation, frustum or geodetic height. A camera-only numerical
  check of the 9,566-point reference route at heights 539, 3454 and 7000 m,
  pitch -30 degrees, and an offset 640-by-480 crop inside a 1000-by-800 canvas
  found no off-crop marker positions at either 10 or 30 seconds and 30 FPS.
  This is not rendered Dry run or video validation.
- Widget buttons remain interactive during ordinary Replay playback. Replay
  no longer applies the visual-recording input lock to every widget; crop
  framing and layout interaction policies remain in effect.
- Moving clip readiness separated from settled waits.
- Linked-video Replay preparation timeline with a normalized transient
  multi-track projection, controlled playhead and scrubbing, widget visibility
  tracks and event ranges, widget-row ordering, a Journey-scoped snapshot,
  pre-Replay and post-Replay clip duration edits handed back to the existing
  Journey clip configuration, a resizable track-title legend, bounded ruler
  zoom, and throttled transient scrubbing. Playback and deferred export read the
  updated clip configuration; Replay's shared overlay resolver applies widget
  event visibility on the active frame.
- Expert interactive Replay now rebuilds trace geometry during playback at the
  renderer's normal geometry cadence and forces exact geometry at start and
  pause. Dry run applies trace updates through its deterministic frame path,
  while keeping its lower-cost geometry cadence between exact boundary frames.
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
| PARTIAL / TODO | 1.0.0 | Validate Basic Replay Dry run visually on a real reference journey and confirm completion and cancellation cleanup in a WebGL browser | [Dry run issue #533](https://github.com/lgs1920/studio/issues/533) |
| PARTIAL / TODO | 1.0.0 | Validate main-scene product MP4 export on fixed imagery, terrain, and 3D Tiles journeys, including recording with the browser window fully covered; prove camera parity, return-view restoration, and visual quality | [Replay quality validation](CORE-REPLAY-QUALITY-VALIDATION.md) |
| IMPLEMENTED | 1.0.0 | Deliver linked Replay preparation as a compact controlled Timeline preview | [Timeline implementation](CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) |
| PARTIAL / TODO | 1.0.0 follow-up | Connect remaining Timeline domain commands, Action Mode, and clip double-click navigation | [Timeline implementation](CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) |
| TODO | 1.1.0 | Replace separated clip controls with the normalized editable multi-track replay timeline | [Track timeline editor](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) |
| TODO | 1.1.0 | Replace the preparation snapshot and existing clip adapter with a canonical persisted timeline domain model consumed by Replay playback and export | [Track timeline editor](../../todo/CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) |
| PARTIAL | Unplanned | Finish Basic/Expert settings ownership, effective-mode propagation, and consistent Basic defaults | [Replay user modes](#replay-user-modes) |
| PARTIAL / TODO | 1.1.0 | Complete pause-aware POI animation lifecycle and displayed fields on canonical Replay time | [POI animation](../../todo/CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md) |
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
