# Three.js Camera HPR Orientation Sphere Widget Specification

## Status

**TODO**, target release `Unplanned`. This document defines the interaction contract
for a real 3D Three.js widget. It does not authorize implementation in the
current release.

The implementation must be validated against the current Cesium camera lifecycle,
widget capture path, and product visual language before being scheduled for a
release.

## Visual prototype

The interaction concept is accompanied by a checked-in Three.js prototype. The
prototype is a visual reference for this specification, not a production widget
and not a replacement for Cesium camera state.

<video controls muted playsinline preload="metadata" width="960" poster="../../../artifacts/camera-hpr-sphere-preview/poster.png">
  <source src="../../../artifacts/camera-hpr-sphere-preview/camera-hpr-orientation-sphere-preview.mp4" type="video/mp4">
  <a href="../../../artifacts/camera-hpr-sphere-preview/camera-hpr-orientation-sphere-preview.mp4">Download the camera HPR orientation sphere preview</a>
</video>

If the documentation renderer does not display the embedded player, use the
[camera HPR orientation sphere preview](../../../artifacts/camera-hpr-sphere-preview/camera-hpr-orientation-sphere-preview.mp4)
directly. The video is an 8.1-second, 960 × 640 H.264 MP4 without audio.

### Prototype files

The complete preview is stored under
`artifacts/camera-hpr-sphere-preview/`:

- `camera-hpr-orientation-sphere-preview.mp4`: rendered demonstration video
- `poster.png`: poster image used by the embedded player
- `index.html`: deterministic Three.js visual prototype
- `three.module.js` and `three.core.js`: pinned Three.js `0.180.0` browser
  modules used by the prototype

The prototype files are intentionally separate from the application source.
The production implementation must consume Three.js through the project
package manager and update the dependency inventory before adding a runtime
dependency.

### Viewing the interactive prototype

The HTML preview must be served over HTTP because browser module imports are not
reliably available from a `file://` URL. From the repository root, run:

```bash
python3 -m http.server 8765 --directory artifacts/camera-hpr-sphere-preview
```

Then open:

```text
http://127.0.0.1:8765/index.html?frame=0
```

The `frame` query parameter selects a deterministic preview state. The video
renderer samples the same prototype at 30 logical frames per second and emits
the final MP4 at 10 frames per second.

### Prototype sequence

| Time | Demonstrated behavior |
| --- | --- |
| `0.0 s` | Initial camera attitude at `H 24°`, `P -30°`, `R 0°` |
| `1.2–3.5 s` | Heading and pitch adjustment through the 3D orientation model |
| `3.5–5.7 s` | Roll adjustment through the outer roll ring |
| `5.7–7.9 s` | Return toward North, level roll, and a lower pitch |
| `7.9–8.1 s` | Stable final orientation |

The prototype communicates the intended visual language and interaction zones:

- drag the sphere for heading and pitch
- drag the outer ring for roll
- use `Alt` for a future unconstrained 3D arcball interaction
- read the current HPR values from the compact numeric readout

## Purpose

Provide a compact, interactive 3D orientation sphere that lets a user inspect
and adjust the Cesium camera Heading, Pitch, and Roll (HPR).

The widget must behave as an orientation instrument, not as a second map view:

- the Cesium map remains the authoritative camera view
- Three.js renders only a visual and interaction model of camera orientation
- the widget never owns camera position, target, range, journey playback, or
  replay time
- all saved camera state remains serializable without Three.js objects

## Product goals

The first usable version must allow a user to:

1. understand the current camera attitude at a glance
2. distinguish heading, pitch, and roll visually
3. adjust the camera orientation with direct 3D manipulation
4. make precise corrections with keyboard and numeric controls
5. reset to useful reference orientations without opening a settings panel
6. keep the map, the HPR readout, and the sphere synchronized
7. use the widget safely while the camera is moving or replay is active

The interaction must feel closer to a 3D attitude gizmo or camera orientation
instrument than to a decorative rotating globe.

## Non-goals

The first version must not:

- replace Cesium navigation controls
- edit camera longitude, latitude, altitude, target, or range
- create a second interactive Cesium viewer
- provide a full Three.js scene editor
- change the widget host position by rotating the sphere
- mutate replay camera paths directly
- use Three.js objects as persisted application state
- expose an uncontrolled free-flight camera unrelated to the map camera

## Existing project context

The current project already provides the required camera data and widget host:

- `src/Utils/cesium/CameraUtils.js` derives camera `heading`, `pitch`, and
  `roll` from the active Cesium camera
- `src/components/cesium/CameraAndTargetPanel/CameraAndTargetPanel.jsx`
  already displays live HPR values
- `src/components/MainUI/compass/Compass.jsx` already reacts to camera heading
  and implements a north reset interaction
- `src/components/MainUI/widgets/Widget.jsx` owns widget selection, dragging,
  scaling, persistence, bounds, and capture behavior
- `public/widgets.yaml` is the catalog source of truth for future widget
  registration

The proposed widget must reuse those responsibilities. It must not implement a
second position, scale, drag, crop, or persistence system.

## Proposed widget contract

The following identifiers are provisional and must be validated before catalog
integration.

```yaml
camera-orientation-sphere-widget:
  id: "camera-orientation-sphere-widget"
  name: "Camera Orientation"
  description: "Interactive 3D camera heading, pitch, and roll indicator"
  icon: "cube"
  mandatory: false
  max: 1
  component: "CameraOrientationSphereWidget"
  type: "lgs-visual-widget"
  path: "@Components/CameraOrientationSphere"
  groups:
    - "scene-widgets"
  configuration:
    default:
      mode: "control"
      visible: true
      showLabels: true
      showValues: true
      showAxes: true
      showHorizon: true
      showCameraMarker: true
      showRollRing: true
      interactionSensitivity: 1
      pitchMin: -89
      pitchMax: 30
      rollMin: -180
      rollMax: 180
      preserveRollOnPitchHeadingDrag: true
      liveApply: true
    user:
    elements:
```

### Widget capabilities

| Capability | First version | Notes |
| --- | --- | --- |
| Scene board | Yes | Primary use case |
| Video board | Later | Read-only display until capture is validated |
| Dynamic | Yes | Follows the active Cesium camera |
| Repeatable | No | One orientation controller per scene |
| Mandatory | No | User can remove it |
| Movable | Yes | Host-managed widget position |
| Scalable | Yes | Host-managed widget scale |
| Rotatable as a widget | No | The Three.js sphere contains orientation rotation |
| Resizable | Prefer host scale | Avoid a second resize model in the first version |
| Lockable | Yes | Standard widget host behavior |
| Persisted | Yes | Persist geometry and user display preferences only |
| Captured in video | Opt-in later | Controls must never appear in final output |

The widget's internal sphere rotation is not the widget host rotation. The host
rotation must remain disabled so a user cannot confuse layout rotation with
camera roll.

## Two operating modes

### Control mode

Control mode is the default scene-board mode.

- The sphere follows the live Cesium camera.
- Pointer, touch, keyboard, and numeric interactions can change HPR.
- The widget is an editor/control surface and is not included in video output.
- The widget may temporarily show interaction highlights and helper overlays.

### Display mode

Display mode is a future read-only mode for scene or video composition.

- The sphere follows the live or replay camera.
- Pointer gestures do not change the camera.
- No selection handles, hover affordances, focus rings, or helper overlays are
  included in captured output.
- Values are updated from the deterministic replay frame during HQ export.

Control and display modes must share the same Three.js visual model. Only the
interaction layer and capture policy differ.

## Orientation terminology and coordinate frame

The orientation is expressed as HPR in degrees in the user interface:

- **Heading** is the horizontal camera direction. `0°` is North and values are
  normalized to `[0°, 360°)`.
- **Pitch** is the vertical camera angle. `0°` is the horizon. Cesium's normal
  map-camera convention uses negative values for looking downward.
- **Roll** is the camera bank around its viewing direction. `0°` means the
  camera horizon is level.

Cesium defines heading, pitch, and roll relative to the local East, North, and
Up frame. The sphere must make this frame visible through stable labels and
axes. The implementation must not silently treat HPR as arbitrary global XYZ
Euler angles.

