# Layer Time Filtering And User-Defined Time Windows

Status: proposed for validation

Target release: `1.1.0`

## 1. Context and objective

LGS1920 Studio currently treats a configured imagery layer as one static Cesium imagery provider. The layer catalogue is loaded from `public/layers-terrains.yaml`, while the selected base or overlay id and visual settings are persisted in the `settings` IndexedDB store. The current `MapLayer` implementation does not expose WMTS dimensions and therefore cannot retain or apply a user-selected temporal interval.

This feature adds opt-in temporal filtering for compatible layers. A user can select a date range for an active and accessible layer, keep that choice after reload, and create named supplementary instances of the same source layer for other date ranges.

The feature is deliberately opt-in. A layer must declare `timeFilter: true`; no time controls or temporal query parameters are added to ordinary layers.

## 2. Scope

### Included

- A declarative `timeFilter` capability on layer definitions.
- A date-range dialog available from the options menu of an active, accessible base or overlay layer.
- ISO 8601 interval generation for WMTS `TIME` dimensions.
- Persistent active time-window selection.
- Multiple named time windows per source layer.
- User-defined supplementary layer instances that can be selected as base or overlay layers.
- Migration, backup, linked-folder synchronization, and reset behavior for the new settings.
- Unit, component, integration, and end-to-end coverage for the temporal flow.

### Excluded from the first release

- A global application timeline that drives all temporal layers.
- Automatic scene-by-scene animation.
- Temporal filtering for terrain, 3D tiles, or non-imagery entities.
- Server-side catalog discovery of valid acquisition dates.
- Changing the configured provider catalogue from the UI.

## 3. Current architecture and impact

| Area | Current behavior | Required change |
| --- | --- | --- |
| Catalogue | Provider and layer definitions are read from `public/layers-terrains.yaml`. | Add `timeFilter` and a provider-specific time parameter declaration. |
| Indexing | `LayersAndTerrainManager` indexes configured layers by id. | Merge persisted supplementary instances into the runtime index without mutating the YAML catalogue. |
| Selection | `settings.layers.base` and `settings.layers.overlay` contain the selected ids. | Allow those ids to reference persisted supplementary instances. |
| Rendering | `MapLayer.jsx` creates a Cesium provider with static layer options. | Pass `dimensions: { TIME: interval }` to WMTS providers and rebuild the provider when the interval changes. |
| Persistence | `SettingsSection` deep-clones and saves `settings.layers` to IndexedDB. | Store time windows and supplementary layer definitions inside `settings.layers`, preserving them in export and folder synchronization. |
| UI | `SelectEntity` has a per-card authentication/options menu. | Add temporal actions only when the card is active, accessible, and declares `timeFilter: true`. |

Cesium 1.143 supports static WMTS dimensions through the `dimensions` constructor option. For KVP WMTS requests, Cesium adds these values to the query string. The implementation should use the public constructor option and must not mutate Cesium private fields after construction.

## 4. Configuration contract

The catalogue layer schema is extended as follows:

```yaml
- id: copernicus-sentinel2
  name: Sentinel-2 true color
  type: base
  tile: wmts
  timeFilter: true
  timeParameter: TIME
  timeFormat: iso8601-interval
```

Proposed fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `timeFilter` | Yes for temporal layers | Boolean capability flag. Defaults to `false` when absent. |
| `timeParameter` | No | WMTS dimension name. Defaults to `TIME`. |
| `timeFormat` | No | Supported value is `iso8601-interval`. |
| `timeDefault` | No | Optional catalogue default with `start` and `end` ISO timestamps. It is not user state. |
| `timeMin` / `timeMax` | No | Optional service bounds used for input validation. |

The renderer must only apply a time dimension when `timeFilter === true`, the layer tile type supports dimensions, and a valid persisted window exists.

## 5. Persisted data model

The following branch is added to the persisted `settings.layers` object:

```javascript
{
  timeWindows: {
    'provider-layer-id': {
      activeWindowId: 'window-id',
      windows: [
        {
          id: 'window-id',
          name: 'Winter',
          start: '2025-12-01T00:00:00.000Z',
          end: '2026-02-28T23:59:59.999Z'
        }
      ]
    }
  },
  supplementaryLayers: [
    {
      id: 'provider-layer-id--winter',
      sourceLayerId: 'provider-layer-id',
      name: 'Winter',
      type: 'base',
      timeWindowId: 'window-id'
    }
  ]
}
```

