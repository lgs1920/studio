# Replay Architecture

Status: current implementation inventory; see the implementation status for known gaps

Date: 2026-10-22

## Purpose

This document is the canonical description of the replay implementation. It
describes the code that currently exists. Planned work is tracked in the replay
status document and in explicitly marked
TODO specifications stored beside the current replay documentation.

## Basic and Expert modes

Basic and Expert are user-facing Replay configurations over the same Replay
session, frame resolver, and camera/runtime. Basic provides a guided
preparation with a restricted set of controls and widgets. Expert exposes
additional camera, clip, and Replay controls. The selected mode changes
configuration and preparation policy, not the Replay engine or video renderer.
Both modes use the configured Replay camera and the same playback and MP4
export path. The current camera configuration controls heading/angle, pitch,
and camera height. Cesium range (the perceived zoom) is derived from camera
height and pitch, then carried in the same camera command used for interactive
playback and export. Basic tracking resolves its Navigation marker policy from the active Basic
configuration, even when the separate Expert marker setting is trace-only.
Startup and live camera commands aim at the same rendered terrain marker;
GPX elevation does not replace that target. Supported pitch values, including
`-89°`, remain unchanged by live tracking and deterministic pose resolution.
When a configured absolute altitude falls below the rendered target, entry and
tracking use the target's minimum terrain clearance before deriving range from
the requested pitch. They never borrow the normal map camera's distance. This
safety adjustment leaves the persisted altitude and altitude mode unchanged.
While Navigation stays inside its trigger zone, Replay pans the camera by a
small fraction of the route movement so the map keeps moving between safety
recenters. The pan preserves the prepared orientation and zoom; collision-driven
camera corrections retain control when the marker approaches the zone boundary.
Start/stop clips may define their own camera movement.
Completed videos open in the standard preview and sharing dialog.
`ReplayMediaCapture` handles screenshots and completed-media handoff.

Basic Replay settings are stored under `basic` in global UI settings and on
each Journey. Reads use `basic` when that property exists and fall back to the
legacy `simple` key only when it is absent. Settings hydration migrates legacy
values to `basic`, preferring `basic` when both keys exist. Every subsequent
write stores `basic` and removes `simple`.

The Basic settings popup offers 10, 15, 20, 30, 45, and 60-second durations,
border/fill color swatches, a border toggle, and four trace/marker size choices.
The thin preset scales the trace to 0.65 while keeping the marker at the small
preset's baseline; small, medium, and large use factors 1, 1.5, and 2.3 for
both. Explicit appearance choices are stored in
`basic.presentation.sizeScale`, `markerSizeScale`, `borderEnabled`, `fillColor`,
and `borderColor`, on the Journey and in application defaults. Missing
`borderEnabled` values retain the legacy bordered appearance. Product
dimensions remain unscaled in the normalized progression; the Basic renderer
applies the path and marker factors at rendering time, after projection limits
for the marker. Disabling the border hides it on the trace and marker while
retaining the selected border color. Color inputs update every choice preview
and the active Replay immediately. Expert appearance remains independent.
When a POI display window starts, Basic Replay eases down from normal speed to
half speed, then follows a one-second crawl profile around the POI: speed falls
from five percent to zero at the closest route point and rises back to five
percent. Cesium camera tracking is frozen for that one-second crawl while the
Replay marker continues along the route. A POI that enters the crop before the
marker arrives remains visible until the marker reaches it, then its display
duration starts. It then continues through the existing easing window. Overlapping
windows share one slowdown envelope rather than stacking speed changes; each
distinct POI keeps its own crawl zone. POIs more than 500 meters from the active
Replay path do not add slowdown segments even when associated with the Journey.
The replay timeline, Record duration, and playback toolbar include the added
playback time.

