# Technical Specification - Cesium Ion Layers

## Purpose

This document describes how to add Cesium Ion layers to LGS1920 Studio beyond the terrain already supported:

- Ion imagery;
- Ion terrain;
- Ion 3D Tiles;
- cache behavior for 3D Tiles.

It complements the existing documents:

- [ion-token-technical.md](../Settings/application/profile/ion-token-technical.md)
- [README-CESIUM](README-CESIUM)
- [ion-token-help.md](../../../../src/assets/ion-token-help.md)

## Current State

The required foundation already exists:

- the active Ion token is applied in `src/Utils/AppUtils.js` via `Cesium.Ion.defaultAccessToken`;
- Cesium terrain is already loaded through `src/Utils/cesium/TerrainUtils.js`;
- the service worker already intercepts `assets.ion.cesium.com` and stores it in persistent cache;
- `CacheManager` can measure and clear that cache;
- the user Ion token is already stored locally.

This spec formalizes the contract needed to add extra Ion layers without breaking the current behavior.

## Functional Goals

1. Allow Ion layers to be enabled based on the active token.
2. Support at least:
   - Ion imagery;
   - existing Ion terrain;
   - Ion 3D Tiles.
3. Keep a clear separation between:
   - non-secret configuration;
   - the locally stored Ion token;
   - Cesium resources loaded at runtime.
4. Provide a robust cache strategy for 3D Tiles, with explicit purge on token change.

## Out of Scope

- server-side token management;
- Ion asset upload;
- Cesium Ion permission editing from the app;
- dynamic Ion asset catalog browsing from the Cesium API.

## Data Model

### Configuration

Ion layer configuration must stay in non-secret settings, for example in `public/layers-terrains.yaml`.

An Ion layer should be able to declare at least:

- `type`: `base`, `overlay`, `terrain`, `tiles3d`, `base3d`;
- `provider`: `cesium`;
- `ionAssetId`: numeric Cesium Ion asset identifier;
- `usage`: UI and entitlement information;
- type-specific rendering options.

For layers that depend on a personal Cesium Ion token, the usage type must be distinct from `premium` and `freemium`.
The chosen value is `personal`.

Example target shape:

```yaml
- name: Cesium World Terrain
  id: cesium-world
  type: terrain
  provider: cesium
  terrainType: cesium
  ionAssetId: 1

- name: Cesium 3D Tiles - City
  id: cesium-city-tiles
  type: tiles3d
  provider: cesium
  ionAssetId: 123456
  usage:
    type: personal
    doc: ''
  tiles3d:
    flyToOnLoad: true
    maximumScreenSpaceError: 16
    preloadWhenHidden: false

- name: Google Photorealistic 3D Tiles
  id: google-photorealistic-3d
  type: base3d
  provider: cesium
  ionAssetId: <google-photorealistic-asset-id>
  usage:
    type: personal
    doc: ''
  base3d:
    imageryOverlay: true
    showGlobe: true
    showTerrain: false
```

### Storage Rules

- the Ion token must never be stored in public YAML files;
- asset IDs, flags, and rendering options may be stored in settings;
- the Ion section must be excluded from overwrite flows that preserve user choices;
- temporary or personal tokens must stay in the local vault.

## Runtime Architecture

### Principles

1. `Cesium.Ion.defaultAccessToken` is set very early at startup.
2. Ion resources are built on demand from the active token.
3. 3D Tiles are added and removed as Cesium primitives, not as imagery layers.
4. A `base3d` asset is a scene base, not a regular overlay.
5. Loading code must be split by layer type.

### Required Helpers

Create a dedicated Ion helper, for example `src/Utils/cesium/IonUtils.js`, to centralize:

- reading the active token;
- creating `IonResource.fromAssetId(...)`;
- invalidating cache when the token changes;
- validating asset IDs.

Important: for 3D Tiles, prefer loading through `IonResource.fromAssetId(assetId, { accessToken })`, then `Cesium3DTileset.fromUrl(resource, options)`.
This avoids depending on an implicit global token when the tileset is instantiated.

## Layer Support

### Ion Terrain

The current terrain path remains the reference:

- known Ion asset;
- Cesium provider;
- loading through `TerrainUtils`.

Specification:

- keep the current path for `cesium-world`;
- if a new Ion terrain is added, the same mechanism must accept a configurable `ionAssetId`;
- terrain logic must not be mixed with 3D Tiles logic.

### Ion Imagery

Ion imagery layers must:

- be declared as `base` or `overlay` layers;
- create an `ImageryProvider` from an Ion resource;
- respect the existing imagery layer ordering;
- reuse the current opacity and contrast settings system.

### Ion 3D Tiles

3D Tiles must be handled as a distinct layer type:

- asynchronous loading in a dedicated component or manager;
- addition into `viewer.scene.primitives`;
- explicit removal on disable or configuration change;
- optional `viewer.flyTo(tileset)` after load;
- user-facing errors surfaced through toast or an equivalent state surface.

Minimum recommended 3D Tiles options:

