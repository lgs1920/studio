# Technical Specification — Brand and Season Swatch Reactivity

## Status

Proposal pending validation before implementation.

## Objective

Replace the last two automatically generated swatches with dynamic brand and season colors, then make every POI, journey, widget, or other color-bearing element that uses one of those dynamic swatches react to theme changes.

The runtime must be able to redraw only the affected entities when:

- the brand color changes
- the season color changes
- both change during the same theme application

## Scope

This specification covers:

- the automatic swatch list contract
- the application event API for brand and season color changes
- the metadata required to remember whether a color comes from a dynamic swatch
- the redraw strategy for POIs, journeys, and widgets
- the required code and test updates

It does not cover:

- redesigning the theme selector UI
- changing the meaning of the existing light/dark application theme
- replacing the current settings or persistence system
- introducing a new database or storage backend

## Current state

The application currently appends two theme-driven colors to `lgs.configuration.swatches.list` during bootstrap. Those appended colors are derived from the light and dark theme variables.

Theme application is currently handled by `AppUtils.setTheme(theme, brandColor, onMapTheme)`, which updates the root theme classes and the `body[data-on-map-theme]` attribute.

The runtime already has targeted redraw entry points:

- POIs can be redrawn through the POI manager and POI draw utilities
- journeys can be redrawn through `journey.draw(...)`
- widgets can be refreshed through the widget manager and widget-to-canvas refresh paths

What is missing is provenance:

- once a color has been saved as a plain hex value, the runtime cannot know whether it came from a static swatch or from a dynamic swatch
- as a result, a later brand or season change cannot selectively invalidate only the affected entities

## Product requirements

### Automatic swatches

The automatic swatch list must keep the existing static palette, but the last two entries must become:

1. the current brand color
2. the current season color

The brand and season entries must remain dynamic. They must be recomputed when the corresponding theme value changes.

### Theme color events

Two application events must exist:

- `CHANGE_BRAND_COLOR`
- `CHANGE_SEASON_COLOR`

These are application bus events. They are emitted on `lgs.events`, not as DOM `CustomEvent` primary APIs.

They are semantic events, not raw picker events:

- they fire only when the resolved brand or season color actually changes
- they are emitted after the application theme has been applied
- they are emitted once per committed change, not for every transient UI state

### Color provenance

Any color-bearing model that can use the automatic swatches must retain enough provenance to know whether the resolved color came from:

- a static swatch
- the brand swatch
- the season swatch

The resolved hex value alone is not sufficient.

Backward compatibility is required:

- existing persisted colors without provenance must still load correctly
- a missing provenance value must default to static/manual color behavior
- the implementation may optionally infer brand/season provenance on load when a legacy value exactly matches the current dynamic swatch snapshot, but that inference must remain best-effort only

### Redraw behavior

When the brand color changes:

- every POI, journey segment, or widget whose stored color depends on the brand swatch must be refreshed

When the season color changes:

- every POI, journey segment, or widget whose stored color depends on the season swatch must be refreshed

When both change together:

- the runtime must coalesce the work into a single batched refresh pass
- each affected entity must be redrawn only once
- the scene must request a render after the batch completes

## Canonical API

### Theme application

`AppUtils.setTheme(theme = null, brandColor = null, onMapTheme = null)`

Current behavior remains:

- resolve the requested application theme
- apply the root theme classes
- apply the current on-map theme to `body[data-on-map-theme]`

New behavior:

- resolve the previous brand and season colors before applying the new theme
- recompute the automatic swatch list after the theme is applied
- emit `CHANGE_BRAND_COLOR` when the resolved brand color changes
- emit `CHANGE_SEASON_COLOR` when the resolved season color changes
- return the resolved on-map theme as it does today

Suggested change detection:

- brand change detection is based on the resolved brand swatch value, not only on the storage key
- season change detection is based on the resolved on-map swatch value, not only on the selected season identifier

### Event payload

The event payload should be minimal and stable.

Suggested shape:

```js
{
  previous: '#7bf1a8',
  current: '#c56e12',
  source: 'theme-selector'
}
```

Required semantics:

- `previous` is the resolved color before the change
- `current` is the resolved color after the change
- `source` identifies the origin of the change, for example `theme-selector`, `bootstrap`, or `storage`

The exact payload may include additional fields if needed, but these three fields are the minimum contract.

### Swatch contract

The automatic swatch list must be regenerated from a single source of truth.

Suggested runtime contract:

- keep the static swatch palette as-is
- append the current brand color as the penultimate automatic swatch
- append the current season color as the last automatic swatch

The color picker consumers must not cache the automatic swatch string in a way that prevents theme-driven updates from being reflected.

## Required implementation changes

### `src/Utils/AppUtils.js`

Add a dedicated helper for building and refreshing automatic swatches.

Required behavior:

- recompute brand and season colors from the current runtime theme state
- write them into the automatic swatch list
- emit the brand and season change events when the resolved values differ from the previous values
- keep the current `setTheme(...)` entry point as the canonical place where theme changes are applied

### `src/components/ThemeSelector.jsx`

Keep the theme selector as the user-facing entry point, but stop making it the owner of theme-change side effects.

Required behavior:

- call the theme application helper
- let the helper publish the color-change events
- keep local UI state only for control rendering

### Color-bearing data models

Every model that can store a swatch-backed color must preserve provenance.

The affected areas include, at minimum:

- POIs
- journey tracks and journey-bound flag colors
- widget configuration fields that use a swatch-enabled color picker

Required behavior:

- preserve the resolved hex color
- store whether the color came from the brand swatch or the season swatch
- treat unmarked colors as static/manual colors

### Editors and color pickers

Any editor that renders the automatic swatch list must react when brand or season changes.

Required behavior:

- rebuild the swatch string when the automatic palette changes
- keep the last two swatches aligned with brand and season
- when the user chooses a dynamic swatch, persist the provenance metadata along with the resolved color

### Runtime redraw dispatcher

Add a small dispatcher or equivalent subscription layer that listens to `CHANGE_BRAND_COLOR` and `CHANGE_SEASON_COLOR`.

Required behavior:

- gather all affected entities by provenance
- deduplicate the refresh targets
- refresh POIs with the existing POI redraw path
- refresh journeys with `journey.draw(...)`
- refresh widgets with the widget manager refresh path
- request a scene render once the batch is complete

## Compatibility rules

- Existing plain hex values remain valid
- Existing manual colors must not start reacting to theme changes
- The new provenance metadata must be optional on read and persisted only when present
- The feature must not change the visual result for colors that are not brand- or season-backed

## Acceptance criteria

- the automatic swatch list ends with the current brand color and the current season color
- a brand color change emits `CHANGE_BRAND_COLOR`
- a season color change emits `CHANGE_SEASON_COLOR`
- POIs that use the brand or season swatch are redrawn when the corresponding color changes
- journeys that use the brand or season swatch are redrawn when the corresponding color changes
- widgets that use the brand or season swatch are refreshed when the corresponding color changes
- a combined theme update triggers one batched refresh, not two independent redraw storms
- static colors are not affected by brand or season changes
- legacy persisted data still loads

## Tests required

- automatic swatch list test for the final two entries
- theme change event emission tests for brand and season
- provenance persistence test for at least one POI/journey/widget color field
- redraw dispatch test for brand-dependent entities
- redraw dispatch test for season-dependent entities
- batching test when both colors change together
- backward compatibility test for legacy plain hex color records

## Out of scope

- changing the theme selector layout
- changing the meaning of the existing light/dark application theme
- introducing a new persistence backend
- adding analytics or reporting around color usage
