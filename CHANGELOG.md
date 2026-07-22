# Changelog

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