- `maximumScreenSpaceError`;
- `flyToOnLoad`;
- `show`;
- `preloadWhenHidden`;
- `debugShowBoundingVolume` for debugging only.

### 3D Base Scene

Some Ion assets are not regular layers at all. Google Photorealistic 3D Tiles is the main example.

These assets must be modeled as a dedicated `base3d` scene mode:

- they define the visual base of the scene;
- they are not loaded as an imagery layer;
- they are loaded as a root tileset primitive;
- they may still accept 2D overlays on top of the tileset;
- they do not require forcing a flat terrain.

Implementation rule:

- `terrain` and `base3d` are mutually exclusive scene bases;
- a `base3d` scene can optionally keep the globe visible if the asset or product decision requires it;
- a `base3d` scene may keep standard imagery overlays such as labels or satellite draping on the tileset itself.

### Layers Requiring a Personal Token

For any Ion layer that requires the personal token:

- if the personal token is not active, the layer mechanism must open the existing token entry UI;
- this replaces the current premium/freemium flow for these items;
- the layer must not be presented as premium or freemium, but as `personal`;
- once the token is validated, the layer must be retried automatically.

## Scene Composition Model

### Scene Modes

The application must distinguish three levels of composition:

1. **Terrain-based globe**
   - classic Cesium globe with terrain and imagery.
2. **Base 3D scene**
   - Google Photorealistic 3D Tiles or similar root 3D assets.
3. **Additional 3D layers**
   - Cesium OSM Buildings or other extra 3D Tilesets layered above the base scene.

### Allowed combinations

- `terrain` + imagery layers + `tiles3d` overlays: allowed;
- `base3d` + 2D overlays: allowed, with draping performed on the base 3D tileset when supported;
- `base3d` + additional `tiles3d` overlays: allowed;
- `terrain` and `base3d` active as competing roots: not allowed.

### Recommendation

For the requested catalog:

- `Google Photorealistic 3D Tiles` should be modeled as `base3d`;
- `Cesium OSM Buildings` should remain a `tiles3d` overlay;
- `Azure Maps Aerial`, `Google Maps 2D Satellite`, `Google Maps 2D Satellite with Labels`, and `Azure Maps Label` should remain imagery layers;
- the app must not force a flat terrain just to host the 3D base.

This preserves the existing layering model and avoids collapsing distinct Cesium concepts into a single layer type.

## 3D Tile Cache

### Target Behavior

The cache must reduce network reloads without hiding a token or entitlement change.

Expected behavior:

1. responses from `assets.ion.cesium.com` are stored in a dedicated persistent cache named from the active Ion token;
2. range requests are left uncached;
3. API endpoints are not cached;
4. changing the token triggers an explicit Cesium cache purge and creation of a new cache name for the new token;
5. the cache is bounded by size or entry count.

### Cache Rules

- do not cache `api.cesium.com`;
- do not cache partial responses (`206`) or range requests;
- keep a dedicated cache for Ion assets, separate from the application cache, with a cache name derived from the active Ion token;
- keep automatic purge on token or user change on the same browser;
- do not rely on cache to bypass changing entitlements.

### Risks

1. **Token change**
   - persistent cache can serve assets loaded under an old context;
   - the spec requires a purge as soon as the token is replaced.
2. **Shared browser**
   - one browser used by multiple users must be able to start from a clean cache;
   - the cache name must remain specific to the active Ion token;
   - purge must remain available from the token management UI.
3. **Cache size**
   - 3D Tiles can consume the browser quota quickly;
   - the spec recommends a visible quota and manual purge path.

### Quota Policy

The Ion cache must expose at least:

- current size;
- quota state;
- manual purge action.

The initial quota threshold should be conservative and increased only after real production measurement.

## User Flow

### Adding an Ion Layer

The user flow must stay based on the layer system already in place:

1. the user selects an Ion layer from the existing catalog;
2. the app checks whether the active Ion token is present;
3. if the layer depends on a personal token and no personal token is active, the existing token entry UI opens;
4. the layer is built from the declared asset ID;
5. the layer is added to the viewer according to its type;
6. if it is a 3D tileset, the scene may optionally call `flyTo`;
7. if it is a `base3d` asset, it becomes the active base scene and can host additional overlays.

### Terrain and 3D Tiles

A terrain is not required to display a 3D tileset.

Decision rule:

- for a `tiles3d` layer, the existing scene terrain can remain unchanged;
- for relief, ground clamping, or altitude-dependent navigation, the app must keep or load an appropriate terrain;
- if the business need is only the 3D tileset display, the 3D layer can work on the current terrain, including ellipsoid if the context allows it.
- if the business need is a photorealistic base scene, use `base3d` instead of forcing an ellipsoid terrain.

### UI Access

The existing token entry UI is assumed to be reused as-is for `personal` items.
The new usage type must not create a second token entry path.

### Token Change

1. The user replaces the Ion token.
2. The token is written to the local vault.
3. `Cesium.Ion.defaultAccessToken` is updated.
4. Existing Ion 3D Tiles primitives are removed.
5. The cache associated with the old token is purged.
6. A new Ion cache is used for the active token.
7. Ion layers are reloaded if needed.

