# Technical Specification Audit — 2026-09-18

## Scope and method

This audit compares the technical documentation with the current Studio source
and with the standalone `../timeline` package. It focuses on duplicate scope,
misclassified documents, stale implementation references, TODO entries that
are already delivered, and functionality described by the specifications but
not yet connected to the application.

The audit uses the current source tree as the implementation authority. A
feature is marked **implemented** only when the source provides usable runtime
behavior. A documented API, placeholder, or local projection is marked
**partial** when its application integration is incomplete.

## Consolidation completed

| Previous scope | Current owner | Audit result |
| --- | --- | --- |
| Replay Timeline preview specification | [`CORE-REPLAY-TIMELINE-IMPLEMENTATION.md`](specs/replay-video/CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) | Merged into the current implementation document. The old standalone TODO file is removed. |
| Track Editor specification | [`CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md`](todo/CORE-DRONE-CAMERA-3D-PATH-EDITOR-SPEC.md) | Merged into the 3D path editor scope. The detailed document is now correctly classified as planned work. |
| Non-distorting widget resize | [`CORE-WIDGET-MANAGER-README.md`](specs/ui-widgets/CORE-WIDGET-MANAGER-README.md) | Merged into the Widget Manager specification and backed by the current resize helpers. |
| Test and deployment next steps | [`CORE-GITHUB-ACTIONS-DEPLOYMENT-MIGRATION.md`](todo/CORE-GITHUB-ACTIONS-DEPLOYMENT-MIGRATION.md) | Merged into the delivery migration scope. |
| Generic Timeline contract | [`../../timeline/src/README.md`](../../timeline/src/README.md) and [`../../timeline/docs/specifications.md`](../../timeline/docs/specifications.md) | These are the package authorities. The Studio document now covers only the Replay-facing integration. |

## Classification changes

The following documents describe unfinished work and now live under
`tech-doc/todo/`:

- Replay start camera editor and clip synchronization
- POI animation during replay
- Clip altitude alignment
- HQ resolution profiles
- Replay Video Widget
- Drone camera 3D path editor
- Camera HPR orientation sphere

The Replay `specs` index now contains current architecture, implementation,
validation, and historical documents. The root `tech-doc/README.md` and the
repository README point to the centralized TODO files for planned work.

## TODO audit

### Timeline requests

| Request | Current status | Evidence and remaining work |
| --- | --- | --- |
| External Timeline Control with Dry Run and Action Mode | **Not implemented** | The generic component emits transport and interaction events, but `ReplayTimelinePreview.jsx` does not connect Action Mode to Replay start/playback or provide a Dry Run mode. Define one Studio adapter command contract before implementing it. |
| Generic additional drawer slot | **Implemented** | `@lgs1920/timeline` exposes the additional-content slots and the Replay adapter renders the drawer below the neutral timeline area. |
| Replay video settings in the drawer | **Implemented, needs product validation** | Ratio and quality/FPS controls are rendered in the drawer. Settings, Replay, recording, and cancel actions remain in the header. The original TODO note says the feature is buggy, so browser validation remains required. |
| Responsive horizontal/vertical drawer layout | **Implemented** | The Replay settings layout switches according to available drawer width. |
| Timeline header and menu repositioning | **Implemented** | Header actions and custom menu slots are used by the Replay preview. |
| Preset and aspect-ratio menus in the drawer | **Implemented** | The current Replay preview renders the video recording settings menus in the generic additional-content slot. |
| Basic and Expert Replay modes | **Not implemented** | No persisted Basic/Expert mode or dedicated Basic camera workflow was found in the current Replay UI. This needs a product decision and a single owner document. |
| Double-click a clip to edit its widgets | **Partial** | Stable clip anchors and panel navigation exist, and the generic component emits the double-click event. The Studio adapter does not currently wire the event to `PanelManager.toggleNavigation`. |
| Track insertion and modification | **Partial** | The generic Timeline and transient Replay projection support track and clip interactions. The result is not yet a persisted `journey.replay.timeline` authoring model. |
| Reactive clip changes after duration or insertion changes | **Partial** | The projection rebuilds from source signatures, but timeline edits remain transient and are not a complete domain-level authoring flow consumed by Draft and HQ. |

The entries that are already implemented should be removed from the active
root TODO after the product owner confirms the remaining browser and UX
validation. The unresolved items belong in the Replay timeline evolution
document and the implementation status roadmap rather than in separate
duplicate specifications.

### Other planned specifications checked against source

| Area | Audit result |
| --- | --- |
| Journey import formats (FIT, TCX, Strava) | No complete implementation was found for the proposed formats. Keep as one import contract with format-specific adapters. |
| Cloud synchronization | Local IndexedDB synchronization exists, but the proposed remote cloud synchronization remains separate and pending. |
| MVT, Copernicus Sentinel-2, and layer time filtering | Existing layer configuration does not provide the proposed generic MVT provider, Copernicus Data Space integration, or time-parameter filtering. Keep the layer time model as the master proposal and Sentinel-2 as its provider adapter. |
| POI time ranges and animation | Current Replay POI controllers exist, but the proposed canonical replay-time visibility and endpoint presentation behavior is not fully embedded. Keep the POI proposal separate from the generic timeline authoring contract. |
| Clip altitude alignment | The proposed reordered-clip altitude contract is not fully implemented. Keep it under Replay data preparation, separate from the timeline UI. |
| HQ profiles and Video Widget | No complete source implementation matching the planned profile catalog or replay-synchronized repeatable Video Widget was found. |
| 3D camera path editor and HPR sphere | Camera runtime support exists, but the proposed authoring UI components are not complete. The editor and orientation sphere remain separate planned deliverables. |
| Arrow widget, translations, profile work, brand swatch reactivity | The TODO documents remain valid. Existing theme, profile, or widget infrastructure does not provide the proposed complete feature contracts. |
| Main UI TODO | Some items are already delivered, such as the standalone Timeline integration. Snapshot SVG support, the `@turf/point` migration, and the remaining CameraManager/profile-menu cleanup need individual verification before being closed. |

## Remaining duplicate or stale ownership risks

1. `CORE-REPLAY-IMPLEMENTATION-STATUS.md` remains the single Replay roadmap.
   Other Replay documents should link to it instead of copying the full TODO
   table.
2. `CORE-REPLAY-TIMELINE-IMPLEMENTATION.md` owns the Studio adapter. The
   sibling Timeline README and specification own generic component behavior.
3. `CORE-REPLAY-TIMELINE-PERFORMANCE-AUDIT.md` is a follow-up proposal. Its
   implemented optimizations are now identified as such, and the remaining
   work requires browser measurements.
4. Recording-loop performance and time-ranged object visibility are related but
   distinct concerns. The combined proposal should remain a coordination
   document and link to the timeline authoring and POI documents instead of
   duplicating their data contracts.

## Recommended next documentation actions

1. Close the delivered drawer and widget-window TODO items after browser
   validation, preserving only the bug fixes that remain.
2. Add the External Timeline Control, Basic/Expert modes, double-click
   navigation, and persisted timeline authoring to the Replay status roadmap.
3. Implement the missing Studio event wiring before expanding the future domain
   timeline model.
4. Keep all new proposed behavior under `tech-doc/todo/` and update the status
   document when source behavior changes.