Basic and Expert MP4 recording temporarily suspend the main viewer's default render loop.
Each capture flush calls `Viewer.render()` after resizing and requesting the
scene, so Cesium updates entity visualizers before drawing that video frame.
This prevents repeated reconstruction of dynamic ground polylines by competing
animation frames. The original loop setting is restored before terminal scene
cleanup, including encoder failure and cancellation. Pending terrain and 3D Tiles
waits advance this same render driver on bounded browser tasks, preserving network
and worker progress without a competing render loop. Dry run retains its normal
render scheduling.

Basic Replay offers an opt-in Dry run preference in the video settings popup.
It traverses the same fixed-timestamp timeline, including start and stop clips,
and applies the same camera, trace, and logical widget state. Tile prewarming
remains enabled according to the configured readiness policy. Dry run checks
tile readiness at phase boundaries and final frames with a maximum 250 ms
budget. Intermediate frames request rendering without a synchronous scene
flush or tile wait, and the session yields browser tasks after batches of work.
Dry run skips widget capture readiness, bitmap capture,
output-canvas composition, codec selection, and media handoff. Widgets consume
published state through normal React batching because no capture reads their
pixels. The monitor displays an integer progress percentage, processed/total
frames, and estimated remaining time without copying a preview image.
Video quality and FPS preferences remain unchanged for the next recording.
Dry-run checkpoints can render synchronously to avoid waiting for the next
browser animation frame. Readiness is checked again after rendering; missing
tiles retain bounded, asynchronous, cancellable waits. Record and Dry run request
ordered route samples from a module worker in small batches while the scene is
prepared and frames render, then apply each sample at its matching frame. The
first batch gates the first rendered frame; later batches are requested
progressively. Cesium camera changes and tile
readiness remain on the main thread. Completed Dry runs report console timing
totals for camera and trace updates, widget-state publication, tile readiness,
and other work (including preparation, frame resolution, UI yields, and
pauses), along with worker CPU time for route-sample preparation.
Dry run validates Replay execution, not widget capture fidelity.

## Normal map and Replay camera ownership

