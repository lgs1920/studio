# Cesium Ion Token Management

## Purpose

Cesium Ion is an optional provider for hosted terrain, imagery, and 3D assets. Studio must remain fully usable with
its non-Ion defaults and must request a personal Ion credential only when an Ion-dependent layer is selected.

## Token model

Studio stores one personal Cesium Ion token in the protected local vault under `cesium_ion_token`.

The runtime Ion store exposes only whether that provider credential is available and keeps the credential available to
the Ion resource factory. The token is never written to public configuration, regular settings, logs, exports, or UI
fields containing a visible value.

There is no shared application token, trial allowance, usage timer, quota prompt, or introductory Ion dialog.

## Startup behavior

Startup follows this sequence:

1. Load the local vault token, if present.
2. Migrate the first legacy per-layer Ion token to `cesium_ion_token` and remove legacy Ion layer credentials.
3. Remove obsolete shared-token and trial persistence values.
4. Mark the provider credential as available or unavailable.
5. Leave `Cesium.Ion.defaultAccessToken` unset.

Startup does not create an Ion resource, access an Ion API, request an Ion asset, or initialize the Ion cache.

## Resource behavior

`IonLayerUtils` is the only resource-level integration point. Before creating an Ion resource, imagery provider,
terrain provider, or Ion-backed tileset, it:

- obtains the provider-level credential;
- rejects the operation when no credential is available;
- initializes the optional persistent cache lazily;
- passes the credential explicitly to the Cesium factory whenever the API supports an access-token option.

Google Photorealistic 3D Tiles is the Cesium exception: Cesium 1.144 obtains its Ion resource through the global Ion
token. Studio temporarily assigns the provider credential for that creation call and restores the previous global value
immediately afterward.

Non-Ion imagery, terrain, and direct URL resources never receive the Ion credential.

## Layer access

Every catalog entry that requires the Cesium Ion service is classified as `freemium`, including Cesium World Terrain,
Cesium Ion imagery, and Cesium Ion 3D assets. The standard freemium access dialog saves one provider-level token and
unlocks all compatible Ion layers. `cesium-ellipsoid` remains `free` because it uses a local Cesium provider and does
not require Ion.

## Removal and fallback

Removing the provider token:

- deletes `cesium_ion_token` from the vault;
- clears the optional Ion cache;
- locks Ion-dependent catalog entries;
- changes an active Ion base to `arcgis-normal`;
- changes an active Ion terrain to `reearth-world`;
- removes active Ion overlays and 3D layers.

A persisted Ion selection without a usable token is normalized to the same non-Ion defaults before terrain startup.

## Validation

Automated tests cover:

- startup without a token and without Ion cache initialization;
- provider-level token loading and saving;
- migration from legacy layer credentials;
- removal and non-Ion fallback;
- explicit token handling by Ion imagery and tileset factories;
- default layer and terrain classification.
