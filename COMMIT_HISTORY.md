# Commit History

## 2026-07-26 — [`merge: sync main into 1.0.0-beta.4`](https://github.com/lgs1920/studio/commit/ebc72195)

- Merge the documentation changes from `main` into the `1.0.0-beta.4` branch.

## 2026-07-26 — [`chore: new beta version 1.0.0-beta.4`](https://github.com/lgs1920/studio/commit/3383ea30)

- Start the `1.0.0-beta.4` branch line with the new beta version marker.

## 2026-07-26 — [`docs: add tech-doc naming rule`](https://github.com/lgs1920/studio/commit/bf1fdfef)

- Add an explicit naming rule for `tech-doc` documentation files in `PROJECT_RULES.md`.
- Require uppercase, flat filenames with descriptive prefixes and no nested spec or todo document paths unless intentionally shared.

## 2026-07-26 — [`docs: rename provider and settings docs`](https://github.com/lgs1920/studio/commit/4325fd5b)

- Rename the provider reference to `tech-doc/specs/HOW_TO_ADD_PROVIDERS_LAYERS.md`.
- Rename the journey settings note to `tech-doc/specs/JOURNEY_SETTINGS_README.md`.
- Update the technical documentation indexes and root README links to the new names.

## 2026-07-26 — [`docs: rename current docs to specs`](https://github.com/lgs1920/studio/commit/31fa0eaf)

- Rename `tech-doc/current/` to `tech-doc/specs/` and move the dependency, provider, and sync guide references into the new specs tree.
- Update the documentation indexes and technical rules so specs live under `tech-doc/specs/` and tech-doc changes are merged to `main`.

## 2026-07-26 — [`docs: flatten tech-doc docs into current`](https://github.com/lgs1920/studio/commit/751a5110)

- Move the documentation previously stored under `tech-doc/deployment/`, `tech-doc/public/`, and `tech-doc/src/` into flat uppercase files under `tech-doc/current/`.
- Update the root and technical documentation indexes, plus internal references, to the new `current/` hierarchy.

## 2026-07-26 — [`docs: rename journey replay video issues`](https://github.com/lgs1920/studio/commit/f20f922e)

- Rename the replay/video architecture analysis document to a hyphenated uppercase filename.
- Update the root and technical documentation indexes to point to the renamed file.

## 2026-07-26 — [`docs: restructure tech docs hierarchy`](https://github.com/lgs1920/studio/commit/9646f47b)

- Rename the technical documentation moved out of `current/src` and `todo/src` to flat uppercase filenames under `tech-doc/current/` and `tech-doc/todo/`.
- Update all root, index, and internal documentation links to the new hierarchy.
- Restore and rename the weekly count API issue docs under the new flat naming convention.

## 2026-07-26 — [`docs: sync issue types from templates`](https://github.com/lgs1920/studio/commit/dcb2eeb0)

- Add hidden issue-type markers to the bug and feature issue templates.
- Add a GitHub Actions workflow and script that sync the repository issue type from the template marker or label fallback.

## 2026-07-25 — [`fix: throttle repeated codec error toasts`](https://github.com/lgs1920/studio/commit/3ef787f5)

- Throttle repeated video codec error notifications to one toast every 30 seconds per recording session.
- Add regression coverage for the notification interval.

## 2026-07-25 — [`fix: persist credits widget dimensions and scale`](https://github.com/lgs1920/studio/commit/1fc34739)

- Restore persisted Credits widget dimensions and scale during video-board rehydration.
- Keep fixed widgets at their saved scale when they still fit the crop and make the Credits target span its intrinsic width.
- Add regression coverage for rehydration and crop-board repositioning.

## 2026-07-25 — [`fix: align video creation action on mobile`](https://github.com/lgs1920/studio/commit/89f323d5)

- Move the HQ video creation action to a dedicated right-aligned row on mobile video previews.
- Add a regression assertion for the grouped action and expose its accessible label.

## 2026-07-25 — [`docs: specify POI replay animation`](https://github.com/lgs1920/studio/commit/122be7ee)

