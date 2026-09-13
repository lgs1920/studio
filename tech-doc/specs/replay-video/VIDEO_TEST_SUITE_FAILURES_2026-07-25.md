# Full video/replay test-suite report — 2026-07-25

The complete Vitest run produced **549 passing tests and 24 failing tests in
16 files** (`573` tests total). The suite is therefore not fully green.

## Failed test files

### Replay and video behavior

- `src/__tests__/unit/replay/replay-visibility-clips.test.js` — 7 failures
  involving toolbar visibility, renderer clearing, final focus, visibility
  restoration, and `setView` call counts.
- `src/__tests__/integration/replay/replay-playback.test.js` — 5 failures
  involving duplicate GPX timeout, `stopRotate`, journey focus, and drawer
  reopening.
- `src/__tests__/integration/replay/replay-video-sync.test.js` — 1 failure:
  recorder stop after final composed frames without stop clips.
- `src/__tests__/integration/replay/replay-camera-tracking.test.js` — 5
  failures in camera-tracking behavior.

### UI and data behavior

- `src/__tests__/ui/camera/app-shortcuts-orbit-panorama.test.js` — timeout.
- `src/__tests__/ui/components/elevation-profile.test.jsx` — 1 failure.
- `src/__tests__/ui/components/orbit-widget-interactions.test.jsx` — timeout.
- `src/__tests__/ui/components/panorama-widget-interactions.test.jsx` —
  timeout.
- `src/__tests__/ui/components/video-download-and-share-dialog.test.jsx` —
  1 failure.
- `src/__tests__/unit/data/metrics.test.js` — timeout after 60 seconds.

### Test collection and environment errors

- `src/__tests__/ui/components/open-poi-editor.test.js` — suite load failure.
- `src/__tests__/unit/data/profiler.test.js` — suite load failure.
- `src/__tests__/unit/replay/replay-duplicate-samples.test.js` — suite load
  failure.
- `src/__tests__/unit/utils/elevation-coordinate-utils.test.js` — suite load
  failure.
- `src/__tests__/unit/utils/track-utils-color.test.js` — suite load failure.
- `src/__tests__/unit/replay/replay-phase1-fixtures.js` — no test suite found.

The collection failures include `document.adoptedStyleSheets is not iterable`
while importing the Web Awesome/UI Toast dependency. These failures and the
remaining replay/UI failures must be resolved before declaring the complete
repository suite green.

The focused video/replay regression run remains green: 20 tests passed.
