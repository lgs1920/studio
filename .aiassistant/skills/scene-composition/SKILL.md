---
name: scene-composition
description: Compose and render LGS1920 scenes for the map, Replay, snapshots, and video export. Use for widget layers, Logo and Credits, backgrounds, visibility, z-index, crop zones, scene replacement, and capture-safe rendering.
---

# Scene Composition

Use this skill when several visual systems must produce one consistent scene. Inspect scene renderers, widget manager, map canvas, cropper, and capture composition code before editing.

Workflow:

1. Identify the target board and output: live scene, snapshot, Replay preview, or HQ video.
2. Define ownership for map, terrain, journey, POIs, background, widgets, overlays, and controls.
3. Preserve mandatory Logo and Credits, their intended anchoring, scaling, attribution, and always-on-top behavior.
4. Keep UI-only controls out of captured output and keep captured widgets aligned to the active crop zone.
5. Make scene replacement clear old widget instances, configuration, selection, and dynamic subscriptions.
6. Verify visibility, z-index, grid and snapping scope, theme contrast, resize behavior, cancellation, and final cleanup.

Do not solve composition issues by adding arbitrary z-index values or global visibility mutations. Add focused rendering and lifecycle tests.
