# Commit History

## 2026-09-01 — `feat(ui): extend timeline Web Component interactions`

- Extend the timeline Web Component with interactive track and clip rendering,
  visibility controls, title editing, drag lifecycle events, and pointer-event
  suppression.
- Align the Web Awesome timeline layout, scrolling, ruler labels, handles,
  minimum dimensions, themed colors, and elevation tokens.
- Update the component tests, README, and Web Component specification.

## 2026-09-01 — `refactor(replay): rename Replay clip phases`

- Rename the Replay clip phases from `start` and `stop` to `pre-replay` and
  `post-replay` across the catalog, normalization, preparation timeline,
  playback timeline, and overlay visibility rules.
- Preserve backwards-compatible aliases and normalize legacy slot values.
- Update Replay clip, exporter, camera-overlay, statistics, and timeline tests.

## 2026-09-01 — `feat(replay): enable timeline preview interactions`

- Replace the read-only preview projection with the interactive timeline Web
  Component capabilities while keeping Replay as the application state owner.
- Add compact floating-widget dimensions, continuous external drag/resize
  handling, track ordering and visibility projection, and matching preview CSS.
- Update the preview, utility, widget-host, and style coverage.

## 2026-09-01 — `docs(replay): document timeline Web Component integration`

- Document the Web Component public contract, local interactions, layout
  constraints, scrolling behavior, and remaining controller boundaries.
- Update the timeline README and replay implementation specifications.

## 2026-08-31 — `refactor(replay): use timeline Web Component preview`

- Replace the React timeline package rendering in the Replay preparation preview with `lgs1920-timeline`.
- Preserve the existing projected tracks, clips, ordering, labels, duration, and current time.
- Keep the first integration display-only while the Replay event and controller wiring remains decoupled.

## 2026-08-30 — `feat(ui): add LGS1920 Web Component timeline`

- Add the standalone `lgs1920-timeline` Web Component with Web Awesome and Font Awesome integration.
- Support controlled timeline data, JSON/YAML input, editable and persisted track names, slots, context menus, and CSS custom properties.
- Keep the React adapter and component tests beside the Web Component implementation.

## 2026-08-30 — [`feat(ui): add hierarchical drawer navigation engine`](https://github.com/lgs1920/studio/commit/3551b66a)

- Store drawer navigation in Valtio as a drawer, tab, and internal target hierarchy.
- Activate requested tabs, expand parent details, and scroll to internal drawer targets.
- Add navigation toggling and close previous details targets when switching destination.

## 2026-08-30 — `fix(replay): toggle timeline drawer targets`

- Open or close the related widget editor or Replay drawer from a timeline double-click.
- Focus the selected Replay clip through the generic drawer navigation engine.
- Keep the locked Replay timeline action inert.

## 2026-08-03 — [`docs: add Three.js camera orientation preview`](https://github.com/lgs1920/studio/commit/422a46c3994f4bcadce94a1385991f4e2d5551d9)

- Add the 3D Three.js camera HPR orientation sphere prototype, poster, and MP4 preview.
- Document how to view the embedded video and serve the deterministic interactive HTML preview.
- Keep the pinned browser Three.js modules beside the prototype assets for offline preview.

## 2026-08-03 — [`fix(replay): remove hidden trace geometry`](https://github.com/lgs1920/studio/commit/5fbb2abbb6982daf5e2a13d9cc5bac1b4c376654)

- Remove the replay data source and all replay entities when trace visibility is disabled.
- Recreate the source only after an explicit visibility request, keeping live replay and export cleanup consistent.
- Update renderer coverage to assert total source removal.

## 2026-08-03 — [`fix(replay): centralize trace visibility`](https://github.com/lgs1920/studio/commit/cc446bd685ddc42de3fe861e41bca4228bbeba94)

- Keep replay trace visibility in one renderer state shared by live playback and video replay frames.
- Prevent an update without an explicit visibility instruction from re-enabling a hidden trace.
- Add coverage for hide persistence and explicit reactivation.

## 2026-08-03 — [`fix(replay): remove trace data source on exit`](https://github.com/lgs1920/studio/commit/94f5f2dfc8f085a8489917a1cce9a752d0af6506)

- Remove the replay `CustomDataSource` from Cesium when playback ends or is stopped, cancelled, aborted, or restored for a dialog.
- Prevent an asynchronous source add from resurrecting a cleared replay trace.
- Add renderer coverage for complete data-source removal.

## 2026-08-03 — [`fix(replay): accelerate near-relief pitch correction`](https://github.com/lgs1920/studio/commit/ec6f8260dfec2d5965034a4a7cf225279bf25ff9)

- Measure rendered and terrain obstructions between the camera and the marker.
- Expand the proven-safe pitch envelope and accelerate the response for relief closer than one kilometer.
- Add regression coverage for immediate and near-relief correction timing.

## 2026-08-03 — [`fix(replay): stabilize camera tracking and pitch correction`](https://github.com/lgs1920/studio/commit/2fef3ddd521040b9423d8624e69c4bbb887b75d9)

- Keep replay pitch correction transient without persisting automatic camera frames as user input.
- Preserve Navigation recentering while visibility correction owns the camera.
- Align Draft and HQ camera resolution and remove replay camera console diagnostics.
- Update replay camera tests and technical documentation.

## 2026-08-01 — [`fix(replay): stabilize camera tracking and depth visibility`](https://github.com/lgs1920/studio/commit/eda0a39c90d64962f03d181055ae8017db52810a)

- Adapt replay tracking zones and camera transitions to short timeline budgets.
- Keep ground-offset camera heights anchored to the rendered marker and correct terrain/depth occlusion.
- Add camera regression coverage and update the replay camera specifications.

## 2026-08-01 — [`refactor(replay): centralize Draft and HQ video timeline`](https://github.com/lgs1920/studio/commit/1647403a9f49240b5627e9857c9f5a86f23dd8de)

- Share the canonical start, replay, and stop timeline between Draft playback and HQ export.
- Publish absolute frame timing and clip phase metadata to replay rendering consumers.
- Add unit coverage for timeline boundaries and Draft/HQ phase parity.

## 2026-08-01 — [`fix: align Vite config with native loader`](https://github.com/lgs1920/studio/commit/f8eed3f75dff4d563f6885596509a078540b79d5)

- Rename the Vite configuration to `.mts` so its ESM syntax is compatible with the native config loader.
- Replace CommonJS `__dirname` usage with `import.meta.dirname` and update related documentation references.
## 2026-08-03 — [`docs: include site and backend issue history in changelogs`](https://github.com/lgs1920/studio/commit/5a2e8191)

- Include all `site` and `backend` issues closed since the latest previous Studio release when preparing a changelog.
- Use the previous Studio changelog date as the boundary even when those issues have no Project `Target release` or milestone.

## 2026-07-28 — [`docs: require issue draft validation`](https://github.com/lgs1920/studio/commit/03ce0f44)

- Require clarification of missing issue details before drafting an issue.
- Require explicit user validation of the complete issue content before creation.

## 2026-07-28 — [`docs: update project rules`](https://github.com/lgs1920/studio/commit/f8b303ce)

- Require project documentation and issue content to be written in English.
- Define `Backlog` and the latest available milestone as defaults when issue values are not specified.
- Require every `PROJECT_RULES.md` change to use a dedicated commit, pull request, and merge into `main`.
## 2026-07-29 — [`chore: synchronize path aliases`](https://github.com/lgs1920/studio/commit/43756c42a7402b6fdc2bf86d9f7af131672c5315)

