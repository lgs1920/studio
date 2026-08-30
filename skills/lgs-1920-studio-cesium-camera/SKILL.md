---
name: lgs-1920-studio-cesium-camera
description: Implement or debug LGS1920 Cesium camera behavior, including Replay tracking, heading and pitch, navigation, dynamic positioning, clip transitions, visibility, and camera state persistence.
---

# Cesium Camera

Use for camera behavior in Cesium, Journey, Replay, panoramic views, or export. Inspect existing camera controllers, Replay components, Cesium lifecycle, and camera tests first.

Workflow:

1. Define the camera mode and ownership for navigation, passive tracking, dynamic tracking, and preparation.
2. Preserve heading hysteresis, angle offsets, marker visibility, and readable route following.
3. During Replay camera preparation, keep keyboard adjustments scoped to the preparation surface, mark user-adjusted camera state, and refresh the controlled camera without competing movement loops.
4. Keep camera position, angle, clip state, render target, and export state synchronized across preview and recording. Restore the main-scene pivot after preparation when the transition is still current.
5. Handle entity removal, scene replacement, unmount, missing journey data, and isolated HQ target disposal safely.
6. Test mode changes, clip transitions, preparation adjustments, camera visibility, crop alignment, pivot restoration, and HQ frame capture.

Do not mutate the Cesium camera from unrelated UI components or add competing animation loops.
