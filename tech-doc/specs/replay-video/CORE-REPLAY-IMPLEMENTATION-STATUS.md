# Replay Implementation Status

Status: current implementation inventory

Date: 2026-08-24

## Purpose

This document separates delivered replay capabilities from partial and planned
work. It must be updated when replay architecture changes. Detailed rationale
and issue analysis remain in [`REPLAY-AUDIT.md`](REPLAY-AUDIT.md).

## Implemented on `refactor/replay-architecture`

- Versioned replay definition, render plan, frame intent, and frame result
  contracts.
- Shared frame resolution and publication boundaries for Draft, HQ, and scrub.
- Canonical renderer-independent camera definitions and commands.
- Deterministic Cesium camera command application.
- Real-time progress slider with coalesced latest-request-wins scrubbing.
- Asynchronous cancellable settled-frame qualification.
- Explicit replay session ownership and guarded cleanup.
- Canonical camera-command continuity across transitions and clips.
- Explicit owner-scoped viewer, scene, and canvas render targets.
- Isolated no-loop HQ `CesiumWidget` with scene descriptor replication and
  announced visible-scene fallback.
- Logical crop viewport and physical output scaling for HQ capture and widgets.
- Frame-accurate HQ trace updates and deterministic Navigation camera updates.
- Moving clip readiness separated from settled waits.

These items describe the current branch, not a released version. They remain
subject to the validation gates below.

## Partial implementation

- The canonical frame contract coexists with mutable session controllers and
  legacy store projections.
- Camera qualification still uses parts of the reactive runtime correction
  stack instead of a fully compiled qualified trajectory.
- The trace still uses Cesium entities and dynamic geometry rather than one
  benchmark-selected immutable capture representation.
- Scene descriptor replication covers the active supported environment but is
  not yet a generic clone of every possible Cesium primitive or provider.
- Automated tests cover contracts and routing, but fixed visual reference
  journeys and video artifact comparison are not complete.
- `JourneyReplayRunner` remains in the application for legacy consumers.

## TODO roadmap

| Status | Target | Work item | Detailed specification |
| --- | --- | --- | --- |
| PARTIAL / TODO | 1.0.0 | Complete synchronized replay-start camera editing while preserving the implemented canonical camera and clip continuity | [Start camera editor](CORE-REPLAY-START-CAMERA-EDITOR-SPEC.md) |
| PARTIAL / TODO | 1.0.0 | Add the read-only HQ recording monitor on top of the implemented isolated render host | [HQ recording monitor](CORE-REPLAY-HQ-RECORDING-MONITOR-SPEC.md) |
| TODO | 1.0.0 | Validate isolated HQ on fixed imagery, terrain, and 3D Tiles journeys; prove camera parity, resource teardown, crop-aware readiness, and visual quality | [Replay quality validation](CORE-REPLAY-QUALITY-VALIDATION.md) |
| TODO | 1.1.0 | Replace separated clip controls with the normalized multi-track replay timeline | [Track timeline editor](CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md) |
| TODO | 1.1.0 | Drive POI animation and displayed fields from canonical replay time | [POI animation](CORE-POI-ANIMATION-DURING-REPLAY-SPEC.md) |
| TODO | 1.1.0 | Align clip altitude inputs and continuity across reordered sequences | [Clip altitude alignment](CORE-CLIP-ALTITUDE-DATA-ALIGNMENT-SPEC.md) |
| TODO | 1.1.0 | Add explicit Automatic, 720p, 1080p, and 4K HQ output profiles with capability checks | [HQ resolution profiles](HQ_4K_VIDEO_EXPORT_SPEC.md) |
| TODO | 1.1.0 | Implement the replay-synchronized repeatable Video Widget | [Video Widget](VIDEO_WIDGET_SPEC.md) |
| TODO | 1.1.0 | Implement the Three.js drone path editor over the serializable runtime evaluator | [Drone camera editor](CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md) |
| TODO | Unplanned | Validate and schedule the Three.js HPR orientation sphere widget | [HPR sphere widget](CORE-CAMERA-HPR-THREEJS-SPHERE-WIDGET-SPEC.md) |

Additional 1.1.0 architecture work remains to complete capture-time camera
qualification, migrate every dynamic consumer to canonical frame time, and
retire `JourneyReplayRunner` after all compatibility consumers have moved.

## Completion gates

Replay work is not complete merely because unit tests pass. The applicable
checks in [Replay Quality Validation](CORE-REPLAY-QUALITY-VALIDATION.md) must pass,
including a real Draft or HQ visual run for changes that affect pixels, timing,
camera, scene readiness, overlays, or encoding.