- Synchronize TypeScript, Vite, and Vitest path aliases.
- Add aliases for assets, widgets, settings, tests, events, core UI, and database modules.

## 2026-07-29 — [`fix(video): prevent replay focus flash on exit`](https://github.com/lgs1920/studio/commit/e8486c589fac0404919e631232503625b6a74d51)

- Pre-focus the final replay scene before opening the video dialog after completion or early exits.
- Reuse the same focus and cleanup path for cancel, abort, and native dialog close flows.
- Add regression coverage for deferred scene restoration and focus ordering.

## 2026-07-29 — [`fix(replay): correct Draft replay timeline progress`](https://github.com/lgs1920/studio/commit/09f8515cc74077ecaf7ce6bf0528a19510bbf408)

- Calculate Draft progress from the complete replay timeline, including enabled start and stop clips.
- Prefer recorder elapsed time and the controller playback duration over sampler-only frame metadata.
- Add regression coverage for missing frame metadata, pre-plan progress, preparation reset, and final completion.

## 2026-07-29 — [`fix(replay): correct Draft replay progress percentage`](https://github.com/lgs1920/studio/commit/b0a24598a67ab327c56dd5b23bec45e78370b619)

- Resolve Draft replay progress from rendered frames or elapsed timeline time, with clamped 0–100 percent output.
- Use the complete Draft video timeline, keep updates monotonic, and preserve the final 100 percent state on stop.
- Add unit, UI, and integration coverage for frame progress, elapsed-time fallback, and Draft recording completion.

## 2026-07-28 — [`fix(replay): stop predictive pitch accumulation`](https://github.com/lgs1920/studio/commit/8d243946)

- Keep Draft lookahead available for heading and position corrections without applying predictive pitch when the current view is already visible.
- Make HQ use the current visibility state, reset deterministic follower velocity, and restore the exact nominal pitch.
- Add camera regression coverage and document the Draft/HQ predictive pitch contract.

## 2026-07-28 — [`fix(replay): depth-test the replay marker against relief`](https://github.com/lgs1920/studio/commit/fc6e7b4d)

- Keep the replay marker depth-tested so terrain relief and 3D tiles can occlude it.
- Add renderer regression coverage and document the relief-masking rule.

## 2026-07-28 — [`fix(replay): restore nominal pitch after temporary camera corrections`](https://github.com/lgs1920/studio/commit/6f64303f)

- Restore the logical nominal pitch after temporary navigation or Dynamic camera corrections.
- Document the distinct Navigation Z1 and Dynamic Z1/Z2 pitch rules.
- Add regression coverage for pitch restoration without bulk camera-path compilation.

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

## 2026-07-30 — [`docs: define site and backend issue mirroring`](https://github.com/lgs1920/studio/commit/1802ff1858927fda9b0b807632681b6fa8641b8f)

- Require every open Site and Backend issue to have a corresponding Studio mirror.
- Preserve issue types, use domain-specific title prefixes and labels, and maintain reciprocal links.
- Prevent duplicate mirrors by checking existing open and closed Studio issues.

## 2026-08-03 — [`docs: specify camera HPR orientation sphere widget`](https://github.com/lgs1920/studio/commit/7d532e6b)

- Specify the proposed Three.js camera Heading, Pitch, and Roll orientation sphere widget.
- Document its interaction contract, Cesium camera ownership, capture behavior, and future implementation boundaries.

## 2026-08-03 — [`fix(replay): prevent trace redraw after playback`](https://github.com/lgs1920/studio/commit/73025a69)

- Prevent post-playback refreshes from recreating the replay trace while recording synchronization remains enabled.
- Cover inactive replay cleanup and active replay trace rendering with a regression test.

## 2026-08-04 — [`fix(video): support standalone video and replay modes`](https://github.com/lgs1920/studio/commit/8e335855)

- Keep video-only recording independent from Replay and omit the draft suffix outside synchronized mode.
- Keep Replay-only playback independent from video and display its trace without video synchronization.
- Preserve synchronized video and Replay recording with its existing Draft and HQ export flow.

## 2026-08-04 — [`docs: add beta.4 changelog`](https://github.com/lgs1920/studio/commit/536b4450)

- Add the 1.0.0-beta.4 release changelog with Studio and Backend closed issues, resources, feature backlog, and known issues.
## 2026-08-04 — [`chore: update studio version to 1.0.0`](https://github.com/lgs1920/studio/commit/7ca41a768d6ea45a79a8f0530db7bb85b39586e6)

- Update the Studio version from 1.0.0-beta.4 to 1.0.0.

## 2026-08-04 — [`fix(video): preserve credits and logo in HQ replay`](https://github.com/lgs1920/studio/commit/4098e6cc7344918d2037ded0f84d5b9b4543db29)

- Keep the mandatory Credits and Logo widgets mounted during HQ replay export.
- Exclude Credits tooltips from the widget canvas capture so hidden tooltip text does not appear in the generated video.
- Add regression coverage for HQ widget mounting and capture exclusions.

## 2026-08-03 — [`docs: record project rules changelog rule commit`](https://github.com/lgs1920/studio/commit/ceeb1356489eccc8cf6886380a828f0159af5570)

- Recorded automatically from Git history.

## 2026-08-03 — [`Merge pull request #451 from lgs1920/agent/project-rules-site-backend-changelog`](https://github.com/lgs1920/studio/commit/013dfce50c04e082275b44af2ef7b7fb33a0a51a)

- docs: include site and backend issue history in changelogs

## 2026-08-04 — [`docs: record beta.4 changelog commit`](https://github.com/lgs1920/studio/commit/48b252eedc6d75b3119a00cc686a29323a52c74b)

- Recorded automatically from Git history.

## 2026-08-04 — [`Merge branch 'main' into 1.0.0-beta.4`](https://github.com/lgs1920/studio/commit/d1b7f42d3c3883dd40fdea40ebb233009e1b807d)

- Recorded automatically from Git history.

## 2026-08-04 — [`Merge pull request #453 from lgs1920/1.0.0-beta.4`](https://github.com/lgs1920/studio/commit/c78d4aa59703e89c876107fbdeb35c762c75b9e1)

- 1.0.0 beta.4

## 2026-08-04 — [`feat(automation): update commit history after pushes`](https://github.com/lgs1920/studio/commit/90aeedcdc8c01273248557f3c1cb1b52f630cd69)

- Recorded automatically from Git history.

## 2026-08-04 — [`docs: automate commit history rule`](https://github.com/lgs1920/studio/commit/8ba13eef9efdd98c358fa06e437b32407ed1e28d)

- Recorded automatically from Git history.

## 2026-08-04 — [`Merge pull request #456 from lgs1920/agent/commit-history-automation`](https://github.com/lgs1920/studio/commit/6c8a7cafaec693f1cfc6a7c5c1c79336eb0efc23)

- feat: automate commit history updates

## 2026-08-04 — [`docs: record studio version commit`](https://github.com/lgs1920/studio/commit/61298cc6c8f5bf27b0c9d2c28c48963fb3970a34)

- Recorded automatically from Git history.

## 2026-08-04 — [`docs: record HQ replay widget fix`](https://github.com/lgs1920/studio/commit/55cc010eb431ccd7081a58bba2a5064f352324ea)

- Recorded automatically from Git history.

## 2026-08-04 — [`fix(replay): tune camera motion sensitivity`](https://github.com/lgs1920/studio/commit/e762e0621ba65cf33ad5f5203cf15c6dcce8e1eb)

- Recorded automatically from Git history.

## 2026-08-05 — [`chore: add CesiumJS agent skills`](https://github.com/lgs1920/studio/commit/3bff34a9e27e97f22b24c527259385d8acd7522f)