The UI must show the active convention in a tooltip or help popover:

```text
Heading: horizontal direction around local Up
Pitch: view angle above or below the horizon
Roll: rotation around the camera viewing direction
Reference frame: local East / North / Up
```

## Three.js scene design

The widget must render a true Three.js scene in an internal canvas.

### Scene graph

The minimum scene graph is:

```text
Scene
├── lighting
├── referenceFrameGroup
│   ├── orientationSphere
│   │   ├── sphereSurface
│   │   ├── latitudeLines
│   │   ├── longitudeLines
│   │   ├── horizonRing
│   │   └── cardinalMarkers
│   ├── cameraDirectionMarker
│   └── localAxes
├── rollRing
└── interactionOverlay
```

`referenceFrameGroup` is the only group whose quaternion represents the active
camera attitude. The Three.js render camera remains fixed relative to the
widget. This makes the attitude change obvious and prevents the display from
looking like the user is merely orbiting a free camera around a static globe.

### Required Three.js objects

- `THREE.Scene`
- `THREE.WebGLRenderer` with alpha and antialiasing enabled
- one fixed `THREE.PerspectiveCamera` for the widget viewport
- one `THREE.Group` for the orientation frame
- one `THREE.SphereGeometry` for the main sphere
- line geometry for latitude, longitude, equator, and horizon references
- a visible camera direction marker, such as a cone, arrow, or small frustum
- a distinct roll ring around the sphere
- a `THREE.Raycaster` for hit testing
- pointer capture on the canvas during active gestures

The first implementation must not create a second Cesium renderer. Three.js is
responsible only for the compact orientation instrument.

### Camera and rendering defaults

The initial renderer contract should be:

- transparent background so the existing widget theme remains visible
- device-pixel-ratio capped to a configurable value, initially `2`
- fixed perspective camera with a narrow field of view
- depth testing enabled for the sphere and axes
- front-facing labels or HTML labels kept outside the rotating geometry when
  readability requires it
- no continuous animation loop when the camera and interaction state are idle
- render on camera changes, widget resize, pointer movement, and animation
  transitions only

The widget must call `renderer.dispose()` and release geometries, materials,
textures, and event listeners on unmount or scene replacement.

### Visual hierarchy

The following hierarchy is mandatory:

1. camera direction marker
2. horizon and equator
3. cardinal labels and local axes
4. sphere surface and secondary grid
5. subtle lighting and shadow cues

The camera marker must remain legible on dark and light map backgrounds. The
widget must provide theme-resolved colors rather than hard-coded colors for all
user-configurable visual parts.

## Visual anatomy

### Sphere surface

The sphere represents the orientation reference, not the Earth's geographic
surface. It should use a restrained technical material with:

- a visible front hemisphere
- a lower-contrast rear hemisphere
- latitude and longitude lines
- a clearly visible equator
- a horizon reference plane or band
- optional transparent wireframe mode for small widget sizes

The sphere must not imply that its texture is a geographic map unless a future
product decision explicitly adds a globe texture.

### Local axes

The widget must show a compact axis triad or axis labels:

- `N` or a north arrow for heading reference
- `E` for the local east axis
- `U` for local up

Axis colors must be stable and must not be reused for unrelated UI states.
The axis triad must rotate with the orientation reference while its labels
remain readable.

### Camera marker

The camera marker represents the camera's forward direction and up direction.
It must make all three degrees of freedom understandable:

- the nose or arrow shows viewing direction
- the top bar or wings show camera up
- the marker bank shows roll

When the camera is aimed downward, the marker must remain visible in front of
the sphere. Depth bias or a small controlled offset may be used to avoid
z-fighting.

### Roll ring

The roll ring is an explicit interaction affordance around the sphere.

- tick marks appear at `0°`, `±45°`, `±90°`, and `180°`
- the current roll marker is visually distinct
- the ring remains available even when the sphere is near a pole
- the ring is hidden only when `showRollRing` is false

