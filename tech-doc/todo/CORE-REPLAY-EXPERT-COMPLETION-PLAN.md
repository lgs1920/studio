# Replay Expert completion plan

**Status** — Proposed implementation sequence for Studio `1.0.0` as inspected on 2026-11-22. The multi-track editor remains a separate `1.1.0` roadmap item.

Replay Expert can already save camera and progression settings per journey and resize the clips before and after Replay. Start by finishing settings persistence, then connect the remaining clip controls and extend automatic POI slowdown to Expert. Each phase has its own acceptance checks.

## 1. Finish Expert settings persistence

- [ ] Make the profile widget editor read and save the Expert profile style through the effective settings of the active journey. Store the color and track-style preference in `journey.replay.expert.profileInfo`. Reuse the existing Expert writeback and save lifecycle. Retain the global fallback for older journeys that lack a saved profile style.
- [ ] Compare the shared Basic and Expert controls from editing through persistence and hydration. Reuse the common behavior where the settings have the same meaning. Audit Basic defaults in `public/replay.yaml` and runtime normalization as part of this comparison.
- [ ] Audit the render-plan and context signatures so preparation, playback, and export use the effective mode and its configuration after a mode or journey change.

**Acceptance** — Change the Expert profile style, switch to Basic and back, select another journey, and reload. Each journey and mode resolves its own settings. Preview, playback, and export use the selected configuration. Cover first entry and older journeys without Expert profile settings.

[Replay implementation status](../specs/replay-video/CORE-REPLAY-IMPLEMENTATION-STATUS.md#replay-user-modes) · [Profile widget editor](../../src/components/Profile/ProfileWidgetEditor.jsx)

## 2. Complete the existing Timeline interactions

- [ ] Connect the React adapter's `onClipDoubleClick` callback to Studio's drawer navigation. Open the Clips tab, expand the selected clip, and focus its existing `replay-clip-<instance-id>` anchor.
- [ ] Inventory the remaining Action Mode and menu commands. Connect commands supported by the existing Journey clip model through the Studio adapter and record any commands that depend on the future multi-track model.

**Acceptance** — Double-click a clip before and after Replay and confirm that the corresponding editor opens. Check resize, enable/disable, removal, and preparation cleanup. Confirm that playback and export still consume the saved clip plan. Keep Replay-specific behavior in the Studio adapter and use the existing Replay clock.

[Timeline implementation](../specs/replay-video/CORE-REPLAY-TIMELINE-IMPLEMENTATION.md) · [Multi-track editor roadmap](CORE-REPLAY-TRACK-TIMELINE-EDITOR-EVOLUTION.md)

## 3. Extend automatic POI slowdown to Expert

- [ ] Feed the existing slowdown compiler with the resolved POI policy for the active mode. Preserve the existing speed curve, near-zero crawl, endpoint holds, and POI eligibility rules.
- [ ] Validate the canonical timing in Play, seek, reverse playback, and Native HQ export before displaying it in the Timeline.
- [ ] Project qualifying POI passages and slowdown intervals onto the preparation Timeline as read-only information using the output-video time mapping.

**Acceptance** — Equivalent Basic and Expert policies produce matching slowdown segments and route progress at the same video times. Hidden and ineligible POIs produce no slowdown. Timeline indicators match playback and export without introducing a manual speed control.

[Automatic POI slowdown specification](CORE-REPLAY-POI-AUTOMATIC-SLOWDOWN-TIMELINE-SPEC.md) · [Native HQ export implementation](../../src/core/ui/replay/ReplayDeferredExporter.js)

## Validation before delivery

- [ ] Add focused regression tests for settings persistence and mode switching, Timeline navigation and clip edits, and POI timing parity. Run the affected Vitest projects after the focused checks.
- [ ] Use the Studio WebGL preflight before checking a real journey with start and stop clips, a profile widget, and an eligible POI. Inspect both interactive playback and the generated Native HQ video in the browser. Record the journey, tested settings, and results.

[Replay quality validation](../specs/replay-video/CORE-REPLAY-QUALITY-VALIDATION.md)
