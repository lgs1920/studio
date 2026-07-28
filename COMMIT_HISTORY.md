# Commit History

## 2026-07-28 — [`fix(replay): align render contract consumers points 5-7`](https://github.com/lgs1920/studio/commit/02f21f5d)

- Make Draft and HQ consume the same logical replay render contract.
- Route HQ widget composition through the shared replay visibility resolver.
- Add regression coverage and document the Draft/HQ contract ownership rules.

## 2026-07-28 — [`fix: align test setup and profile metrics`](https://github.com/lgs1920/studio/commit/0339f1d4624969122f7ec165b48cc5d92399f653)

- Restrict Vitest discovery to actual test files and support Markdown imports and adopted style sheets in jsdom.
- Align POI editor, track visibility, profile metrics, and elevation profile test coverage with the current implementation.

## 2026-07-28 — [`fix: replay video debug overlays`](https://github.com/lgs1920/studio/commit/3c51b4035e3b8709f211796e19b999722126877f)

- Add a Debug camera switch to the Advanced camera setup for video-linked replay.
- Keep replay camera diagnostics visible on screen and in the composed video when enabled.

## 2026-07-28 — [`test(replay): cover repeated camera snapshot starts`](https://github.com/lgs1920/studio/commit/d55848268357f5d64bc5d76bf212dbdc39409809)

- Add integration coverage for repeated replay camera snapshot starts.

## 2026-07-28 — [`fix(replay): keep draft camera updates on live timing`](https://github.com/lgs1920/studio/commit/28600a614d05d01d57cc8980af78a289da24f28e)

- Keep Draft replay camera updates on live timing instead of forcing a logical camera trajectory.

## 2026-07-28 — [`fix(replay): keep stable logical camera poses deterministic`](https://github.com/lgs1920/studio/commit/d5e3c30360b508d7bb7b9f750f950fc36cb1179a)

- Preserve deterministic logical camera pose application while keeping normal replay playback on its live camera path.

## 2026-07-28 — [`fix(replay): finalize scene restoration after abort`](https://github.com/lgs1920/studio/commit/9292096b296cad353916a4ee255dbef25949bca0)

- Route aborted playback through the shared scene-restoration finalizer.
- Keep camera, UI, visibility, and replay state cleanup consistent after listener failures.
- Add regression coverage for the public restoration wrapper and premature abort path.

## 2026-07-28 — [`fix(replay): ignore stale Cesium focus after restart`](https://github.com/lgs1920/studio/commit/355d952efeb0596330294f50fd9902873229b431)

- Reapply the active replay camera pose when a cancelled Cesium focus operation settles late.
- Add regression coverage for replay restart and stale focus completion.

## 2026-07-28 — [`docs: clarify project issue and rules workflow`](https://github.com/lgs1920/studio/commit/7f91689356c7e7f1d28ac9341c40de226983e468)

- Clarify the English-only rule for documentation and issue content.
- Define validation and default backlog/milestone behavior for issue creation.
- Require project-rules changes to remain isolated in a dedicated change set.

## 2026-07-28 — [`docs: add GitHub Actions deployment migration study`](https://github.com/lgs1920/studio/commit/c7b1c7b4e638aaefe9965209a0468ad77216af66)

- Analyze staged migration strategies for Studio deployment through GitHub Actions.
- Define security, release, rollback, validation, and environment requirements.
- Keep deployment concerns separate from the Draft/HQ replay render-mode contract.

## 2026-07-28 — [`test(ui): align video download dialog assertions`](https://github.com/lgs1920/studio/commit/f948ac3a93fd983d1f9c90ad50a676d66ca7dd3b)

- Wait for the HQ download action to become available before asserting the dialog state.
- Align the draft download assertion with the current button label.

## 2026-07-28 — [`fix(ui): preserve cropper pointer pass-through`](https://github.com/lgs1920/studio/commit/29c01aa6f3db62cfc896ab3664ef4cd97c379952)

- Keep the cropper shell and crop overlay transparent to pointer events.
- Block input around the crop window while leaving the crop window available to Cesium.
- Cover the pass-through behavior and capture-lock interaction with UI tests.

## 2026-07-28 — [`test(replay): cover logical render contracts`](https://github.com/lgs1920/studio/commit/b84cfb2e13a35d848e3802b00d6b60907ff4c4e7)

- Add unit coverage for logical camera poses, frames, clips, and track paths.
- Verify that Draft and HQ share visual inputs while using distinct scheduling policies.

## 2026-07-28 — [`fix(replay): complete camera state and render mode fixes (#410 #427)`](https://github.com/lgs1920/studio/commit/99f724fa3b67a361c98ba3517feeb5d08c86d806)