Persisted Replay camera settings belong to the selected journey and are edited
through Replay controls. During video preparation, explicit mouse tilt and zoom
on the map also edit Replay pitch and height. Gesture-start values distinguish
these inputs from automatic camera movements and unchanged gestures. Pointer
release commits drag edits synchronously, and preparation flushes pending wheel
updates before Record. Drag and wheel inertia remain pending until camera height
and pitch stop changing across a quiet observation interval, or Cesium reports
the end of movement. Interactive Play waits for the same final gesture value.
Stop, errors, preparation exit, and disposal cancel pending input before restoring
the map; a cancelled preparation cannot resume playback later.
Constant altitude stores absolute prepared height. Ground
offset stores that height minus the rendered Replay target height. Neither input
rewrites the cone angle. Ordinary Cesium navigation and playback/capture
camera feedback never write Replay settings.
The preparation cone uses a fixed nominal CSS-pixel layout independent of Cesium
zoom and configured Replay camera height. Its sides, rounded base, and angle arc
share the camera icon's projected local map plane, including pitch and heading
foreshortening. Height settings do not change the nominal scale. The final crop constraint
contains the rounded base, tip, and camera icon together, retaining the projected
departure anchor where possible and translating the guide when needed to keep
it usable. Crop replacement and ancestor layout changes refresh that constraint.
Passive display adjustments never write camera settings or move the map camera.
Dragging the camera-angle guide during preparation applies its Replay angle and
altitude to the Cesium camera live through the Replay camera controller. The
guide consumes its mouse and keyboard events so Cesium navigation does not also
handle them. Camera-icon dragging changes only azimuth and preserves Replay
height regardless of pointer radius; only the cone-tip handle edits height.
Preparation still restores the saved normal camera view when it
closes. The simulated route defaults to 1,000 metres, capped by the available
track length; its arrow and dotted stroke use Replay fill color.
An on-map preparation joystick controls height (vertical axis) and pitch
(horizontal axis) independently of azimuth. Held thumb deflection controls the
adjustment rate: maintaining a displaced thumb continues zooming or pitching.
Upward input and ArrowUp zoom in by reducing camera height; downward input and
ArrowDown zoom out by increasing it.
Updates use elapsed animation-frame time, with a bounded catch-up interval after
browser suspension. Returning to center stops adjustment. Diagonals combine both
controls. Release, pointer cancellation, focus
loss, Journey replacement, playback, and capture stop its input loop and return
the handle to center without restoring the previous camera pose. Its public
`updatePreparationCamera` session boundary persists the active Journey camera
and applies it to Cesium without acquiring ownership. The transient `lgs-widget`
uses the scene board and stays outside the visual-widget catalogue and captured
video composition. Its circular pad uses the standard on-map card theme. A
transparent Three.js scene draws a movable, concave on-map cuvette over a
rounded on-map ball. The cuvette follows the ball's spherical surface, and an
on-map bevel defines the ball's edge. The grooved, on-map-colored crown stays
fixed around it. Its perspective angle is oblique, and the cuvette fades slightly
as it nears the edge. Mesh depth, surface normals, and directional lighting
provide the relief.
Transparent canvas pixels leave the on-map disk visible around the hardware.
The DOM thumb remains the pointer and keyboard target. It
keeps its concave on-map fallback
appearance while WebGL initializes or is unavailable, then becomes transparent
over the rendered cuvette. The canvas also renders on mount and resize. No title,
measurements, help text, or direction buttons are displayed. Locally bundled
Font Awesome zoom and rotation icons appear only during adjustment. Focused
arrow keys expose both axes without triggering global Replay azimuth shortcuts.
Dragging the pad outside the thumb moves the widget through the shared
widget host. The host keeps Moveable's bounds engine active for draggable
controls even when alignment snapping is disabled, keeping the whole widget
inside its board during movement. Only the thumb excludes host dragging and controls the camera.
Ctrl constrains thumb movement to the first dominant axis after a three-pixel
threshold, retaining that axis until Ctrl is released. The circular boundary
preserves the blocked coordinate; releasing Ctrl resumes free movement without
applying movement previously ignored on that axis.
Entering Basic or Expert video preparation stops and awaits an existing normal
map orbit before framing the canonical journey departure in a static
North-oriented view with Replay pitch and height. This explicit entry boundary
waits for prior scene restoration and successful preparation, and rejects stale
transitions. It never supplies normal camera values to Replay settings. Passive
guide refreshes leave the Cesium camera and its geographic pivot unchanged;
explicit camera-angle guide edits apply the prepared Replay pose without taking
camera ownership. Outside this explicit preparation control, passive drawer
refreshes and timeline seeks cannot apply a camera update without a playback camera lease;
the session call bridge enforces this boundary.

On first successful video-preparation entry, the session keeps the existing
normal camera pose for restoring when preparation is exited, without taking a
camera lease. At playback or capture start, it leases the physical
render-target camera and saves that camera's current view separately from the
preparation-exit view and the Replay entry pose. In video preparation this is
the displayed preparation view; when playback starts outside preparation it
is the current normal view. An isolated export lease snapshots only its own
camera and leaves the main map camera alone. Replay applies its configured
angle, pitch, and height before start clips.
The departure marker's crop-relative screen position is persisted separately in
the active Journey's Basic or Expert Replay settings. Preparation and playback
reuse it when framing the departure, while camera height, pitch, and angle keep
their independent settings.
The normal camera manager suspends reads and persistence while the main camera
is leased. A lifecycle revision rejects asynchronous reads that overlap a lease.
Isolated export cameras acquire their own leases and leave main-view persistence
independent.