The ring is also the primary way to perform intentional roll changes. Interior
sphere drags must not introduce accidental roll when the default configuration
preserves roll.

### Numeric readout

The readout must show:

```text
H 123.4°   P -35.0°   R 4.2°
```

Values must update continuously during a gesture and must use the same source
as the camera panel. The readout must not display a predicted value after a
camera update has failed.

## Interaction model

### Interaction principles

- The map camera remains authoritative after every committed update.
- The sphere is always synchronized before a new gesture starts.
- A gesture starts from a quaternion snapshot, not from stale HPR text.
- All pointer gestures use pointer capture.
- The host widget drag must never start from an interactive Three.js surface.
- Interaction controls must use `lgs-widget-no-drag`.
- The user must be able to cancel an active gesture and restore its starting
  orientation.
- Every interaction must provide visible feedback before the map changes.

### Interaction regions

The widget has four semantic regions:

| Region | Primary action |
| --- | --- |
| Sphere interior | Adjust heading and pitch |
| Sphere edge | Adjust heading and pitch with stronger trackball response |
| Roll ring | Adjust roll |
| Numeric readout | Focusable exact-value controls |

The active region must be exposed to assistive technology with an accessible
name and state. The entire canvas must not be exposed as an unlabeled generic
image.

## Pointer interaction

### Starting a sphere drag

On primary pointer down inside the sphere:

1. prevent host widget dragging
2. focus the widget interaction surface
3. capture the pointer
4. read the latest camera quaternion and HPR
5. store the gesture start point and start orientation
6. set interaction state to `adjusting-orientation`
7. highlight the heading and pitch guides
8. render the preview immediately

The current camera state must be read at gesture start even if the widget was
already synchronized a frame earlier. This prevents an external map drag from
being overwritten by a stale gesture baseline.

### Interior drag mapping

The default interior drag uses an arcball-style 3D mapping:

- pointer coordinates are normalized into the sphere viewport
- the point is projected onto a virtual unit sphere
- the start and current points produce a delta quaternion
- the delta is applied to the gesture-start quaternion
- roll is preserved unless free-roll mode is explicitly enabled

The constrained default prevents an ordinary left/right or up/down drag from
unexpectedly banking the camera. The mapping must still feel three-dimensional:

- horizontal movement primarily changes heading
- vertical movement primarily changes pitch
- diagonal movement combines both
- movement near the sphere edge provides stronger rotational feedback

The implementation must not repeatedly convert the current quaternion to HPR,
apply Euler deltas, and convert back. That approach causes drift and gimbal
artifacts.

### Free 3D rotation

Free 3D rotation is an explicit advanced interaction:

- hold `Alt` while dragging the sphere, or enable the “Free 3D rotation” mode
  in the widget menu
- the full arcball delta is applied, including roll
- the current axis and roll indicator remain visible during the gesture

Free 3D rotation is optional for the first release if constrained interior
interaction and the roll ring are sufficient. The data model must leave room
for it.

### Roll ring drag

On pointer down over the roll ring:

1. prevent host widget dragging
2. capture the pointer
3. compute the pointer angle around the sphere center
4. store the initial ring angle and starting roll
5. update roll from the shortest angular delta
6. clamp or wrap according to the configured roll policy

The ring must support crossing the `-180°` / `180°` boundary without a visible
jump. Pointer movement must use `Math.atan2` and an unwrapped accumulated angle.

### Pointer move and render cadence

During an active gesture:

- update the preview state on every pointer move
- coalesce Three.js rendering through `requestAnimationFrame`
- send camera updates at most once per animation frame
- avoid starting a network request, database write, or React state cascade for
  each raw pointer event
- keep the readout responsive even when Cesium is rendering heavily

The camera update path must expose whether the latest update is pending,
accepted, rejected, or superseded. A superseded update must not overwrite a
newer orientation.

### Pointer up

On pointer up or `pointercancel`:

- release pointer capture
- end the gesture
- commit the final normalized quaternion/HPR through the camera controller
- persist only the supported camera state through existing camera persistence
  rules
- remove temporary guides and hover highlights
- keep the final sphere state synchronized with the map camera

