# Replay HQ Parallel Workspace Execution Analysis

Status: proposed architecture and issue drafts

Date: 2026-08-24

## Scope

The goal is to keep the standard Studio workspace usable while an HQ replay
export is running. The interactive Studio camera, scene editing, and export
camera must have separate ownership. The export must remain deterministic and
must not read mutable UI state while frames are being produced.

This document compares two implementation options:

1. Move HQ scheduling and encoding coordination to a dedicated Worker while
   keeping the isolated Cesium HQ renderer on the main thread.
2. Move the complete HQ renderer, scheduling, composition, and encoding path to
   a dedicated Worker using `OffscreenCanvas`.

There is deliberately no `Visible map camera` mode in either option. The HQ
render target remains the dedicated export camera. The question is where that
dedicated target runs, not which Studio camera is authoritative.

## Evidence from the current code

The following statements are based on the current workspace, not on the
historical replay audit alone.

- `prepareVideoCaptureUi()` hides the interactive MainUI and sets
  `replay.mainUiHidden = true` in
  `src/components/MainUI/video/videoEditingCleanup.js`.
- `ReplayDeferredExporter` creates an `IsolatedHqReplayRenderHost` by default.
  The host owns a hidden, no-loop `CesiumWidget` with its own scene, camera,
  canvas, imagery, terrain, and supported 3D Tiles resources.
- The current isolated host is still created on the main thread. It is not a
  Worker and it does not use `OffscreenCanvas`.
- The exporter sets the replay session render target to the isolated host and
  resolves camera, trace, readiness, and capture work through that target.
- Video widgets are currently mounted through
  `VideoSceneWidgetsPortal.jsx` into a DOM board. The exporter composes widget
  overlays from the video board, so a Worker cannot directly read those DOM
  nodes.
- The crop board is also part of the current widget/capture infrastructure. It
  must not be removed as a side effect of hiding the editor UI.
- The current HQ path already uses fixed replay frame timestamps. Moving work
  to a Worker must preserve that frame contract; it must not introduce a new
  Worker clock.

The current architecture therefore has a useful render-target boundary, but
not yet a process boundary. The first option can reuse that boundary. The
second option must extend it into a serializable Worker protocol.

## Option 1 — Worker for HQ orchestration and encoding

### Functional architecture

The main thread keeps the dedicated HQ Cesium host and performs deterministic
frame rendering. A dedicated Worker owns the expensive non-DOM orchestration:

```text
Main thread
  standard Studio workspace and interactive camera
  dedicated HQ Cesium host and export camera
  render target, tile readiness, frame readback
          <---- serializable frame protocol ---->
Dedicated Worker
  fixed frame timeline
  export state machine
  progress and cancellation
  frame submission and encoding coordination
```

The Worker receives an immutable export snapshot containing the render spec,
timeline manifest, camera/replay definition, crop rectangle, and frozen widget
composition inputs. The main thread renders one requested frame and returns a
transferable frame payload or an encoder-ready `VideoFrame`. The Worker sends
the encoded output and progress events back to the UI.

### What this solves

- Timeline iteration, export state transitions, progress bookkeeping, and
  encoder coordination no longer occupy the main JavaScript event loop.
- The standard workspace can remain visible because the export camera already
  belongs to the isolated render target.
- Interactive camera changes cannot change the HQ camera as long as the export
  snapshot and target remain immutable.
- The existing Cesium render-target and readiness ownership can be reused
  without making Cesium Worker-compatible in the first delivery.

### What this does not solve

- Cesium rendering and tile readiness remain on the main thread. A large HQ
  render or a slow tile scene can still create long main-thread tasks.
- GPU work remains shared with the interactive viewer. A Worker does not create
  a second GPU queue or guarantee faster export.
- DOM widgets remain main-thread resources. They must be frozen, rasterized, or
  represented by serializable frame inputs before the Worker starts.
- If the main-thread renderer waits synchronously for tile readiness or canvas
  readback, workspace responsiveness can still degrade.

### Expected performance profile

| Area | Expected result |
| --- | --- |
| Workspace JavaScript responsiveness | Better for timeline/encoding work; still affected by Cesium render and readback tasks |
| HQ wall-clock export time | Possibly better if orchestration was the bottleneck; unchanged if Cesium/tile readiness dominates |
| GPU load | Approximately the current isolated-host load, shared with the interactive viewer |
| Memory | Small protocol buffers plus the current isolated Cesium resources |
| Tile/network pressure | Approximately current behavior; no automatic reduction |
| Implementation risk | Moderate; the render-target boundary already exists |

