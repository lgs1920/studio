# Journey And Track Click Selection With Interactive Overlay Menu

Status: proposed for validation

Target release: `1.1.0`

## 1. Context and objective

LGS1920 Studio renders journeys through Cesium data sources, usually with one data source per track. Existing canvas events can identify a single picked entity, but there is no journey-level interaction that lets users select a non-current journey or conveniently choose several nearby tracks.

The feature is changed from hover detection to click selection. A user clicks a rendered track, Studio searches a configurable pixel radius around the click, resolves all matching tracks and journeys, selects the relevant journey when it is not current, and opens a dedicated DOM action menu. The menu displays the selected journey or journeys and provides edit, remove, and video/replay actions.

There is no menu on mouse hover. Hover and mouse-move events must not trigger picking, state changes, or menu rendering.

## 2. Scope

### Included

- Click-only selection on rendered 3D journey tracks.
- Configurable search radius of 5, 10, or 20 pixels, declared in YAML.
- Multi-pick around the click to select one or several nearby tracks.
- De-duplication of tracks and journeys represented by multiple Cesium entities.
- Selection of a journey that is not the current journey.
- A dedicated interactive DOM overlay menu anchored to the click position.
- Per-journey actions for editing, removing, and opening video/replay configuration.
- Reuse of the existing editor, removal confirmation, and video/replay flows.
- Accessibility, keyboard handling, performance safeguards, and automated tests.

### Excluded from the first release

- Any menu or data pick caused by pointer hover or mouse movement.
- A new video renderer or export pipeline.
- Deleting a journey without confirmation.
- Direct editing of journey fields inside the overlay menu.
- Touch-specific long-press behavior. Existing tap behavior remains unchanged unless explicitly extended later.

## 3. Current architecture and impact

| Area | Current behavior | Required change |
| --- | --- | --- |
| Cesium input | `CanvasEventManager` exposes `CLICK`, `TAP`, and mouse movement events. Standard click handling uses `scene.pick`. | Register a journey selection handler on click only and pass the click position to a radius-based resolver. |
| Journey rendering | `TrackUtils.prepareDrawing()` creates one `GeoJsonDataSource` per track and one `CustomDataSource` per journey. | Add stable journey/track metadata or a resolver from picked entities/data sources to track and journey slugs. |
| Current journey | Editor and replay flows assume `lgs.theJourney` is already the desired journey. | Add a target-based selection command that updates context before opening an action. |
| Existing hover UI | Distant track locator markers use a non-interactive DOM tooltip. | Keep it independent. The new menu is click-opened and interactive. |
| State | Application state uses Valtio stores. | Add ephemeral click-selection/menu state. It must not be persisted. |
| Configuration | Runtime settings are loaded from YAML. | Add a validated click radius setting to the YAML settings contract. |

## 4. YAML configuration

Add a configuration branch to `public/settings.yaml`:

```yaml
journeySelection:
  clickRadiusPixels: 10
  allowedClickRadiusPixels: [ 5, 10, 20 ]
```

Normative rules:

- `clickRadiusPixels` is the active radius in CSS pixels.
- The default is `10` when the branch is absent.
- Only values declared in `allowedClickRadiusPixels` are valid for the first release.
- Invalid, negative, non-integer, or unsupported values fall back to `10`.
- The radius is measured in screen/CSS pixels, not Cesium drawing-buffer pixels. Do not multiply by device pixel ratio unless the Cesium event contract requires conversion.
- The branch is catalogue/application configuration. It is not user-editable in this feature and is not part of hover state.

If a future UI exposes this setting, it must use the same allowed-value validation and persist through the normal settings path. The initial feature only requires YAML configuration.

## 5. Click selection algorithm

### 5.1 Event ownership

Register one journey selection listener on the existing canvas event manager:

```text
onClick(event) -> resolveTracksAroundClick(event.position, clickRadiusPixels)
```

