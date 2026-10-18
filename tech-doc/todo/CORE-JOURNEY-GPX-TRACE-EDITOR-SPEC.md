# GPX Trace Editor Specification

Status: **proposal — pending product and technical validation**

Target release: undecided

This document describes a proposed editor for correcting the geometry of a
journey track imported from GPX. It is a design specification, not an approval
to implement every option below. The recommended first version and unresolved
choices are called out explicitly.

## 1. Objective

Let a user inspect and correct one selected track in a journey by moving,
adding, or deleting its recorded points. The editor should make the route easy
to inspect in plan, elevation profile, and 3D terrain views while keeping one
view visible at a time. Every view edits the same in-memory draft, so changing
views never creates separate or divergent copies of the route.

The main use case is repairing a bad GPX recording: a GPS point that jumps off
the path, a short excursion that should be removed, a missing bend that needs
a point inserted, or an altitude that needs correction.

## 2. Goals and non-goals

### Goals

- Select a journey and one of its tracks for editing.
- Inspect the selected track in three mutually exclusive views: plan, profile,
  and 3D terrain.
- Select one or many original GPX points, move them, add a point on an
  existing segment, and delete selected points.
- Reconnect neighboring points after deletion without crossing an original
  GPX track-segment boundary.
- Preserve the relationship between coordinates and supported per-point data,
  especially timestamps and elevations.
- Preview edits, undo and redo them, then either apply the whole edit or
  discard it.
- Refresh derived track and journey data after an applied geometry change.
- Preserve the normal map camera and other application state when the editor
  opens, changes view, closes, or fails.

### Not in the first version

- Automatic road/path routing between points.
- Automatic smoothing, denoising, or reconstruction of a route from GPS
  measurements.
- Correcting GPS timestamps or inventing missing time data.
- Treating terrain elevation as authoritative GPX elevation without an explicit
  user operation and a documented vertical-datum policy.
- Editing several tracks simultaneously.
- Editing arbitrary GPX extension fields or sensor streams that the current
  import/export pipeline does not preserve.
- Displaying three synchronized editors at once. The user specifically asked
  for a view selector and only one active view at a time.
- A wireframe rendering of the terrain mesh as a requirement of the route
  editor. The route can be drawn as a line over a shaded terrain surface.

## 3. Existing application model

The editor should build on the existing Journey and Track model rather than
creating a second route format:

- A Journey owns one or more Track instances; a track's source content is a
  GeoJSON Feature.
- Track geometry is represented as a `LineString` or `MultiLineString`. A
  `MultiLineString` can retain separate source segments, such as separate GPX
  `trkseg` elements.
- Coordinates use the GeoJSON order `[longitude, latitude, elevation?]`.
- Supported point times are stored in
  `feature.properties.coordinateProperties.times`. Existing metric code
  accepts a flat array for a `LineString` and reads per-segment or legacy flat
  arrays for a `MultiLineString`; an editor should normalize this data before
  it writes an edited draft.
- The GPX exporter walks each track segment and emits each point's coordinate,
  optional elevation, and supported time. It does not imply lossless handling
  of every possible vendor extension.
- Track and Journey metrics are derived from track content. Rendering and
  terrain alignment can also use derived content; that display representation
  must not silently overwrite the source GPX coordinates.

Relevant implementation references are [Journey](../../src/core/Journey.js),
[Track](../../src/core/Track.js), [GPX import/export utilities](../../src/Utils/JourneyGpxUtils.js),
[track rendering utilities](../../src/Utils/cesium/TrackUtils.js), and the
existing [profile chart](../../src/components/Profile/ProfileChart.jsx).
These files describe current behavior; they do not already provide the
point-editing workflow proposed here.

## 4. Proposed user workflow

1. The user chooses **Edit trace** for a Journey and selects one Track when the
   Journey contains more than one.
2. The editor takes a snapshot of the chosen track's source geometry and
   supported per-point data into a draft. The original remains untouched.
3. A view selector switches between **Plan**, **Elevation profile**, and
   **3D terrain**. Only the selected viewport is mounted/active. Selection,
   undo history, and draft changes are shared across view changes.
4. The user selects or edits points. A compact details panel can show point
   index, segment, longitude, latitude, elevation, time, and applicable
   warnings. Numeric fields provide an accurate alternative to dragging.