### Token Removal

1. The personal token is removed from the vault.
2. The app falls back to the shared token or to no token.
3. The cache associated with the removed token is purged automatically.
4. Ion layers that require entitlements disappear or are disabled cleanly.

## Code Impact

### Files to Touch

- `src/Utils/AppUtils.js` or the equivalent startup entry point;
- `src/Utils/cesium/TerrainUtils.js`;
- a shared Ion helper;
- a dedicated 3D Tiles component or manager;
- `src/core/settings/settingsExclusions.js`;
- `public/layers-terrains.yaml`;
- possibly `src/core/cache/CacheManager.js` or the service worker if the cache policy must change.

### Cesium APIs to use

- `Cesium.Ion.defaultAccessToken` for runtime token selection;
- `IonResource.fromAssetId(assetId, {accessToken})` for resource construction;
- `Cesium3DTileset.fromUrl(resource, options)` for `tiles3d` and `base3d` assets;
- `Cesium.createGooglePhotorealistic3DTileset()` as the dedicated shortcut for Google Photorealistic 3D Tiles;
- `viewer.scene.primitives.add(tileset)` for root 3D scene assets;
- `viewer.scene.primitives.remove(tileset)` for cleanup;
- `tileset.imageryLayers.add(...)` for draped imagery overlays on a 3D tileset;
- `viewer.imageryLayers.add(...)` for imagery overlays on the globe.

### Loading responsibilities

- the scene controller decides whether the active base is `terrain` or `base3d`;
- the layer manager resolves the selected catalog item into a runtime asset;
- the 3D manager owns the lifecycle of the root tileset primitive;
- the imagery manager owns 2D layers, both globe-based and tileset-based;
- cache invalidation must happen when the active Ion token changes, before reusing any cached Ion response.

### Required Separation

- `TerrainUtils` remains the terrain owner;
- the Ion helper manages resources and tokens;
- a 3D Tiles component or manager handles `scene.primitives`;
- the service worker manages cache persistence;
- the UI must not own loading logic.

## Implementation Plan

1. Extend the layer model.
   - Add the `personal` usage type to the layer catalog contract.
   - Mark the relevant layers in `public/layers-terrains.yaml`.
   - Update the logic that currently handles `premium` and `freemium` so it can treat `personal` separately.

2. Reuse the existing token UI.
   - When a `personal` layer is requested and no personal token is active, open the existing token prompt.
   - Do not create a second entry flow.
   - After validation, retry the requested layer automatically.

3. Centralize Ion resource creation.
   - Add a shared Ion helper for the active token, `IonResource.fromAssetId(...)`, asset validation, and cache invalidation.
   - Reuse it for imagery, terrain, and 3D Tiles.

4. Add 3D Tiles support.
   - Create a dedicated manager or component for `tiles3d`.
   - Load the tileset through `Cesium3DTileset.fromUrl(...)` using an Ion resource.
   - Add and remove the primitive explicitly in `viewer.scene.primitives`.
   - Keep `flyTo` optional and driven by layer config.
   - Support `base3d` as a special root asset that can become the active base scene.
   - When the active base is `base3d`, keep overlays attached to the tileset or to the scene depending on Cesium support.

5. Wire the token-specific cache.
   - Name the Ion cache from the active token.
   - Keep the current service worker strategy.
   - Add automatic purge when the token changes or is removed.
   - Avoid caching `api.cesium.com` and range or partial responses.

6. Handle lifecycle.
   - Initialize `Cesium.Ion.defaultAccessToken` at startup.
   - On token removal or replacement, remove related primitives, purge cache, then reload if required.
   - Do not require a terrain just to display `tiles3d`.
   - Do not force a flat terrain when the selected base is `base3d`.

7. Verify behavior.
   - Test a standard `premium` / `freemium` layer to ensure nothing regresses.
   - Test a `personal` layer without an active personal token.
   - Test an Ion `tiles3d` layer with a personal token.
   - Test token replacement and cache purge.
   - Test app restart with token and layer restoration.

## Acceptance Criteria

1. An Ion imagery layer loads with the active token.
2. The current Ion terrain flow still works after the new layers are introduced.
3. An Ion 3D tileset loads and is removed without visible leaks.
4. Changing the token invalidates the Ion cache and reloads assets.
5. Range requests are not broken by the cache.
6. Ion API endpoints are not cached.
7. Cache state is observable and purgeable from the application.

## Open Questions

To finalize the exact implementation, confirm:

1. which Ion assets should be exposed first;
2. whether Ion layers should live in the current provider/layer catalog or in a separate subsystem;
3. whether 3D Tiles should be visible by default or only user-activated;
4. whether the app should expose an explicit offline mode for Ion assets.

## References

- Cesium Ion access tokens: https://cesium.com/learn/ion/cesium-ion-access-tokens/
- Cesium3DTileset: https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html
- IonResource: https://cesium.com/learn/cesiumjs/ref-doc/IonResource.html