- Recorded automatically from Git history.

## 2026-08-05 — [`Merge branch 'chore/cesiumjs-agent-skills'`](https://github.com/lgs1920/studio/commit/b32bc09e8e0df8a67f2e5121ffe41fa3b9d53161)

- Recorded automatically from Git history.

## 2026-08-05 — [`Merge remote-tracking branch 'origin/main'`](https://github.com/lgs1920/studio/commit/61a3c6130f03b802970a378c9e0587e42c5d4524)

- Recorded automatically from Git history.

## 2026-08-12 — [`docs: document available Bun commands`](https://github.com/lgs1920/studio/commit/d0abe71e1ab3b21c2e5570475dbbc7567132d9cb)

- Recorded automatically from Git history.

## 2026-08-12 — [`fix: configure persistent launch registration storage`](https://github.com/lgs1920/studio/commit/bda87418a02ea20bfe457376aca533170562bca1)

- Recorded automatically from Git history.

## 2026-08-12 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/bf87263beff5e02d813a524c908a15773f6f2760)

- Recorded automatically from Git history.

## 2026-08-12 — [`docs: add Three.js open source credit`](https://github.com/lgs1920/studio/commit/433df065e1b475551e04f219fa2d70ec6571d44d)

- Recorded automatically from Git history.

## 2026-08-12 — [`docs: regroup media and asset credits`](https://github.com/lgs1920/studio/commit/17c677e732f921d81b9dfec862c1f679977a97eb)

- Recorded automatically from Git history.

## 2026-08-13 — [`fix: crop generated logo PNGs to visible bounds`](https://github.com/lgs1920/studio/commit/e36abcc6d24c720bda8ef2525906e247cbb16061)

- Recorded automatically from Git history.

## 2026-08-13 — [`feat: add persistent Studio welcome hero`](https://github.com/lgs1920/studio/commit/72ed1b0587bd4539108133a2a27e4021a78dc5b2)

- Recorded automatically from Git history.

## 2026-08-13 — [`merge: persistent Studio welcome hero`](https://github.com/lgs1920/studio/commit/0b7d377c1e5099bf5cefb5819939eab4ae0a6b65)

- # Conflicts:
- #	COMMIT_HISTORY.md
- #	scripts/update-commit-history.mjs

## 2026-08-13 — [`merge: sync main with origin`](https://github.com/lgs1920/studio/commit/93807769aa81fa23ae8ca96c6216cb99b8aa2afb)

- Recorded automatically from Git history.

## 2026-08-13 — [`feat: add shared welcome media catalog`](https://github.com/lgs1920/studio/commit/6fef4b20c59c0613325271fc7cb3dac48686e24e)

- Recorded automatically from Git history.

## 2026-08-13 — [`feat: add welcome hero route and animation fixes`](https://github.com/lgs1920/studio/commit/f53eaabac4f90d0a529fb6249674c5f46f8d7f47)

- Recorded automatically from Git history.

## 2026-08-13 — [`chore: keep only current changelog draft`](https://github.com/lgs1920/studio/commit/89536eca148e8af911b31cedefa3a4e8d738fff3)

- Recorded automatically from Git history.

## 2026-08-13 — [`fix: include error details in support email`](https://github.com/lgs1920/studio/commit/da8973744380b1f3d0031f549c8a4ed874d7acd4)

- Recorded automatically from Git history.

## 2026-08-13 — [`docs: update media credits`](https://github.com/lgs1920/studio/commit/55043474ad2c458daab64e3fbe6abb7956f0a0b3)

- Recorded automatically from Git history.

## 2026-08-13 — [`feat: show welcome media credit`](https://github.com/lgs1920/studio/commit/32a7c1a4493ef12f4e1aca1eb029e362c3d34cb5)

- Recorded automatically from Git history.

## 2026-08-13 — [`fix: hide welcome language selector`](https://github.com/lgs1920/studio/commit/65bae0373ec854bf7e6b528520836b65e2265dd1)

- Recorded automatically from Git history.

## 2026-08-13 — [`fix: fade welcome route edges`](https://github.com/lgs1920/studio/commit/cd84107e306edd34cb974e7961bf0821ceeb0ff8)

- Recorded automatically from Git history.

## 2026-08-13 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/8ecd3821a5ed81af5bdb8d811322c5eb32bcf582)

- Recorded automatically from Git history.

## 2026-08-13 — [`feat: show welcome build info`](https://github.com/lgs1920/studio/commit/c0ae51f2e9fc909ccc55df348acfc3aabe2ba553)

- Recorded automatically from Git history.

## 2026-08-13 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/537a9a75922824b7d9efd69648e8e662e747f685)

- Recorded automatically from Git history.

## 2026-08-13 — [`fix: align welcome hero halo with site`](https://github.com/lgs1920/studio/commit/f4b414079624c7ecd7329fc1a587bc0fdb8c2a80)

- Recorded automatically from Git history.

## 2026-08-14 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/35bc3436b10bc7ed5812bbceeccf3c68b86f477e)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-08-14 — [`feat: update Studio slogan`](https://github.com/lgs1920/studio/commit/681165af469e6fbfad966171b6814fe05bb68739)

- Recorded automatically from Git history.

## 2026-08-14 — [`feat: crossfade welcome hero videos`](https://github.com/lgs1920/studio/commit/83969121587aa0bb3e0012844637dc27a236263a)

- Recorded automatically from Git history.

## 2026-08-14 — [`fix: smooth welcome hero video transitions`](https://github.com/lgs1920/studio/commit/f8cd9d167bf4e655c37d2e3e7f747fbd9899a848)

- Recorded automatically from Git history.

## 2026-08-14 — [`fix: remove initial welcome hero video fade`](https://github.com/lgs1920/studio/commit/0c46716dfdcb4de2ba9fb768c1fe9a6e11afaf49)

- Recorded automatically from Git history.

## 2026-08-14 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/db20ccb8e51f93c3aae824f51db30a88cc5cf970)

- Recorded automatically from Git history.

## 2026-08-14 — [`style: make IGN logo white`](https://github.com/lgs1920/studio/commit/fc503f43163b375a387467b157bbdfc0aa790a0e)

- Recorded automatically from Git history.

## 2026-08-15 — [`docs: update 1.0.0 changelog draft`](https://github.com/lgs1920/studio/commit/b52e1c6b4a06aaed0269f1f71738debe5b34a534)

- Recorded automatically from Git history.

## 2026-08-15 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/c41f9cf9107944d6fd9d2009fd7c687bfc6dfcc5)

- Recorded automatically from Git history.

## 2026-08-17 — [`perf(capture): improve SnapDOM font precaching`](https://github.com/lgs1920/studio/commit/49ca3b0da906b82e2a42ad02a0c805f7ba02dae0)

- Recorded automatically from Git history.

## 2026-08-17 — [`fix(ui): update welcome hero loading state`](https://github.com/lgs1920/studio/commit/f6e7e7d6fc5c51d9734e0aa71a77b69efca96ecc)

- Recorded automatically from Git history.

## 2026-08-17 — [`docs: document Bun migration study`](https://github.com/lgs1920/studio/commit/b3d201d7f24a6ce66c7253d659f2489f7e53e23b)

- Recorded automatically from Git history.

## 2026-08-17 — [`fix: handle local file reading errors`](https://github.com/lgs1920/studio/commit/67dce8bf4cf3bdcf744027ac7fe5431a31b91463)

- Recorded automatically from Git history.

