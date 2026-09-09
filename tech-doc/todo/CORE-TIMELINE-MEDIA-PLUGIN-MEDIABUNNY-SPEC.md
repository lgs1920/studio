# Generic Timeline Media Plugin and Linked Audio/Video Specification

Status: **TODO**

Target release: **TBD**

Date: 2026-09-09

## Scope

This specification defines the generic media capabilities required by the
`LGS1920Timeline` Web Component to display and edit video and audio clips.
It also defines a Mediabunny adapter that provides media metadata, video
thumbnails, audio waveforms, and optional media processing services.

The specification is independent from Replay. Replay, video recording,
application stores, persistence, and final export may consume this interface
later through explicit adapters.

The timeline remains a generic editor. It must not import Mediabunny, decode
media files, create a competing playback clock, or persist media assets.

## Existing capabilities

The current timeline already provides the following foundations:

| Capability | Current state |
| --- | --- |
| Multiple tracks | `tracks` accepts an arbitrary array of track definitions. |
| Track creation | The generic `Add track` action emits `add-track`. |
| Track filtering | `accepts` can restrict a track to clip kinds such as `video` or `audio`. |
| Clip movement | Clips can be moved horizontally and between compatible tracks. |
| Clip resizing | Start and end handles edit the timeline range. |
| Collision handling | `allow`, `prevent`, and `ripple` policies are available. |
| Visual clipping | The clip container already uses `overflow: hidden`. |
| Custom visual content | `clip-content` slots can replace the default icon and label. |
| Controlled integration | Track and clip changes are emitted with public snapshots. |
| Keyboard editing | Delete, duplicate, copy placement, visibility, enabled state, and resize shortcuts exist. |

The current clip content slot is nested in the default preview content. It is
suitable for custom labels and compact cards, but a full-height thumbnail or
waveform needs a dedicated background content layer.

## Required additions

The media layer must add these capabilities without making them specific to a
particular host application:

- linked video and audio clip groups;
- atomic movement, resizing, deletion, duplication, and splitting of linked groups;
- dynamic creation and reuse of compatible media tracks;
- media source in and out points in addition to timeline start and end points;
- external thumbnail-strip rendering;
- external waveform rendering;
- media loading, preview, and decoding cancellation;
- explicit lifecycle events for media previews and grouped edits;
- optional media operations such as trimming, transcoding, and export;
- validation preventing orphaned linked clips and invalid source ranges.

## Generic data model

The timeline receives flat tracks and clips for rendering, while the media
model keeps the relationship between the video and audio components explicit.

```js
{
    id: 'media-group-42',
    source: {
        assetId: 'asset-42',
        sourceType: 'video',
        name: 'mountain.mp4',
        durationSeconds: 18.4,
        hasVideo: true,
        hasAudio: true,
    },
    timelineStartSeconds: 12,
    timelineEndSeconds: 24,
    sourceStartSeconds: 0,
    sourceEndSeconds: 12,
    videoTrackId: 'video-track-1',
    audioTrackId: 'audio-track-1',
    videoClipId: 'media-group-42-video',
    audioClipId: 'media-group-42-audio',
}
```

The public timeline projection contains one clip per rendered track:

```js
{
    id: 'media-group-42-video',
    kind: 'video',
    mediaGroupId: 'media-group-42',
    role: 'video',
    assetId: 'asset-42',
    start: 12,
    end: 24,
    sourceStart: 0,
    sourceEnd: 12,
    preview: {
        type: 'thumbnail-strip',
        frames: [
            {time: 0, url: '/media/asset-42/thumb-0.webp'},
            {time: 6, url: '/media/asset-42/thumb-6.webp'},
            {time: 12, url: '/media/asset-42/thumb-12.webp'},
        ],
    },
}
```

```js
{
    id: 'media-group-42-audio',
    kind: 'audio',
    mediaGroupId: 'media-group-42',
    role: 'audio',
    assetId: 'asset-42',
    start: 12,
    end: 24,
    sourceStart: 0,
    sourceEnd: 12,
    preview: {
        type: 'waveform',
        peaks: [0.12, 0.58, 0.31, 0.91, 0.44],
        channels: 1,
    },
}
```

`start` and `end` describe the position on the timeline. `sourceStart` and
`sourceEnd` describe the selected interval inside the source media. A trim
operation must update both linked components together.

## Track management

Media tracks are regular timeline tracks with additional constraints:

```js
{
    id: 'video-track-1',
    kind: 'video',
    label: 'Video 1',
    accepts: ['video'],
    mediaTrackRole: 'video',
    linkedTrackId: 'audio-track-1',
}
```

```js
{
    id: 'audio-track-1',
    kind: 'audio',
    label: 'Audio 1',
    accepts: ['audio'],
    mediaTrackRole: 'audio',
    linkedTrackId: 'video-track-1',
}
```

The media model owns track allocation:

1. Reuse a compatible track when the new group does not collide with its clips.
2. Create a new video/audio pair when a simultaneous video requires another
   lane.
3. Create only an audio track for an audio-only source.
4. Create only a video track when a video source has no audio stream.
5. Keep linked tracks adjacent when tracks are reordered.
6. Do not remove one member of a linked pair while the other still exists.

The generic Web Component may expose track creation and reordering events, but
the media controller must validate pair adjacency and orphan prevention before
committing the controlled `tracks` value.

## Linked group editing

The component must eventually support a grouped edit transaction rather than
two independent clip edits. The transaction contains the complete proposed
layout and either commits all members or commits none of them.

Required grouped operations:

- move both clips by the same timeline delta;
- resize both clips while preserving the shared timeline range;
- trim both source ranges by the same source delta;
- duplicate the complete group with new stable identifiers;
- remove the complete group;
- split both clips at the same timeline position;
- cancel and restore the complete original group;
- reject the operation when either destination track collides or refuses the clip.

Visibility and audio state remain independent. Hiding a video component must
not mute its audio component. Muting audio must not hide the video component.
The default delete, move, resize, duplicate, and split behavior remains group
oriented.

## Preview rendering boundary

The timeline must not decode media itself. It renders a generic preview
description or accepts externally supplied content through slots.

The preferred rendering contract is:

- `clip-background` for full-bleed visual content such as thumbnails;
- `clip-content` for foreground labels, badges, and custom controls;
- `clip-waveform` as an optional targeted slot when a host prefers a separate
  audio visual layer;
- existing icon and label slots remain compatible.

The background layer is positioned inside the clip rectangle and remains below
the resize handles and foreground content. The clip rectangle keeps
`overflow: hidden`, so a thumbnail strip or waveform is clipped automatically
when the clip becomes narrower.

The host may provide a targeted slot such as:

```html
<canvas slot="clip-background-media-group-42-video"
        data-media-preview="video"></canvas>
```

For large or dynamic timelines, the host may instead use one global slot and
update the rendered node from the clip identifier. The timeline must expose
the clip identifier, media group identifier, visible time range, and pixel
width to the host without exposing internal DOM state.

## Media plugin contract

The media plugin is an adapter selected by the host. The timeline depends only
on this generic contract:

```js
{
    id: 'mediabunny',
    canHandle(source),
    inspect(source, options),
    createVideoPreview(asset, options),
    createAudioPreview(asset, options),
    createFrameSource(asset, options),
    process(operation, asset, options),
    release(assetId),
    dispose(),
}
```

The methods return application-neutral values:

- `inspect()` returns duration, dimensions, rotation, video presence, audio
  presence, sample rate, channel count, and supported source metadata;
- `createVideoPreview()` returns a thumbnail list, sprite, or preview stream;
- `createAudioPreview()` returns normalized waveform peaks and channel data;
- `createFrameSource()` returns a cancellable frame provider for an editor or
  export host;
- `process()` handles optional trim, transcode, extract, or mux operations;
- `release()` releases per-asset caches, object URLs, decoders, and workers;
- `dispose()` releases all plugin resources.

Every asynchronous method accepts an `AbortSignal`. A new request for the same
asset may cancel an older request. Removing a clip or unmounting the timeline
must release its preview resources.

## Mediabunny adapter

The first adapter can use the existing `mediabunny` dependency. Its internal
responsibilities are:

1. Create an `Input` from a `BlobSource`, URL source, or application source.
2. Read duration and primary video/audio track metadata.
3. Use a video sample sink or equivalent decoded frame path to extract selected
   thumbnail timestamps.
4. Use an audio sample or audio buffer sink to calculate decimated waveform
   peaks.
5. Cache previews by `assetId`, source revision, preview kind, and requested
   resolution.
6. Release inputs, sinks, object URLs, and worker resources on cancellation.
7. Report unsupported codecs and decoding failures as stable plugin errors.

The adapter may also expose optional operations based on Mediabunny's
conversion and output APIs, including source trimming, format conversion, and
audio/video muxing. Those operations must not be required by the generic
timeline editor.

