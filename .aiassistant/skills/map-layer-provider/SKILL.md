---
name: map-layer-provider
description: Add, configure, or repair LGS1920 map layers, base maps, terrain providers, WMS, 3D Tiles, Cesium Ion, Google Photorealistic Tiles, attribution, and provider-specific availability.
---

# Map Layer Provider

Use this skill for map source work. Read `public/layers-terrains.yaml`, `public/settings.yaml`, map provider modules under `src/core/`, and the layer loading and error paths before editing.

Workflow:

1. Identify whether the source is a base layer, terrain, WMS, direct 3D Tiles, Cesium Ion, or a user-specific provider.
2. Add declarative metadata, URL, credentials requirement, attribution, disclaimer, and availability in the existing YAML model.
3. Keep personal Ion tokens isolated per user and never hard-code secrets.
4. Route WMS requests through the existing Cesium resource proxy where required. Preserve provider branding and credits.
5. Handle initialization, loading, invalid token, network, and unsupported-source errors without breaking other layers.
6. Verify layer ordering, terrain fallback, visibility persistence, token initialization, and cleanup.

Use primary project abstractions instead of provider-specific shortcuts. Add tests for configuration and failure paths. Do not expose tokens in logs or committed files.