## 2026-08-17 — [`fix(replay): continue HQ export after tile timeout`](https://github.com/lgs1920/studio/commit/bb12a862b7ff0d7f93092d89e7f27b9fcd443092)

- Recorded automatically from Git history.

## 2026-08-17 — [`perf(replay): retain Cesium tiles during HQ export`](https://github.com/lgs1920/studio/commit/ea4426a9e852cd77929b4938a7e353650ba2d730)

- Recorded automatically from Git history.

## 2026-08-18 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/37dee8ed2234902a90a300ce595e6ddbcba9d72b)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: stabilize PWA update flow`](https://github.com/lgs1920/studio/commit/7a47d113ce53194663fa431564f40bd655d929b1)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: fingerprint PWA releases reliably`](https://github.com/lgs1920/studio/commit/c5a4777abb396ec8a2c5b507b05c1be072d4f763)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: hide boot splash in webapp`](https://github.com/lgs1920/studio/commit/1d80dbdbf3198bfb3a3cb8d08936c09a6312cbac)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat: support layer-specific map credits`](https://github.com/lgs1920/studio/commit/8678f3217417d444da3e1b66cbaef7ca6ae343d4)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat: add internal Google Maps attribution`](https://github.com/lgs1920/studio/commit/8eed89e343e2996600ef601a0ae42b4d2e61498e)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: remove webapp startup flash`](https://github.com/lgs1920/studio/commit/b8d2f62398d7012b8d3d22a6b955059c8bd1409f)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: improve PWA icon masks`](https://github.com/lgs1920/studio/commit/f1c3875ba51052396ac5010839a49295a84d9e68)

- Recorded automatically from Git history.

## 2026-08-18 — [`docs: enforce explicit user intent`](https://github.com/lgs1920/studio/commit/6325b0170728ce9d4ff31750bacba38d6c80f26b)

- Recorded automatically from Git history.

## 2026-08-18 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/2a1edda379e2864f05499f70905aa758f14ffa2d)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: add Google Maps attribution to photorealistic 3D tiles`](https://github.com/lgs1920/studio/commit/7879f068dbb40f41990896001cb319dc24ad9346)

- Recorded automatically from Git history.

## 2026-08-18 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/d6ce39a5c477d651028130652a4cb6b9581674be)

- Recorded automatically from Git history.

## 2026-08-18 — [`style: refine credits bar spacing`](https://github.com/lgs1920/studio/commit/97c235b9e79f1c5f68ff8305d37fc87fd7368895)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: prevent stale Esri credit with Google 3D`](https://github.com/lgs1920/studio/commit/4e33456a5f637ab1cbff28d697f4a393a57b754c)

- Recorded automatically from Git history.

## 2026-08-18 — [`style: refine widget credit spacing`](https://github.com/lgs1920/studio/commit/555b06fcc91fd53222dbf2a748eff3cd54d8d43a)

- Recorded automatically from Git history.

## 2026-08-18 — [`docs: document PWA installation and updates`](https://github.com/lgs1920/studio/commit/c9d6838c2a79b4381fde5684813c21b191a3982e)

- Recorded automatically from Git history.

## 2026-08-18 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/375464835bc8f601e16205d3e725c2a50e369dad)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix: align boot splash image with welcome video`](https://github.com/lgs1920/studio/commit/a6b69145d431c9424dfd1b2dfff2122a748d6ba9)

- Recorded automatically from Git history.

## 2026-08-18 — [`fix global label-at-start hint layout`](https://github.com/lgs1920/studio/commit/86957a0e7a327cefddf16ee6408074382f3e9240)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat replay tile readiness settings`](https://github.com/lgs1920/studio/commit/bf66876d4d65c2a90812aa0516a84bd78c1a6f51)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat coordinate replay scene tile readiness`](https://github.com/lgs1920/studio/commit/907f6a5a5aaf2baa7ae2de20737457a274a2fba9)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat prepare replay tiles before HQ capture`](https://github.com/lgs1920/studio/commit/1a611a0d92cd3a0e4fbaabf705cb4d4907e6868c)

- Recorded automatically from Git history.

## 2026-08-18 — [`feat expose replay tile readiness controls`](https://github.com/lgs1920/studio/commit/01ff65ad1ad8508a5212ecce71abd8f06ab2167a)

- Recorded automatically from Git history.

## 2026-08-18 — [`docs document replay tile readiness`](https://github.com/lgs1920/studio/commit/11eb13a6a558164712f23ff6941fbac81803b4d7)

- Recorded automatically from Git history.

## 2026-08-18 — [`docs research Cesium cloud resources`](https://github.com/lgs1920/studio/commit/c01e63b3ee9afec8bf76753f8d01c677998033ba)

- Recorded automatically from Git history.

## 2026-08-18 — [`docs specify journey Cesium lighting`](https://github.com/lgs1920/studio/commit/ced92860cbbac3abbce9ab127a9cc1e7d914b65a)

- Recorded automatically from Git history.

## 2026-08-18 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/9e27496dae4f49b7b2c4971dd9d60b4c4e3ad0c3)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: stabilize replay select values`](https://github.com/lgs1920/studio/commit/5c58fe64d28023f0dbe41cd3e360e3dbce47f2fa)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: keep crop zone centered during viewport resize (#470)`](https://github.com/lgs1920/studio/commit/c30793bf2d3b418cb0b26a8fd8c258aec080128a)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: render replay setup icon from fontawesome kit`](https://github.com/lgs1920/studio/commit/bd71d48d0df15d54449eb438587d7c800439bf79)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: add diagnostic details to error dialogs (#472)`](https://github.com/lgs1920/studio/commit/46dbbdb292d1cb28641288192e25c8e6117eaf20)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: keep replay popup toggle anchored`](https://github.com/lgs1920/studio/commit/38885c30701a27ac90b2a63d1733194876b55cf0)

- Recorded automatically from Git history.

## 2026-08-19 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/df073f0901ebbb101bc59d1bc7eb211c4780c6c1)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: add separate journey focus control (#445)`](https://github.com/lgs1920/studio/commit/c309e4480742709fd62088515089e2d0c9744289)

- Recorded automatically from Git history.

## 2026-08-19 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/b224453fa98179dfbcca38be7b4f2ab7c3061532)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: add journey metadata to recordings`](https://github.com/lgs1920/studio/commit/bf8794cda390c856d68236105c54b90358a7fc79)

- Recorded automatically from Git history.

## 2026-08-19 — [`fix: preserve metadata in HQ exports`](https://github.com/lgs1920/studio/commit/59ae000967eadd7a537a1f2fb46a402010c56a33)

- Fixes #467

## 2026-08-19 — [`Merge branch 'fix/replay-video-stats-overlay' into 1.0.0`](https://github.com/lgs1920/studio/commit/6afb4f6c3d0ba043bc59f8a1052b20fd49f03212)

## 2026-08-19 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/951a2c19b52e5909b7d8f536f2ebf510922cb914)

- Recorded automatically from Git history.

## 2026-08-20 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/5b5217d70904c363e3ce2142e65938fbb91f7bd1)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-08-20 — [`feat(video): consolidate recording HUD settings`](https://github.com/lgs1920/studio/commit/bd13f5db6a5bb1ea16e7635d88505c2f604b594f)

- Recorded automatically from Git history.

## 2026-08-20 — [`fix(widgets): normalize on-map bounds and margins`](https://github.com/lgs1920/studio/commit/869f65105f6abc0eb6030901b94663d3a3b67fb3)

- Recorded automatically from Git history.

## 2026-08-20 — [`feat(video): refine recording HUD controls`](https://github.com/lgs1920/studio/commit/cb5117915d63bb2658961f4601805d4f4fe23d40)

