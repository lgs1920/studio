# POI Performance Diagnostics

## Purpose

Studio provides an opt-in, session-local collector for investigating POI map and
Replay rendering cost. It records aggregates only; it does not alter rendering,
Replay timing, stored POI state, or video pixels.

## Enable and read a profile

Open Studio with the query parameter `?poiPerf=1`. Once the application loads,
read the current aggregates in the browser console:

```js
window.__lgsPoiPerformance.snapshot()
```

Call `window.__lgsPoiPerformance.reset()` before a separate interaction sequence.
Read the shared bitmap-cache budget with `window.__lgsPoiPerformance.canvasCache()`.
Reload without `poiPerf=1` to disable collection. The collector does not write to
local storage, IndexedDB, or the server.

## Collected aggregates

- Rich POI content renders and mounted `MapPOIContent` surfaces (map, menu, or
  transient preview).
- Capture requests, queue wait, starts, stale discards and commits.
- Capture request source and stale-discard phase, including a stale check after
  SnapDOM and before the subsequent `toCanvas()` work.
- Pending capture supersessions, cancellations, identical-request deduplication,
  cache queue bypasses, and cache invalidations by icon load or resize.
- Same-signature capture requests are coalesced while work is active. Each
  mounted POI content surface retains at most its latest rendered canvas and
  reuses it for an unchanged visual signature. The entry is replaced after
  appearance, icon, or measured layout changes and released on unmount.
- Identical visual signatures across POIs can reuse a shared least-recently-used
  canvas entry. The shared cache is capped at 128 entries and 64 MiB estimated
  RGBA storage; oversized individual canvases bypass it. Concurrent captures
  with the same signature share one SnapDOM/toCanvas operation.
- A completed cache hit updates Cesium immediately and cancels that POI's
  obsolete pending raster request instead of waiting for the capture queue.
- SnapDOM and `toCanvas()` durations, canvas pixel count and estimated RGBA bytes.
- Cesium POI draw duration, entity creates/updates and billboard image replacements.
- Position-only changes update the existing Cesium entity without a new SnapDOM
  capture when the displayed POI content does not include the changed values.
- Replay POI visibility and candidate counts, nearby POI synchronization duration
  and candidate counts, nearby entries and POI-list entries scanned, crop checks,
  unique-candidate cache hits, and stop-clip mask ticks.
- Replay entity-container lookups and scans, effective visibility writes, and
  repeated writes skipped when entity and billboard visibility already match.
- Replay entity lookup reuses POI entity references for the lifetime of a Replay
  session. Entity additions/removals and data-source ownership changes invalidate
  affected entries; ordinary entity property changes do not invalidate identity
  references. The cache is bounded to 2,048 POI IDs and is disposed with the
  Replay session or when its viewer/scene collections change.
- Map POI projection tick count and duration. Projection now runs only for the
  POI whose hover title or DOM preview is active, since these coordinates are
  consumed by those transient overlays.

Duration metrics expose count, total, average, maximum, and approximate p50/p95
from the most recent bounded sample ring. The number of metric names and samples
per metric is capped; capture payloads, POI details, timestamps, and per-frame
records are not retained. Diagnostic aggregation is disabled by default.

## Interpretation and limits

The counters identify work frequency and synchronous wall-clock spans. Canvas
dimensions are pixel counts; the byte estimate assumes four bytes per pixel and
does not represent actual GPU or browser memory. A Cesium draw duration measures
JavaScript-side configuration and submission, not GPU completion. React render
counts are component invocations, not committed DOM updates. These aggregates do
not provide FPS, long-task data, heap usage, GPU timings, or MP4 export duration;
use browser performance tooling and the existing Replay recording report for
those measurements.

The collector does not itself establish a performance baseline. Compare matched
fixtures and machine/browser settings, and record the loaded and visible POI
counts, Replay settings, display scale, export resolution, codec, and FPS.
