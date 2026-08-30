---
name: lgs-1920-studio-replay-video-export
description: Build, debug, or extend LGS1920 Replay playback and video export. Use for camera tracking, crop handling, Cesium frame capture, static and dynamic widget composition, recording state, HQ export, progress, cancellation, or finalization.
---

# Replay Video Export

Use this skill when a change crosses Replay playback and recording. Inspect `src/components/JourneyReplay/`, `src/core/ui/replay/`, `src/core/events/appShortcuts.js`, and video tools before editing. For linked video preparation, also inspect `ReplayPreparationTimeline.js`, `ReplayOverlayResolver.js`, `ReplayScrubScheduler.js`, and the replay timeline preview.

Workflow:

1. Map the state machine: video preparation, pre-recording, recording, snapshot, finalizing, cancellation, and completion. Keep standard video entry separate from linked Replay entry.
2. Treat the read-only preparation timeline as the canonical projection for start, replay, stop, and widget actions. Keep Draft recording and HQ export derived from the same timeline and frame contract.
3. Keep Replay camera state, user preparation adjustments, and video crop dimensions synchronized before capture. Restore the main-scene pivot after preparation without overwriting a newer camera change.
4. Preserve camera angle and position modes across clips and HQ export. Resolve camera, scene, canvas, data-source, and visibility writes through the active replay render target.
5. Separate Cesium frame capture from overlay or widget composition. Keep Logo, Credits, and dynamic widgets aligned with the crop zone, and resolve replay-driven visibility through the shared overlay resolver.
6. Make progress, cancellation, stale-start invalidation, and cleanup idempotent. Restore camera, UI visibility, transient linked-toolbar state, and render-target ownership on every exit path.
7. Test low-FPS and HQ paths, timeline edits and scrubbing, clip transitions, crop ratios, camera preparation, cancellation, and stale startup state.

Do not add a second recording clock or timeline, persist transient capture visibility into user settings, hide cleanup failures, or run `bun run dev`. Add focused tests and run the relevant Vitest suite, lint, and build when appropriate.