Playback completion, cancellation, and error restore the saved preparation
view (or the current normal view when playback began outside preparation),
including world-space position, direction, up vector, Cesium reference frame,
and map pivot before releasing ownership. Exiting or disposing video
preparation restores the normal view captured before preparation. No journey
focus flight runs during handback. Reentrant starts retain the original return
view. A stale session cannot restore or release a camera borrowed by a newer
session.
A successful new preparation invalidates the Replay settings baseline from an
earlier preview, while retaining its normal-camera return snapshot. Recording
cleanup cannot persist the older baseline over newer preparation edits. Pending
cleanup also preserves edits made while a new preparation is active, before
that preparation has been validated.
Terminal cleanup never persists a playback camera baseline. Outside preparation,
it reloads runtime controls from the currently selected Journey's camera data.
This also preserves newer saved edits and prevents an old session from writing
its height or pitch into another Journey after selection changes.
Basic Replay disables camera diagnostics, including when persisted or prepared
settings enable them. Expert Replay exposes the diagnostics setting.
Diagnostics label ground offset separately from absolute Replay height.
Recording diagnostics report the altitude mode, configured pitch, altitude,
and angle alongside the rendered marker height and applied Cesium entry pose.
Deferred export context uses Replay entry state only and never a camera return
snapshot or an arbitrary live map view. Revalidating preparation clears any
entry pose retained by an earlier playback, then captures the finalized
preparation pose before the deferred plan captures its camera context.
Interactive startup also captures the prepared Cesium pose before configuration
and restores that exact pose for the first frame, preserving its zoom and crop
composition. The `replay.camera.transfer` and `camera.view.apply` trace events
compare configured altitude, pitch, and angle with physical camera height and
camera-to-marker range at each transfer boundary.

Basic Replay adds a configurable trace-centroid focus phase after its playback.
It rotates at 12 revolutions per minute, completing one turn every five seconds.
Expert Replay uses its configured start and stop clips.

## Functional architecture

Replay resolves one journey and camera domain for interactive playback,
scrubbing, and capture. The following are execution paths, not user-facing
Replay modes:

| Policy | Time source | Render target | Primary purpose |
| --- | --- | --- | --- |
| Interactive playback | Monotonic wall time | Interactive Studio viewer | Immediate preview and controls |
| Deferred Replay capture | Fixed video frame timestamps | Main Studio Cesium viewer and canvas | Deterministic MP4 production |
| Scrubbing | Latest slider request | Interactive Studio viewer | Real-time manual positioning |

Each path must resolve equivalent visual state for the same logical time. They
are not independent replay engines.

The editable start and end handles in Replay preparation define the deferred
video export window over the canonical start/Replay/stop timeline. The first
encoded frame resolves the phase and Replay progress at the selected start
time; later frames map the zero-based output clock back to that source time.
The selected end time bounds the export. A range that starts or ends inside a
clip preserves that clip's source-local time, and a range beginning after a
phase omits the earlier phases. With no edited range, export covers the full
timeline. The range affects deferred video output and does not create a second
interactive playback clock.

The functional frame contains:

- journey sample and progress;
- active start, replay, wait, or stop phase;
- canonical camera pose and command;
- trace and marker state;
- dynamic widget and overlay state;
- scene-readiness and quality outcome.

## Runtime authorities

### Timeline and frame resolution

`ReplayVideoTimeline` and `ReplayFrameTimeline` enumerate deferred-export timestamps and
start/replay/stop phases. `ReplayFrameResolver` resolves a canonical frame intent
for a requested logical time. `ReplayFramePublisher` publishes complete resolved
frames to consumers.

The Valtio replay store and media handoff events are projections for UI and
integration. They are not authoritative clocks for rendering.

### Session and lifecycle

`JourneyReplaySessionController` remains the public replay facade. The session
controllers coordinate playback, scene state, camera state, clips, rendering,
and cleanup. `ReplaySessionOwnership` prevents obsolete asynchronous cleanup
from restoring or moving the camera after a newer session owns replay.

`JourneyReplayRunner` remains a compatibility authority for existing
consumers. New replay behavior must not be added to it.

### Camera

The current camera stack resolves the nominal tracking view, crop containment,
terrain visibility, pitch correction, and transitions. Canonical
`ReplayCameraCommand` values cross interactive playback, export, scrub, and
clip boundaries.
`ReplayCesiumCameraAdapter` is the deterministic Cesium application boundary.