- Add the proposed POI replay animation specification, including endpoint pairing, field selection, pause ownership, duration validation, cancellation, and export synchronization.
- Link the specification from the root and TODO technical documentation indexes.

## 2026-07-25 — [`docs: specify clip altitude alignment`](https://github.com/lgs1920/studio/commit/3b5c651c)

- Add the proposed clip altitude continuity, absolute-value, reorder validation, warning, and dynamic boundary specification.
- Link the specification from the root and TODO technical documentation indexes.

## 2026-07-25 — [`docs: define issue creation workflow`](https://github.com/lgs1920/studio/commit/de27140f)

- Document the required fields, assignee, milestone, and backlog confirmation workflow for issue creation.

## 2026-07-25 — [`docs: note app icon refresh in beta changelog`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Add a short release-note line stating that the app icons and favicon have been updated.

## 2026-07-24 — [`docs: add direct logging rule`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Add a direct logging rule to `PROJECT_RULES.md` so explicit logging requests use native console methods without wrappers.

## 2026-07-24 — [`fix: keep theme swatches reactive and Safari-safe`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Add a Safari-compatible fallback for `matchMedia('(prefers-color-scheme: dark)')` listeners.
- Replace frozen swatch memoization in color editors with reactive swatch reads.
- Cover the listener fallback and reactive swatch behavior with tests.

## 2026-07-24 — [`fix: stabilize poi snapdom rendering in firefox`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Add a regression test for the POI map card CSS.
- Contain the POI snapshot background in a positioned stacking context.
- Replace the shrinked POI inset shadow with a real border so Firefox renders the marker consistently.

## 2026-07-24 — [`test: update profile widget preview dimensions`](https://github.com/lgs1920/studio/commit/505c9226)

- Update the profile widget preview test expectations for the current rendered dimensions.

## 2026-07-24 — [`test: fix store proxy contract path`](https://github.com/lgs1920/studio/commit/420c57b0)

- Fix the `test:stores` script path and keep the store proxy contract test aligned with the current layout.

## 2026-07-24 — [`docs: add brand and season swatch reactivity spec`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Add the brand and season swatch reactivity technical specification.
- Describe the `CHANGE_BRAND_COLOR` and `CHANGE_SEASON_COLOR` event contract, provenance tracking, and redraw batching rules.
- Link the new specification from the technical documentation README and the root README.

## 2026-07-24 — [`docs: document video crop behavior`](https://github.com/lgs1920/studio/commit/5a869824)

- Document the editable crop's persisted dimensions, edge-only snapping, and normalized scale contract.
- Clarify that leaving the video editor persists the mounted crop before the UI state changes.

## 2026-07-24 — [`fix: preserve replay focus restoration`](https://github.com/lgs1920/studio/commit/d725a4ea)

- Return the scene focus promise from `Journey.focus` so replay restoration can await it.
- Ensure replay focus restoration finishes even when the focus callback itself returns no value.

## 2026-07-24 — [`fix: stabilize video crop persistence`](https://github.com/lgs1920/studio/commit/ddb89962)

- Preserve logical video crop dimensions across editor sessions.
- Normalize crop scale, remove resize feedback, and snap the crop only to composition bounds.

## 2026-07-24 — [`docs: add weekly count api specs and issues`](https://github.com/lgs1920/studio/commit/e3b26a01)

- Add the weekly count API spec and separate backend and studio issue drafts.

## 2026-07-23 — [`docs: add internal database skill and architecture`](https://github.com/lgs1920/studio/commit/a095213c)

- Add the internal database Skill and separate its scope from feature-level browser persistence.
- Document IndexedDB schemas, JavaScript APIs, backup formats, local folder synchronization, security, and current limitations.
- Refresh the LocalDB API reference and synchronization guide against the implementation.

## 2026-07-23 — [`docs: refine replay timeline constraints`](https://github.com/lgs1920/studio/commit/fc61a8ad)

- Document the single replay clip shared by Draft recording and HQ export.
- Reduce the widget track limit from 120 to 20.

## 2026-07-23 — [`docs: update AI rules and skills for commit history`](https://github.com/lgs1920/studio/commit/b48f4893)

- Update the project rules and AI skills for commit history and technical-documentation organization.

