---
name: lgs-1920-studio-gpx-journey-import
description: Build or repair LGS1920 GPX journey import, parsing, validation, normalization, sequencing, metrics, colors, and sample journey handling.
---

# GPX Journey Import

Use for GPX files, journey creation, imported tracks, waypoint handling, and malformed data. Inspect import utilities, journey stores, sample assets, and existing fixtures before editing.

Workflow:

1. Parse tracks, segments, points, timestamps, elevations, and extensions with the existing library.
2. Normalize coordinate order, missing values, timestamps, colors, and segment sequencing.
3. Validate useful geometry and report invalid or incomplete data without crashing the map.
4. Recompute derived statistics after import and after profile edits.
5. Preserve source metadata and activity-specific defaults where available.
6. Add fixtures for valid, multi-segment, missing-elevation, malformed, and reordered GPX data.

Never silently discard points or invent elevation. Keep parsing pure where possible and keep store mutations explicit.
