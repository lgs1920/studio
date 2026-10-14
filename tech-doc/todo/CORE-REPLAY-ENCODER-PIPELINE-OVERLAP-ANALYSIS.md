# Replay Encoder and Frame-Rendering Pipeline Overlap Analysis

Status: proposed performance experiment; implementation pending a fresh baseline

Date: 2026-10-14

## Objective

Determine whether Replay video export can reduce wall-clock time by rendering
the next composed frame while the current frame is waiting for encoder or output
back-pressure. The proposal is limited to the frame hand-off between
`ReplayDeferredExporter` and Mediabunny. It does not move Cesium to a Worker,
change the selected codec, lower output quality, change output timestamps, or
drop frames.

The experiment is justified only if a fresh Edge recording still shows a large
`CanvasSource.add` duration after the already-applied removal of the redundant
per-frame canvas transform and intermediate encoder-canvas copy.

## Current pipeline

The current exporter produces one complete frame and awaits its submission
before the session renders the next one in
[`ReplayDeferredExporter.js`](../../src/core/ui/replay/ReplayDeferredExporter.js):

```text
Render Replay frame N
  -> commit frame state to widgets
  -> wait for widget capture
  -> compose map and overlays
  -> await CanvasSource.add(frame N)
  -> publish frame progress
  -> render Replay frame N+1
```

`CanvasSource.add()` synchronously creates a `VideoSample` from its canvas, then
the Mediabunny encoder path may wait for encoder queue capacity and output-writer
back-pressure. This makes it possible in principle to preserve the composed
frame in an immutable `VideoFrame`, let encoding continue asynchronously, and
render another Replay frame while that wait is in progress.

The `CanvasSource.add()` timing is not a measurement of codec CPU time alone. It
includes sample creation, encoder submission, and waits for the WebCodecs queue
or output writer. Encoding can continue in the background while the caller is
waiting. See the performance notes in
[`CORE-REPLAY-QUALITY-VALIDATION.md`](../specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md).

## Measured baseline and gain ceiling

The supplied Edge report measured 1,021 frames:

| Measurement | Time | Share of frame loop |
| --- | ---: | ---: |
| Whole frame loop | 182.167 s | 100% |
| `CanvasSource.add` and back-pressure wait | 133.863 s | 73.5% |
| Remaining frame-loop work, by subtraction | 48.304 s | 26.5% |

The subtraction is `182.1669 - 133.8629 = 48.3040` seconds. It is a ceiling for
this particular run, not a forecast: even perfect overlap could not hide more
than the work that was outside `CanvasSource.add` in that sample. Some of that
work depends on the preceding frame or runs on the same main thread, and shared
CPU/GPU contention can make either stage slower when they overlap.

The report predates the removal of a redundant Mediabunny transform and the
intermediate encoder canvas. Those changes may have reduced the current
`CanvasSource.add` time. Therefore the 48.3-second ceiling and all percentages
above must be recalculated from a new report before deciding to implement this
proposal.

The same report showed approximately 5.5 seconds in widget state publication and
widget capture combined, 0.9 seconds in canvas composition, and 0.25 seconds in
MP4 finalization. Those are useful local optimization targets, but none is as
large as the measured encoder-submission wait. Widget state publication and
capture must remain synchronized with the frame whose pixels are captured.

## Proposed bounded architecture

Use a producer and a single ordered encoder consumer. The producer owns Replay
frame progression, Cesium readiness, widget publication, and composition. After
composition, it creates an immutable frame snapshot and enqueues it. The encoder
consumer submits snapshots to Mediabunny in timestamp order and awaits each
submission before taking the next one.

```text
Producer: render N -> compose N -> snapshot N --+
                                                +--> bounded FIFO --> ordered encoder consumer
Producer: render N+1 -> compose N+1 -> snapshot N+1 -+                 await submission N
                                                                      await submission N+1
```

Start with at most two application-owned frame snapshots outstanding: one being
submitted and one waiting in the FIFO. When the queue is full, the producer
waits before rendering another frame. This overlaps work without allowing an
unbounded backlog.

The implementation should use Mediabunny's `VideoSampleSource` with explicitly
created `VideoSample`/`VideoFrame` values, or an equivalent public API that
supports immutable frame snapshots. The encoder consumer must remain the only
place that calls the media source. Do not call `CanvasSource.add()` concurrently
from multiple frame callbacks: the media source maintains timestamp, key-frame,
encoder, and muxer state, and concurrent calls would make ordering and
back-pressure behavior harder to reason about.

The snapshot is taken only after Cesium has been flushed and widget overlays
have been composed. It must contain the same pixels, dimensions, timestamp, and
duration as the current canvas submission. The reusable composition canvas may
then advance to the next frame without changing a snapshot already in the FIFO.

## Expected performance

If `R` is the average time to render and compose a frame and `E` is the average
time spent awaiting its encoder submission, a serial pipeline takes roughly
`R + E` per frame. A perfectly overlapped two-stage pipeline approaches
`max(R, E)` per frame. Its ideal gain is bounded by the smaller total stage, but
real runs also include setup, progress, scene readiness, and finalization.