## 2026-07-23 — [`docs: specify arrow widget`](https://github.com/lgs1920/studio/commit/105c9bb6)

- Specify the Arrow widget UI, Solid icon variants, circle markers, independent colors, scaling, rotation, and handle interactions.

## 2026-07-23 — [`docs: specify replay video widget`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Document the Arrow widget and the replay video widget architecture.
- Define video source, replay timing, audio, trimming, end-of-video hiding, and HQ export behavior.

## 2026-07-22 — [`fix: preserve replay widget opacity and UI layering`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Preserve configured widget opacity during replay previews.
- Keep widget toolbars and menus above video widgets.

## 1.0.0-beta.3

- Add grid snapping and widget-to-widget snapping, including center alignment during video composition.

## 2026-07-22 — [`fix: improve widget snapping during video composition`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Snap widgets to one another on the active video board, including center alignment when widgets do not touch.
- Refresh snapping targets as widgets are added or removed and improve snap guideline visibility.

## 2026-07-22 — [`fix: start recording after video preparation`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Start recording automatically when the video widgets are ready after launching Record from the tunnel.
- Remove the duplicate Record button from the Video Recorder widget and cover the flow with integration tests.

## 2026-07-22 — [`fix: remove replay trace console logs`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Stop emitting `[LGS replay trace]` messages to the browser console while preserving internal replay diagnostics.
- Add a regression test for camera timing diagnostics.

## 2026-07-22 — [`fix: correct widget text rendering`](https://github.com/lgs1920/studio/commit/COMMIT_ID)

- Preserve text widget scale state during editing.
- Render Journey Stats text shadows consistently and clip overflowing content.

## 2026-07-22 — [`fix: style selected tunnel step`](https://github.com/lgs1920/studio/commit/330b9fcf)

- Highlight the active Tunnel step with the on-map theme and compact spacing.

## 2026-07-22 — [`fix: stabilize journey toolbar replay controls`](https://github.com/lgs1920/studio/commit/0f981d6f)

- Stop Journey toolbar orbit controls without relaunching the camera rotation.
- Temporarily hide the Journey toolbar while linked replay video editing is open, then restore it without persistence.

## 2026-07-22 — [`fix: improve recording indicators`](https://github.com/lgs1920/studio/commit/76aac6eb)

- Use duotone recording indicators with white and state-specific colors.
- Distinguish preparation, ready, recording, and finalization phases for Draft and HQ workflows.
- Simplify recording labels and align progress metadata colors with the action icons.

## 2026-07-22 — [`fix: reset replay Z1/Z2 diagnostic overlay lifecycle`](https://github.com/lgs1920/studio/commit/370ed572)

- Show the Z1/Z2 diagnostic overlay at the start of every replay.
- Remove it at replay completion, stop, and video-dialog restoration.

## 2026-07-22 — [`fix: synchronize replay draft final frame`](https://github.com/lgs1920/studio/commit/7ddff621)

- Keep the replay trace scoped to the video scene.
- Preserve up to 2048 uniformly sampled trace points and the terminal point.
- Compose terminal replay frames before stopping the Draft recorder.

## 2026-07-22 — [`d35db5b`](https://github.com/lgs1920/site/commit/d35db5b) — Update bilingual homepage roadmap and access copy

- [2026-07-22 — `fix: make replay lookahead FPS aware`](https://github.com/lgs1920/studio/commit/42eb8c69)
- Replay camera look-ahead now accounts for the output frame interval in Draft and HQ.
- [2026-07-22 — `refactor: split journey replay responsibilities`](https://github.com/lgs1920/studio/commit/98a0e462)
- Split the journey replay facade from camera, session, runtime, visibility, and clip responsibilities.
- [2026-07-22 — `refactor: organize tests by responsibility`](https://github.com/lgs1920/studio/commit/387db846)
- Organized tests into unit, integration, and UI responsibility directories.
- [2026-07-22 — `docs: document internal skills`](https://github.com/lgs1920/studio/commit/9023ef5e)
- Documented the versioned roadmap and cloud access milestone.
- Split the 3D drone path editor specification from the drone camera runtime architecture.
