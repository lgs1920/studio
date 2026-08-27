---
name: lgs-1920-studio-cesium-camera
description: Implement or debug LGS1920 Cesium camera behavior, including Replay tracking, heading and pitch, navigation, dynamic positioning, clip transitions, visibility, and camera state persistence.
---

# Cesium Camera

Use for camera behavior in Cesium, Journey, Replay, panoramic views, or export. Inspect existing camera controllers, Replay components, Cesium lifecycle, and camera tests first.

Workflow:

1. Define the camera mode and ownership for navigation, passive tracking, and dynamic tracking.
2. Preserve heading hysteresis, angle offsets, marker visibility, and readable route following.
3. Keep camera position, angle, clip state, and export state synchronized across preview and recording.
4. Handle entity removal, scene replacement, unmount, and missing journey data safely.
5. Test mode changes, clip transitions, camera visibility, crop alignment, and HQ frame capture.

Do not mutate the Cesium camera from unrelated UI components or add competing animation loops.
