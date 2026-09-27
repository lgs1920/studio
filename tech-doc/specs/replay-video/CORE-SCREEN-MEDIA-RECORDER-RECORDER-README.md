# Replay Media Capture

Status: current implementation inventory

Date: 2026-09-27

## Scope

Studio creates video files through Journey Replay only. The video export path
renders the Replay timeline at fixed timestamps and encodes the resulting
frames through `ReplayDeferredExporter`. There is no standalone or real-time
screen-video recorder.

`ReplayMediaCapture` remains as a small shared media handoff service for still
screenshots and for exposing a completed Replay MP4 to the preview dialog. It
is available as `__.mediaCapture` and does not capture or encode video.

## Replay video export

`VideoRecordingScreenArea` prepares the crop and capture UI, then builds a
Replay render specification. `ReplayDeferredExporter` resolves and renders
every planned Replay frame, encodes those frames into an MP4, and publishes the
finished blob through `REPLAY_DEFERRED_EXPORT_READY_EVENT`. The final dialog
owns preview, download, share, and Replay cleanup.

Replay export FPS, quality levels, and presets live in
`src/core/ui/replay/ReplayVideoSettings.js`; they are independent of the
screenshot handoff service.

## Screenshot capture

`VideoRecordingScreenArea` uses `CanvasOverlayComposer` to compose the selected
crop with Replay widgets, then passes the finished canvas to
`ReplayMediaCapture.captureScreenshot()`. The capture service encodes a PNG,
stores its dimensions and metadata, and emits the `video/captured` event. The
shared dialog then provides the same preview, download, and share actions used
for Replay videos.

`CanvasOverlayComposer` is a composition utility. It does not encode video or
schedule frames.

## Related implementation

- `src/core/ui/replay/ReplayMediaCapture.js`
- `src/core/ui/replay/ReplayVideoSettings.js`
- `src/core/ui/replay/ReplayDeferredExporter.js`
- `src/core/ui/replay/ReplayVideoRenderSpec.js`
- `src/core/ui/screen-media-recorder/composer/CanvasOverlayComposer.js`
- `src/components/MainUI/video/VideoRecordingScreenArea.jsx`
- `src/components/MainUI/video/VideoDownloadAndShareDialog.jsx`