- Recorded automatically from Git history.

## 2026-08-20 — [`fix(video): adapt recording HUD for mobile`](https://github.com/lgs1920/studio/commit/7e787344b7256adb4ec74e275c49aaa279e7b6af)

- Recorded automatically from Git history.

## 2026-08-20 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/742fe379dd406e8fda3d4d7c53fcd5ce7517bb4c)

- Recorded automatically from Git history.

## 2026-08-20 — [`docs: synchronize branch documentation`](https://github.com/lgs1920/studio/commit/73acf296785a7b0910815347589b850b1ef9b135)

- Recorded automatically from Git history.

## 2026-08-20 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/2b4679ca5a6817f5967527297599a5e58aef825c)

- Recorded automatically from Git history.

## 2026-08-20 — [`fix(launch): enhance transition in webapp splash screen`](https://github.com/lgs1920/studio/commit/aa90dadbbbd884337e1694bb11676488bc7a7572)

- Recorded automatically from Git history.

## 2026-08-20 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/6023ccb64539a5356e74a7d91ec107e9169262b9)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: gate Cesium input during synchronized recording`](https://github.com/lgs1920/studio/commit/77321b5671b797affd742751f047e8bce8e8a198)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: align video HUD and recording controls`](https://github.com/lgs1920/studio/commit/a2887899df0a576c66c9dc6331e3721127acc672)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: route crop interactions to Cesium`](https://github.com/lgs1920/studio/commit/39a95b9f11860ce5b0b5e98c6891da0ccdc7b238)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: stabilize replay widget composition`](https://github.com/lgs1920/studio/commit/45040f34fc75cb2d6c01ca922d4a7f554434f7a5)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: keep crop pass-through outside Cesium widgets`](https://github.com/lgs1920/studio/commit/29bdc97750b035faf49a4c4124b0dff00fe0ae9b)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: enlarge HQ replay HUD actions`](https://github.com/lgs1920/studio/commit/fc02e1f6f2b400a49005b6047c63317a7899dfdb)

- Recorded automatically from Git history.

## 2026-08-22 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/c0e6d55779c01c2c982fb491a82caae7a3fbe542)

- Recorded automatically from Git history.

## 2026-08-22 — [`chore: keep Cesium skills up to date`](https://github.com/lgs1920/studio/commit/28b254a2e54c451763a9baa0561d87931bccabe9)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: reload after service worker activation`](https://github.com/lgs1920/studio/commit/02a3efbb60610495c80ebea6ff7a6156f0f9b59b)

- Recorded automatically from Git history.

## 2026-08-22 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/d992910585aed21ab6f291fd82993b2162efc003)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-08-22 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/71e2cc5fa656a3fd6efb2d082599081396d207fa)

- Recorded automatically from Git history.

## 2026-08-22 — [`fix: improve journey report exports`](https://github.com/lgs1920/studio/commit/622116c9a0e7e147a9d12baf15f0196c32f9db57)

- Recorded automatically from Git history.

## 2026-08-23 — [`docs: add replay quality audit`](https://github.com/lgs1920/studio/commit/ba67ead883b07ce7f729d874ca7578b5e3fb87c9)

- Recorded automatically from Git history.

## 2026-08-23 — [`Merge remote-tracking branch 'origin/fix/replay-video-stats-overlay' into fix/replay-video-stats-overlay`](https://github.com/lgs1920/studio/commit/07a8d5e066d33796529d76ddabcfd79ed1b5d846)

- Recorded automatically from Git history.

## 2026-08-24 — [`refactor: establish canonical replay frame pipeline`](https://github.com/lgs1920/studio/commit/29a3c0dcf99b4cbd7a0dcf2b2ec7b662a66ec6e9)

- Recorded automatically from Git history.

## 2026-08-24 — [`refactor: resolve replay frames lazily`](https://github.com/lgs1920/studio/commit/99833b8d5c37cfa991f26e8b672a926c427e3739)

- Recorded automatically from Git history.

## 2026-08-24 — [`refactor: canonicalize replay camera intent`](https://github.com/lgs1920/studio/commit/bad9c27c60f3020697af1e29ad26ab00be95fcf1)

- Recorded automatically from Git history.

## 2026-08-24 — [`refactor: apply canonical replay camera commands`](https://github.com/lgs1920/studio/commit/1081e7359aa44706913403fe47d62efa61c3e976)

- Recorded automatically from Git history.

## 2026-08-24 — [`docs: update dependency inventory path`](https://github.com/lgs1920/studio/commit/3765661395de797d028ef3a73b5c5eb037f0660f)

- Recorded automatically from Git history.

## 2026-08-24 — [`docs: reorganize technical documentation`](https://github.com/lgs1920/studio/commit/b58295c4518e70850ab7322b9749dfffe4085213)

- Recorded automatically from Git history.

## 2026-08-24 — [`fix: update information pane dependency source`](https://github.com/lgs1920/studio/commit/dcf9fbfeb5d26fb29fb1e896b62c5b4f37c5aa96)

- Recorded automatically from Git history.

## 2026-08-24 — [`refactor: isolate replay HQ rendering`](https://github.com/lgs1920/studio/commit/e1f7e1b90efcfb01d3f78599fedd4d3c77314143)

- Recorded automatically from Git history.

## 2026-08-24 — [`feat: complete replay recording integration`](https://github.com/lgs1920/studio/commit/498541d16ffb2b7b04d3e46bc02856a29f69a1c6)

- Recorded automatically from Git history.

## 2026-08-24 — [`docs: update replay architecture and status`](https://github.com/lgs1920/studio/commit/00b629a17095637db6f8efe0049aa82df54e0bf2)

- Recorded automatically from Git history.

## 2026-08-24 — [`Merge branch 'refactor/replay-architecture' into 1.0.0`](https://github.com/lgs1920/studio/commit/8c738656eb593a6ece2c8af373f4c64f9211811a)

- # Conflicts:
- #	COMMIT_HISTORY.md

## 2026-08-24 — [`docs: analyze parallel replay workspace execution`](https://github.com/lgs1920/studio/commit/2cf24f770a9f20ee397d90d789b7ebab6b561012)

- Recorded automatically from Git history.

## 2026-08-25 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/e479470595528f3343a05b063fa87f514790ade9)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-08-25 — [`fix: make Cesium Ion optional and provider-scoped (#483)`](https://github.com/lgs1920/studio/commit/6883ea049eeb5850c5ea6deecd74866b6ac27ccd)

- Recorded automatically from Git history.

## 2026-08-25 — [`refactor: remove obsolete FFmpeg conversion integration`](https://github.com/lgs1920/studio/commit/6acd6a252cbc8da9145a75177319470edfd9555e)

- Recorded automatically from Git history.

## 2026-08-25 — [`feat: add backend deployment monitoring`](https://github.com/lgs1920/studio/commit/ca4cfe535afaa1961dd6601cb6029f97494dcc0c)

- Recorded automatically from Git history.

## 2026-08-25 — [`fix: expose Bun to PM2 module installation`](https://github.com/lgs1920/studio/commit/7306e12a59d363470a6a821d497fd03875025cb1)

- Recorded automatically from Git history.

## 2026-08-25 — [`docs: update 1.0.0 release changelog`](https://github.com/lgs1920/studio/commit/627a1853072a493073491f2bd76be0e995c179dd)

- Recorded automatically from Git history.

## 2026-08-25 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/47e3894e2f48aba8bfd84170f0be35543ac87492)

- Recorded automatically from Git history.