The handler must not register `MOUSE_MOVE`, `MOUSE_ENTER`, or `MOUSE_LEAVE` listeners for this feature. A move over a trace must have no effect.

The handler should ignore clicks that are already consumed by an active drawer, dialog, menu, or other higher-priority canvas interaction. It must also ignore clicks originating from the overlay DOM menu.

### 5.2 Radius search

The resolver converts the click position into a bounded set of sample positions:

1. Pick the exact click position.
2. Pick points distributed around a circle of radius `r`.
3. Optionally include a small center cross to avoid gaps caused by line rasterization.
4. Call `scene.drillPick` at each sample when available, otherwise `scene.pick`.
5. Merge and de-duplicate the resulting journey track candidates.

The sampling pattern must be deterministic. A first implementation may use eight points around the circle plus the center. The exact number of samples must be bounded and covered by tests. The radius must not expand beyond the configured value.

The resolver should prefer a Cesium scene-space approach if an equivalent supported API becomes available, but it must remain screen-radius based so the user-visible tolerance is predictable.

### 5.3 Candidate filtering

Only rendered journey track entities are candidates. Ignore:

- imagery and terrain
- Cesium UI primitives
- POIs
- replay-only helper entities
- locator marker entities unless they resolve unambiguously to their track
- entities without a valid journey or track reference
- hidden or removed tracks

The resolver must preserve the track identity because the action menu may need to show several tracks belonging to the same journey.

### 5.4 Normalized result

```javascript
{
  clickPosition: { clientX, clientY, canvasX, canvasY },
  radiusPixels: 10,
  tracks: [
    {
      slug: 'track-slug',
      title: 'Track title',
      journeySlug: 'journey-slug',
      journeyTitle: 'Journey title'
    }
  ],
  journeys: [
    {
      slug: 'journey-slug',
      title: 'Journey title',
      trackSlugs: ['track-slug'],
      isCurrent: false
    }
  ]
}
```

Track candidates are de-duplicated by track slug. Journey candidates are de-duplicated by journey slug. Ordering is deterministic: exact-pick priority where available, then sample order, then locale-aware journey title, then slug.

## 6. Selecting a non-current journey

The click result must allow any resolved journey to become the target, even when `lgs.theJourney` is another journey.

Create a shared target-selection command with this contract:

```text
selectJourneyTarget(journeySlug, options) -> Promise<Journey|null>
```

The command must:

1. resolve the journey from the in-memory journey map
2. update `lgs.theJourney` and the relevant main/editor context using the existing context methods
3. prepare the journey editor state when an action requires it
4. preserve camera position unless the chosen action explicitly requests focus
5. update the current journey list state without duplicating entries
6. return the resolved journey or `null` when it is unavailable

Selecting a journey for the action menu must not silently open the editor or move the camera. The menu action determines the next operation.

For multiple journeys, the menu must show all resolved journeys and execute selection/actions against the row slug. Clicking a row may make that journey current, but the final UX decision must be explicit. At minimum, `Edit`, `Remove`, and `Video/Replay` must first select their own target.

## 7. Interactive DOM overlay menu

Create a React/Web Awesome component mounted in the existing map/UI overlay root. It opens only when a click produces at least one valid track or journey candidate.

Suggested structure:

```text
journey-click-menu
├── heading
├── selected-track-summary
└── journey-click-menu-list
    ├── journey-click-menu-item
    │   ├── journey name
    │   ├── track names
    │   ├── Edit
    │   ├── Remove
    │   └── Video / Replay
    └── ...
```

The menu must communicate both levels when relevant:

- selected track names identify what the radius matched
- journey names identify the actionable records

If several tracks belong to one journey, display one journey row with its matched track names rather than repeating the journey for every entity.

## 8. Menu positioning and lifecycle

Position the menu in viewport coordinates using the click position, with a default offset of 12 pixels. Clamp it within an 8-pixel viewport margin and flip above/below when necessary.

