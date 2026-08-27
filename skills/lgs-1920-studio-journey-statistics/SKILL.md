---
name: lgs-1920-studio-journey-statistics
description: Calculate, refresh, display, or debug LGS1920 journey statistics such as distance, elevation, ascent, duration, speed, pace, altitude smoothing, and Replay live metrics.
---

# Journey Statistics

Use this skill for journey metrics, profile data, statistics widgets, and Replay progress values. Inspect existing journey stores, statistics utilities, `src/components/Stats/`, and related tests before editing.

Workflow:

1. Define the metric, its source points, units, activity-specific defaults, and empty or invalid state.
2. Preserve the distinction between raw geometry, smoothed altitude, accumulated ascent, and display formatting.
3. Ensure profile edits and journey replacement invalidate or refresh derived statistics at the correct time.
4. For Replay metrics, handle partial progress, stop POIs that are too close, clip boundaries, and end-of-playback reset.
5. Keep static Journey Stats separate from dynamic Replay Stats.
6. Add regression tests for known GPX samples, activity defaults, smoothing, sequencing, refresh timing, and formatting.

Avoid silently changing units or rounding during calculations. Prefer deterministic pure functions for derived values and keep Valtio mutations at store boundaries.