## 2026-08-25 — [`docs: split Replay Timeline preview from editor specification`](https://github.com/lgs1920/studio/commit/3a2b9b9c4f199f2eb446cf9b284969ecd378602d)

- Recorded automatically from Git history.

## 2026-08-25 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/077f47711d4aa57fba7260fbaead95b59cfd5530)

- Recorded automatically from Git history.

## 2026-08-25 — [`fix: remove HQ camera selector from video dialog`](https://github.com/lgs1920/studio/commit/e6cda9ddbc3e4f2311304ba36a0edb074f5fdfdb)

- Recorded automatically from Git history.

## 2026-08-26 — [`fix(replay): stabilize preparation camera and live angle editing (#457)`](https://github.com/lgs1920/studio/commit/48c963fe158a2432bc0e6e78b6ca7f1301af74f5)

- Fixes #457

## 2026-08-26 — [`docs: update documentation paths`](https://github.com/lgs1920/studio/commit/32775487783cf1dc259ed3b61292c0d4804d22c7)

- Recorded automatically from Git history.

## 2026-08-26 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/0fcc656410f258727683f4677c2b9b92bb486781)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: unify camera adjustment overlay`](https://github.com/lgs1920/studio/commit/bd6c758da94d99775239e5bb54dc037ec68c7845)

- Recorded automatically from Git history.

## 2026-08-27 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/b0f0fd01dbe7e2a05117140b701b5a19ca2ec888)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix(camera): prevent camera from moving below terrain`](https://github.com/lgs1920/studio/commit/672b9689505cbd5a822693bf170dfc3e72e90954)

- Recorded automatically from Git history.

## 2026-08-27 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/53c9e44cbf54e7207bc63985fee755bd4b8288be)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: use SnapDOM geometry for replay widgets`](https://github.com/lgs1920/studio/commit/514cf43bf722d3260216b5a71ac9e4bb5e242ebe)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: synchronize replay journey visibility settings`](https://github.com/lgs1920/studio/commit/92ee4134282c262ee326731f36d2c782455497ae)

- Recorded automatically from Git history.

## 2026-08-27 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/4be52e18433e62128ab4687d498714e667110ebd)

- Recorded automatically from Git history.

## 2026-08-27 — [`chore(events): remove canvas event trace logs`](https://github.com/lgs1920/studio/commit/0223534ab2b697858e90fe91a1c94766083e0e2d)

- Recorded automatically from Git history.

## 2026-08-27 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/d3e84d2040a123984469cfe97e43f23b8c6e9696)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: handle deployment Git synchronization`](https://github.com/lgs1920/studio/commit/7148f4f7966514fbe2bf5ca5aa721483de425a79)

- Recorded automatically from Git history.

## 2026-08-27 — [`docs: clarify deployment workflow`](https://github.com/lgs1920/studio/commit/fbcb300687145cbda7e84da794211df3afe17b86)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: preserve camera overlay during widget drag`](https://github.com/lgs1920/studio/commit/38d20ce7f9ab3b75c05ff75243ddfc2a96a559f7)

- Recorded automatically from Git history.

## 2026-08-27 — [`docs: add analytical rigor rules`](https://github.com/lgs1920/studio/commit/4470341dac68300c4cdb7b2bc845eef29fd0a2f7)

- Recorded automatically from Git history.

## 2026-08-27 — [`chore: centralize project skills`](https://github.com/lgs1920/studio/commit/aa83fcd4ec61c7fef51b67c6d302a3b8ece62de1)

- Recorded automatically from Git history.

## 2026-08-27 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/3c3a1ff96706fd7520fa5cab9609f3cd4c67bc3d)

- Recorded automatically from Git history.

## 2026-08-27 — [`fix: repair replay camera angle guide (#495)`](https://github.com/lgs1920/studio/commit/8f97c3aa2962eb81433a439695882dd9ce8d1566)

- Recorded automatically from Git history.

## 2026-08-28 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/736e9cb6d14be040e5b469be3c5de966ed199e96)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-08-28 — [`fix: preserve widget capture geometry`](https://github.com/lgs1920/studio/commit/bc4191ab6f9f0ccd0c35b13b6f44a06a0d370562)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix: stabilize default widget placement`](https://github.com/lgs1920/studio/commit/7e9abd4bee477cc6d82b24921c286eb6a51ef9e2)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix: rebuild replay camera angle guide`](https://github.com/lgs1920/studio/commit/8da62ee93b22c5dbc3bcd2a7c096d4dd2363b818)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix: refresh video stats canvas`](https://github.com/lgs1920/studio/commit/568dd1d324ad0957a22cc08cb723af8b18d426d1)

- Recorded automatically from Git history.

## 2026-08-28 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/1043af13d6abfbc47abab2c86824a426c764db39)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix: centralize replay preparation return`](https://github.com/lgs1920/studio/commit/085733b4f2a7ed94c7b4753c368ef576924c21e5)

- Recorded automatically from Git history.

## 2026-08-28 — [`test: enable canvas support in jsdom`](https://github.com/lgs1920/studio/commit/782c40bdf56b929f9ff32244a896c6e9583de4e1)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix(video): separate standard and replay entry points (#498)`](https://github.com/lgs1920/studio/commit/fa3ae9b5c84453914ba33753b39cb9784636a4cc)

- Recorded automatically from Git history.

## 2026-08-28 — [`test(replay): align current camera and smoothing contracts`](https://github.com/lgs1920/studio/commit/b94b96b8c89bb5a52d512492e0c0c46a1db3add8)

- Recorded automatically from Git history.

## 2026-08-28 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/903949b9f024fe9388a91e84160d3dd42d0a0cd8)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix(replay): use sliders icon in drawer title`](https://github.com/lgs1920/studio/commit/e6cb129432d15d8ecc48c17314c48804f9933a44)

- Recorded automatically from Git history.

## 2026-08-28 — [`fix(replay): restore main-scene pivot after preparation`](https://github.com/lgs1920/studio/commit/cdccb0a1f8d01917ad0d40aed48d3d4e1346267b)

- Recorded automatically from Git history.

## 2026-08-28 — [`feat(ui): display Studio initialization progress (#501)`](https://github.com/lgs1920/studio/commit/579320acc6db23db627b9d93a1d257ad1441f61f)

- Recorded automatically from Git history.

## 2026-08-29 — [`fix(ui): refine initialization welcome layout`](https://github.com/lgs1920/studio/commit/e3bf77deb30baa4931c1a4d37e8d6d45ac4e7fa2)

- Recorded automatically from Git history.

## 2026-08-29 — [`fix(pwa): defer update dialog until studio entry`](https://github.com/lgs1920/studio/commit/989e08750135e275398196c7e22dcbc5060f3c2b)

- Recorded automatically from Git history.

## 2026-08-29 — [`test: use LGS1920 fixture for journey metrics`](https://github.com/lgs1920/studio/commit/f5cd128ea81219418da07be5c1c403743992f956)

- Recorded automatically from Git history.

## 2026-08-29 — [`feat(replay): add preparation timeline`](https://github.com/lgs1920/studio/commit/d9da1fa3b7a9915292ae2c39fa3bfcfa3d701d82)

- Recorded automatically from Git history.

## 2026-08-29 — [`fix(widget): preserve profile and timeline dimensions`](https://github.com/lgs1920/studio/commit/a016c18dc46fb48be3d64cbb0b11e372364f5923)

- Recorded automatically from Git history.

## 2026-08-29 — [`fix(crop): restore crop zone selection`](https://github.com/lgs1920/studio/commit/4a9a3449a0b6fead83f24f0bdcff96a24ffee1f4)