The plugin must not pass Mediabunny `Input`, track, sink, or sample objects into
the timeline data model. Only serializable metadata and preview references may
cross the boundary.

## Events and external control

Existing per-clip lifecycle events remain available for standalone clips. Media
groups require additional atomic events:

| Event | Purpose |
| --- | --- |
| `before-media-group-change` | Cancel a proposed grouped edit. |
| `media-group-change` | Report a committed grouped edit. |
| `after-media-group-change` | Notify after the timeline has rendered the new projection. |
| `before-media-group-split` | Cancel a split before any member is changed. |
| `media-group-split` | Report the two resulting groups. |
| `media-preview-request` | Request an external preview for a clip. |
| `media-preview-ready` | Report a preview reference or slot update. |
| `media-preview-error` | Report an external preview failure. |
| `media-source-change` | Report a changed source or source range. |
| `media-link-change` | Report link or unlink operations. |

Grouped edit details must include:

```js
{
    groupId,
    clipIds,
    operation: 'move',
    tracks,
    previousTracks,
    sourceEvent,
    accepted: true,
}
```

The host may cancel a `before-*` event with `preventDefault()`. It must receive
the complete proposed layout so it can validate or persist the operation
without reading private timeline state.

## Useful video and audio operations

The generic model should support these operations, even when a host chooses to
expose only a subset of them:

- split at the playhead;
- timeline trim through `start` and `end`;
- source trim through `sourceStart` and `sourceEnd`;
- ripple delete;
- duplicate and copy placement;
- link and unlink audio/video components;
- mute, solo, gain, and audio fades;
- video fade in and fade out;
- lock and hide tracks;
- markers and clip labels;
- snapping to clip boundaries and markers;
- proxy or low-resolution preview selection.

The Web Component should provide generic commands and events. Media-specific
processing belongs to the plugin or the host controller.

## Isolation and failure handling

The media plugin must preserve the timeline boundary:

- it must not mutate the host store directly;
- it must not create a second playback clock;
- it must not attach global listeners without an explicit teardown;
- it must not persist blob URLs as stable asset identifiers;
- it must not keep decoded frames, audio buffers, or workers after release;
- a preview failure must leave the clip geometry and edit state intact;
- a failed grouped operation must leave every group member unchanged;
- a missing audio stream must not create an orphan or fake audio clip.

## Implementation phases

### Phase 1: Generic media model

- Add media groups and linked track metadata.
- Add source in and out points.
- Add atomic group validation and edit transactions.
- Add grouped lifecycle events.
- Keep the existing timeline renderer usable without media previews.

### Phase 2: Generic preview layer

- Add a full-bleed `clip-background` rendering layer.
- Keep `clip-content` and label slots backward compatible.
- Add preview references and cancellation lifecycle.
- Add waveform and thumbnail preview contracts without a media dependency.

### Phase 3: Mediabunny plugin

- Implement source inspection.
- Implement thumbnail extraction.
- Implement waveform extraction.
- Add cache and cancellation handling.
- Add plugin tests with mocked media inputs and a small real-file validation set.

### Phase 4: Optional media operations

- Implement source trimming and splitting.
- Add preview proxy generation when required.
- Add muxing and export helpers only for hosts that request them.

## Acceptance criteria

- A video source with an audio stream creates one linked video/audio group.
- The model creates or reuses compatible tracks without overlapping clips on one
  track.
- Moving, resizing, splitting, duplicating, and deleting a group is atomic.
- A source trim preserves synchronization between video and audio.
- Video thumbnails and audio waveforms can be supplied without importing
  Mediabunny into the timeline Web Component.
- Preview requests can be cancelled and released after clip removal.
- External listeners can cancel or consume every grouped edit through public
  events.
- A failed preview or media operation does not corrupt timeline geometry.
- The component remains usable with image, widget, text, and custom clips.
- Tests cover linked groups, track allocation, clipping, cancellation, preview
  failures, and event isolation.

## Current implementation references

- [`LGS1920Timeline.js`](../../src/webcomponents/lgs1920-timeline/LGS1920Timeline.js)
- [`LGS1920TimelineRendering.js`](../../src/webcomponents/lgs1920-timeline/LGS1920TimelineRendering.js)
- [`LGS1920TimelineEditing.js`](../../src/webcomponents/lgs1920-timeline/LGS1920TimelineEditing.js)
- [`README.md`](../../src/webcomponents/lgs1920-timeline/README.md)
- [`CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md`](CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md)