If the final camera update fails, the widget must resynchronize from Cesium and
show a non-blocking error state. It must not leave a speculative orientation in
the sphere.

## Touch interaction

Touch interaction must use `touch-action: none` on the Three.js canvas while it
is interactive.

### One-finger drag

One-finger drag follows the same constrained sphere interaction as a primary
mouse drag.

### Two-finger interaction

The first version may support the following two-finger gestures:

- two-finger vertical movement adjusts pitch
- two-finger twist adjusts roll

Pinch must not change the Cesium camera range. The widget is an orientation
controller, and changing range from a small overlay would be surprising.

If two-finger support is not implemented initially, the widget must ignore the
gesture without forwarding it to the map.

## Wheel interaction

The wheel is captured only while the pointer is over the sphere or roll ring.

- wheel up/down changes pitch by a small default step
- `Shift` changes by a coarse step
- `Ctrl` changes by a fine step
- wheel never changes camera range
- wheel events must not zoom the Cesium map while the widget is focused

The step values must be configurable in code and covered by tests. A future
release may replace wheel pitch with a user preference, but the initial
behavior must remain deterministic.

## Click actions and quick orientations

The following actions are available as buttons or menu actions, not hidden
gestures:

| Action | Result |
| --- | --- |
| North | Heading `0°`, preserve current pitch, set roll `0°` |
| East | Heading `90°`, preserve current pitch, set roll `0°` |
| South | Heading `180°`, preserve current pitch, set roll `0°` |
| West | Heading `270°`, preserve current pitch, set roll `0°` |
| Horizon | Preserve heading, set pitch `0°`, set roll `0°` |
| Top-down | Preserve heading, set pitch to the safe top-down value, set roll `0°` |
| Level camera | Preserve heading and pitch, set roll `0°` |
| Reset | Restore the camera orientation captured when the menu action opened |

The existing Compass behavior of resetting heading to North is a useful
precedent, but the orientation sphere must make the affected axes explicit
before applying the action.

Double-clicking the sphere must not perform a hidden destructive action in the
first version. If a double-click shortcut is later introduced, it must be added
to the shortcuts catalog and documented before implementation.

## Keyboard interaction

The widget must expose a focusable interaction surface. Keyboard interaction is
local to the focused widget and must not introduce an undocumented global
shortcut.

### Default key mapping

| Key | Action | Default step |
| --- | --- | --- |
| Left / Right | Heading | `1°` |
| Up / Down | Pitch | `1°` |
| `Q` / `E` | Roll left / right | `1°` |
| `Shift` + direction | Coarse adjustment | `10°` |
| `Alt` + direction | Fine adjustment | `0.1°` |
| `N` | North | Quick orientation |
| `H` | Horizon | Quick orientation |
| `L` | Level camera | Quick orientation |
| `R` | Reset gesture/session baseline | Context-dependent |
| `Escape` | Cancel active gesture | No camera commit |

The implementation must update the dedicated shortcuts documentation before
shipping any persistent key binding. Arrow keys must not move the host widget
when the orientation surface or a numeric field has focus.

## Numeric editing

The numeric readout must provide an accessible exact-value path. It may be
implemented as three compact Web Awesome inputs or as a popover opened from the
readout.

### Fields

- Heading: `0` to `<360°`, wrapping allowed
- Pitch: configured `pitchMin` to `pitchMax`
- Roll: configured range, normally `-180°` to `180°`

### Commit behavior

- input changes preview the value locally
- Enter commits the value to the camera
- Tab commits the current field and focuses the next field
- Escape restores the field's last committed value
- invalid values remain visible as validation errors and are not sent to Cesium
- blur commits only if the value is valid

Numeric changes must use the same quaternion-to-camera pipeline as pointer
gestures. They must not write directly to a Valtio store while bypassing the
camera manager.

## Camera synchronization contract

### Source of truth

The active Cesium camera is the source of truth for display. The widget may
maintain a transient gesture state, but it must not become a second authority.

The synchronization flow is:

```text
Cesium camera changed
    -> camera orientation controller reads quaternion/HPR
    -> Valtio/UI snapshot is updated through existing camera utilities
    -> widget applies quaternion to referenceFrameGroup
    -> Three.js renders the new attitude
```

The interaction flow is:

```text
User gesture
    -> Three.js computes a delta quaternion
    -> controller converts the proposed orientation to Cesium-compatible HPR
    -> controller applies orientation while preserving position/target/range
    -> Cesium camera changed event fires
    -> widget resynchronizes from Cesium
```

### Proposed controller boundary

The component should communicate through a dedicated controller boundary rather
than writing camera internals directly:

```js
const result = await cameraOrientationController.applyQuaternion(nextQuaternion, {
  source: 'camera-orientation-sphere',
  preservePosition: true,
  preserveTarget: true,
  preserveRange: true,
})
```

The controller must:

1. reject updates while the camera is unavailable or the scene is not 3D
2. preserve camera position, target, and range
3. use the existing Cesium camera manager/focus conventions
4. normalize heading and roll at the Cesium boundary
5. clamp pitch before applying it
6. serialize only validated degrees/radians as appropriate for existing APIs
7. return a version or sequence number so stale updates cannot win
8. allow replay and camera-flight locks to reject user changes explicitly

The component must not call `camera.setView` in multiple event handlers with
duplicated conversion logic.

### External camera changes

If the user drags the map, activates a POI, starts an orbit, starts panorama
movement, or advances replay while the sphere is idle:

- cancel any stale preview state
- update the sphere from the new Cesium orientation
- update numeric values
- remove stale interaction guides

If an external camera change occurs during a sphere gesture, the current gesture
must be cancelled unless the controller can safely merge the change. The safe
default is cancellation with a fresh read from Cesium.

## Quaternion and HPR rules

The implementation must use quaternions internally for all continuous
interaction.

### Required rules

- capture a gesture-start quaternion
- compose deltas with explicit multiplication order
- never accumulate by repeatedly modifying displayed Euler angles
- convert to HPR only for Cesium application and numeric display
- normalize every quaternion before rendering or applying it
- use shortest-path interpolation for animated transitions
- preserve a stable local ENU reference frame

### Gimbal lock policy

Near a top-down pitch, heading and roll can become visually or mathematically
ambiguous. The widget must make that limitation explicit:

- show a subtle “Heading and roll are coupled near top-down” hint when the
  pitch is within a configurable threshold of the pole
- keep the quaternion as the authoritative transient representation
- avoid pretending that two independently edited Euler values are independent
  when they are not
- use the roll ring to preserve intentional banking when possible
- offer the `Level camera` action as a recovery path

The application must not silently rewrite the user's roll merely because the
display crossed the top-down singularity. Any normalization choice must be
covered by unit tests.

## Animation behavior

Quick orientation actions may animate the sphere and Cesium camera together.

- default duration: short and configurable
- use quaternion slerp for the sphere preview
- use the existing camera flight/focus conventions for Cesium
- disable competing pointer gestures during the animation
- allow Escape to cancel the animation
- resynchronize from Cesium after completion or cancellation

The widget must not run an independent timer to simulate camera movement during
replay. Replay time remains owned by the replay controller.

## Loading, unavailable, and error states

### Loading state

Before the Cesium scene and camera are ready:

- render the stable widget shell
- render a neutral Three.js sphere or skeleton
- show `Camera orientation unavailable` as an accessible status
- do not enable camera-changing gestures

### Unsupported state

When the scene is 2D or the camera orientation cannot be represented:

- keep the widget mounted if the host expects it
- disable orientation controls
- show the reason in a tooltip/status text
- do not emit fallback HPR values as if they were real 3D orientation

### Error state

When a camera update is rejected:

- restore the last Cesium-confirmed quaternion
- keep the widget geometry and position intact
- show a non-blocking error message
- allow retry after the camera becomes available

## Widget host and capture behavior

The Three.js canvas is widget content. The existing widget host owns:

- selection
- move
- scale
- lock
- z-index
- bounds
- persistence
- scene replacement
- widget-to-canvas capture

The widget must not duplicate these behaviors.

### Drag exclusion

