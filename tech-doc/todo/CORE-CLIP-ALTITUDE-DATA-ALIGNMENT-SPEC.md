# Clip Altitude Data Alignment

## Status

**TODO** for target release `1.1.0`.

## Context

Replay clips can be chained to create a continuous camera sequence. A clip may
start at the end altitude of the previous clip, or at the replay altitude when
it is the first clip in a sequence. Today, clip altitude fields are configured
with static limits and the clip editor does not expose the upstream altitude
used to establish continuity.

This makes sequential clip creation difficult and allows a later reorder to
produce an altitude jump that was not present when the clips were initially
created.

The referenced UI entry point is
`src/components/JourneyReplay/JourneyReplayClipsTab.jsx`. Clip normalization and
runtime data handling are implemented in
`src/core/ui/replay/JourneyReplayClips.js`.

## Goals

- Make the upstream altitude reference visible while creating or editing a
  clip.
- Prevent impossible altitude boundaries when a clip is created after an
  existing clip.
- Detect continuity breaks immediately after a clip is reordered or edited.
- Keep editing possible when a continuity break is detected.
- Store and manipulate clip altitudes as absolute values.
- Resolve configured offsets before connection calculations and never expose
  relative values through the clip data model.

## Non-goals

- Automatically reordering clips to repair a discontinuity.
- Automatically changing a user-entered altitude after a clip has been created.
- Blocking persistence, preview, or export because of a warning.
- Changing the physical camera interpolation performed by the replay runtime.
- Introducing a new user-configurable tolerance in this milestone.

## Terminology

- **Upstream element**: the previous clip in the same ordered sequence, or the
  replay endpoint when no previous clip exists.
- **Upstream exit altitude**: the absolute altitude at which the upstream
  element ends.
- **Clip entry altitude**: the absolute altitude at which the current clip
  starts.
- **Configured offset**: an existing altitude offset applied by replay or clip
  configuration. It is resolved before a value is exposed to the clip editor
  or used in continuity validation.
- **Continuity**: the relationship between a clip entry altitude and the
  upstream exit altitude according to the direction and semantics of the clip
  definition.

## Functional requirements

### 1. Clip creation

When a new clip is initialized, the editor must resolve its upstream context
from the current ordered list.

For a clip with an upstream element:

1. Read the upstream element's absolute exit altitude.
2. Resolve the configured offset exactly once at this boundary.
3. Display the resulting absolute altitude as the upstream reference.
4. Derive the altitude input boundary from the clip direction/type.
5. Lock the input boundary so the user cannot create a value that violates the
   physical connection rule.

The boundary must be dynamic. A minimum boundary is required for clips that
move upward from the upstream altitude; a maximum boundary is required for
clips that move downward. The exact direction must be provided by the clip
definition rather than inferred from localized labels.

For the first `start` clip, when no upstream element exists:

- Do not display an upstream reference.
- Do not add a continuity-derived minimum or maximum.
- Preserve the static field constraints declared by the clip definition.

The same resolution rules apply when a clip is inserted between existing
clips. The following clips must be re-evaluated after insertion.

### 2. Clip editing and reordering

Every change that can alter sequence continuity must trigger a global
validation of the affected ordered sequence:

- changing an altitude field;
- adding a clip;
- removing a clip;
- moving a clip with the arrow actions;
- moving a clip with drag and drop;
- changing a value that determines the clip's exit altitude or direction.

The validator must traverse the sequence in display order and compare each
clip's entry altitude with the resolved upstream exit altitude. It must return
stable results keyed by clip instance ID, so React rendering does not depend on
array indexes.

Validation must be non-blocking. Invalid values remain editable and persist as
normal clip data, but the affected clip must be clearly marked.

### 3. Warning presentation

For every invalid clip:

- Set the associated `WADialog`/Web Awesome details container to the brand
  warning variant used by the replay editor.
- Prefix the affected altitude field label with a warning icon.
- Use the Web Awesome warning variant for the icon.
- Expose an accessible description explaining the upstream altitude and the
  expected relationship.

When the connection becomes valid, remove the warning state and restore the
normal field presentation immediately.

Warnings must be scoped to the invalid connection. A valid neighboring clip
must not inherit the warning state unless its own connection is invalid.

### 4. Absolute altitude data

All clip-facing interfaces and normalized instances must use absolute altitude
values:

- clip defaults;
- clip instance parameters;
- editor values;
- validation inputs and outputs;
- runtime handoff values.