5. The user reviews the resulting line and any warnings, then chooses **Apply**
   or **Cancel**.
6. Apply validates the draft, updates the source track once, rebuilds derived
   statistics and dependent render data, and persists through the existing
   Journey save flow. Cancel drops the draft and restores the pre-editor view
   state.

The exact placement (drawer, full-screen editor, or dialog) is a UI decision.
The editor should have enough viewport area for route selection and point
dragging; a small modal is unlikely to be adequate for long traces.

## 5. Views and editing semantics

### 5.1 Plan view

The plan view shows the selected track from above, with a north indicator,
scale, track segments, and selectable vertices. It is the primary view for
longitude/latitude corrections.

- Dragging a point changes its horizontal geographic position.
- The recommended default preserves its source elevation and timestamp.
- Numeric longitude and latitude fields remain available for precise edits.
- A surface-snap command may place the point on the currently displayed
  terrain, but it must be a separate explicit action because sampled terrain
  height and recorded GPX elevation may use different vertical references.
- The default camera should remain top-down while the user is editing in this
  view. If 3D terrain context is needed, the user switches to the 3D view.

**Projection choices:**

1. **Top-down Cesium 3D globe (recommended first):** keep the normal globe and
   point the camera down at the route. This retains the current terrain,
   imagery, and geographic picking path, though the local view is not a planar
   engineering drawing.
2. **Cesium 2D scene:** use a map projection and a flat plan. This gives a
   conventional map interaction but changes Cesium scene mode and camera
   behavior, so it needs explicit state restoration and projection-aware
   editing tests.
3. **Custom local planar viewport:** transform a bounded route area into a
   local coordinate plane. This gives predictable local editing but adds
   projection, scale, and antimeridian handling work.

### 5.2 Elevation profile

The profile plots cumulative distance along the selected segment on the
horizontal axis and recorded elevation on the vertical axis. Segment
boundaries must appear as breaks, not as a line joining the end of one segment
to the start of another.

- The recommended first version allows a point to be selected and its
  elevation changed by vertical drag or a numeric elevation field.
- Horizontal chainage is derived from route geometry and is locked during a
  normal profile drag. This keeps a vertical correction from unexpectedly
  moving the point on the map.
- A future **move along route** mode could convert horizontal movement into a
  position on the existing segment. That mode must explain that it changes
  longitude/latitude as well as chainage; it should not be implicit in normal
  profile editing.
- Missing elevation must be shown as missing. Terrain-derived display height
  may be offered as a separate reference series, but must not be presented as
  recorded GPX elevation.
- The profile is an editor in its own right for altitude. Its horizontal axis
  is not a second independent route geometry.

**Alternative profile behaviors:**

| Behavior | Result | Trade-off |
| --- | --- | --- |
| Altitude-only drag (recommended) | Changes elevation; horizontal position remains fixed | Predictable and easy to explain; profile cannot reshape route distance |
| Move along route | Changes the point's station and map position along the current route | More capable, but can reorder/overlap points and needs robust insertion semantics |
| Read-only profile | Shows altitude without editing | Lowest risk, but fails the requirement that all views be editable |

### 5.3 3D terrain view

The 3D view shows the selected route over the active Cesium terrain and allows
the user to inspect relief from an orbiting camera. It should render the route
as a thin line and original vertices as editable handles when the scale allows.

- Dragging a selected point horizontally changes its longitude and latitude
  using a terrain or ellipsoid pick, while preserving source elevation by
  default.
- A separate altitude control (numeric field or explicit vertical gizmo)
  changes the elevation. Do not infer that a screen-space drag should change
  all three coordinates at once.
- Optional **Snap to terrain** sets elevation from a terrain sample only after
  the user asks for it. Keep this as a clearly named edit operation and show
  the resulting value before Apply.
- If terrain is unavailable, indicate that the view is using a fallback and
  keep coordinate editing available where possible. Do not claim a terrain
  snap succeeded when the pick returned no surface position.
- A simple route line over shaded terrain is the default. A route line drawn as
  a wire and a terrain surface drawn as a wireframe are separate display
  choices; the latter adds substantial rendering and interaction complexity
  and is not required for trace correction.

**Vertical-value choices:**

1. **Preserve the stored GPX elevation when dragging horizontally
   (recommended):** protects source data, but the rendered point may no longer
   sit exactly on steep terrain.