Camera motion uses Replay duration to scale route-heading anticipation and a
short spatial smoothing window for the camera-only anchor. The anchor follows a
deterministic uniform cubic Bezier B-spline evaluated on a route-distance grid.
The grid restarts at every track segment and extrapolates endpoint knots so the
camera path starts and ends at the original route samples. The smoothing pass
caps its horizontal offset at one quarter of the currently projected crop
width. It does not change the canonical route sample used by the trace, marker,
visibility checks, or crop progression. Tight-zigzag chord simplification
remains a separate camera-only rule and applies only when the section's
cross-track amplitude is below half of the projected crop width.

Live Dynamic tracking predicts a sustained exit from its trigger zone using two
future route projections, then begins the correction before the marker reaches
the boundary. Navigation keeps its confirmed predictive collision check with a
3-second base transition horizon. Live tolerance and visibility corrections
use a cubic ease-in/out camera flight lasting at least 3 seconds. Preserve
any longer duration selected by the active camera Ease. Deterministic Basic
Replay capture interpolates hard Navigation corrections on replay time for at
least 3 seconds instead of applying an immediate camera frame. This correction
timing does not change clip timing.

Tracking lookahead converts seconds to progress using the configured Replay
duration, including for untimed GPX routes. GPX recording speed does not define
camera anticipation. Navigation confirms a predicted exit with a later sample
beyond that prediction, rather than a sample closer to the current marker.
The production export supplies its `replay-export` source so camera-anchor
smoothing runs on recorded frames as well as live playback. Crop-width limits
use rendered terrain target height.

Tracking adaptation also compares the distance traversed during the transition
with the visible ground span. That span derives from the prepared Replay
height, rendered target altitude, pitch, camera frustum and crop-to-canvas ratio.
The same duration therefore anticipates earlier at a tighter zoom. Crop
projections retain the full canvas CSS dimensions and origin, independently of
the smaller crop and physical drawing-buffer pixel density.

Every Navigation update qualifies the current, unmodified marker against the
crop, including while a three-second transition is active or a pose is held.
If necessary, a minimal camera translation places it at the inner crop margin.
This final safety correction preserves the interpolated orientation, frustum
and camera-to-target range rather than rotating instantly or changing the
selected zoom. It shifts along the camera ray for the target's requested crop
position; if that would place the camera below the target, the original framed
pose remains in place.
Anticipated route samples never replace the real marker for this containment
check. The path endpoints remain exact when they already contain the marker.

Navigation corrections use direct paths with exact position endpoints and
quaternion interpolation of direction and up. Their canonical command encodes
the transient interpolated aim instead of forcing an immediate look-at toward
the future route target. Clip transfers retain their own path and target-lock
policies. Explicit scrubbing cancels active transitions and applies the requested
sample without playback lookahead.
Navigation export reapplies its held camera pose while the marker remains inside
its zone, matching live playback instead of replacing that pose with the nominal
view on every frame. The final three Replay seconds ease toward the exact route
endpoint so the last frame does not snap out of an unfinished correction. Replay
progress, including playback direction, determines completion; an absolute video
timestamp containing start clips must not end camera tracking prematurely.

Interactive playback may use live camera behavior. Deferred export uses
logical frame time and applies a camera result for every deterministic frame.
Wall-clock throttling must never decide whether an export camera frame is
applied.

### Trace and marker

`JourneyReplayCesiumRenderer` owns replay trace and marker entities in one
`CustomDataSource`. It resolves its viewer and scene from the session's explicit
render target, falling back to the Studio viewer for interactive replay.

The renderer normalizes the supplied camera guide into Cartesian positions once
per `show()` installation and reuses those positions across frame updates and
dynamic property evaluations. Reinstalling the guide, replacing its source, or
clearing the renderer invalidates that cache. Progress interpolation and final
trace endpoints continue to use the current logical sample.