- Complete replay camera state restoration and shared Draft/HQ render-mode contracts.
- Add replay integration and unit coverage for camera paths, scene state, export, and playback.
- Document the replay render-mode architecture and camera tracking-zone behavior.

## 2026-07-27 — [`fix(replay): remove replay and path logs`](https://github.com/lgs1920/studio/commit/263d6510b0beab739f89a538513ca3aaa051fc0f)

- Remove noisy replay and camera-path logging from playback and video synchronization flows.
- Preserve the replay camera and scene restoration lifecycle while keeping diagnostics available where needed.

## 2026-07-27 — [`fix(replay): align replay sync coverage`](https://github.com/lgs1920/studio/commit/526aa16901f6e37c9068713b63ae2efc7f099079)

- Align replay synchronization state, camera capture, and terrain lookup transitions across Draft recording and playback.
- Extend integration coverage for the synchronized recording flow.

## 2026-07-27 — [`Tune replay camera trajectory control`](https://github.com/lgs1920/studio/commit/57b73a6893c3df624881bc2c7a9c459fcdc70ff7)

- Tune replay trajectory pacing and turn responsiveness for constrained camera paths.
- Add duration-aware pacing support and cover the updated camera math.

## 2026-07-27 — [`Add replay camera path unit coverage`](https://github.com/lgs1920/studio/commit/25441f9bccdd8daab505f96d0bea4a35a1413def)

- Add unit coverage for the constrained replay camera path.

## 2026-07-27 — [`docs(replay): document camera update tracing and cache`](https://github.com/lgs1920/studio/commit/5928ab4b08a8e96d730983a26d773ef5f4d1f0ba)

- Document the replay camera update cache and the finer-grained update-step tracing.
- Clarify that the hot replay camera path now reuses an ephemeral per-update cache for repeated visibility and collision checks.

## 2026-07-27 — [`fix: stabilize replay Draft and HQ capture`](https://github.com/lgs1920/studio/commit/4b9d4d906297145624747b43cfb8811dec980a38)

- Remove synchronous bulk camera path compilation from Draft and HQ runtime capture.
- Start linked Draft replay outside the recorder start listener and expose preparation timing traces.
- Stabilize deterministic HQ frame state, camera ownership, widget readiness, and overlay composition.
- Add replay capture regression coverage and document the non-blocking runtime policy.

## 2026-07-27 — [`docs(path): note terrain collision correction`](https://github.com/lgs1920/studio/commit/7f9b40eee2b572435defdfee530da466a6cc0a49)

- Add a terrain collision avoidance note to the drone camera path architecture spec.
- Clarify that terrain correction must be serialized in the path for replay, Draft, and HQ reuse.

## 2026-07-27 — [`docs(replay): add glow neon spec`](https://github.com/lgs1920/studio/commit/5804643ca00fd482f268fd6b2973c6b849dab551)

- Add the replay trace and marker glow/neon specification under `tech-doc/todo/`.
- Link the new spec from the `tech-doc` documentation indexes.
- Keep the replay architecture document and unrelated runtime changes out of this documentation commit.

## 2026-07-26 — [`fix: smooth replay camera pitch and capture cadence`](https://github.com/lgs1920/studio/commit/e7e49f78f616da9733d7f8951029f24394158bde)

- Keep the nominal replay pitch when corrections rebuild camera frames.
- Bypass the small progress-key throttle while replay video capture is active so the camera follows every frame.
- Add regression coverage for the capture-active update cadence.

## 2026-07-26 — [`fix: preserve replay camera pitch through corrections`](https://github.com/lgs1920/studio/commit/e06a6451)

- Keep the nominal replay pitch when corrections rebuild camera frames.
- Stop replay corrections from inheriting the live Cesium pitch as the target pitch.

## 2026-07-26 — [`docs: refresh replay camera and HQ overlay docs`](https://github.com/lgs1920/studio/commit/fe1ab707)

- Refresh the replay core readme with the recent camera transfer and HQ overlay responsibilities.
- Document the camera cadence and cancellation refinement in the drone camera path spec.
- Note the hidden replay diagnostics canvas behavior in the replay video architecture TODO.

## 2026-07-26 — [`fix: stabilize replay camera path and HQ overlay capture`](https://github.com/lgs1920/studio/commit/29a72fee)

- Allow replay camera transfers to switch between frame and time cadence for draft capture.
- Support function-based camera transition cancellation tokens.
- Keep hidden replay diagnostics canvases visible to the HQ overlay composer.

## 2026-07-26 — [`fix: align replay camera path cadence and cancellation`](https://github.com/lgs1920/studio/commit/4b28cdd6)

- Allow replay camera transfers to run on a time cadence when draft capture needs it.
- Make camera transition cancellation handle function-based cancel tokens safely.

## 2026-07-26 — [`fix: scope panorama transfer to the widget`](https://github.com/lgs1920/studio/commit/6f30bf95)