2. **Preserve terrain-relative offset:** sample terrain before and after a
   horizontal move and retain the same offset. This can look natural, but
   requires reliable terrain availability and a defined conversion between
   GPX height and Cesium height.
3. **Snap to terrain on every drag:** easy to understand visually, but changes
   elevation as a side effect and can rewrite a recording's altitude data.
   Do not use as the default.

## 6. Point selection and editing operations

### 6.1 Selection

- A single click selects one original source point.
- `Ctrl`/`Cmd`-click toggles a point in the selection.
- `Shift`-click selects the continuous range from the selection anchor to the
  clicked point, within the same source segment.
- A range selection must never cross a `MultiLineString`/GPX segment boundary.
- Selection is based on stable draft point identities, not only array indices;
  insertion and deletion change indices. Draft-only IDs are removed before
  committing the GeoJSON data.
- Selected points should be visually distinct from the editable but unselected
  vertices. The UI should expose selected count and segment identity.

For large tracks, the renderer may declutter or cluster visible point handles,
but editing and selection must still address the original points. A decimated
display line or vertex set must never replace the source draft.

### 6.2 Moving points

- A drag starts only after a small movement threshold, so a click can select
  without accidentally moving a point.
- While dragging, show the proposed position and update the shared draft.
- Commit one undo operation when the drag ends, not one operation per pointer
  event.
- `Escape` during a drag restores that drag's starting coordinate.
- A numeric editor should permit exact coordinate and elevation correction
  when pointer placement is too imprecise.
- Moving a point must not reorder it in the track. If a move would make the
  sequence geometrically cross itself, warn but do not silently reorder
  recorded samples.

### 6.3 Inserting a point

Right-clicking the visible route between two vertices opens a context menu
with **Insert point here**. The menu should identify the segment and the two
neighboring source points. A keyboard-accessible equivalent must be available
from the selected segment or point details.

Insertion rules:

1. Find the nearest eligible rendered route edge and its two source vertices.
2. Insert the new coordinate between those vertices in source order.
3. Keep it in the same segment; an insertion cannot bridge a segment boundary.
4. Derive its horizontal position from the clicked point on the displayed
   edge. The implementation must define whether the edge parameter maps to
   ellipsoid-geodesic interpolation or another route interpolation method;
   geodesic interpolation is the recommended default for long edges.
5. Interpolate elevation only when both neighbors have valid elevation. If
   either value is missing, leave the new elevation missing rather than
   inventing a terrain value.
6. Interpolate time only when both neighboring times are valid and ordered.
   Use the same edge fraction; otherwise leave the inserted time missing.
   Never generate timestamps when the source has no usable time data.
7. Preserve all existing points and point times exactly.

For a source segment with a gap or invalid point data, insertion should show a
warning and must not use the terrain or current wall-clock time to fill missing
source values.

### 6.4 Deleting points and reconnecting the route

`Delete`/`Backspace` and the point context menu delete the selected points.
When a contiguous run of interior points is removed, the surviving point
before the run is joined directly to the surviving point after it. This is a
straight route edge according to the active renderer's interpolation rules;
it is not a road router and does not reconstruct the deleted bends.

- Delete each selected range independently within its original segment.
- Never connect the last point of one GPX `trkseg` to the first point of the
  next segment.
- Preserve timestamps and elevations on all surviving points. Removing points
  removes their associated point data at the same indices.
- Show the proposed joined edge before Apply. For a large gap or large change
  in route length, warn the user so a deletion does not appear to preserve the
  original path shape.
- The first version should reject a partial deletion that would leave a
  `LineString` with fewer than two coordinates. An explicit **Remove segment**
  action may remove an entire segment, with confirmation when that would remove
  the track's only segment. This avoids silently turning a line into an
  unsupported one-point geometry.

Whether the editor should offer a future **bridge by interpolation** action
instead of a direct connection is an open product decision. It must remain an
explicit action because it creates new geometry rather than merely joining
surviving endpoints.

## 7. GPX and Journey data integrity

### 7.1 Source and rendered geometry

The draft edits the source geometry of the chosen Track. Render smoothing,
terrain alignment, simplification, and display-only offsets may be used to show
the route, but they must be kept separate from the edited source coordinates.
The editor should indicate when the displayed line is transformed relative to
the raw GPX points.