The following elements must use `lgs-widget-no-drag`:

- Three.js canvas wrapper
- roll ring interaction wrapper
- numeric controls
- quick orientation buttons
- mode switches
- help and reset controls

### Scene board

Control mode is available on the scene board and follows the live Cesium camera.
The widget must survive camera replacement and scene remounting without stale
Three.js listeners or renderers.

### Video board and capture

The first implementation must not expose interactive controls in a captured
video. A later display mode may be available on the video board if all of the
following are true:

- the output is deterministic for snapshots and HQ export
- interaction handles are removed from the captured subtree
- the Three.js canvas can be copied by the existing widget composer
- DPR and renderer dimensions are synchronized with the output resolution
- replay frame updates drive the displayed quaternion
- export cancellation disposes temporary resources correctly

The final video must never capture pointer cursors, hover states, focus rings,
selection borders, numeric input carets, or debug axes.

## Responsive behavior

The widget must remain useful from its minimum supported size to its maximum
host scale.

### Large size

- sphere, roll ring, axes, labels, and numeric readout are visible
- helper text may be shown

### Medium size

- sphere and roll ring remain visible
- helper text is hidden
- numeric readout remains compact

### Small size

- sphere remains the primary visual
- labels may reduce to `N`, `E`, and `U`
- numeric values may move to a tooltip or compact footer
- interaction hit areas must not become smaller than the accessible minimum

The Three.js renderer must resize from the logical widget content dimensions,
not from a transformed `DOMRect` that includes host scale.

## Accessibility

The widget must not depend on visual 3D cues alone.

- accessible name: `Camera orientation`
- accessible description: `Interactive Heading, Pitch, and Roll controller`
- canvas has a clear role and a status relationship to the numeric readout
- current values are available as text, not only as rendered pixels
- all actions have keyboard equivalents or accessible buttons
- roll ring has an accessible label and current value
- disabled states explain why interaction is unavailable
- focus remains visible without being included in video output
- color is never the only distinction between heading, pitch, roll, and axes
- reduced-motion preferences disable or shorten animated transitions

## Configuration and persistence

Persist only configuration that belongs to the widget:

- display mode
- visibility of labels, axes, horizon, values, and roll ring
- interaction sensitivity
- approved display colors and opacity
- widget host geometry through the existing widget manager

Do not persist:

- Three.js scenes, cameras, geometries, materials, textures, or quaternions
- transient pointer state
- pending update sequence numbers
- hover, focus, or error state
- a camera orientation snapshot unless a separate camera-preset feature is
  explicitly introduced

Configuration must use the standard resolution order:

1. `configuration.elements[instanceId]`
2. `configuration.user`
3. `configuration.default`

## Proposed component boundaries

The future implementation should keep responsibilities separated:

```text
CameraOrientationSphereWidget.jsx
    host integration and lifecycle

CameraOrientationSphere.jsx
    Three.js scene creation, render loop, scene updates

CameraOrientationSphereInteraction.js
    pointer, touch, wheel, keyboard, hit regions, gesture state

CameraOrientationMath.js
    ENU frame, quaternion composition, arcball projection, HPR conversion

CameraOrientationController.js
    Cesium application, synchronization, update sequencing, rejection policy

CameraOrientationSphereEditor.jsx
    Web Awesome configuration controls

CameraOrientationSpherePreview.jsx
    stable editor preview without live camera mutation
```

No component may make a second copy of the camera conversion or persistence
rules.

## Interaction state machine

The interaction state must be explicit:

```text
unavailable
    -> idle
idle
    -> hovering
    -> adjusting-orientation
    -> editing-value
    -> animating
    -> error

adjusting-orientation
    -> idle              pointerup and successful sync
    -> idle              Escape or pointercancel
    -> error             rejected camera update

editing-value
    -> idle              valid commit
    -> editing-value    invalid value
    -> idle              Escape restore

animating
    -> idle              completed and resynchronized
    -> idle              cancelled and resynchronized
```

State transitions must clean up pointer capture, pending animation frames,
temporary guides, and update subscriptions.

## Performance requirements