The menu is click-opened, so it does not need hover grace periods or pointer-crossing logic. It remains open until:

- an action is activated
- Escape is pressed
- the close button is activated
- the user clicks outside the menu and outside a configured canvas selection target
- a drawer or modal takes ownership
- the target journey is removed or becomes unavailable

Do not install a broad document click handler that fires before menu buttons. Use a capture strategy that distinguishes the menu root, the Cesium canvas, and unrelated UI controls.

## 9. Menu actions

### Edit

For the clicked journey row:

1. resolve the latest journey by slug
2. select it as the current target if necessary
3. call the shared editor preparation flow, equivalent to `Utils.updateJourneyEditor(slug, {focus: false})`
4. open `JOURNEY_EDITOR_DRAWER` with the existing edit/data tab contract
5. close the menu and return focus to the editor

### Remove

For the clicked journey row:

1. resolve and select the latest journey
2. open the existing confirmation dialog with the correct journey name
3. preserve the journey if cancelled
4. reuse the existing cleanup path for data sources, POIs, groups, current context, and persistence
5. close the menu and clear its state after successful removal

The current `RemoveJourney` component is coupled to the editor store. Extract a target-based command or shared removal service rather than simulating a click on the existing component.

### Video / replay

For the clicked journey row:

1. resolve and select the target journey
2. prepare its context without automatically changing camera focus
3. open the approved journey-scoped replay/video configuration entry point
4. close the menu without starting recording automatically

The product decision is whether the action is named `Video`, `Replay`, or `Replay and video`, and whether it opens `REPLAY_DRAWER` or directly enables the existing video editing state.

## 10. Runtime state

Proposed ephemeral Valtio state:

```javascript
{
  visible: false,
  clickPosition: { clientX: 0, clientY: 0 },
  radiusPixels: 10,
  tracks: [],
  journeys: [],
  interactionToken: 0
}
```

This state must not be included in persisted settings, backups, linked-folder synchronization, or journey records. Before every action, resolve the journey slug again to avoid operating on stale references.

## 11. Accessibility and interaction safety

- Use a semantic menu or labeled action group with Web Awesome controls.
- Each action includes the journey name in its accessible label, for example `Edit Mont Blanc`.
- The menu is keyboard reachable after a click opens it.
- Escape closes the menu.
- Remove always uses the existing confirmation dialog.
- A click radius must not imply that every nearby journey is immediately selected or modified. Actions remain explicit per row.
- Do not rely on color or line proximity alone. Show matched track and journey names.
- Preserve existing tap behavior until a touch-specific equivalent is designed.

## 12. Performance and reliability

- No mouse-move or hover picking.
- One click handler for the feature, not one handler per entity.
- Bound the number of sampled points and the `drillPick` result count.
- Avoid database reads during click resolution. Use in-memory journeys, tracks, and data-source indexes.
- Do not log full Cesium pick objects in production.
- Clear selection state when a journey is deleted, data sources are redrawn, the scene changes, or the viewer is destroyed.
- Handle a click where one track disappears between sampling and menu action.

## 13. Test plan

### Unit tests

- validate YAML radii and fallback to 10 pixels
- generate deterministic sample points for 5, 10, and 20 pixels
- resolve track entities to journeys
- de-duplicate polyline style entities by track slug
- de-duplicate journeys while preserving matched track slugs
- ignore non-journey and stale entities
- select a journey different from `lgs.theJourney`

### Component tests

- no menu appears from mouse movement or hover
- a click with no candidates leaves the menu closed
- one matched track renders its journey and track names
- multiple tracks from one journey render one journey row
- multiple journeys render separate rows
- Edit, Remove, and Video/Replay use the clicked row slug
- Escape, outside click, and action activation close the menu
- accessible labels include the target journey name

### Integration tests