An edit to a point's horizontal coordinates must leave its altitude untouched
unless an explicit altitude operation is also requested. This matters because
GPX elevation and Cesium terrain heights are not automatically interchangeable
vertical references.

### 7.2 Time and elevation arrays

Every insert, delete, and move must keep `coordinateProperties.times` aligned
with the geometry. Before editing, normalize supported time data into one
array per segment. On Apply, serialize it in the shape expected by the
canonical geometry and existing exporters.

- A move preserves that point's original timestamp.
- A delete removes only the deleted point's time.
- An insertion follows the interpolation rules above or leaves time absent.
- Non-monotonic or malformed source time values must be preserved on untouched
  points and reported; do not silently sort times independently of geometry.
- Missing elevation remains missing unless explicitly set by the user or
  explicitly snapped to terrain.

If future import support adds heart rate, cadence, temperature, or vendor
extensions, each value must be added to the same alignment and round-trip
contract before the editor claims to preserve it.

### 7.3 Derived data and related objects

On successful Apply:

- Update only the chosen track's source geometry and aligned point properties.
- Recompute that Track's derived metrics and the parent Journey aggregates
  through the existing metrics pipeline.
- Refresh rendered geometry and bounds from the canonical updated track.
- Update endpoint-derived markers/flags only if they are explicitly linked to
  the track endpoints. Independent POIs must not be moved merely because the
  first or last track point changed.
- Preserve the Journey, Track, route style, metadata, other tracks, and
  independent POIs.
- Persist once through the existing Journey save path after validation; a
  cancelled or invalid draft must not partially persist.

The export check should compare the edited Journey before and after GPX
round-trip for geometry, segment count, supported elevation/time values, and
the metadata the current exporter promises to preserve. It must not be described
as byte-for-byte GPX preservation.

### 7.4 Validation and rollback

Before Apply, validate at least:

- coordinates are finite and within legal longitude/latitude ranges;
- each remaining line segment has enough coordinates for the app's geometry
  model;
- time arrays match their point arrays where present;
- inserted timestamps are valid and ordered when interpolated;
- each point is in exactly one source segment;
- no editor-only IDs, selection state, renderer objects, or Cesium/Three.js
  instances enter persisted Journey data.

If validation fails, keep the editor open, identify the affected segment/point,
and allow the user to repair or cancel. Do not write part of a draft.

## 8. Engine and rendering choices

### 8.1 Recommended first implementation: existing Cesium viewer

Use the application's existing Cesium scene for plan and 3D terrain editing,
and use a lightweight profile viewport for elevation editing. Cesium already
owns the globe, terrain, imagery, geographic camera, and terrain picking in
Studio. This avoids adding a second geographic rendering stack and makes
terrain context directly visible during a correction.