The result must be measured. It is not safe to promise a faster export from a
Worker alone.

### Implementation shape

1. Define a versioned `ReplayHqWorkerRequest` and `ReplayHqWorkerEvent`
   protocol. Requests must contain serializable data only.
2. Freeze the export snapshot before the first frame: timeline, render spec,
   crop rectangle, camera definition, scene descriptor identity, and widget
   overlay inputs.
3. Add a main-thread render bridge that accepts a frame intent, renders on the
   dedicated target, and returns a transferable payload without touching the
   interactive camera.
4. Move frame iteration, cancellation, progress, and encoder coordination into
   the Worker. Use transferables and `VideoFrame` where supported; avoid
   serializing pixel buffers more than once.
5. Add bounded back-pressure so the Worker cannot queue unbounded render
   requests or memory.
6. Keep cleanup symmetrical for success, cancellation, readiness failure, and
   encoding failure.
7. Add real Draft/HQ visual validation and responsiveness measurements.

### Main risks

- A protocol that sends mutable store objects would reintroduce race
  conditions and make the result depend on current UI state.
- A queue without back-pressure can use more memory than the current path.
- If the main thread waits for the Worker while rendering, the UI will still
  block and the option will have failed functionally.
- Widget snapshots taken after export starts can make the video disagree with
  the visible workspace. The snapshot boundary must be explicit.

## Option 2 — Full HQ renderer and encoder in a Worker

### Functional architecture

The dedicated Worker owns the complete HQ pipeline. The main thread owns the
standard Studio workspace only.

```text
Main thread
  standard Studio workspace and interactive camera
  export request, monitor, cancellation, final download
          <---- serializable frame/progress protocol ---->
Dedicated Worker
  dedicated Cesium runtime and OffscreenCanvas
  replay frame timeline and camera
  tile readiness and rendering
  widget/composition inputs
  frame readback and encoding
```

The Worker must create a Worker-compatible Cesium runtime around an
`OffscreenCanvas`. It must receive a serializable scene descriptor rather than
DOM elements or live application objects. DOM-based widgets cannot be mounted
inside the Worker; they must be rasterized or converted to a serializable
render representation before export.

### What this solves

- Cesium HQ rendering, tile readiness, frame composition, and encoding are no
  longer scheduled on the main JavaScript event loop.
- The standard workspace can remain responsive while the Worker renders and
  encodes the dedicated HQ output.
- Export camera ownership is physically separated from the interactive Cesium
  viewer runtime.
- The Worker can apply strict back-pressure between rendering and encoding
  without involving React or the main UI.

### What this does not solve automatically

- Moving the renderer to a Worker does not make tile loading faster. The same
  providers, network, GPU, and scene complexity still determine quality and
  export duration.
- Worker rendering may increase GPU memory and context pressure because the
  interactive viewer and export renderer remain active at the same time.
- `OffscreenCanvas` does not provide DOM. Existing video widgets, Web Awesome
  components, fonts, and DOM layout must be represented separately.
- Cesium support, provider access, browser support, context loss, and worker
  teardown all need dedicated validation.

### Expected performance profile

| Area | Expected result |
| --- | --- |
| Workspace JavaScript responsiveness | Strongest isolation; UI is not blocked by Worker-side render/readiness tasks |
| HQ wall-clock export time | Could improve if main-thread contention was the bottleneck; may be unchanged or worse if GPU/tile work dominates |
| GPU load | A second active render context competes for the same GPU; peak load can increase |
| Memory | Higher: Worker runtime, Cesium resources, scene resources, frame buffers, and encoded data may coexist |
| Tile/network pressure | Can increase while the interactive viewer remains active; duplicate resources need a policy |
| Implementation risk | High; requires a new Worker-compatible render and composition boundary |

The principal benefit is responsiveness isolation, not a guaranteed increase in
frames per second or shorter export time.

### Implementation shape

1. Prove capability detection for Worker, `OffscreenCanvas`, WebGL/WebGL2,
   required Cesium features, `VideoFrame`, and the selected encoder path.
2. Define a versioned Worker protocol and a fully serializable scene
   descriptor. No live Cesium objects, DOM nodes, React props, Valtio proxies,
   or application singletons may cross the boundary.
3. Create a Worker-side dedicated render host with its own Cesium scene,
   camera, imagery, terrain, 3D Tiles, readiness coordinator, and lifecycle.