- Recorded automatically from Git history.

## 2026-08-29 — [`fix(ui): stabilize widget stacking and editor controls`](https://github.com/lgs1920/studio/commit/8bbc0faf8bf54110adfc761e7b690700b11a1a13)

- Recorded automatically from Git history.

## 2026-08-29 — [`docs(replay): document preparation timeline changes`](https://github.com/lgs1920/studio/commit/097207f89d330627401f9a003fecd7b911f5a1ae)

- Recorded automatically from Git history.

## 2026-08-29 — [`feat(widget): add hide and show controls (#505)`](https://github.com/lgs1920/studio/commit/609e5a73071cd8276ab56b3e5215471c7ca71f32)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): simplify timeline action previews`](https://github.com/lgs1920/studio/commit/b6aafd47cf0035aa75e5ab28403e85438dd99691)

- Recorded automatically from Git history.

## 2026-08-30 — [`feat(ui): support link mode for ToggleStateIcon`](https://github.com/lgs1920/studio/commit/004820ae74079cf370e4217e13452d61151df037)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): align timeline track controls`](https://github.com/lgs1920/studio/commit/84f6d9e1fab3072e5207e0471338c5f3300f3395)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(ui): align widget menu theming`](https://github.com/lgs1920/studio/commit/bcde2dfeb35d07ddbd757fb43d5977382e6a3283)

- Recorded automatically from Git history.

## 2026-08-30 — [`chore: update project skills`](https://github.com/lgs1920/studio/commit/e9f2134cc14cf4a5eb786c5119d72c7a5043bc4d)

- Recorded automatically from Git history.

## 2026-08-30 — [`Merge remote-tracking branch 'origin/add-timeline' into add-timeline`](https://github.com/lgs1920/studio/commit/b291a8c69f2ba6ba776785386a65c6668a879540)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(widget): refresh catalog metadata from yaml`](https://github.com/lgs1920/studio/commit/a9bbbb2a89fed1c4e42f4c8aa79cd1c52d8b88ec)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(crop): add video resize context action`](https://github.com/lgs1920/studio/commit/94397284ba571e59305e15f9327daf7efc334048)

- Recorded automatically from Git history.

## 2026-08-30 — [`feat(replay): open editors from timeline actions`](https://github.com/lgs1920/studio/commit/c48a032a6677ed4a4c77aa84eeef0677270a71b1)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): toggle timeline drawer targets`](https://github.com/lgs1920/studio/commit/b9a5be3f6ef019bb5b3278d1090b6ea4f7fa1d91)

- Recorded automatically from Git history.

## 2026-08-30 — [`chore: add replay timeline skill`](https://github.com/lgs1920/studio/commit/f4cc4b4cb64f2c7edba96253d8eddb4db99d8676)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(ui): prevent native menus and text selection`](https://github.com/lgs1920/studio/commit/55111ac1864e99d6279f417be6ddd13fcc18570d)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(widget): reduce stats widget minimum width`](https://github.com/lgs1920/studio/commit/3f37dac1240b5744ae4420ed0d8bdcb5a5145011)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): stabilize timeline editor layout`](https://github.com/lgs1920/studio/commit/7ada6db995f53e23f889869bbb0cdc02220b72fc)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): accelerate timeline edge scrolling`](https://github.com/lgs1920/studio/commit/56b8f3c5c8ab23027fba508295bcb56b87065d9b)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): improve timeline edge scrolling`](https://github.com/lgs1920/studio/commit/e76dbecacbdb989886a5f4b0d85f2ea3cf4ca349)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): throttle timeline scrubbing`](https://github.com/lgs1920/studio/commit/b589fbee70fd37f489c8ecd5853305189510c395)

- Recorded automatically from Git history.

## 2026-08-30 — [`fix(replay): lighten hidden timeline hatching`](https://github.com/lgs1920/studio/commit/33fb55801db7b0cbd53c61c27d9487a1919671dc)

- Recorded automatically from Git history.

## 2026-08-30 — [`feat(ui): add LGS1920 Web Component timeline`](https://github.com/lgs1920/studio/commit/047c5b4d56b5f5abdfcdf9d9e971277c3be9605e)

- Recorded automatically from Git history.

## 2026-08-30 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/1ffe1053373d733441a11b8a30aa6127736292aa)

- # Conflicts:
- #	COMMIT_HISTORY.md

## 2026-08-31 — [`docs: clarify documentation status rules`](https://github.com/lgs1920/studio/commit/b0cb99380e9238e0cca0dbc78d862a940ab7dc7f)

- Recorded automatically from Git history.

## 2026-08-31 — [`chore(config): add Web Components Vite alias`](https://github.com/lgs1920/studio/commit/6eee1477c04aa6df78e7845c97ecd4935f98ada2)

- Recorded automatically from Git history.

## 2026-08-31 — [`feat(ui): add resizable side drawers (#507)`](https://github.com/lgs1920/studio/commit/ac26845654de2d80e3a5176c86eefa447e83af2f)

- Recorded automatically from Git history.

## 2026-08-31 — [`Merge remote-tracking branch 'origin/add-timeline' into add-timeline`](https://github.com/lgs1920/studio/commit/abc81587e88097c73a2663b5c7a3a5e251bc889c)

- # Conflicts:
- #	COMMIT_HISTORY.md

## 2026-08-31 — [`feat(replay): extend timeline web component`](https://github.com/lgs1920/studio/commit/b9cc4a791a43c66a6152cf5054b2825b66bdb08f)

- Recorded automatically from Git history.

## 2026-08-31 — [`docs(replay): document timeline web component`](https://github.com/lgs1920/studio/commit/a304c04f29bf241cd32c67edfe48cf942a77104f)

- Recorded automatically from Git history.

## 2026-08-31 — [`Merge remote-tracking branch 'origin/add-timeline' into add-timeline`](https://github.com/lgs1920/studio/commit/965b350184030730896825dd6895454c30bb7157)

- Recorded automatically from Git history.

## 2026-08-31 — [`Merge branch 'add-timeline' into 1.0.0`](https://github.com/lgs1920/studio/commit/0e36b2471468d4cabecc37caf5ce217310aa1068)

- Recorded automatically from Git history.

## 2026-08-31 — [`fix(replay): pre-bundle timeline dependencies`](https://github.com/lgs1920/studio/commit/e979eb9c708b1d912bfda8d806e0d68798a8b2b4)

- Recorded automatically from Git history.

## 2026-08-31 — [`Merge branch 'add-timeline' into 1.0.0`](https://github.com/lgs1920/studio/commit/58002a88e6b65965b609cdeb497fc980fd373cf0)

- Recorded automatically from Git history.

## 2026-08-31 — [`Merge remote-tracking branch 'origin/1.0.0' into 1.0.0`](https://github.com/lgs1920/studio/commit/6f105b57a0f85546e582dc0ff4ae6707908cd87b)

- # Conflicts:
- #	COMMIT_HISTORY.md

## 2026-08-31 — [`chore: document source file header policy`](https://github.com/lgs1920/studio/commit/1af411b79f3373e16c74475a7967c095143683d1)

- Recorded automatically from Git history.

## 2026-08-31 — [`chore: automate source file header updates`](https://github.com/lgs1920/studio/commit/8f41f0465c6b03b7c0283cb0478f15a36c3f359e)

- Recorded automatically from Git history.

## 2026-08-31 — [`refactor(replay): use timeline Web Component preview`](https://github.com/lgs1920/studio/commit/f8826b6fc1aae01df3342ca2217ae404f4882fa5)