Cesium's documented `ScreenSpaceTiltOrbitCameraController` supports orbiting
and tilting around a target and allows drag-button configuration or a custom
world-position picker. Cesium's `Camera.lookAt` can place the camera relative
to a target in its local east-north-up frame. These features make a useful
route-centered 3D inspection view possible. They do not establish that
Cesium's standard interaction is equivalent to unconstrained Trackball
rotation with roll; that interaction must be tested in a small prototype
before the camera decision is considered final. See the official [Cesium
controller](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceTiltOrbitCameraController.html)
and [Camera](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#lookAt)
reference.

Use Cesium public picking APIs appropriate to the rendered content. Terrain
ray picking and depth-buffer picking have different requirements and results;
test the chosen method against terrain, imagery-only ellipsoid fallback,
3D Tiles, and line/vertex overlays. See [Globe.pick](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#pick)
and [Scene.pickPosition](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#pickPosition).
Do not couple the editor to private Cesium terrain internals.

### 8.2 Alternative: standalone Three.js editor viewport

Three.js offers convenient generic 3D interaction tools. `Raycaster` can pick
rendered objects, `TransformControls` provides transform gizmos, and
`TrackballControls` permits camera rotation without maintaining a constant
camera-up direction. That can be attractive if the requirement truly means
free roll and arbitrary trackball orientation. The official [Raycaster](https://threejs.org/docs/pages/Raycaster.html),
[TransformControls](https://threejs.org/docs/pages/TransformControls.html),
and [TrackballControls](https://threejs.org/docs/pages/TrackballControls.html)
docs describe these roles.

Three.js does not supply Studio's Cesium globe, terrain provider, imagery,
terrain picking, or GeoJSON geographic camera model. A standalone Three view
would need a separate terrain/mesh source and explicit conversion between
longitude/latitude/elevation and a stable local coordinate frame. It would
also add another WebGL renderer and synchronization boundary. This option is
reasonable if free camera roll, robust generic gizmos, or an isolated authoring
scene is a hard requirement, but it is not automatically simpler for editing
a real GPX route over live terrain.

### 8.3 Alternative: hybrid Cesium terrain with Three.js controls/overlay

A hybrid can keep Cesium terrain while using Three.js interaction tools, but
it must synchronize camera pose, viewport size, depth/picking, coordinate
frames, terrain changes, and pointer events across renderers. If both renderers
draw the same scene, duplicate GPU work and depth mismatch are additional
risks. A hybrid should be considered only after a prototype identifies a
specific interaction that Cesium cannot provide at acceptable quality.

### 8.4 Engine comparison

| Option | Terrain and geographic context | Point editing | Free camera rotation | Cost and risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Existing Cesium scene | Native Studio terrain, imagery, and geographic coordinates | Custom point handles and drag logic | Orbit and tilt are documented; unconstrained roll needs validation | Lowest duplication; must handle Cesium gesture ownership and vertical semantics | **Prototype first; likely V1** |
| Separate Three.js scene | Must build/import a terrain mesh or another terrain source | Raycaster and transform controls are convenient | Trackball supports rotation without fixed camera-up | Local-coordinate conversion, terrain duplication, second renderer and data pipeline | Use if free-roll controls are mandatory or Cesium prototype fails |
| Cesium + Three.js hybrid | Cesium can own terrain, but Three overlay must align with it | Flexible tools, cross-renderer picking is complex | Flexible | Highest synchronization and GPU cost | Defer unless a concrete unmet requirement justifies it |

## 9. Camera ownership and gesture design

The editor temporarily owns map gestures and camera pose while active. It must
capture the prior interactive view and restore it on close, cancellation,
error, and view teardown. The editor must not persist its temporary camera as
the Journey's normal camera, overwrite Replay camera settings, or change global
camera preferences as a side effect.

The main gesture conflict is that left-dragging can mean move a point or orbit
the camera, and right-click is requested for insertion while some map controls
also use right-button drags. Resolve this deliberately. A first prototype
should test an explicit binding such as:

- left-click: select a vertex or route edge;
- left-drag on a selected vertex: move it;
- left-drag on empty terrain: orbit only when a camera modifier is held, or use
  middle-drag for orbit;
- wheel/pinch: zoom;
- right-click on a route edge: show the insertion menu;
- right-click on a point: show the point/selection menu.

This mapping is only a proposal. The final map must be consistent across the
three views, preserve native browser context menus outside the editor surface,
and have keyboard and touch alternatives. Make camera bindings configurable
if testing shows that the default cannot support both point movement and
comfortable 3D navigation.

While the editor is open, normal map rotation/auto-rotation should be paused.
When it closes, restore only the state owned by this editor session and leave
newer camera owners untouched. Follow the application's existing camera
ownership rules in [Replay architecture](../specs/replay-video/CORE-REPLAY-ARCHITECTURE.md).

## 10. Draft state, undo, and performance

Keep a plain, isolated draft of the selected track. Do not create a Valtio
proxy per route vertex. UI selection and active tool state can be reactive, but
high-frequency pointer movement should update a renderer-friendly buffer or
batched draft state rather than publish a whole Journey update on every
pointer event.

- One completed point drag is one undo operation.
- A multi-point delete is one undo operation.
- An inserted point is one undo operation.
- Switching views does not add undo steps or reset selection.
- Undo and redo restore geometry and its aligned supported point data together.
- Apply is a single validated mutation to the canonical Track.
- Cancel discards the draft and its undo history.

For a long track, avoid one expensive Cesium entity per vertex if profiling
shows that it is too slow. Consider batched point primitives, screen-space
decluttering, and only materializing editable handles near the active camera.
These optimizations are display-only: they must not reduce the set of
selectable source vertices or mutate geometry through simplification.

The first renderer should reuse the active Cesium viewer instead of creating a
second Cesium Viewer. Mount only one editor viewport at a time and dispose its
listeners, controllers, and overlay primitives when it closes.

## 11. Accessibility and input alternatives

- Every pointer operation must have a keyboard-accessible equivalent.
- Provide a point list or point details panel so users can select a point
  without pixel-accurate map picking.
- `Ctrl`/`Cmd` toggles selection; `Shift` selects a continuous range.
- `Delete`/`Backspace` deletes the selection after a clear indication of the
  count and affected segments.
- `Escape` cancels the current drag or closes a context menu. It should not
  silently discard the complete draft; closing with unapplied edits requires
  an explicit discard choice.
- Undo and redo should use the platform convention (`Ctrl+Z` / `Cmd+Z` and
  `Ctrl+Shift+Z` / `Cmd+Shift+Z`).
- Selected points need a visible focus indicator, sufficient contrast, and a
  non-color-only selected state.
- Touch users need an explicit **Add point** action or long-press menu because
  right-click does not exist on touch screens.

## 12. Risks and mitigations

| Risk | Why it matters | Proposed mitigation |
| --- | --- | --- |
| Terrain elevation differs from source GPX elevation | A point can jump vertically or acquire false altitude during a horizontal drag | Preserve source height by default; make terrain snap explicit; document the vertical conversion policy |
| Three views use inconsistent editing semantics | A move in one view could appear to undo another view's edit | Share one draft and define per-view axes and invariants before implementation |
| Cesium orbit conflicts with point dragging | Navigation becomes frustrating or points move accidentally | Prototype gesture bindings early; use a drag threshold and distinct camera gesture |
| Route contains many thousands of points | Per-point entities and reactive updates can slow rendering, especially in Edge | Reuse one renderer, batch handles, profile long traces, keep source points selectable |
| Deleting points creates a misleading shortcut | The straight connection may not follow the path the user intended | Preview the connection and report material route-length/shape changes |
| Segment boundaries are lost | GPX gaps can be turned into false continuous movement | Keep segment identity in the draft; prohibit cross-segment selection, insertion, and reconnection |
| Time arrays drift from coordinates | Replay and export attach a time to the wrong point | Normalize to per-segment arrays and update coordinates and times atomically |
| Derived render geometry is edited as source | Smoothing/terrain display can overwrite the user's original GPX values | Draft from canonical source content and keep render transforms separate |
| Camera state leaks into normal map or Replay | Editing can unexpectedly change later map behavior | Use a scoped camera/input lease and restore on every exit path |
| Partial save after invalid edit | Journey metrics and geometry disagree | Validate the complete draft before a single canonical mutation and save |
| Hidden vertices are hard to select | Decluttering can imply that a route has fewer editable points | Keep original point identity and expose point list/numeric selection |

## 13. Proposed implementation sequence

### Phase 0 — Interaction and data spike

- Test Cesium route-centered orbit and tilt with representative GPX traces.
- Prototype point selection, dragging, route-edge insertion, and camera
  gestures in the existing viewer.
- Test the vertical behavior over both flat and steep terrain, including a
  missing terrain surface and 3D Tiles if those are active map sources.
- Test with a track large enough to reveal point-rendering and pointer-latency
  problems.
- Decide whether documented orbit/tilt is enough or whether full camera roll
  is a hard requirement that merits a Three.js prototype.

### Phase 1 — Safe draft editing

- Track selector, view selector, draft, selection, point list, and camera
  restoration.
- Plan-view point movement and numeric coordinate editing.
- Point insertion, deletion, segment rules, and aligned time/elevation edits.
- Undo, redo, Apply, Cancel, and metric refresh.

### Phase 2 — Profile and terrain editing

- Editable altitude profile with explicit missing-elevation treatment.
- Cesium 3D view with route-centered orbit, point movement, and explicit
  terrain snap/altitude adjustment.
- Gesture/accessibility refinement and performance work based on measured
  large-track behavior.

### Phase 3 — Optional advanced corrections

- Along-route profile movement if users need it.
- Explicit interpolation/bridge tool for deleted runs.
- Terrain-relative altitude editing after the vertical-datum model is defined.
- Additional GPX extension editing only after import/export contracts exist.

## 14. Acceptance criteria

The first release should not be considered complete until all of these are
true:

- A Journey with multiple tracks can open one selected Track without changing
  its siblings.
- Switching Plan/Profile/3D retains draft coordinates, selection, and undo
  history while showing only one active viewport.
- Plan drag changes longitude/latitude and leaves elevation/time unchanged by
  default.
- Profile drag changes elevation and leaves horizontal coordinates unchanged
  by default.
- 3D drag changes horizontal position according to the selected altitude
  policy; explicit altitude editing works independently.
- Right-click/keyboard insertion puts a point in the correct segment and
  keeps the time/elevation arrays aligned.
- Deleting a selected run reconnects only within its source segment; boundary
  deletion never creates a new cross-segment edge.
- Undo and redo restore both geometry and point properties.
- Cancel leaves source Journey data and persistence unchanged.
- Apply updates the selected Track once, refreshes dependent metrics/rendering,
  and leaves unrelated tracks, independent POIs, and camera settings intact.
- GPX export/import round-trip keeps segment count, point order, supported
  elevations/times, and documented metadata.
- The editor restores camera and gesture ownership after normal close,
  cancellation, and error.
- The point-selection and editing workflow is usable without a mouse and does
  not depend on color alone.
- Large-trace interaction is measured in supported browsers, including Edge;
  it remains responsive without creating a second Cesium viewer.

## 15. Decisions to validate

The following defaults are recommended for product review; they are not yet
implementation commitments.

| Decision | Recommended default | Other valid choices |
| --- | --- | --- |
| Main engine | Existing Cesium scene for plan and 3D; lightweight profile view | Separate Three.js scene; Cesium/Three hybrid |
| Camera freedom | Cesium orbit and tilt around a route target, validated in Phase 0 | Full trackball roll in Three.js; custom Cesium camera controls |
| Visible layout | One active view selected by Plan/Profile/3D tabs | Split view, explicitly deferred due to cost and user preference |
| Track scope | Edit one selected track at a time | Multi-track coordinated selection, higher complexity |
| Profile horizontal drag | Locked chainage; edit elevation vertically | Explicit along-route editing mode |
| Horizontal drag elevation | Preserve recorded elevation | Preserve terrain offset; snap to terrain |
| Inserted altitude | Interpolate only when both adjacent values exist | Explicit terrain sample or manual numeric value |
| Inserted time | Interpolate only between valid ordered neighbors | Leave new time absent in all cases |
| Delete behavior | Directly connect surviving neighbors and preview the edge | Explicit gap interpolation/router as a later tool |
| Small segment after deletion | Reject partial deletion leaving fewer than two coordinates; offer explicit remove-segment action | Permit one-point segment using a new point-geometry representation |
| Terrain display | Shaded terrain with a route wire and vertex handles | Terrain mesh wireframe as an optional diagnostic overlay |
| Persistence | In-memory draft; one validated Apply; Cancel discards | Autosave each edit, higher risk and weaker rollback |

## 16. References

### Local implementation and design references

- [Journey model](../../src/core/Journey.js)
- [Track metrics and data model](../../src/core/Track.js)
- [Journey GPX import/export](../../src/Utils/JourneyGpxUtils.js)
- [Track rendering utilities](../../src/Utils/cesium/TrackUtils.js)
- [Profile chart](../../src/components/Profile/ProfileChart.jsx)
- [Journey and track map selection proposal](CORE-JOURNEY-CLICK-OVERLAY-SELECTION-SPEC.md)
- [Journey import formats proposal](JOURNEY_IMPORT_FORMATS_SPEC.md)
- [Replay camera ownership architecture](../specs/replay-video/CORE-REPLAY-ARCHITECTURE.md)

### Official engine documentation

- [Cesium `ScreenSpaceTiltOrbitCameraController`](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceTiltOrbitCameraController.html)
- [Cesium `Camera.lookAt`](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#lookAt)
- [Cesium `Globe.pick`](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#pick)
- [Cesium `Scene.pickPosition`](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#pickPosition)
- [Three.js `Raycaster`](https://threejs.org/docs/pages/Raycaster.html)
- [Three.js `TransformControls`](https://threejs.org/docs/pages/TransformControls.html)
- [Three.js `TrackballControls`](https://threejs.org/docs/pages/TrackballControls.html)