Interactive playback may throttle expensive geometry updates. Deferred export
must force frame-accurate geometry because its frames are generated faster
than wall time. A wall-clock throttle can otherwise leave the encoded trace
empty or stale.

### Render targets

`ReplayRenderTarget` associates a replay session with an explicit viewer, scene,
and canvas without replacing global Studio objects. Interactive playback, Dry
run, and product MP4 export use the main Studio Cesium viewer. Product export
applies every resolved Replay camera command to that viewer, synchronously
renders during tile readiness, and copies the same main canvas into the video
composer. The main scene therefore continues to display the advancing Replay
while the recording monitor previews composed output frames.

`IsolatedReplayRenderHost` remains available to explicit off-screen render
callers. It owns a no-loop `CesiumWidget`, a separate camera, and independent
Cesium runtime resources. Its scene descriptor reproduces supported terrain,
imagery, environment settings, and the active base 3D layer. Product recording
does not allocate this host or redirect the main Replay renderer to it.

Camera, trace, clip, visibility, prewarming, readiness, and capture operations
must resolve the active session render target. They must not access the global
viewer directly when a target-aware call is available.

### Scene qualification and readiness

Transient slider requests apply immediately and coalesce to the latest request.
A settled request uses `ReplaySceneFrameQualifier`, supports cancellation, and
waits within bounded readiness budgets.

Export scene readiness belongs to the active render target. Product MP4 export
qualifies every frame on the main Studio viewer, while Dry run qualifies only
its bounded phase/final checkpoints. A synchronous scene
render supplies the post-render boundary during readiness instead of relying on
the browser's animation-frame loop. Moving replay and clip frames use bounded
moving-frame readiness; holds and final frames may request settled quality.
Readiness delays export wall time but never changes logical video time.

### Composition and encoding

`ReplayDeferredExporter` contains the deferred-export orchestration for
preparation, frame rendering,
readiness, overlay composition, encoding, cancellation, and cleanup.
Its Basic Replay Dry run mode keeps logical frame updates, tile prewarming,
bounded tile-readiness checkpoints, cancellation, and cleanup. It skips widget capture,
output-canvas composition, codec probing, and media creation.
Product export and Dry run delegate the controller seek to their frame
application callback. The preceding session resolution does not also seek:
otherwise it would invoke the interactive scrub listener before the guarded
export update, duplicating trace/camera work and mixing the two execution paths.
Standalone frame sessions retain their default seek-before-render behavior.
`ReplayVideoOverlayComposer` maps logical widget and crop coordinates to the
physical output surface. Mediabunny encodes the product frame timeline and must
not become a replay clock.

`ToolsUI` owns one persistent video widget portal through preparation and capture.
Crop controls and recording controls replace only the board surface. Widget hosts
reattach to the current board DOM while retaining their content instances. Restored
timeline instances resolve their registration group from the widget catalogue,
including Journey-only Text, Profile, and Stats widgets. Registration refreshes do
not clear live mount state or reset stacking order. The timeline keeps every known
instance mounted and controls visibility independently of component loading.
Before capture, the exporter registers and waits for the union of the saved
manifest and current track references, including clips that start later.

Export commits synchronous Valtio widget consumers through
`ReplayWidgetFrameRenderers` before reading DOM pixels. Mounted widgets register
imperative preparation with lifecycle-owned teardown: Stats settles its bounds,
Compass applies the published heading, and Profile paints and flushes its chart.
Capture and composition resolve the same visible widget set on each frame,
including user visibility and the dynamic/summary Stats phase transition.
Visible capture failures, timeouts, and cancellation stop export rather than
encoding a stale widget bitmap.

`Widget2Canvas` observes dirty content even in manual mode, drains pending
mutations before capture, and reuses unchanged bitmaps. Hidden content is not
rasterized and is refreshed when it reappears. Export temporarily owns mirror
refresh scheduling and restores each mirror's original policy on every exit.
SnapDOM remains responsible for complete DOM widget fidelity and differential
recapture. Its unchanged capture results can reuse their rasterized canvas;
canvas-backed surfaces still copy current frame pixels directly.