Normative rules:

- `sourceLayerId` always points to a catalogue layer. Supplementary instances never copy provider credentials or the full YAML definition.
- `supplementaryLayers[].id` is generated, stable, and collision-safe. It is not reused after deletion during the current session.
- A supplementary instance stores its display name, source id, entity type, and selected window id. The window itself remains owned by the source layer.
- `activeWindowId: null` means that the source layer uses the provider default and no `TIME` parameter is sent.
- `start` and `end` are stored as UTC ISO timestamps. The UI may collect local dates, but conversion to UTC occurs before persistence.
- A window must have `start <= end`. Empty, malformed, or partially persisted records are discarded during normalization.
- Deleting a window also deletes supplementary instances that reference it after confirmation, or blocks deletion while references exist if that is preferred by the final UX decision.
- If a source layer is removed from the YAML catalogue, its orphaned temporal settings remain recoverable in storage but are not rendered. A cleanup action may be added later.

The existing `base`, `overlay`, `colorSettings`, and filter fields remain backward compatible. Existing users receive empty `timeWindows` and `supplementaryLayers` branches through the normal settings merge.

## 6. Runtime model

`LayersAndTerrainManager` should expose a normalized runtime layer map:

1. Index catalogue layers as today.
2. Validate persisted temporal state against each source layer.
3. Create derived runtime records for valid supplementary layers by spreading the source layer metadata and overriding `id`, `name`, `type`, `sourceLayerId`, and the resolved time window.
4. Keep the provider id and credentials inherited from the source layer.
5. Expose helpers for `getSourceLayer`, `getTimeWindow`, `canUseTimeFilter`, and `isAccessible` so the UI and renderer share the same rules.

The selected base or overlay id remains the single source of truth for rendering. Selecting a supplementary layer therefore activates its own resolved interval without introducing a second viewer-level selection state.

## 7. URL and Cesium behavior

For a KVP WMTS layer, the provider construction becomes conceptually:

```javascript
new WebMapTileServiceImageryProvider({
  url,
  layer,
  style,
  format,
  tileMatrixSetID,
  dimensions: {
    TIME: '2025-12-01T00:00:00Z/2026-02-28T23:59:59Z'
  }
})
```

The dimension key must use the configured `timeParameter`, while the Sentinel-2 configuration uses `TIME`. The interval formatter must:

- emit a start and end separated by `/`
- normalize to UTC
- preserve second-level precision required by the service
- URL-encode values through Cesium `Resource`, not by manually concatenating query strings
- never send `TIME` when no active window exists

When a temporal selection changes, the React provider memoization key must change. `MapLayerImagery` then removes the old imagery layer and installs a new provider. The old provider and error listener must be released by the existing cleanup path. A temporary loading state is recommended so a date change is visibly committed before the old imagery disappears.

For a future RESTful WMTS endpoint, the same capability may use a template dimension such as `{Time}`. That is a separate configuration mode and is not required for the first implementation.

## 8. User experience

The options menu on a layer card contains:

- `Set time range` when the layer is active, accessible, and temporal
- `Manage time windows` when at least one saved window exists
- `Duplicate as supplementary layer` from the saved-window action or dialog

The dialog supports:

- start date and time
- end date and time
- optional custom name when saving a reusable window
- list of existing windows
- apply, save, rename, duplicate, and delete actions

An active temporal layer shows a compact indicator and its current window name in the card or selected-layer summary. The dialog must explain that the service may return a mosaic or the provider default when no valid acquisition exists in the interval.

Only base and overlay entities are eligible in the first release. A locked layer must not expose temporal actions. A free anonymous layer and a token-unlocked layer use the same UI and runtime path.

## 9. Accessibility and validation

- Use Web Awesome dialog, date/time inputs, buttons, alerts, and form validation.
- Every input has a visible label and an error message associated with the input.
- Keyboard focus moves into the dialog and returns to the triggering options button on close.
- The dialog announces invalid ranges and provider errors through an assertive callout.
- Prevent dates outside `timeMin` and `timeMax` when those constraints are declared.
- Prevent a zero-length or reversed interval unless the provider explicitly declares point-time support, which is out of scope here.

## 10. Persistence, reset, export, and synchronization

