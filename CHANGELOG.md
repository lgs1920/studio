# Changelog

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
