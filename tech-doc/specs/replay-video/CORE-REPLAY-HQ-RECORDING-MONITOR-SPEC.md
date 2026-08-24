# Replay HQ Recording Camera and Monitoring

Status: **PARTIAL / TODO**

The isolated HQ render host and independent camera ownership are implemented.
The live recording monitor remains TODO.

Date: 2026-08-05

Target release: 1.0.0

Tracking issue: #459. Depends on the canonical camera work from #457 and the
isolated HQ render host from #458.

## 1. Purpose

Separate the interactive map camera from the camera used to render a linked
Journey Replay HQ export, while giving the user a live view of the frames being
encoded and the export progress.

This document complements the replay start-camera specification. It does not
change the camera editor, start-anchor, or start-clip contract defined by #457.

## 2. Scope and activation rules

The dedicated recording camera is used only when both conditions are true:

1. the replay is linked to the video recording flow;
2. the selected recording mode is Replay HQ.

| Context | Camera owner | Monitoring source |
| --- | --- | --- |
| Video without a linked replay | Normal interactive camera | Existing video preview |
| Replay not linked to video | Normal interactive camera | Replay/map view |
| Linked Draft recording | Normal visible camera | Live composed canvas |
| Linked Replay HQ export | Dedicated recording camera | Latest HQ output frame |

The HQ recording mode is selected before export starts and remains fixed until
the export completes, is cancelled, or fails.

## 3. Camera and rendering architecture

The interactive preview and the HQ export have independent ownership:

```text
Replay settings + clips -> recordingCamera -> HQ render output -> Mediabunny
User map interaction    -> previewCamera   -> interactive map
HQ render output        -> monitoring widget
```

The recording camera must consume the canonical replay pose, the replay start
anchor, the ordered start-clip plan, and the effective start roll resolved by
#457. User navigation must not mutate that camera or the HQ replay timeline.

Cesium renders one camera per scene. Therefore, allowing the user to navigate
the visible map while HQ renders another camera requires a dedicated Cesium
render pipeline. The implementation may use a second viewer or a lighter
offscreen scene, but the choice belongs to the HQ camera issue. The monitoring
widget itself does not require another viewer.

## 4. Monitoring widget

The monitoring widget is a transient UI widget, not a video-board composition
widget. It must remain outside the captured widget board so that it cannot
capture itself in Draft or HQ output.

The widget displays:

- the latest rendered output frame;
- the active mode (`Draft` or `Replay HQ`);
- the current phase (`preparing`, `rendering`, `encoding`, `finalizing`,
  `completed`, `cancelled`, or `failed`);
- processed frame count and total frame count when available;
- percentage and elapsed time;
- encoded size when available;
- pause, cancel, and close actions according to the existing export lifecycle.

The widget does not read an unfinished MP4 file. It displays the same final
canvas that is passed to the encoder:

- Draft uses the live `CanvasOverlayComposer` output;
- HQ uses the canvas produced for the current deterministic export frame,
  before the frame is submitted to Mediabunny.

This keeps the monitoring image visually aligned with the encoded content and
avoids a second decode pipeline.

## 5. Mediabunny boundary

The current live recorder and HQ exporter use a memory-backed output and expose
the finalized Blob after the output is finalized. The monitoring widget must
therefore consume frame and progress events, not the incomplete MP4.

Fragmented MP4 playback with Media Source Extensions is explicitly out of scope
for this feature because the existing preview dialog already handles playback
after the video is finalized and downloaded or shared.

## 6. State contract

The recording pipeline should publish a small monitor state without exposing
encoder internals to the widget:

```js
{
  active: true,
  mode: 'hq',
  phase: 'rendering',
  frameIndex: 120,
  frameCount: 1800,
  progress: 0.0667,
  elapsedMillis: 4200,
  encodedBytes: 1843200,
  canvas: HTMLCanvasElement,
  error: null
}
```

The canvas reference is runtime-only and must not be persisted. The widget must
clear the reference and transient progress after completion, cancellation, or
failure.

## 7. Issue relationships

- #457 defines the canonical replay camera pose and start-clip endpoint.
- The HQ recording-camera issue depends on #457 and owns the offscreen render
  pipeline and camera ownership.
- The monitoring-widget issue depends on #457 and the HQ recording-camera issue
  for the HQ frame publication contract. Draft monitoring may be implemented
  independently once the shared monitor state exists.

The issues remain separately scoped and should be linked through explicit
dependency and related-issue references rather than merged into one broad
implementation issue.

## 8. Acceptance criteria

- The dedicated recording camera is inactive for unlinked replay and ordinary
  video recording.
- Linked Draft recording continues to use the normal visible camera.
- Linked Replay HQ export uses the dedicated recording camera.
- User navigation does not alter the HQ recording camera or replay timeline.
- The monitoring widget displays the latest frame being encoded.
- The monitoring widget displays reliable phase and progress information.
- The monitoring widget is absent from captured video output.
- The existing final preview dialog remains the playback surface for the
  finalized video.
- Cancellation, completion, and failure clean up the monitor state.