- Keep the panorama flight local to `PanoramaWidget` and its transfer helper.
- Remove the broader replay camera architecture changes from the commit.

## 2026-07-26 — [`fix: scope panorama transfer to the widget`](https://github.com/lgs1920/studio/commit/acaaccdf)

- Keep the panorama flight local to `PanoramaWidget` and its transfer helper.
- Remove the broader replay camera architecture changes from the commit.

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

## 2026-07-25 — [`docs: note app icon refresh in beta changelog`](https://github.com/lgs1920/studio/commit/cdcbc97ae6a077ae3e5925b97d8e5ca95338fdf5)

- Add a short release-note line stating that the app icons and favicon have been updated.

## 2026-07-24 — [`docs: add direct logging rule`](https://github.com/lgs1920/studio/commit/673ed1d60e16b8e64f0cd3b1e2fb99fe1c79dbe8)

- Add a direct logging rule to `PROJECT_RULES.md` so explicit logging requests use native console methods without wrappers.

## 2026-07-24 — [`fix: keep theme swatches reactive and Safari-safe`](https://github.com/lgs1920/studio/commit/96ef8cf3cf7005cf72b10ab6332fbc3c3d299069)

- Add a Safari-compatible fallback for `matchMedia('(prefers-color-scheme: dark)')` listeners.
- Replace frozen swatch memoization in color editors with reactive swatch reads.
- Cover the listener fallback and reactive swatch behavior with tests.

## 2026-07-24 — [`fix: stabilize poi snapdom rendering in firefox`](https://github.com/lgs1920/studio/commit/4b756f79e0ab3160408c03a7ebe035018816f924)

- Add a regression test for the POI map card CSS.
- Contain the POI snapshot background in a positioned stacking context.
- Replace the shrinked POI inset shadow with a real border so Firefox renders the marker consistently.

## 2026-07-24 — [`test: update profile widget preview dimensions`](https://github.com/lgs1920/studio/commit/505c9226)

- Update the profile widget preview test expectations for the current rendered dimensions.

## 2026-07-24 — [`test: fix store proxy contract path`](https://github.com/lgs1920/studio/commit/420c57b0)

- Fix the `test:stores` script path and keep the store proxy contract test aligned with the current layout.

## 2026-07-24 — [`docs: add brand and season swatch reactivity spec`](https://github.com/lgs1920/studio/commit/a47fd1e260fdedbb32e4482cb8ebf0caef205e68)

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

## 2026-07-23 — [`docs: specify replay video widget`](https://github.com/lgs1920/studio/commit/ad4b4dd44e9eccbead02f5e62e6a55da43857a55)

- Document the Arrow widget and the replay video widget architecture.
- Define video source, replay timing, audio, trimming, end-of-video hiding, and HQ export behavior.

## 2026-07-22 — [`fix: preserve replay widget opacity and UI layering`](https://github.com/lgs1920/studio/commit/c256f26f352e75f5cd7492fc340e2c5d2e33c1c6)

- Preserve configured widget opacity during replay previews.
- Keep widget toolbars and menus above video widgets.

## 1.0.0-beta.3

- Add grid snapping and widget-to-widget snapping, including center alignment during video composition.

## 2026-07-22 — [`fix: improve widget snapping during video composition`](https://github.com/lgs1920/studio/commit/4df993376deeb3aace2a15411d7da4fc227f89d1)

- Snap widgets to one another on the active video board, including center alignment when widgets do not touch.
- Refresh snapping targets as widgets are added or removed and improve snap guideline visibility.

## 2026-07-22 — [`fix: start recording after video preparation`](https://github.com/lgs1920/studio/commit/39a5b57eba9d6f4333d73cb5464ceb02c9965924)

- Start recording automatically when the video widgets are ready after launching Record from the tunnel.
- Remove the duplicate Record button from the Video Recorder widget and cover the flow with integration tests.

## 2026-07-22 — [`fix: remove replay trace console logs`](https://github.com/lgs1920/studio/commit/c2a6f3e857458f68d17cd2f8bcc949fd33340ddf)

- Stop emitting `[LGS replay trace]` messages to the browser console while preserving internal replay diagnostics.
- Add a regression test for camera timing diagnostics.

## 2026-07-22 — [`fix: correct widget text rendering`](https://github.com/lgs1920/studio/commit/e9b95d5238c86b13dfe50861be3d856d77ce7b53)

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

## 2026-07-26 — [`fix: open code dependencies in stacked drawer`](https://github.com/lgs1920/studio/commit/acaaccdf)

- Added a stacked Code dependencies drawer to the Information panel.
- Moved the dependency inventory behind the drawer and kept the Credits tab link lightweight.
- Added coverage for the stacked drawer opening helper.
