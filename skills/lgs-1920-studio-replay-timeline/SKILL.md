---
name: lgs-1920-studio-replay-timeline
description: Implement, diagnose, review, or document the LGS1920 Replay preparation timeline, its controlled time projection, widget tracks, scrubbing, clip-editor navigation, and timeline widget host.
---

# Replay Timeline

Use this skill for the linked-video Replay preparation timeline. Read the
current implementation inventory in
[`CORE-REPLAY-TIMELINE-IMPLEMENTATION.md`](../../tech-doc/specs/replay-video/CORE-REPLAY-TIMELINE-IMPLEMENTATION.md)
before changing behavior. Read
[`CORE-REPLAY-TIMELINE-PREVIEW-SPEC.md`](../../tech-doc/todo/CORE-REPLAY-TIMELINE-PREVIEW-SPEC.md)
only when comparing the delivered preview with the proposed product scope or
the future editable timeline.

## Authorities and boundaries

- `src/core/ui/replay/ReplayPreparationTimeline.js` owns the normalized,
  read-only preparation projection.
- `src/core/ui/replay/ReplayVideoTimeline.js` and
  `src/core/ui/replay/ReplayFrameTimeline.js` remain the phase and frame-time
  authorities. Do not rebuild phase boundaries from UI values.
- `src/components/MainUI/video/ReplayTimelinePreview.jsx` is a controlled
  visual and interaction adapter for `@xzdarcy/react-timeline-editor`. Never
  start the package runner or create a competing Replay clock.
- Replay store state and the published canonical frame own playback, pause,
  progress, and current time. Scrubbing must continue through
  `ReplayScrubScheduler` with latest-request-wins behavior.
- The Replay track is mandatory, fixed, and visually placed at the bottom of
  the canonical projection. Widget rows may be reordered through the widget
  manager z-index order. Keep the canonical bottom-to-top order separate from
  the package's top-to-bottom editor order.
- Replay-driven widget visibility must resolve through
  `ReplayOverlayResolver`. User visibility and transient capture masking are
  separate concerns.
- The timeline is transient preparation UI and is excluded from captured
  output with `data-capture-exclude`. Do not persist timeline editor state as a
  second domain model.

## Main workflow

1. Trace entry and exit through `MainUI.jsx`, `ToolsUI.jsx`,
   `videoEditingCleanup.js`, and `VideoDownloadAndShareDialog.jsx`.
2. Inspect the projection inputs: current journey clips, Replay settings,
   deferred export timeline, capture FPS, Replay direction, and video widget
   stack.
3. Update the canonical projection before changing package-facing rendering.
   Preserve milliseconds in the domain projection and convert to seconds only
   at the package boundary.
4. Preserve the distinction between the Replay row, dynamic visibility rows,
   static video widget rows, fixed Logo/Credits rows, and the transient timeline
   widget itself.
5. When an action opens an editor, use the stable clip anchor and
   `PanelManager.toggleNavigation`. Do not open a drawer by guessing its
   currently selected tab.
6. Add or update focused unit and UI tests for phase boundaries, visibility,
   row order, scrubbing, editor navigation, widget dimensions, and cleanup.

## Key files

- Projection: `src/core/ui/replay/ReplayPreparationTimeline.js`
- UI adapter and controls: `src/components/MainUI/video/ReplayTimelinePreview.jsx`
- UI constants and package adapter helpers:
  `src/components/MainUI/video/replayTimelineUtils.js`
- Widget host: `src/components/MainUI/widgets/list/ReplayTimelineWidget.jsx`
- Widget catalog: `public/widgets.yaml`
- Linked preparation mount: `src/components/MainUI/ToolsUI.jsx`
- Timeline state flag: `src/core/stores/ui.js`
- Clip source/editor: `src/components/JourneyReplay/JourneyReplayClipsTab.jsx`
- Drawer target navigation: `src/core/ui/panels/PanelManager.js`
- Timeline styles: `src/components/MainUI/video/replay-timeline-preview.css`

Do not treat the future `journey.replay.timeline` authoring model, item
trimming, overlap validation, or full timeline persistence as delivered by the
current preparation preview. Those remain future work unless the source and
status documentation are updated together.