- click sampling uses the configured YAML radius
- overlapping tracks are collected within the radius
- selecting a non-current journey updates context before opening its editor
- remove uses the existing confirmation and cleanup path
- video/replay opens for the clicked journey rather than the previous current journey
- changing the radius in YAML changes sample coordinates after configuration reload

### End-to-end acceptance

- click a visible track and verify the menu appears without any hover interaction
- click near, but not directly on, a track and verify the configured radius selects it
- click where several tracks overlap and verify all matching journey names appear
- select a non-current journey and edit it
- cancel and confirm removal for the correct journey
- open video/replay for a non-current journey and verify its context is active
- click empty globe, terrain, imagery, POI, or unrelated UI and verify no journey menu opens

## 14. Delivery sequence

1. Add and validate the YAML click-radius configuration.
2. Implement pure radius sampling and pick-to-track/journey resolution helpers.
3. Add the target journey selection command for non-current journeys.
4. Add the click-only runtime controller and ephemeral Valtio state.
5. Add the DOM overlay menu and action routing.
6. Extract reusable target-based edit/remove commands.
7. Integrate the approved video/replay entry point.
8. Add unit, component, integration, and end-to-end coverage.

## 15. Open decisions for validation

- Should the active YAML parameter be `journeySelection.clickRadiusPixels` as proposed?
- Should the default radius be 5, 10, or 20 pixels? The proposal uses 10.
- Should clicking a menu row select the journey, or should only an explicit action select it?
- Should a menu row display all matched track names or only the journey name?
- Should the video action open `REPLAY_DRAWER`, direct video editing, or a combined flow?

## 16. Proposed GitHub feature issue

This is a proposed issue body pending user validation. It must not be opened until the click-only behavior, radius configuration, action naming, and project fields are confirmed.

### Title

`[Feature] Select journeys and nearby tracks from a configurable click radius`

<!-- issue-type: feature -->

## Context

The current canvas interaction does not provide a journey-level action menu and makes it difficult to target tracks precisely. A journey that is not currently selected cannot be conveniently chosen from its rendered track.

## Requested behavior

Replace the proposed hover interaction with click-only selection. When the user clicks a rendered track, search a configurable radius of 5, 10, or 20 screen pixels around the click, resolve all matching tracks and journeys, select a non-current journey when required, and display a dedicated DOM menu with the matched names and actions for editing, removal, and video/replay configuration.

## Acceptance criteria

- No journey picking or menu display occurs on hover or mouse movement.
- A click on or near a rendered track searches the YAML-configured screen-pixel radius.
- The radius supports the values 5, 10, and 20 pixels, with a validated default of 10 pixels.
- Multiple nearby tracks are resolved and displayed without duplicate track or journey entries.
- A journey that is not currently selected can become the action target.
- The dedicated DOM menu displays the matched track and journey names.
- Edit opens the existing journey editor for the selected row journey.
- Remove uses the existing confirmation and cleanup flow and never deletes on selection alone.
- Video/replay opens the approved journey-scoped configuration flow without starting recording automatically.
- Empty globe, terrain, imagery, POI, unrelated UI, and hover movement do not open the journey menu.
- Runtime click-selection state is not persisted.
- Automated tests cover radius sampling, multi-track resolution, non-current journey selection, accessibility, and all menu actions.

## Notes or questions

Target release: `1.1.0`. Proposed repository: `lgs1920/studio`. Proposed labels: `enhancement`, `Layers`, `Core`, `UI`, and `Journey`. The final issue must use the shared Project fields, including status, priority, and target release, after explicit validation.

## Technical notes

Relevant areas include `src/core/events/CanvasEventManager.js`, `src/core/events/cesiumEvents.js`, `src/Utils/cesium/TrackUtils.js`, journey editor utilities, `RemoveJourney.jsx`, `JourneyReplayDrawer.jsx`, and `src/core/stores/ui.js`. Prefer a click-only `JourneySelectionController` with deterministic radius sampling, `scene.drillPick`, and a React/Web Awesome menu mounted in the map overlay root.