The feature must use the existing `SettingsSection` persistence path. No separate database store is needed for the initial release. Consequently:

- every change to time windows or supplementary layers is immediately persisted by the existing settings subscription
- settings export/import includes the new branches automatically
- linked-folder synchronization includes the new data as part of the settings record
- application reset removes user-defined windows and supplementary layers with the rest of layer settings
- a migration test must prove that an old settings record loads with no temporal state and remains usable

Token values remain in the existing vault and must not be copied into supplementary layer records.

## 11. Test plan

### Unit tests

- normalize valid and invalid persisted temporal records
- format UTC ISO intervals and reject reversed intervals
- generate collision-safe supplementary ids
- resolve source metadata and inherited authentication
- confirm `TIME` omission when no window is active

### Component tests

- hide temporal actions for inactive, locked, terrain, and non-temporal layers
- display actions for free and unlocked token layers
- save, rename, duplicate, and delete windows
- selecting a supplementary instance changes the selected entity id
- dialog keyboard focus and validation behavior

### Integration tests

- `MapLayer` passes the configured dimension to Cesium WMTS
- changing a window replaces the imagery provider and removes the previous layer
- settings reload restores active windows and supplementary instances
- backup and linked-folder round trips preserve all temporal state

### End-to-end acceptance

- select an accessible temporal base layer
- save `Winter`, select it, reload, and verify the selection remains active
- create `March` as a supplementary layer, switch between `Winter` and `March`, and verify distinct request URLs
- verify an authenticated temporal layer behaves identically after token unlock
- verify no temporal query parameter is added to a non-temporal layer

## 12. Delivery sequence

1. Add pure temporal schema, normalization, and interval-formatting helpers.
2. Extend the layer manager with derived supplementary instances.
3. Add Cesium WMTS dimensions and provider recreation behavior.
4. Implement the dialog and card options actions.
5. Add persistence, migration, backup, and synchronization tests.
6. Add one real provider fixture, then validate against the Copernicus integration.
7. Run lint, unit/component tests, and a production build.

## 13. Open decisions for validation

- Should deleting a referenced window cascade after confirmation, or require deleting supplementary layers first?
- Should a saved window without a supplementary layer still be shown as an available reusable preset?
- Should the dialog collect date-only values by default or expose time-of-day controls immediately?
- Should the first release support only WMTS KVP dimensions, or also RESTful WMTS templates?

## 14. Proposed GitHub feature issue

This is a proposed issue body pending user validation. It must not be opened until the solution, implementation plan, and missing project fields are confirmed.

### Title

`[Feature] Add persistent time filtering and named temporal layer variants`

<!-- issue-type: feature -->

## Context

Imagery layers are currently static. Compatible WMTS services cannot be queried for a user-selected date range, and users cannot keep multiple date windows for the same source layer.

## Requested behavior

Add opt-in temporal filtering for accessible base and overlay layers. A layer declaring `timeFilter: true` must expose a date-range dialog from its options menu, apply the selected interval to the configured WMTS time dimension, persist the selection, and allow the user to create named supplementary layer instances such as `Winter` or `March`.

## Acceptance criteria

- Temporal capability is declared per layer and defaults to disabled.
- The date-range action is visible only for active, accessible, temporal base or overlay layers.
- A valid interval is serialized as a UTC ISO 8601 interval and applied to the WMTS dimension configured by the layer.
- Changing the interval replaces the Cesium imagery provider without leaving the previous provider active.
- The selected interval survives reload, settings backup/import, and linked-folder synchronization.
- Users can save multiple named windows and create distinct supplementary layers from them.
- Supplementary layers inherit source provider metadata and credentials without duplicating token values.
- Existing non-temporal layers and existing persisted settings remain backward compatible.
- Automated tests cover validation, URL dimensions, persistence, provider replacement, and accessibility.

## Notes or questions

Target release: `1.1.0`. The final issue must use the shared Project fields, including the approved `Target release`, `Status`, priority, labels, repository, and assignee. Those values must be validated before issue creation.

## Technical notes

Primary implementation areas are `public/layers-terrains.yaml`, `src/core/ui/LayerAndTerrainManager.js`, `src/components/cesium/MapLayer.jsx`, `src/components/Settings/layers/SelectEntity.jsx`, and new temporal dialog/state helpers. Cesium 1.143 exposes WMTS static dimensions through the public `dimensions` constructor option.
