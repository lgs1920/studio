---
name: lgs-1920-studio-scene-composition
description: Compose and render LGS1920 scenes for the map, Replay, snapshots, and video export. Use for widget layers, Logo and Credits, backgrounds, visibility, z-index, crop zones, scene replacement, and capture-safe rendering.
---

# Scene Composition

Use this skill when several visual systems must produce one consistent scene. Inspect scene renderers, widget manager, map canvas, cropper, replay overlay resolution, and capture composition code before editing.

Workflow:

1. Identify the target board and output: live scene, snapshot, Replay preview, linked preparation timeline, Draft recording, or HQ video.
2. Define ownership for map, terrain, journey, POIs, background, widgets, overlays, controls, and the active replay render target.
3. Preserve mandatory Logo and Credits, their intended anchoring, scaling, attribution, and always-on-top behavior.
4. Keep UI-only controls out of captured output and keep captured widgets aligned to the active crop zone. Timeline previews may use read-only visual copies of map and widget content.
5. Distinguish persisted user visibility from transient replay/capture masking. A linked video may hide the Journey toolbar for composition without changing its saved visibility setting.
6. Make scene replacement clear old widget instances, configuration, selection, and dynamic subscriptions. Do not let an old board or render target retain overlays.
7. Verify visibility resolution, z-index and stacking order, grid and snapping scope, theme contrast, resize behavior, cancellation, and final cleanup.

Do not solve composition issues by adding arbitrary z-index values, global visibility mutations, or widget-local replay timers. Add focused rendering and lifecycle tests.