The export compositor has no autonomous animation loop and draws directly into
the working export canvas. This removes the intermediate full-frame copy after
Cesium composition. The separate stable encoder canvas remains necessary for
codec keep-alive submissions while the next frame is being prepared.

### Recording preparation and map controls

During Basic preparation, the runtime camera is authoritative for the drawer
and partial cone edits. Duration or style hydration must not replace it with an
older journey camera. Successful preparation persists that validated camera
before recording transitions, so releasing the preparation flag cannot change
the height, pitch, or angle used by export. Playback and export startup retain
the runtime camera across their own configuration hydration before applying the
first camera frame.

The Record action awaits completion of any normal map rotation before resolving
the preparation camera and crop. Journey Toolbar rendering is masked throughout
pre-recording, recording, export, and finalization without changing its persisted
visibility setting. Replay scene cleanup cannot expose it during capture. After
capture ends, the toolbar returns only when its saved visibility allows it.

## Replay transport and recording monitor

`ReplayRecordingMonitorWidget` is the single transient Replay surface outside the
captured widget board and is hosted by the generic `Widget` component. During
ordinary Replay it hosts the canonical transport, real-time scrub slider,
snapshot action, and settings action. During linked Replay export it switches
to the latest final composed frame, recording progress, runtime metrics, and
icon-only lifecycle actions. Each composed frame is copied synchronously into
the monitor preview before the exporter reuses its working canvas, preventing
the monitor from displaying an intermediate cleared frame. The monitor retains a
stable snapshot of that frame and reconnects its preview whenever React mounts a
new canvas, including when the surface moves to or returns from Document PiP.
Canvas recognition accepts same-origin canvases from the PiP window realm.

Dry run omits the frame preview and fits its host height to its progress and
controls through the widget manager's `resizeToContent` contract. Initialization
constrains both persisted and runtime dimensions before positioning, preserving
the monitor width and position without carrying over the preview's empty height.
Returning to recording enforces the preview content's minimum height while
allowing the user to enlarge it. Collapsed host dimensions remain independent.

The surface is a read-only projection of replay and recording authorities. It
does not resolve frames, drive the replay clock, move either camera, qualify the
scene, or participate in composition. Widget reduction, positioning, and
removal belong to the widget manager; the monitor has no private close or
minimize controls. Explicit cancellation stops recording and exits
Picture-in-Picture before terminal cleanup.

## Required invariants

- One logical timestamp resolves one complete visual frame.
- Playback, capture, and scrub consume the same canonical camera contract.
- Deferred-export camera and trace updates are independent of wall-clock pacing.
- Product MP4 export resolves and applies each frame camera command on the main
  Studio viewer before copying its canvas into the video composer.
- An explicitly isolated render target never moves the interactive Studio
  camera.
- A render owner writes camera and entities only to its active render target.
- Obsolete sessions cannot restore camera or scene state.
- Cancellation and every terminal exporter path release the target and destroy
  isolated Cesium resources.
- Dynamic widgets consume the published logical frame instead of private timers.
- The video-board compass consumes the published export camera pose while an
  export is active; it never reads the interactive Studio camera for composition.
- Replay transport and recording progress are not duplicated across independent
  floating HUDs.

## TODO architecture extensions

Future replay architecture is documented in focused specifications within this
directory. A TODO specification is not a description of current behavior. The
authoritative status and target release for every extension is maintained in
[Replay Implementation Status](CORE-REPLAY-IMPLEMENTATION-STATUS.md#todo-roadmap).

## Related documents

- [Replay implementation status](CORE-REPLAY-IMPLEMENTATION-STATUS.md)
- [Replay quality validation](CORE-REPLAY-QUALITY-VALIDATION.md)
- [Camera tracking zones](REPLAY_CAMERA_TRACKING_ZONES.md)