Relative offsets must not be stored in `params.altitude` or equivalent fields.
If an existing source contains relative values, migration/normalization must
resolve them once using the applicable upstream context before returning the
normalized clip data.

Unit conversion remains a display concern. Values are converted to the active
elevation unit for the input control and converted back to absolute project
units before persistence and validation.

## Proposed data contract

Clip definitions should expose the minimum metadata needed by the editor and
validator:

```yaml
fields:
  - key: altitude
    label: Altitude
    type: number
    unit: m
    continuity:
      role: entry
      direction: ascending
```

The exact property names may follow the existing replay catalog conventions,
but the normalized definition must provide equivalent information. Supported
direction values for this milestone are `ascending`, `descending`, and
`none`.

An internal resolved context should contain the following information:

```js
{
  clipId,
  clipInstanceId,
  upstreamAltitude: 1200,
  offset: 0,
  resolvedUpstreamAltitude: 1200,
  boundary: {
    type: 'min',
    value: 1200,
  },
  valid: true,
}
```

The `offset` property is diagnostic only. The value used by the editor and
validator is always `resolvedUpstreamAltitude`.

## Validation rules

For a clip with a resolved upstream altitude `U` and entry altitude `E`:

- `ascending`: valid when `E >= U`;
- `descending`: valid when `E <= U`;
- `none`: no continuity validation and no dynamic boundary.

The first `start` clip has no upstream context and is valid by definition for
continuity purposes. Static field `min` and `max` constraints remain active
for every clip.

The validator must treat missing or non-finite values as invalid only when the
clip definition requires an altitude entry. It must not produce a warning for
clips such as `landing` that do not declare an altitude field.

## UI behavior

The altitude field should expose the reference using existing Web Awesome
label/help affordances. The UI copy must remain in English in the source and
follow the existing localization strategy if one is introduced for this area.

Recommended accessible message:

> Upstream exit altitude: {value}. This clip must start at or above/below this
> altitude.

The dynamic boundary must be passed to the display-unit input after conversion
to the active elevation unit. The normalized absolute value must be used for
the comparison before any display rounding.

## State and integration

- Keep the validation result in the replay editor state or a derived Valtio
  state; do not mutate clip instances with transient UI warnings.
- Reuse the existing `syncClips` persistence path for durable altitude values.
- Invoke one shared validation function from add, update, remove, arrow move,
  and Sortable `onEnd` flows.
- Preserve warning state when a details panel is closed and restore it when the
  panel is reopened.
- Ensure `settings`, journey replay data, and runtime replay data continue to
  receive the same normalized absolute values.

## Acceptance criteria

1. Adding a non-first clip displays the resolved absolute exit altitude of its
   upstream element.
2. The altitude input receives a dynamic minimum or maximum matching the clip
   direction.
3. Adding the first `start` clip does not display a reference and does not add a
   continuity-derived boundary.
4. Reordering clips runs validation for the complete affected sequence.
5. Every invalid clip shows a warning dialog/details variant and a warning icon
   on its altitude field.
6. Editing an invalid altitude immediately clears or restores the warning when
   the relationship becomes valid or invalid.
7. Warning presentation never prevents editing, saving, or reordering.
8. Stored clip altitude values are absolute and are not double-adjusted by an
   offset.
9. Display-unit conversion and rounding do not change the validation result.
10. Existing clips without altitude fields continue to work without false
    warnings.

## Test plan

Add or update tests for:

- upstream altitude resolution with and without an offset;
- first `start` clip behavior;
- ascending and descending dynamic boundaries;
- insertion between two clips;
- arrow reorder and Sortable drag reorder;
- invalid-to-valid and valid-to-invalid live updates;
- warning icon and warning variant rendering;
- absolute storage across display-unit changes;
- clips without an altitude field;
- no double application of offsets during normalization and persistence.

## Implementation notes

The likely implementation split is:

1. Extend `JourneyReplayClips.js` with normalized continuity metadata and pure
   upstream-resolution/validation helpers.
2. Update `JourneyReplayClipsTab.jsx` to derive field constraints and warning
   presentation from the validation result.
3. Extend the replay catalog entries in `public/replay.yaml` with explicit
   continuity direction metadata where required.
4. Add focused unit tests for pure data helpers and component tests for user
   interactions.

No implementation is included by this specification. The specification is
ready for validation and implementation planning for milestone `1.1.0`.
