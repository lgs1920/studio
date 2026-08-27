---
name: lgs-1920-studio-replay-video-export
description: Build, debug, or extend LGS1920 Replay playback and video export. Use for camera tracking, crop handling, Cesium frame capture, static and dynamic widget composition, recording state, HQ export, progress, cancellation, or finalization.
---

# Replay Video Export

Use this skill when a change crosses Replay playback and recording. Inspect `src/components/JourneyReplay/`, `src/core/ui/`, `src/core/events/appShortcuts.js`, and video tools before editing.

Workflow:

1. Map the state machine: pre-recording, recording, snapshot, finalizing, cancellation, and completion.
2. Keep Replay camera state and video crop dimensions synchronized before capture.
3. Preserve camera angle and position modes across clips and HQ export.
4. Separate Cesium frame capture from overlay or widget composition. Keep Logo, Credits, and dynamic widgets aligned with the crop zone.
5. Make progress and cleanup idempotent. Restore camera and UI visibility on every exit path.
6. Test low-FPS and HQ paths, clip transitions, crop ratios, cancellation, and stale startup state.

Do not add a second recording state machine, hide cleanup failures, or run `bun run dev`. Add focused tests and run the relevant Vitest suite, lint, and build when appropriate.
