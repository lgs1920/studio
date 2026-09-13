# Non-Distorting Widget Resize Specification

Status: proposed, pending implementation

Target release: `1.0.0`

## Purpose

Provide a generic widget-host capability for resizing a widget by width and
height without applying a non-uniform visual transform to its content.

The feature must distinguish a real layout resize from widget scaling. The
requested behavior is to change the widget dimensions and let the widget
content adapt to the new available box. It must not stretch text, icons,
charts, borders, or other content through `scaleX` or `scaleY`.

## Product scope

The generic host capability is intended for reusable visual widgets. The first
adoption is covered by a separate implementation issue for:

- the Profile widget;
- the Replay Timeline widget.

Other widgets are out of scope for the first adoption and must not change
behavior implicitly.

## Current implementation constraints

The widget host currently exposes two different interaction modes:

- `scalable`, which applies a CSS transform and stores `scale.x` and `scale.y`;
- `resizable`, which changes the rendered `width` and `height`.

The non-distorting feature must use the second mode. The global widget ratio
must not be changed as a side effect because it is also used by existing
widgets and crop-related behavior.

The current container adaptation path can rebuild a uniform scale for visual
widgets. The implementation must ensure that a real resize remains a real
dimension change and is not converted back into a scale during bounds,
rehydration, scene replacement, or board resize handling.

## Proposed host contract

Each adopting widget declares:

- `resizable: true`;
- an explicit resize policy that indicates whether the aspect ratio is locked;
- minimum and maximum width and height constraints;
- responsive content behavior for the resized box.

The host must:

1. expose the existing width, height, and corner handles;
2. pass the ratio policy to Moveable without relying on the global widget ratio;
3. update `config.dimensions` during the gesture and at gesture end;
4. keep the widget position inside the active board bounds;
5. persist width and height independently;
6. restore those dimensions without introducing a scale transform;
7. preserve the behavior of widgets that remain `scalable` or ratio-locked;
8. keep scene, video-board, snapshot, and HQ export composition consistent.

The implementation should use one canonical per-widget property for the ratio
policy. Reusing `ratio.locked` is acceptable only if its meaning remains clear
for both persistence and host interaction. A dedicated `keepRatio` or
`preserveAspectRatio` property may be preferable if the existing ratio object
continues to serve crop and format semantics.

## Profile widget requirements

The Profile widget must use real resizing rather than non-uniform scaling.

- Increasing the width must not stretch the chart or its labels.
- Increasing the height must not stretch the chart or its labels.
- The chart must recalculate or adapt to the available width and height.
- The existing profile ratio editor must remain available where applicable.
- A locked profile ratio must continue to resize proportionally.
- A free profile resize must change width and height independently.
- Persisted dimensions must survive reload, scene replacement, and board resize.
- Snapshot and HQ video output must match the visible resized widget.

## Replay Timeline widget requirements

The Replay Timeline widget must use real resizing rather than non-uniform
scaling.

- Increasing the width must enlarge the timeline layout without stretching its
  typography or controls.
- Increasing the height must preserve readable row and control layout.
- Timeline content must remain inside the widget box and adapt to its size.
- The widget must remain compatible with the existing locked and transient
  lifecycle behavior.
- Its resized dimensions must remain correct after remounting and scene
  preparation transitions.
- The timeline must remain excluded from captured video output where required.

## Persistence and lifecycle

The persisted record must retain independent `width` and `height` values. A
record created by the new behavior must not require `scale.x` or `scale.y` to
reconstruct its visible dimensions.

The following paths require verification:

- initial mount;
- resize start, update, and end;
- bounds constraint handling;
- browser persistence and rehydration;
- scene replacement;
- scene and video-board rendering;
- snapshot capture;
- HQ video export;
- cancellation and cleanup.

## Acceptance criteria

- A widget configured for non-distorting resize changes its layout dimensions,
  not its CSS scale transform.
- Width and height can be changed independently when the ratio is unlocked.
- A locked ratio continues to constrain width and height proportionally.
- The Profile widget is resized without stretching its chart, labels, or
  borders.
- The Replay Timeline widget is resized without stretching its typography or
  controls.
- Width and height are persisted independently and restored accurately.
- Existing scalable widgets keep their current behavior.
- Scene bounds and board resizing do not silently convert the feature to a
  uniform scale.
- Focused automated tests cover both widgets and the generic host contract.

## Out of scope

- Replacing the existing scalable behavior for every widget.
- Introducing a freeform warp or perspective transform.
- Changing the global video format ratio.
- Adding a new keyboard shortcut.
- Making the Replay Timeline editable in time or structure.

## Implementation notes

The implementation should remain centralized in the widget host and widget
manager. Individual widget components should only provide responsive content
and should not duplicate pointer, persistence, bounds, or transform logic.
