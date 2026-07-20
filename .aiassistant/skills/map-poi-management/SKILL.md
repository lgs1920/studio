---
name: map-poi-management
description: Manage LGS1920 points of interest, journey stops, filtering, proximity rules, visibility, sequencing, labels, and Replay readability.
---

# Map POI Management

Use for POI creation, filtering, rendering, stop visibility, and map readability. Inspect journey data, Cesium entity creation, Replay visibility logic, and related tests before editing.

Workflow:

1. Define POI identity, source, coordinates, ordering, label, and visibility conditions.
2. Separate data filtering from Cesium rendering and clean up removed entities.
3. Hide stop POIs that are too close to the current Replay position when needed for readability.
4. Preserve user-selected filters and avoid hiding unrelated journeys or layers.
5. Recalculate visibility when journey, camera, replay position, or scene changes.
6. Test proximity boundaries, ordering, empty data, replacement, and cleanup.

Use stable IDs and deterministic distance comparisons. Do not solve visibility bugs with arbitrary rendering delays.