- cap the renderer pixel ratio
- avoid React rerenders for every raw pointer event
- use mutable Three.js objects for visual updates
- render through a single coalesced animation frame
- avoid per-frame geometry allocation
- reuse materials and line geometries
- dispose all resources at unmount
- suspend rendering when the widget is hidden and not needed for capture
- keep the normal idle cost close to zero

The widget must remain responsive while Cesium is rendering terrain, 3D Tiles,
or replay overlays.

## Testing requirements

### Unit tests

Cover:

- degree normalization and wrapping
- pitch and roll clamping
- arcball point projection
- quaternion delta composition order
- ring angle unwrapping across `-180°` / `180°`
- quaternion-to-HPR conversion near normal attitudes
- gimbal-lock warning threshold
- keyboard step modifiers
- invalid numeric values
- stale update sequence rejection

### Component tests

Cover:

- widget renders a Three.js canvas when the scene is available
- unavailable and 2D states disable interaction
- camera changes update the sphere and readout
- interior drag changes heading and pitch
- default interior drag preserves roll
- roll ring changes only roll
- Escape cancels a gesture
- pointer capture is released on pointerup and pointercancel
- numeric edits use the same controller path
- host dragging does not start from the Three.js surface
- keyboard focus prevents host keyboard movement

### Integration tests

Cover:

- scene board mount and unmount
- scene replacement without stale renderer/listeners
- map drag followed by sphere drag uses the newest camera baseline
- orbit and panorama movement update the sphere
- camera-flight locks reject or defer updates consistently
- widget removal disposes Three.js resources
- widget position and scale persist through the normal manager
- hidden control widget does not appear in video capture
- future display mode remains deterministic in snapshot and HQ export

### Manual acceptance tests

1. Open a 3D scene and confirm the sphere matches the camera HPR values.
2. Drag horizontally and confirm heading changes without unexpected roll.
3. Drag vertically and confirm pitch changes without changing camera position.
4. Drag the roll ring and confirm only roll changes.
5. Rotate through the `0°` heading boundary and confirm no jump.
6. Rotate through the `-180°` / `180°` roll boundary and confirm no jump.
7. Move the Cesium map externally and confirm the sphere resynchronizes.
8. Test top-down pitch and confirm the coupling hint appears.
9. Cancel a gesture with Escape and confirm the original camera orientation is
   restored.
10. Resize and scale the host widget and confirm the Three.js viewport remains
    crisp and correctly fitted.
11. Remove and re-add the widget and confirm no stale render loop remains.
12. Enter video capture and confirm control surfaces are absent from output.

## External references

- [Cesium camera controls](https://cesium.com/learn/cesiumjs-learn/cesiumjs-camera/)
- [Cesium Camera API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html)
- [Three.js TrackballControls](https://threejs.org/docs/pages/TrackballControls.html)
- [Three.js Camera documentation](https://threejs.org/docs/pages/Camera.html)
- [Babylon.js editor gizmos](https://editor.babylonjs.com/documentation/basics/composing-scene)
- [Cesium discussion of heading and roll coupling](https://community.cesium.com/t/camera-heading-roll/4124)

These references are interaction and coordinate-system references. They are not
implementation dependencies except for the approved future Three.js package.

## Implementation checklist

- [ ] Validate the widget name, catalog ID, and first-release availability
- [ ] Validate constrained interior drag versus free arcball rotation
- [ ] Validate the pitch and roll ranges for normal map navigation
- [ ] Decide whether the roll ring is always visible or mode-dependent
- [ ] Decide whether numeric fields are inline or popover-based
- [ ] Add the approved Three.js dependency and dependency inventory entry
- [ ] Define the camera orientation controller boundary
- [ ] Implement quaternion math tests before visual interaction
- [ ] Implement the Three.js scene with deterministic disposal
- [ ] Integrate the widget host without duplicating geometry behavior
- [ ] Add the keyboard bindings to the shortcuts documentation
- [ ] Add scene-board integration tests
- [ ] Validate capture and HQ export before enabling display mode
- [ ] Update this document into a current implementation specification after
      the feature is released