For the supplied report, the idealized lower bound for the frame loop is about
133.9 seconds, giving a theoretical maximum saving of about 48.3 seconds, or
26.5%. That assumes every other frame-loop operation can overlap without
contention, which is unlikely to hold exactly. A real result may be much
smaller, unchanged, or slower. No export-duration improvement should be claimed
until repeated Edge runs demonstrate it.

## Risks and controls

| Risk | Why it matters | Control |
| --- | --- | --- |
| Frame order or timestamps change | MP4 output can show duplicated, missing, or reordered frames, or misaligned duration | Use one FIFO and one encoder consumer; preserve exact timestamp and duration values; assert submitted-frame count and monotonic timestamps |
| The reused canvas changes before capture | A later render could overwrite pixels that an earlier frame still needs | Create the immutable snapshot synchronously after composition and before allowing the producer to reuse the canvas |
| Memory grows with pending frames | Raw RGBA storage is about 7.91 MiB at 1920×1080 and 31.64 MiB at 3840×2160 per frame, before browser, GPU, and encoder copies | Bound both outstanding frame count and queued pixel bytes; block the producer at the limit; measure peak memory on Edge |
| GPU/CPU contention increases render time | Cesium rendering and WebCodecs may share GPU resources; more overlap does not guarantee more throughput | Begin with one queued snapshot beyond the active submission; compare render/readiness time and total duration, not only encoder wait |
| Cancellation leaks frames or delays stop | Queued `VideoFrame` resources must be released, and an active writer may still be waiting | Close queued snapshots on cancellation; close each consumed sample in `finally`; await or cancel the active consumer; retain symmetric output cleanup |
| Keep-alive frame races with timeline frames | A timer-generated timestamp could be inserted after a later timeline frame or violate monotonic order | Route keep-alive submissions through the same ordered consumer; suppress or defer them while timeline frames are queued |
| Pause semantics become surprising | A small number of already-rendered frames may remain queued after pause is requested | Stop producing at the existing pause boundary, document the bounded in-flight allowance, and do not advance visible progress as if queued frames were encoded |
| Partial failures are swallowed | A producer may continue rendering after the consumer has failed | Store the first consumer error, stop producer admission, propagate the error through export cleanup, and close every remaining snapshot |

At two outstanding snapshots, the raw RGBA-equivalent storage is approximately
15.8 MiB at 1080p or 63.3 MiB at 4K. Actual browser allocations vary and may
include extra GPU or encoder surfaces, so these figures are planning estimates,
not memory guarantees. The queue should have a pixel-byte budget as well as a
frame-count limit; a low-resolution run must not justify an unsafe 4K queue.

## Benchmark plan

### Fresh baseline

After the current copy/transform optimization is built, record the same Edge
scenario at least three times. Keep the journey, frame count, FPS, output
dimensions, crop, visible widgets, quality, and browser conditions unchanged.
Close DevTools during the export because an attached debugger can change timing.
Record the median wall time, frame-loop time, `CanvasSource.add` time, frame
count, output size, and any available peak-memory observation.

### Prototype comparison

Implement the queue behind a temporary, explicit development setting or branch
so the baseline path remains available. Compare queue capacities of one and two
outstanding snapshots. Do not increase the bound unless the two-snapshot result
shows stable memory and a clear throughput improvement.

Measure these stages separately:

- frame rendering and scene-readiness wait;
- widget state commit, capture, and overlay composition;
- immutable snapshot creation;
- time queued before encoder submission;
- active `VideoSampleSource.add()` duration and its back-pressure wait;
- total frame-loop and wall-clock duration;
- peak memory, cancellation latency, frame count, and output duration.

Use at least three runs per configuration and compare medians. Keep the same
recording settings and inspect the output video visually at the first frame,
route transitions, tight turns, and final frame. Repeat once with a covered
browser window if that is part of the supported capture workflow.

## Acceptance criteria

The prototype is acceptable only when all of the following hold:

- The output frame count, frame timestamps, FPS, dimensions, and duration match
  the serial baseline.
- No frames are dropped, duplicated, reordered, or captured before composition
  completes.
- Queue size and estimated queued pixel bytes never exceed their configured
  bounds.
- Cancellation, pause/resume, keep-alive, encoder failure, and finalization
  release all frame resources and settle the export promise.
- Edge shows no new allocation failure, encoder error, or Cesium readiness
  regression in repeated runs.
- The median total export time improves by at least 10% on the representative
  scenario. This is a proposed complexity gate; a smaller gain should be
  weighed against the additional lifecycle and memory complexity.
- Visual validation passes for the first, transition, moving, and final frames.

## Recommendation

First collect a fresh baseline with the current canvas-copy and transform
optimizations. If encoder submission remains dominant, implement a prototype
with one active submission plus at most one queued immutable snapshot. Preserve
the serial path as a fallback until the benchmark and visual criteria pass. Do
not switch to real-time latency mode or drop frames to improve the benchmark.

This is a proposed experiment, not a description of current behavior. Any
Mediabunny API change must be rechecked against the installed version before
implementation.
