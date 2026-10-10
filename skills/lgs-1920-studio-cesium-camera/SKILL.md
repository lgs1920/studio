---
name: lgs-1920-studio-cesium-camera
description: Implement or debug LGS1920 Cesium camera behavior, including Replay tracking, heading and pitch, navigation, dynamic positioning, clip transitions, visibility, and camera state persistence.
---

# Cesium Camera

Use for camera behavior in Cesium, Journey, Replay, panoramic views, or export. Inspect existing camera controllers, Replay components, Cesium lifecycle, and camera tests first.

Workflow:

1. Define the camera mode and ownership for navigation, passive tracking, dynamic tracking, and preparation.
2. Preserve heading hysteresis, angle offsets, marker visibility, and readable route following.
3. On entry to Simple or Expert video preparation, stop and await any normal map orbit, then frame the canonical journey departure North with Replay pitch and height. This explicit entry framing must not derive Replay settings from the normal map view. Subsequent guide refreshes leave the preparation view in place. During Replay preparation, scope keyboard adjustments to Replay configuration and refresh its guide without moving, locking, capturing, or changing the pivot of the normal map camera. Explicit map mouse tilt and zoom during video preparation edit Replay pitch and height before Record. Flush pending wheel changes before preparation is captured. Ignore automatic camera events and unchanged gestures, preserve Replay angle, and convert prepared absolute height to target-relative ground offset only when that altitude mode is selected. Outside that input boundary, normal Cesium navigation must never persist Replay settings.
4. Follow [normal Cesium and Replay camera ownership](../../PROJECT_RULES.md#normal-cesium-and-replay-camera-ownership): save the current normal view at actual playback/capture start, apply the configured Replay angle, pitch, and height before clips, and restore the normal world-space view, reference frame, and pivot on every terminal path. Keep return snapshots separate from Replay entry/export state and suspend normal persistence while its camera is borrowed.
   Store Replay height, pitch, and camera angle in the active Journey's Simple or Expert camera data. Global Replay camera settings omit height and pitch and keep camera angle at the initial value `0`. A Journey without a saved pose starts from the active Cesium height and pitch, then persists them on the Journey; migrate legacy angle fields on the Journey instead of falling back to global settings.
5. Handle entity removal, scene replacement, unmount, missing journey data, and isolated Replay export target disposal safely.
6. Exercise public camera lifecycle controls with a real Cesium `Camera`, not only `setView` spies. Test mode changes, clip transitions, preparation adjustments, camera visibility, crop alignment, pivot restoration, and Replay export frame capture.

Do not mutate the Cesium camera from unrelated UI components or add competing animation loops.