- Recorded automatically from Git history.

## 2026-08-31 — [`chore: normalize source file headers`](https://github.com/lgs1920/studio/commit/dddfcc84d4e72ce43dc6364a24f86c27e13372ec)

- Recorded automatically from Git history.

## 2026-08-31 — [`fix: report all source header mismatches`](https://github.com/lgs1920/studio/commit/29e26ccae26e4bb1a86513ee47eb3dd60a537950)

- Recorded automatically from Git history.

## 2026-08-31 — [`style: normalize cropper test header`](https://github.com/lgs1920/studio/commit/a75b61b43f19d378c3ecd24aae652f9d4a08c66f)

- Recorded automatically from Git history.

## 2026-08-31 — [`style(ui): align LGS scrollbar with timeline`](https://github.com/lgs1920/studio/commit/a57ee5fc7259ae256f818cd426e71c9f905ce01f)

- Recorded automatically from Git history.

## 2026-08-31 — [`fix: stabilize lint and shortcut tests`](https://github.com/lgs1920/studio/commit/dff5495bc2de2ed72bd7bf5b1d102ca63bbfef00)

- Recorded automatically from Git history.

## 2026-09-01 — [`Merge remote-tracking branch 'origin/feature/timeline-webcomponent' into feature/timeline-webcomponent`](https://github.com/lgs1920/studio/commit/e3d24c561a9a71a151765f2d651e68cfc821da6e)

- Recorded automatically from Git history.

## 2026-09-01 — [`feat(ui): extend timeline Web Component interactions`](https://github.com/lgs1920/studio/commit/ce0b7aed5aadc3017684f941955cd6fcbda0dce0)

- Recorded automatically from Git history.

## 2026-09-01 — [`refactor(replay): rename Replay clip phases`](https://github.com/lgs1920/studio/commit/c061d698b963a93ee9ba6f09b31dde1f245ace42)

- Recorded automatically from Git history.

## 2026-09-01 — [`feat(replay): enable timeline preview interactions`](https://github.com/lgs1920/studio/commit/409018f62b6b94f18b1c99edd88b62b214910d3b)

- Recorded automatically from Git history.

## 2026-09-01 — [`docs(replay): document timeline Web Component integration`](https://github.com/lgs1920/studio/commit/d2dfb63b90ad69afc4e5b305b6915e2041bba305)

- Recorded automatically from Git history.

## 2026-09-01 — [`chore: update dependencies`](https://github.com/lgs1920/studio/commit/51aa743b324741d3a72caca98d1e49d423bc9dea)

- Signed-off-by: chdenat <christian.denat@orange.fr>

## 2026-09-01 — [`Merge remote-tracking branch 'origin/feature/timeline-webcomponent' into feature/timeline-webcomponent`](https://github.com/lgs1920/studio/commit/c5eba06cfa9ee1b07b0bf32880d4bacfe246980d)

- Recorded automatically from Git history.

## 2026-09-01 — [`chore: require stable fixes`](https://github.com/lgs1920/studio/commit/5cf399d375c9e8404391a529fc2ef8707dd24489)

- Recorded automatically from Git history.

## 2026-09-01 — [`feat(timeline): add transport and playhead controls`](https://github.com/lgs1920/studio/commit/b47da0ca5bc2f1850b8385b1ea4b7ddb627e153b)

- Recorded automatically from Git history.

## 2026-09-01 — [`feat(replay): synchronize timeline preview with Replay`](https://github.com/lgs1920/studio/commit/22d207aa8d92af952450bfc5a54962dc4edc28ac)

- Recorded automatically from Git history.

## 2026-09-01 — [`chore: protect uncommitted changes`](https://github.com/lgs1920/studio/commit/d38f05a53eac9cfd68c1d94a2529858a71a6f963)

- Recorded automatically from Git history.

## 2026-09-01 — [`docs: clarify Web Awesome usage rules`](https://github.com/lgs1920/studio/commit/2a383f5d3c395ab154f25980281f8041345cad6d)

- Recorded automatically from Git history.

## 2026-09-01 — [`fix: update replay clip icons and labels`](https://github.com/lgs1920/studio/commit/56c79705d56d358d97a26e2417544a76608a3636)

- Recorded automatically from Git history.

## 2026-09-01 — [`fix(timeline): preserve native split during interactions`](https://github.com/lgs1920/studio/commit/44601e8e2509c58cd45f5d21d5b5525e10d634ac)

- Recorded automatically from Git history.

## 2026-09-01 — [`refactor(timeline): keep React adapter passive`](https://github.com/lgs1920/studio/commit/9a9206451889d9f79a2a8b4408651a85ab8ab6e9)

- Recorded automatically from Git history.

## 2026-09-01 — [`docs(timeline): document native split and menu slots`](https://github.com/lgs1920/studio/commit/67cd228e78fc1bccd63df3bcaecbbc93864ae894)

- Recorded automatically from Git history.

## 2026-09-01 — [`Merge remote-tracking branch 'origin/feature/timeline-webcomponent' into feature/timeline-webcomponent`](https://github.com/lgs1920/studio/commit/19dcb4bd17daf9e71901b53d60ec7b3d5df7f24c)

- Recorded automatically from Git history.

## 2026-09-01 — [`fix(timeline): keep track drag position stable`](https://github.com/lgs1920/studio/commit/67947df838161cda719af2d24c11850ce98e43ee)

- Recorded automatically from Git history.

## 2026-09-01 — [`style(timeline): use brand drag feedback`](https://github.com/lgs1920/studio/commit/6f19bbc6099c2a4085dbfa8b52704093250b18c6)

- Recorded automatically from Git history.

## 2026-09-01 — [`docs(timeline): document keyboard shortcuts`](https://github.com/lgs1920/studio/commit/0176b8fffec04bcccdd01f09de7cafa8d549917f)

- Recorded automatically from Git history.

## 2026-09-01 — [`Merge remote-tracking branch 'origin/feature/timeline-webcomponent' into feature/timeline-webcomponent`](https://github.com/lgs1920/studio/commit/4af5287d838c026fbc230ed69622f140ef133e74)

- Recorded automatically from Git history.

## 2026-09-01 — [`fix(timeline): reject occupied clip drops`](https://github.com/lgs1920/studio/commit/ede1e31b05ca2f29bf392c7c7f101cfe0dbbc861)

- Recorded automatically from Git history.

## 2026-09-01 — [`fix(timeline): keep hidden track clips visible`](https://github.com/lgs1920/studio/commit/2b80ea271ffd2f7b328bfb76ee3fac4af550ad68)

- Recorded automatically from Git history.

## 2026-09-02 — [`refactor(timeline): simplify track titles and clip menus`](https://github.com/lgs1920/studio/commit/94a5e60d1373b1e6dd05c075f6498f3ed0cb70bb)

- Recorded automatically from Git history.

## 2026-09-02 — [`refactor(timeline): remove contextual menus`](https://github.com/lgs1920/studio/commit/0c42d73746b60f867f6779b03c3960d8a18a26cc)

- Recorded automatically from Git history.

## 2026-09-02 — [`fix(timeline): use success colors for valid drags`](https://github.com/lgs1920/studio/commit/295bdb05aa63ea728f7b5603ba16dd4b96d92e5e)

- Recorded automatically from Git history.

## 2026-09-02 — [`Merge remote-tracking branch 'origin/feature/timeline-webcomponent' into feature/timeline-webcomponent`](https://github.com/lgs1920/studio/commit/7ccd7d018278c88919712217cf3cf10a5caa0a72)

- Recorded automatically from Git history.
