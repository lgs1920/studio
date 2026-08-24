# Video Widget Technical Specification

Status: **TODO**

Target release: `1.1.0`

Generic video-board composition support exists, but the repeatable synchronized
`VideoWidget` component is not implemented.

## Purpose

The Video widget is a repeatable, editable visual widget that displays a video overlay during Journey Replay. It is intended for sponsor content, route introductions, picture-in-picture footage, educational material, and other media that must remain synchronized with the replay timeline.

The widget remains host-managed: selection, dragging, scaling, rotation, bounds, z-index, persistence, and capture lifecycle are handled by the existing widget manager.

## Widget contract

- Catalog ID: `video-widget`
- Component: `VideoWidget`
- Type: `lgs-visual-widget`
- Availability: video board only, when a journey is available
- Repeatability: one instance per scene
- Static content: video source, layout, visual style, and timing configuration
- Dynamic content: current video frame during replay and video export
- Mandatory, fixed-position, and always-on-top: `false`
- Editable and scalable: `true`
- Removable and lockable: standard widget host behavior

The widget is mounted by `VideoSceneWidgetsPortal` on `VIDEO_WIDGETS_BOARD`. It must remain mounted while the video editor, pre-recording phase, recording phase, or HQ replay export is active.

The component renders a stable HTML video subtree. It must not create a second positioning, scaling, rotation, or persistence system.

## Catalog entry

Proposed catalog entry:

```yaml
video-widget:
  id: "video-widget"
  name: "Video"
  description: "Video overlay during replay"
  icon: "video"
  mandatory: false
  max: 1
  component: "VideoWidget"
  type: "lgs-visual-widget"
  path: "@Components/Video"
  groups:
    - "journey-widgets"
  availability:
    boards:
      - "video"
    requires:
      - "hasJourney"
  configuration:
    default:
      source:
        type: "url"
        value: null
        assetId: null
      playback:
        startAt: 0
        endAt: null
        hideOnEnd: true
        autoplay: true
        muted: true
      display:
        objectFit: "contain"
        opacity: 1
        background: "#000000"
        borderRadius: 0
        controls: false
        playsInline: true
      scaled: true
    user:
    elements:
```

The configuration is resolved in this order:

1. `configuration.elements[instanceId]`
2. `configuration.user`
3. `configuration.default`

Instance edits must write to the element layer and must never mutate shared defaults.

## Source model

The source model supports two storage modes:

- `url`: an externally reachable or application-managed URL
- `asset`: a persisted media asset identified by `assetId`

Temporary `blob:` URLs may be used during import and preview, but they must not be persisted as the final source because they are invalid after a page reload.

The production implementation should persist uploaded video data in the application media store or IndexedDB and persist only its stable `assetId` in widget configuration.

The widget must validate the source before playback and expose a stable fallback state when the source is missing, unsupported, or unavailable. Source loading errors must not unmount the widget host or alter its persisted geometry.

## Playback timing

The video starts when the replay starts. It is not stretched or continuously remapped to replay progress.

The configured interval is a source interval inside the video file:

- `startAt` is the media start time in seconds
- `endAt` is the optional media end time in seconds
- when `endAt` is omitted, the natural media duration is used

Playback therefore follows this lifecycle:

1. At replay start, seek to `startAt` and start the video.
2. While replay is playing, let the video advance normally.
3. Pause and resume the video with the replay.
4. Stop playback when the replay ends or when the configured media interval ends.
5. Hide the widget as soon as the video interval ends when `hideOnEnd` is `true`.

The effective video end is the earliest of:

```text
replay end
video endAt, when configured
natural video duration
```

The same behavior applies when replay clips extend the total replay timeline. The video starts at the beginning of the complete replay session and ends at the end of that session, unless its configured media interval ends first.

The video must not loop by default. A future loop option may be added as a separate product decision.

When the video ends before the replay, the widget is hidden for all remaining replay frames. It must not display the last decoded frame, an empty video frame, or browser playback controls.

## Replay synchronization

The widget synchronizes with the existing replay controller events:

- `REPLAY_EVENT_START`: load the initial video position and start playback when allowed
- `REPLAY_EVENT_UPDATE`: update replay state and detect the configured media end
- `REPLAY_EVENT_PAUSE`: pause the HTML video element
- `REPLAY_EVENT_RESUME`: resume playback when the source is ready
- `REPLAY_EVENT_STOP`: pause and reset to the configured start position
- `REPLAY_EVENT_END`: render the terminal frame and stop playback

The replay controller remains the single source of truth for lifecycle state. The widget must not create an independent timer or animation loop to represent replay time.

For normal interactive playback, the widget may use `HTMLVideoElement.play()` after synchronizing the initial position. It must use the media element's `ended` event and configured `endAt` to stop playback. It must not derive `currentTime` from replay progress on every update.

All `play()` calls must handle rejected promises, including browser autoplay restrictions. The widget is muted by default and uses `playsInline` to maximize autoplay compatibility.

## Rendering contract

The visual subtree must remain stable:

```html
<div class="video-widget-content">
  <video class="video-widget-media"></video>
</div>
```

The component must use explicit layout and rendering properties:

- `object-fit` from `display.objectFit`
- `opacity` from `display.opacity`
- `background-color` from `display.background`
- `border-radius` from `display.borderRadius`
- `controls="false"` during scene rendering and export
- `playsinline`
- `muted` according to configuration

The video element must not show browser controls in snapshots, replay output, or HQ export. Any editor-only controls must use `lgs-widget-no-drag` and must be rendered outside the captured visual subtree.

The widget must remain compatible with the existing `Widget2Canvas` lifecycle. A live video frame must not be represented by a static placeholder canvas when the widget is being recorded.

## Video board and capture behavior

The widget is available only on the video board. It must work in both situations:

- interactive video composition preview
- replay-driven video recording and HQ deferred export

During recording, the widget must remain mounted after the editor closes. It must not be hidden by preview-only conditions once `preRecording`, `recording`, or `finalizing` is active.

The widget is included in the existing overlay ordering and uses the host-managed position, scale, rotation, and z-index. It must not implement custom crop-bound calculations.

The widget must not obscure mandatory composition widgets such as Logo or Credits unless the existing z-index rules explicitly allow it.

## HQ export integration

The current replay compositor accepts canvas-compatible overlay sources and draws them with `CanvasRenderingContext2D.drawImage`. The Video widget requires the compositor to accept an `HTMLVideoElement` as a dynamic source.

The export path must:

1. resolve the video widget configuration
2. calculate the video time from the elapsed replay timeline for the current frame
3. seek the video element when its time differs from the target time
4. wait for the requested frame to become available
5. draw the video frame into the composition canvas
6. apply the widget position, scale, rotation, opacity, clipping, border radius, and z-index

The compositor must use `video.videoWidth` and `video.videoHeight` when calculating the intrinsic aspect ratio. It must not depend on the HTML `width` and `height` attributes being set.

The export path must not depend on real-time browser playback. Every exported frame must be reproducible from the elapsed replay timeline and the widget configuration.

For an exported replay frame with elapsed timeline time `t` in seconds, the target media time is:

```text
videoTime = startAt + t
```

The value is clamped to the configured `endAt` or the natural media duration. The elapsed timeline includes the complete replay session, including replay clips when clips are part of the active export timeline. It is not calculated from normalized replay progress and does not stretch the video to fit the replay duration.

The video element should use `requestVideoFrameCallback` when available. A `seeked` and `loadeddata` fallback is required for browsers that do not support it.

If a video frame cannot be decoded before the export frame deadline, the exporter must retain the previous decoded frame rather than drawing an empty or partially initialized frame.

Export cancellation, replay stop, scene replacement, and widget removal must pause the video, remove listeners, cancel pending frame waits, and release temporary object URLs when they are no longer referenced.

## Editor UI

The editor is loaded by the widget registry as `VideoWidgetEditor`, with `VideoWidgetPreview` for the preview tab. It uses the existing non-modal widget drawer and the current video board background when available.

### Source

- Video file picker
- Source status and error state
- Replace source action
- Remove source action

### Playback

- Video start: numeric input in seconds
- Video end: numeric input in seconds, disabled when the natural duration is used
- Hide video when it ends: enabled by default and not disabled for replay export
- Autoplay switch
- Muted switch

### Display

- Object fit: Contain, Cover, Fill
- Opacity slider from `0` to `1`
- Background color using the existing Web Awesome color editor convention
- Border radius numeric input
- Scale style switch controlling `scaled`

All controls use Web Awesome and existing editor styles. Interactive preview controls are marked `lgs-widget-no-drag`.

Reset restores the instance to catalog defaults without deleting it. Resetting an instance must not delete its persisted media asset unless the user explicitly removes the source.

## Accessibility

- The widget has the accessible name `Video`.
- A missing source exposes an accessible status message.
- The file picker has a visible label and accepts supported video MIME types.
- The editor preview does not expose duplicate playback controls when `controls` is disabled.
- The video must provide captions or an explicit decorative-media interpretation when the product content requires spoken information.
- Keyboard focus inside editor controls must not start widget dragging.

## Compatibility and validation

Missing or invalid values fall back to catalog defaults for compatibility with older scenes. Numeric values must be finite and clamped to safe ranges:

- `opacity`: `0` to `1`
- `startAt`: greater than or equal to `0`
- `endAt`: greater than `startAt` when present
- `borderRadius`: greater than or equal to `0`

The widget must handle:

- source loading before replay starts
- source loading while replay is already active
- replay seeking in both directions
- paused replay
- replay completion
- unsupported media formats
- missing source assets
- scene replacement
- widget removal during recording
- browser autoplay rejection

## Acceptance criteria

- A `video-widget` catalog entry is available on the video board when a journey exists.
- The widget can be added, selected, moved, scaled, rotated, locked, reordered, reset, removed, and persisted using standard widget host behavior.
- A valid video source is visible in the video composition preview.
- Replay start, pause, resume, seek, stop, and end keep the video synchronized.
- The video does not advance while replay is paused.
- A video shorter than the replay is visible only until its configured or natural end, then hidden for the remaining replay frames.
- The widget remains mounted during recording and deferred HQ export.
- The exported video contains the correct video frame at each replay frame.
- Video positioning, crop bounds, opacity, rotation, border radius, and z-index match the preview.
- Browser video controls and editor handles are absent from snapshots and exports.
- Scene replacement unmounts the old widget without stale listeners, frames, object URLs, or configuration.
- Mandatory Logo and Credits widgets remain unaffected.
- Focused tests cover source loading, replay synchronization, seek behavior, pause/resume, video-board mounting, HQ frame composition, cancellation cleanup, and scene replacement.

## Product decisions

The following decisions are confirmed:

1. The source may be an uploaded file or an external URL.
2. One Video widget is allowed per scene.
3. The video starts when the replay starts and is not synchronized to replay progress.
4. The video stops when the replay ends or when the configured video interval ends, whichever happens first.
5. Audio is supported and the user can mute the video. The default remains muted for autoplay compatibility.
6. MP4 must be supported. AVI and ProRes support may be provided when the MediaBunny decoder and browser capabilities support them; the implementation must rely on decoder capability rather than a restrictive extension-only list.
7. Cloud-backed video sources are planned for a later phase. The source model must therefore keep `assetId`, URL, and provider metadata extensible.

The UI must expose explicit `Video start` and `Video end` controls for trimming the selected source interval.
