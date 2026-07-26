# Track Editor Specification

## Goal

Define the editor capabilities needed to author camera paths and track-based
motion presets, including 3D Bezier paths.

The editor does not own the runtime camera engine. It only creates and edits
path definitions that are consumed by the canonical path evaluator.

## Scope

The editor must support:

- path selection and path creation in memory
- path presets such as focus, orbit, panorama, and fly-to policies
- 3D Bezier path authoring
- journey-derived replay path editing
- preview of the same canonical path used by Draft and HQ
- camera-related parameters that are safe to expose in the UI

## 3D Bezier Support

3D Bezier paths must be editable in local 3D space, not only in 2D track
projection.

The editor should expose:

- anchors
- incoming and outgoing handles
- local ENU editing coordinates
- altitude-aware control of the curve
- live preview of the resulting path

The editor should not require the user to manually reason in Cesium world
coordinates while shaping a curve.

## Replay Integration

The replay camera should be able to reuse the same canonical path model that
the editor previews.

That means:

- the journey remains the source of truth
- replay materializes a canonical path from journey state
- Draft and HQ consume the same path evaluation
- replay-specific tuning should be expressed as path policy, not as ad hoc
  camera logic

## Open Questions

- Which path presets must be exposed in the first UI version?
- Should 3D Bezier handles be editable directly in the map, in a side panel,
  or in both places?
- Which replay-derived fields are editable versus read-only?
