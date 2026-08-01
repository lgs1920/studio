# Replay trace and marker glow/neon effects

## Status

Proposed specification for milestone `1.1.0`.

Tracking issue: [#424](https://github.com/lgs1920/studio/issues/424).

## Context

Replay trace and marker styling currently comes from `JourneyReplayProgressionStyle.js` and is rendered in `JourneyReplayCesiumRenderer.js`.

The requested feature adds a shared visual effect system for the replay trace and the replay marker. The user-facing behavior is simple: one effect selector, one opacity slider, and one runtime rendering contract.

This work must remain consistent with [CORE-DRONE-CAMERA-PATH-ARCHITECTURE.md](../specs/CORE-DRONE-CAMERA-PATH-ARCHITECTURE.md): Cesium is a runtime adapter and renderer concern, not part of the path engine or the replay timing model.

## Goals

- Add two replay effects: Glow and Neon.
- Apply the selected effect to both the replay trace and the replay marker.
- Base the effect color on the visible border when a border exists.
- Fall back to the trace or marker base color when no visible border exists.
- Keep the effect opacity independent from the base color opacity.
- Keep the current replay visuals unchanged when no effect is selected.
- Keep the implementation compatible with Cesium-backed playback, live replay, and export.

## Non-goals

- Adding separate effect selectors for trace and marker.
- Introducing a second animation clock or effect timeline.
- Changing the replay camera, path sampling, or marker positioning logic.
- Adding user-editable glow radius, blur spread, or shader parameters in V1.
- Changing the existing trace/border/marker style model outside the new effect fields.

## Product decisions

### Shared effect model

The replay effect is a single shared setting. It applies to the trace and the marker together. There is no separate trace-only or marker-only effect state in this milestone.

### Effect modes

The selector must expose exactly these modes:

- `No effect`
- `Glow`
- `Neon`

The default mode is `No effect`.

### Effect opacity

The effect has its own opacity value.

- The opacity slider is disabled when `No effect` is selected.
- The opacity value is preserved even when the effect is disabled.
- Changing the effect mode must not reset the opacity value.

### Border-aware base color

The effect color must be derived from the visible border when one exists.

| Target | Visible border or outline? | Base color used for the effect |
| --- | --- | --- |
| Trace | Yes | Trace border color |
| Trace | No | Trace base color |
| Marker | Yes | Marker outline color |
| Marker | No | Marker base color |

The alpha channel of the base color must be ignored. The effect uses its own opacity as the final alpha.

## Data model

The replay settings should keep the new effect state under the replay progression style contract.

```js
ui.replay.progression.effect = {
    mode: 'none',
    opacity: 1,
}
```

Normalization rules:

- invalid or missing `mode` values fall back to `none`
- `opacity` is clamped to the `0..1` range
- `none` still keeps the persisted opacity value
- existing progression fill and border settings remain unchanged

## Cesium compatibility notes

Official Cesium documentation confirms polyline glow support through `PolylineGlowMaterialProperty`.
Polyline outline support is also documented through `PolylineOutlineMaterialProperty`.

For point rendering, the documented primitives expose color, outline color, outline width, translucency, and distance behavior through `PointGraphics` and `PointPrimitive`, but the public docs do not expose a native marker neon effect.

That means:

- trace glow can use documented Cesium polyline capabilities;
- marker glow/neon must stay renderer-owned and may require layered primitives or a custom material fallback;
- the implementation must not depend on a native Cesium `neon` property existing for points.

This conclusion is an implementation constraint, not a separate product surface.

## Runtime rendering contract

`JourneyReplayCesiumRenderer` remains the owner of the visual composition.

The renderer must:

- resolve the effect mode and opacity from the replay settings on each update;
- resolve a border-aware base color for the trace and for the marker independently;
- discard the base alpha and apply the effect opacity as the final alpha;
- keep the existing trace/marker entity identity and visibility lifecycle stable;
- refresh the Cesium material or layered primitive when the effect mode changes;
- preserve the current z-order and border/fill composition when `No effect` is selected.

Glow and Neon are both preset styles, not free-form user-defined shader inputs. The exact visual tuning may differ between trace and marker as long as the selected preset remains recognizably distinct and stable.

## UI contract

The Replay drawer must rename the `Edit` tab to `Style`.

The `Style` tab must contain:

- one effect selector with `No effect`, `Glow`, and `Neon`
- one opacity slider

Behavior rules:

- the slider is disabled when `No effect` is selected
- the slider becomes enabled immediately when `Glow` or `Neon` is selected
- the effect controls do not replace the existing trace, border, and marker size controls
- the tab label and the internal panel key should use the same semantic name unless the drawer framework requires a migration alias

## Implementation references

The current code paths that should absorb this feature are:

- `src/components/JourneyReplay/JourneyReplayDrawer.jsx`
- `src/core/ui/replay/JourneyReplayProgressionStyle.js`
- `src/core/ui/replay/JourneyReplayCesiumRenderer.js`
- `src/Utils/cesium/TrackUtils.js`
- `src/__tests__/ui/replay/replay-drawer.test.jsx`
- `src/__tests__/integration/replay/replay-cesium-renderer.test.js`

## Validation and tests

This feature must ship with focused tests.

### Settings and normalization

- default effect state is `none`
- invalid effect modes fall back to `none`
- opacity values are clamped to the valid range
- disabling the effect keeps the persisted opacity value

### UI tests

- the Replay drawer tab label changes from `Edit` to `Style`
- the effect selector exposes the three expected values
- the opacity slider is disabled for `No effect`
- the opacity slider becomes enabled for `Glow` and `Neon`

### Renderer tests

- trace rendering uses the border color when a border is visible
- trace rendering falls back to the trace base color when no border is visible
- marker rendering uses the outline color when a visible outline exists
- marker rendering falls back to the marker base color when no outline is visible
- the effect opacity is independent from the base color opacity
- `No effect` preserves the current trace and marker appearance

### Cesium compatibility tests

- verify the trace effect path remains compatible with documented Cesium polyline APIs
- verify the marker path does not require undocumented Cesium point properties
- verify the renderer fallback keeps the replay marker stable in playback

## Open validation point

Issue [#424](https://github.com/lgs1920/studio/issues/424) must remain the source of truth for the Cesium support check.

If Cesium proves sufficient for the marker effect through documented primitives, the renderer should use that path.
If not, the marker effect must use a renderer-owned layered or custom fallback without changing the replay settings contract.

## Acceptance criteria

- Glow and Neon are available for both the replay trace and the replay marker.
- The replay drawer exposes a single Style tab with the effect controls.
- The effect color follows the visible border when one exists.
- The effect color falls back to the base trace or marker color when no border exists.
- Base color opacity does not drive effect opacity.
- No effect leaves the existing replay visuals unchanged.
- The implementation remains compatible with Cesium-backed replay playback.
- The feature is covered by settings, UI, renderer, and Cesium compatibility tests.

## Related tracking

- [#422](https://github.com/lgs1920/studio/issues/422) — Add Glow and Neon replay effects for trace and marker
- [#423](https://github.com/lgs1920/studio/issues/423) — Rename the Replay drawer Edit tab to Style and add effect controls
- [#424](https://github.com/lgs1920/studio/issues/424) — Validate Cesium support for replay Glow and Neon effects
