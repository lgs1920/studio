---
name: lgs-1920-studio-cesium-camera
description: Implement or debug LGS1920 Cesium camera behavior, including Replay tracking, heading and pitch, navigation, dynamic positioning, clip transitions, visibility, and camera state persistence.
---

# Cesium Camera

Use for camera behavior in Cesium, Journey, Replay, panoramic views, or export. Inspect existing camera controllers, Replay components, Cesium lifecycle, and camera tests first.

Workflow:

1. Define the camera mode and ownership for navigation, passive tracking, dynamic tracking, and preparation.
2. Preserve heading hysteresis, angle offsets, marker visibility, and readable route following.
3. On entry to Basic or Expert video preparation, stop and await any normal map orbit, then frame the canonical journey departure North with Replay pitch and height. This explicit entry framing must not derive Replay settings from the normal map view. Passive guide refreshes leave the preparation view in place. During preparation, consume camera-angle guide pointer and keyboard events before Cesium navigation handles them, then apply the selected Replay pose through the Replay camera controller without taking camera ownership. Scope other keyboard adjustments to Replay configuration. Explicit map mouse tilt and zoom during video preparation edit Replay pitch and height only when they differ from the gesture-start pose. Before Record, wait for pending wheel movement to settle, persist the final values on the active Journey, flush its debounced database write, and ensure playback/export load those same values. Preserve Replay angle and convert prepared absolute height to target-relative ground offset only when that altitude mode is selected. Ignore automatic camera events and unchanged gestures. Outside those input boundaries, normal Cesium navigation must never persist Replay settings.
4. Follow [normal Cesium and Replay camera ownership](../../PROJECT_RULES.md#normal-cesium-and-replay-camera-ownership): save the current normal view at actual playback/capture start, apply the configured Replay angle, pitch, and height before clips, and restore the normal world-space view, reference frame, and pivot on every terminal path. Keep return snapshots separate from Replay entry/export state and suspend normal persistence while its camera is borrowed.
   Store Replay height, pitch, and camera angle in the active Journey's Basic or Expert camera data. Persist Basic settings under `basic`: reads prefer that key and fall back to legacy `simple` only when it is absent, while every write stores `basic` and removes `simple`. Global Replay camera settings omit height and pitch and keep camera angle at the initial value `0`. A Journey without a saved pose starts from the active Cesium height and pitch, then persists them on the Journey; migrate legacy angle fields on the Journey instead of falling back to global settings.
5. Handle entity removal, scene replacement, unmount, missing journey data, and isolated Replay export target disposal safely.
6. Exercise public camera lifecycle controls with a real Cesium `Camera`, not only `setView` spies. Test mode changes, clip transitions, preparation adjustments, camera visibility, crop alignment, pivot restoration, and Replay export frame capture.

Do not mutate the Cesium camera from unrelated UI components or add competing animation loops.

Preparation gesture completion must observe the final camera pose, including
wheel and drag inertia; a fixed delay after input is insufficient. Interactive
Play and Record wait for this boundary. Cancel pending input before automatic
camera restoration and invalidate queued starts on stop, error, exit, or disposal.
Terminal cleanup reloads runtime controls from the active Journey but never
persists an old playback baseline. Verify newer edits and Journey changes during
cleanup with real Cesium camera lifecycle tests.