4. Define a capture-time widget contract. Each widget must either provide a
   serializable renderer or produce a frozen raster snapshot before export.
5. Move fixed frame resolution, rendering, readiness, composition, and encoding
   into the Worker while preserving the existing canonical frame contract.
6. Add explicit memory/back-pressure limits and context-loss recovery or a
   user-visible unsupported state.
7. Validate generated pixels, camera parity, tile quality, cancellation, and
   cleanup on supported browsers.

### Main risks

- A partial Worker migration can create two replay clocks or two camera
  authorities. The Worker must consume the existing frame contract.
- A DOM widget snapshot can be stale, incorrectly scaled, or missing fonts and
  icons. This must be treated as a capture contract, not an incidental canvas
  copy.
- Duplicate Cesium resources can exceed browser or GPU limits on long or dense
  scenes.
- Unsupported browser capabilities must be detected before the export starts;
  a silent fallback would make performance and output ownership ambiguous.

## Comparison and recommendation

| Decision point | Option 1: orchestration Worker | Option 2: full render Worker |
| --- | --- | --- |
| Main-thread UI responsiveness | Improved but not guaranteed during Cesium work | Best isolation |
| Reuse of current render-target implementation | High | Partial; protocol and Worker host required |
| Widget migration effort | Snapshot/freeze contract required | Full snapshot or Worker-renderer contract required |
| GPU and memory risk | Close to current behavior | Significantly higher |
| Export speed certainty | Moderate and measurable | Uncertain until GPU/tile benchmarked |
| Browser/runtime risk | Moderate | High |
| Recommended first step | Yes | After capability proof |

The recommended sequence is Option 1 first. It creates the Worker protocol,
immutable export snapshot, back-pressure, and workspace ownership rules while
preserving the current Cesium host. Those contracts are required by Option 2
as well, so the work is not discarded if full rendering isolation is later
chosen.

Option 2 should be selected only if measurements show that main-thread Cesium
rendering/readiness remains the blocking issue after Option 1, and after a
small Worker/`OffscreenCanvas` feasibility spike proves the required Cesium,
tile, widget, and encoding capabilities.

## Required benchmark before selecting the final runtime

Record the following for a fixed set of imagery-only, terrain, 3D Tiles, and
dense journeys:

- export wall-clock duration and encoded frame count/duration;
- maximum and p95 main-thread task duration;
- frame render time and tile-readiness wait time;
- time spent in overlay composition and encoding;
- peak JavaScript heap and, where available, GPU memory/context usage;
- tile request count, duplicate resource count, and failed requests;
- UI input latency while moving the standard camera and editing the scene;
- cancellation latency and resource teardown time;
- visual parity of first, transition, moving, waiting, and final frames.

Run the same matrix against the current isolated main-thread implementation as
the baseline. Do not define success only as “the export completed”. Generated
pixels, camera motion, trace progression, widget composition, and workspace
responsiveness all need acceptance evidence.

## Proposed issue 1

### Title

`[Feature] Run Replay HQ orchestration and encoding in a dedicated Worker`

### Body

```markdown
<!-- issue-type: feature -->

## Context

Replay HQ export uses fixed frame timestamps and an isolated Cesium render
target, but the isolated renderer and export orchestration currently run on the
main thread. The capture lifecycle also hides the standard Studio UI. This
prevents the user from continuing to work in the standard workspace while an
HQ export is running and leaves timeline, readiness, composition, and encoding
work competing with UI tasks.

The HQ camera must remain the dedicated export camera. This issue does not add
or restore a `Visible map camera` mode.

## Requested behavior

Move HQ frame scheduling, export state transitions, progress, cancellation, and
encoding coordination to a dedicated Worker. Keep the existing isolated Cesium
HQ renderer on the main thread for this option.

The Worker must consume an immutable, serializable export snapshot. The main
thread must render only through the dedicated HQ render target and must never
use the interactive Studio camera as an HQ authority.

The standard workspace must remain visible and usable during export. Changes to
the interactive camera or scene must not change the export timeline, crop
rectangle, dedicated camera, or captured widget state.

## Acceptance criteria

- The standard Studio workspace remains available during an HQ export.
- The interactive Studio camera is not used to resolve or apply HQ camera
  frames.
- The Worker owns fixed frame iteration, export progress, cancellation, and
  encoding coordination.
- The main thread owns only the dedicated HQ render request and returns
  transfer-friendly frame data to the Worker.
- The export snapshot contains serializable timeline, render-spec, crop, camera,
  and widget-composition inputs and cannot change after the first frame.
- Widget output is frozen or snapshotted before export and remains stable even
  when the user edits the standard workspace.
- Back-pressure prevents unbounded pending render requests or frame buffers.
- Success, cancellation, readiness failure, and encoding failure release the
  render target and all Worker resources.
- Progress, remaining time, errors, and cancellation are exposed to the
  existing recording monitor without making the monitor a replay authority.
- The benchmark in the replay quality validation document records export time,
  main-thread task duration, memory, frame count, and visual output for the
  supported reference journeys.

## Notes or questions

- The implementation must preserve the existing canonical replay frame
  contract; the Worker is not a second replay clock.
- The crop board remains capture infrastructure even when its editor UI is
  hidden.
- A real HQ visual run is required because this changes frame scheduling,
  composition, and encoding ownership.

## Technical notes

- Define versioned Worker request/event contracts with serializable payloads.
- Prefer transferables and `VideoFrame` where supported; avoid copying the
  same pixel buffer multiple times.
- Keep Cesium, DOM, React, and Valtio objects on the main thread in this issue.
- Add focused protocol, cancellation, back-pressure, and lifecycle tests.
```

