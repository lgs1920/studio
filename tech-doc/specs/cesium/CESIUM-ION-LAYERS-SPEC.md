# Cesium Ion Layers

Status: current implementation

## Scope

This specification defines how Studio exposes optional Cesium Ion terrain, imagery, and 3D assets while keeping the
default scene independent from Cesium Ion.

## Catalog contract

An Ion-dependent catalog entry declares its Cesium asset identifier and the relevant layer type:

- `terrain` with `terrainType: cesium`;
- `base` or `overlay` with `tile: ion`;
- `base3d` or `tiles3d` with a Cesium Ion asset identifier.

All such entries use `usage.type: freemium`. `cesium-ellipsoid` uses `terrainType: ellipsoid` and remains `free`.

The default catalog configuration is:

```yaml
base: arcgis-normal
terrain: reearth-world
```

## Runtime architecture

`IonLayerUtils` owns Ion resource creation:

- `getIonAccessToken()` requires the provider-level vault credential and lazily initializes the cache;
- `ionResourceFromAssetId()` creates an explicit `IonResource` with that credential;
- `imageryProviderFromLayer()` creates Ion or Google 2D imagery providers with that credential;
- `createTileset()` creates Ion tilesets with an explicit resource and temporarily scopes the credential for Google
  Photorealistic 3D Tiles;
- `clearCesiumCache()` clears the existing optional cache without creating a new one.

The default Cesium viewer uses `imageryProvider: false` and `baseLayerPicker: false`. Non-Ion providers are constructed
without Ion credentials. Direct URL terrain and 3D tiles remain independent from Ion.

## Cache contract

The service worker keeps the existing persistent `cesium-ion-assets` cache for Ion asset responses. The application
creates its `CacheManager` only immediately before the first Ion resource is requested. Range requests, API endpoints,
and non-Ion requests are not made part of this application-level Ion flow.

Changing or removing the provider token clears the existing cache. No cache object is created merely because Studio
starts or because a personal credential exists in the vault.

## Access flow

1. The user selects an Ion-dependent catalog entry.
2. If no provider token is available, the standard freemium layer dialog opens.
3. The user saves one personal Cesium Ion token in the protected vault.
4. The selected layer and every compatible Ion layer use that provider token.
5. Removing the token locks Ion entries and falls back from active Ion selections to the approved non-Ion defaults.

Persisted selections are normalized during `LayersAndTerrainManager` construction when no provider credential exists, so
an old Ion selection cannot block startup.

## Security rules

- Never commit a shared Cesium Ion token.
- Never pass the provider token to non-Ion providers.
- Never display, log, export, or persist the token outside the protected vault.
- Never use Cesium's built-in default token as an application credential.

## Tests

Tests cover startup isolation, provider-level credential migration, cache laziness, explicit token propagation,
freemium catalog classification, selection locking, and non-Ion fallback behavior.
