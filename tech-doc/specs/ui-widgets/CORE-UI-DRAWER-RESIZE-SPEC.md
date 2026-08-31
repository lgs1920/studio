# Resizable Side Drawers

## Status

IMPLEMENTED in release `1.0.0`, delivered by issue [#507](https://github.com/lgs1920/studio/issues/507).

## Context

LGS1920 Studio renders its non-modal drawers in the shared `#drawer-root` surface.
Web Awesome controls the side-drawer panel size through the `--size` custom
property. The current desktop default is `28rem`, inherited from
`--lgs-vertical-panel-width` and `--lgs-width-unit`.

Some drawer content, especially Replay and editor panels, can be too narrow for
comfortable use. Users need to enlarge a side drawer temporarily without
changing the map or the surrounding application layout.

## Goals

- Allow a desktop side drawer to be resized horizontally with a pointer.
- Keep the resize interaction independent from the drawer layout geometry.
- Support both precise resizing and a deliberate fast expansion to the maximum.
- Enforce explicit minimum and maximum widths.
- Preserve the existing drawer opening, stacking, placement, and closing behavior.
- Provide an equivalent keyboard interaction and an accessible resize control.
- Keep mobile drawer behavior unchanged.

## Non-goals

- Do not resize top or bottom drawers in this iteration.
- Do not change the map layout or reserve a permanent gutter for the resize control.
- Do not add a new component library or replace Web Awesome drawers.
- Do not persist the selected width across browser sessions unless a separate
  persistence decision is approved.

## User interaction

### Resize handle

Each opted-in desktop side drawer exposes a `5px` pointer target on its inner
edge. The target is an overlay inside the drawer's top-layer dialog and must
not contribute to layout sizing. It must not add
padding, margin, border, or content width to the drawer.

The pointer target uses a `grab` cursor when idle and `grabbing` during a drag.
A small background indicator appears on hover or focus, but the drawer remains
visually unchanged when the control is idle.

### Precise drag

A slow or normal drag changes the drawer width continuously and proportionally
to the pointer movement. The width is clamped between the configured minimum
and maximum values. Pointer capture keeps the interaction active if the pointer
leaves the handle during the drag.

The implementation must prevent accidental text selection and must restore the
normal document cursor and pointer behavior when the interaction ends or is
cancelled.

### Fast expansion

A deliberate fast outward gesture may expand the drawer to its maximum width.
The gesture must require all of the following:

- movement in the outward direction;
- a minimum travelled distance;
- a minimum movement speed over a short gesture window; and
- pointer release while the gesture is still directed outward.

The fast gesture must animate to the maximum width and must not trigger from a
small accidental pointer movement. A normal slow drag always takes precedence
and remains precise.

### Reset

A double-click on the resize handle toggles the drawer between its minimum and
maximum widths. The minimum width is the drawer's initial width (`28rem`,
`448px`) in the shared policy.
The reset must respect the available viewport width and must not exceed the
configured bounds.

### Keyboard

The resize handle must be focusable and expose a vertical separator semantics.
Keyboard users must be able to:

- use the horizontal arrow keys for small width changes;
- use `Shift` plus an arrow key for larger width changes;
- use `Home` to move to the minimum width; and
- use `End` to move to the maximum width.

The focused handle must have a visible focus indicator. Its accessible name
must identify the drawer being resized, and its current, minimum, and maximum
values must be exposed to assistive technology.

## Width policy

The initial desktop policy is:

- default width: the existing `28rem` value;
- minimum width: the default initial width, `28rem` (`448px`);
- maximum width: the smaller of `70vw` and `45rem` (`720px`).

The effective maximum must never be lower than the effective minimum. The
available viewport must be taken into account before applying the final width.
The policy may later support drawer-specific overrides, but the first
implementation should use one shared policy unless a drawer has a documented
content requirement.

On mobile devices, the resize handle is disabled and the current full-width or
mobile drawer sizing rules remain authoritative. Portrait bottom-drawer
behavior must remain unchanged.

## Technical direction

- Keep the shared drawer width controlled through Web Awesome's `--size`
  property.
- Expose an explicit opt-in `resize={true|false}` prop on the generic
  `WaDrawerNonModal` wrapper. The default must be `false`, so existing drawers
  keep their current behavior until they opt in.
- Expose an optional `resizeMax` prop for drawer-specific maximums. It accepts
  pixels or viewport dimensions such as `80vh`, `80vw`, or `640px`. When
  omitted, the shared maximum policy applies; a custom maximum remains
  constrained by the available viewport width.
- Add the resize interaction at the shared drawer wrapper level so individual
  drawers do not duplicate pointer logic.
- Web Awesome renders the internal dialog in the browser top layer. Therefore,
  render the handle inside that dialog (through a portal) so it remains above
  the backdrop and receives pointer input.
- Position the handle as an absolutely positioned overlay inside the dialog so
  its hit area does not alter the drawer's computed geometry.
- Use pointer events rather than mouse-only events so the same interaction can
  support compatible touch and pen input.
- Keep the current drawer identity and stacking state in `PanelManager` intact.
- Do not put transient drag state in the persisted application stores.

## Acceptance criteria

- A desktop side drawer can be widened and narrowed with a pointer.
- The handle does not change the drawer's initial or resized geometry by adding
  layout space.
- Width never falls below `448px` or exceeds `min(70vw, configured maximum)`.
- A configured `resizeMax` overrides the shared maximum for that drawer only.
- Slow dragging provides precise continuous resizing.
- A qualifying fast outward gesture animates to the maximum width.
- Double-clicking the handle toggles between the minimum and maximum widths.
- Left- and right-side drawers apply the correct resize direction.
- The handle is keyboard accessible with visible focus and the defined keys.
- Mobile drawers do not expose the desktop resize interaction.
- Existing drawer opening, closing, stacking, tab navigation, and focus
  restoration continue to work.
- The generic drawer exposes `resize`, defaults to `false`, and does not pass
  these implementation-only props to the underlying Web Awesome element.
- The Journey Track Editor explicitly opts in with `resize={true}` and uses a
  drawer-specific `resizeMax` of `80vw` for validation.
- Tests cover pointer dragging, clamping, fast expansion, reset, keyboard
  interaction, placement direction, mobile behavior, and cleanup.

## Implementation plan

1. Define the shared drawer resize policy and identify the common drawer surface
   used by `#drawer-root`.
2. Add the non-layout resize handle and pointer lifecycle handling for left and
   right placements.
3. Apply the clamped width to the existing Web Awesome `--size` property.
4. Add fast-gesture detection, animated expansion, and double-click reset.
5. Add keyboard semantics, focus styling, and reduced-motion-safe animation.
6. Add focused unit and interaction tests for the acceptance criteria.
7. Keep this document aligned with the implemented drawer behavior.