## Proposed issue 2

### Title

`[Feature] Render and encode Replay HQ in a dedicated OffscreenCanvas Worker`

### Body

```markdown
<!-- issue-type: feature -->

## Context

Replay HQ export currently uses a dedicated but main-thread Cesium host. The
standard workspace cannot be used freely during export because Cesium rendering,
tile readiness, composition, and encoding still compete with the UI event loop.

This issue proposes full execution isolation: the dedicated HQ Cesium runtime,
fixed frame timeline, scene readiness, composition, and encoding run in a
Worker. The HQ camera remains dedicated to the export and is never the
interactive Studio camera.

This issue does not add or restore a `Visible map camera` mode.

## Requested behavior

Create a Worker-side HQ render host using `OffscreenCanvas`. The Worker must
own the deterministic HQ frame pipeline from the immutable export snapshot to
the encoded output. The main thread keeps the standard Studio workspace,
recording monitor, export controls, and final download handling.

DOM-based video widgets must be represented by a documented capture contract:
either a serializable Worker renderer or a frozen raster snapshot produced
before the Worker starts.

## Acceptance criteria

- Capability detection validates the required Worker, `OffscreenCanvas`, WebGL,
  Cesium, and encoding features before export starts.
- The Worker owns the dedicated Cesium scene, camera, canvas, imagery, terrain,
  supported 3D Tiles, frame timeline, readiness, composition, and encoding.
- No DOM node, React object, Valtio proxy, live Cesium object, or application
  singleton crosses the Worker boundary.
- The standard Studio workspace remains visible and responsive during export.
- Interactive camera and scene edits cannot change the immutable HQ export
  snapshot or dedicated HQ camera.
- Video widget output is deterministic, correctly scaled, and frozen or
  rendered from a declared Worker-compatible representation.
- Worker back-pressure bounds frame, pixel, and encoded-data memory.
- Cancellation, context loss, readiness failure, encoding failure, and normal
  completion release the Worker, WebGL context, tile resources, and buffers.
- The recording monitor receives progress, remaining time, errors, and
  cancellation state without becoming a replay clock or render authority.
- A real HQ visual validation run proves camera motion, trace and marker
  progression, tile quality, widget composition, frame count, duration, and
  first/final frame correctness.
- The benchmark compares this implementation with the current isolated
  main-thread baseline, including UI latency, export time, memory, GPU/context
  pressure where available, and tile requests.

## Notes or questions

- The existing canonical replay frame contract remains the only replay clock.
- The crop rectangle and widget composition inputs must be frozen before the
  first Worker frame.
- Unsupported capability must produce an explicit user-visible state; a silent
  change of camera or render authority is not acceptable.
- This issue should follow a small feasibility spike if Cesium or the selected
  encoder path has not yet been proven in a Worker.

## Technical notes

- Define a versioned serializable scene descriptor and frame protocol.
- Use `OffscreenCanvas`, transferables, and `VideoFrame` where supported.
- Define Worker-side equivalents for scene readiness and overlay composition.
- Add focused capability, protocol, cancellation, context-loss, memory, and
  lifecycle tests.
```

## Decision gate

The two issues should not be implemented concurrently. Validate the issue
wording and choose the execution sequence first. The architecture recommendation
is to implement Option 1, measure it against the baseline, and only then open
Option 2 for implementation if main-thread Cesium work remains the limiting
factor.
