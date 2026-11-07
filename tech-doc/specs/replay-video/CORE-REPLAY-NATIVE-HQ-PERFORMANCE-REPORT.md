# Native HQ Video Export Performance Report

Date: 2026-11-06

Status: implementation instrumentation is available. Real Cesium export
benchmarks and visual validation are pending because this environment cannot
start its Chromium WebGL test browser.

## Environment and evidence

- Reference source: local `1.0.0` at `35a4c731`, the latest locally available
  reference commit at feature-branch creation. The feature branch was created
  from this commit. The branch was not reset or rebased.
- CesiumJS: `1.147.0`.
- Mediabunny: `1.65.2`.
- The browser WebGL preflight could not find the project's `chrome-devtools`
  executable in the WSL environment. No real Chromium scene or export was run.
- Automated unit and integration tests exercise policy, lifecycle, qualification,
  and composition contracts. Their suite runtimes are not Cesium rendering or
  export-performance measurements.
- No real 1.0.0 export baseline was collected before implementation. The current
  machine therefore has no measured Standard-versus-Native-HQ comparison.

## Matched benchmark matrix

All cells remain **not measured** until runs use the same browser, GPU, scene,
journey, crop, overlays, frame rate, codec, and encoder quality. For the
architecture comparison, Standard and Native HQ must also use the same physical
dimensions and SSE. The 1080p and 4K rows quantify the additional cost of higher
pixel counts; the Maximum row additionally changes the SSE target.

| Scenario | Renderer | Resolution | Tiles SSE | Export time, frame timings, readiness, memory and output metrics |
| --- | --- | ---: | ---: | --- |
| Original baseline | `1.0.0` Standard | Same chosen output | 16 | Not measured |
| Updated Standard | Visible canvas | Same as baseline | 16 / existing adaptive | Not measured |
| Native HQ matched | Isolated Cesium | Same as baseline | 16 | Not measured |
| Native HQ 1080p High | Isolated Cesium | 1920 × 1080 for 16:9 | 4 | Not measured |
| Native HQ 4K High | Isolated Cesium | 3840 × 2160 for 16:9 | 4 | Not measured |
| Native HQ 4K Maximum | Isolated Cesium | 3840 × 2160 for 16:9 | 2 | Not measured |

There is no measured architectural overhead, throughput change, speedup, or
regression to report. No claim of performance parity is made.

## Instrumentation available in Studio

An MP4 export publishes a bounded `recordingPerformance` report in
`lgs.stores.replay.deferredExportPlan.runtime.recordingPerformance` and the
direct exporter result. The report includes selected mode, requested and actual
Cesium dimensions, composition dimensions, codec, nominal FPS, requested SSE,
qualified frame count, readiness timeout/failure/cancellation counts, total
export wall time, frame production throughput, encoded packet and byte counts,
and per-stage count, total, mean, approximate P50/P95, and maximum durations.
Stages include tile readiness, synchronous Cesium render calls, composition,
CanvasSource submission/backpressure, MP4 finalization, and cleanup.

The report also includes observed tileset load/unload/error events and terrain
queue events when a readiness coordinator is active. These are not exact network
request counts or cache misses. Heap peak is sampled only when the browser
exposes `performance.memory`. GPU memory and utilization are unavailable, and
the WebGL context count is a known application count rather than a complete
browser inventory. GPU execution may continue after a synchronous render call
returns, so these timings do not measure completed GPU work.

Mediabunny continues to use `CanvasSource`, sequential fixed-timestamp frame
submission, and `BufferTarget`. No real long 4K run was available to establish
whether the in-memory target needs replacement. Keep-alive stability and output
timestamp integrity also require real encoder validation.

## Reproducible browser benchmark procedure

1. Use one Chromium build, machine/GPU, driver, and browser profile for every
   run. Record browser and GPU details.
2. Use the same saved journey, terrain/imagery/3D Tiles scene, camera trajectory,
   crop, clips, widgets, export FPS, codec, and encoding quality.
3. Run the original `1.0.0` Standard baseline before comparing the feature branch.
   Use a clean build of each branch and retain the output report and MP4.
4. Run at least three cold-cache and three warm-cache exports per scenario. Use
   identical physical output dimensions and SSE for the original Standard,
   updated Standard, and Native HQ matched rows.
5. Then run Native HQ 1080p High, 4K High, and 4K Maximum. Do not combine these
   quality-cost results with the matched architecture comparison.
6. After each export, save the JSON report using browser DevTools:

   ```javascript
   copy(JSON.stringify(lgs.stores.replay.deferredExportPlan.runtime.recordingPerformance, null, 2))
   ```

7. Record actual Cesium drawing-buffer resolution, output file size, frame count,
   video duration, and whether each strict frame qualified. Inspect the first,
   phase-boundary, turning-point, and final frames and confirm the interactive
   camera is unchanged after Native HQ.
8. Compare medians and ranges across repeats. Report browser metrics that are
   unavailable as unavailable; do not infer GPU memory or network cache misses.
   Verify no progressive heap/context growth across repeated exports and verify
   cancellation releases the isolated host.

The browser skill's WebGL preflight must pass before visual inspection or
performance claims. Current browser limitation: the WSL `chrome-devtools`
executable is missing from PATH. This report should be updated with measured
results after that environment is repaired.
