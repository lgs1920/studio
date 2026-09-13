# How To Add Providers And Layers

Map, overlay, terrain, and 3D providers are declared in `public/layers-terrains.yaml`.
The file is loaded as runtime settings, indexed by `LayersAndTerrainManager`, and rendered by Cesium through
`MapLayer.jsx` for imagery layers, `TerrainUtils.js` for terrain layers, or the dedicated 3D layer helpers.

## Files

- `public/layers-terrains.yaml`: provider, layer, overlay, terrain, and filter configuration.
- `public/layers-sample.yaml`: complete sample file showing all supported fields.
- `src/core/ui/LayerAndTerrainManager.js`: indexes providers and layer entities by `id`.
- `src/components/cesium/MapLayer.jsx`: creates Cesium imagery providers from layer settings.
- `src/Utils/cesium/TerrainUtils.js`: creates Cesium terrain providers from terrain settings.
- `public/assets/images/layers/thumbnails/`: layer thumbnails referenced by `image`.
- `public/assets/images/layers/logos/`: provider logos referenced by `logo`.

## Top-Level Settings

```yaml
base: arcgis-wayback-20191212
base3d: null
tiles3d: null
overlay: null
terrain: cesium-world

colorSettings:

filter:
  byUsage: all
  byName: ''
  active: false
  thumbnail: true
  provider: true
  alphabetic: true
  byCountries: []

providers:
  - id: osm
    name: OpenStreetMap
    layers: []
```

- `base`: selected base layer id. It must point to a layer with `type: base`.
- `base3d`: selected 3D scene id, or `null`. It must point to a layer with `type: base3d`.
- `tiles3d`: selected 3D tiles overlay id, or `null`. It must point to a layer with `type: tiles3d`.
- `overlay`: selected overlay id, or `null`. It must point to a layer with `type: overlay`.
- `terrain`: selected terrain id. It must point to a layer with `type: terrain`.
- `colorSettings`: optional per-layer visual settings persisted by layer id.
- `filter`: default UI filter state for the layer selector.
- `providers`: list of provider groups.

## Provider Schema

```yaml
- id: osm
  name: OpenStreetMap
  credits: Credits Openstreetmap.org & contributors
  logo: ''
  url: 'https://www.openstreetmap.org'
  layers:
    - name: OpenStreetMap
      id: osm-map
      type: base
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable provider id. Layer ids must use this as the prefix, for example `osm-map`. |
| `name` | Yes | Display name in settings UI. |
| `credits` | Recommended | Provider-level attribution. |
| `logo` | Optional | URL or public asset path. |
| `url` | Recommended | Provider website used by info and token UI. |
| `layers` | Yes | Layer definitions owned by this provider. |

## Layer Schema

Common fields:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Unique entity id across all providers. It must start with the provider id and `-`, because entity lookup derives the provider from this prefix. Keep it stable because settings persist by id. |
| `name` | Yes | Display name in the layer selector. |
| `image` | Recommended | Thumbnail filename under the layer images assets. |
| `type` | Yes | `base`, `overlay`, `terrain`, `base3d`, or `tiles3d`. |
| `usage.type` | Yes | `free`, `freemium`, `premium`, `account`, or `personal`. |
| `usage.doc` | Optional | Provider documentation or API key documentation URL. |
| `usage.signin` | Optional | Account/token creation URL. |
| `usage.name` | Required for token layers | Query parameter name, for example `key` or `apikey`. |
| `countries` | Optional | ISO-like country tags used by filters, for example `[ FR ]`. |
| `doc` | Optional | Layer-specific documentation URL. |
| `credits` | Optional | Layer-specific attribution override. |
| `assetId` | Optional | Cesium ion asset id. Supported by imagery, terrain, and 3D layers. |
| `ionAssetId` | Optional | Alias for `assetId`, used by the ion 3D helpers. |
| `sceneKind` | Optional | Extra ion scene hint, for example `google-photorealistic`. |
| `imageryKind` | Optional | Ion imagery hint, for example `ion` or `google2d`. |
| `mapType` | Optional | Cesium Google2D map type, for example `satellite`. |
| `overlayLayerType` | Optional | Extra Google2D overlay hint. |
| `show` | Optional | Initial 3D visibility flag. |

Imagery fields:

| Field | Required | Notes |
| --- | --- | --- |
| `tile` | Yes | One of the supported imagery tile types below. |
| `url` | Yes | Base URL or URL template consumed by the selected tile type. |
| `minimumLevel` | Required for imagery | Lowest native zoom level. Prevents invalid low-level tile requests. |
| `maximumLevel` | Required for imagery | Highest native zoom level. Prevents 400/404 tile storms when Cesium zooms too far. |
| `alpha` | Optional | Initial overlay opacity. |

Terrain fields:

| Field | Required | Notes |
| --- | --- | --- |
| `terrainType` | Yes | `cesium`, `ellipsoid`, or `url`. |
| `url` | Required for `terrainType: url` | Terrain endpoint. Can include `{%authent%}` for token replacement. |
| `noRelief` | Optional | UI hint for ellipsoid terrain. |

Ion 3D fields:

| Field | Required | Notes |
| --- | --- | --- |
| `base3d` | Required for `type: base3d` | Nested options for the active 3D base scene. |
| `tiles3d` | Required for `type: tiles3d` | Nested options for an additional 3D tileset. |
| `base3d.kind` | Optional | Scene kind hint, typically `google-photorealistic` or `ion`. |
| `base3d.flyToOnLoad` | Optional | Automatically fly the camera after load. |
| `base3d.showGlobe` | Optional | Keep the globe visible under the 3D scene. |
| `base3d.showTerrain` | Optional | Keep terrain enabled under the 3D scene. |
| `tiles3d.kind` | Optional | 3D tileset kind hint. |
| `tiles3d.flyToOnLoad` | Optional | Automatically fly the camera after load. |
| `tiles3d.maximumScreenSpaceError` | Optional | Cesium 3D tileset quality / performance tradeoff. |

## Supported Imagery Tile Types

### `slippy`

Uses Cesium `OpenStreetMapImageryProvider`.

```yaml
tile: slippy
url: 'https://tile.openstreetmap.org/'
minimumLevel: 0
maximumLevel: 19
type: base
```

The URL is a directory-style root. Cesium appends `{z}/{x}/{y}.png`.

### `maptiler`

Uses Cesium `UrlTemplateImageryProvider`.

```yaml
tile: maptiler
url: 'https://api.maptiler.com/maps/winter-v4/256/{z}/{x}/{y}@2x.png?{%authent%}'
minimumLevel: 0
maximumLevel: 22
usage:
  type: freemium
  signin: 'https://cloud.maptiler.com/maps/'
  name: key
```

`{%authent%}` is replaced at runtime with `usage.name=storedToken`.

### `thunderforest`

Uses Cesium `UrlTemplateImageryProvider`.

```yaml
tile: thunderforest
url: 'https://tile.thunderforest.com/outdoors/'
minimumLevel: 0
maximumLevel: 22
usage:
  type: freemium
  signin: 'https://www.thunderforest.com/pricing/'
  name: apikey
```

The renderer builds the final URL as:

```text
{url}{z}/{x}/{y}.png?{usage.name}={usage.token}
```

### `swisstopo`

Uses Cesium `UrlTemplateImageryProvider`.

```yaml
tile: swisstopo
url: https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg
minimumLevel: 0
maximumLevel: 20
```

Use the same URL template order as the provider endpoint: `{z}/{x}/{y}`.

### `wmts`

Uses Cesium `WebMapTileServiceImageryProvider`.

```yaml
tile: wmts
url: 'https://data.geopf.fr/wmts'
layer: ORTHOIMAGERY.ORTHOPHOTOS
style: normal
format: image/jpeg
tileMatrixSetID: PM
minimumLevel: 0
maximumLevel: 19
```

Required WMTS fields are `layer`, `style`, `format`, and `tileMatrixSetID`.

### `wmts-legacy`

Uses Cesium `UrlTemplateImageryProvider` with a query string assembled by `MapLayer.jsx`.

```yaml
tile: wmts-legacy
url: https://data.geopf.fr/private/wmts
layer: GEOGRAPHICALGRIDSYSTEMS.MAPS
style: normal
format: image/jpeg
tileMatrixSetID: PM
minimumLevel: 0
maximumLevel: 18
apikey: ign_scan_ws
other: '&Service=WMTS&Request=GetTile&Version=1.0.0'
```

The generated URL uses `TileMatrix={z}`, `TileRow={y}`, and `TileCol={x}`.

### `wayback`

Uses Cesium `UrlTemplateImageryProvider`.

```yaml
tile: wayback
url: 'https://wayback-b.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/49849/'
minimumLevel: 0
maximumLevel: 23
```

The renderer strips the trailing slash and appends `/{z}/{y}/{x}`.

## Supported Terrain Types

### Cesium World Terrain

```yaml
type: terrain
terrainType: 'cesium'
```

Uses Cesium ion asset id `1`.

### Ellipsoid

```yaml
type: terrain
terrainType: 'ellipsoid'
noRelief: true
```

Uses `EllipsoidTerrainProvider`.

### URL Terrain

```yaml
type: terrain
terrainType: url
url: 'https://api.maptiler.com/tiles/terrain-quantized-mesh-v2?{%authent%}'
usage:
  type: freemium
  signin: https://cloud.maptiler.com/maps/
  name: key
```

Uses `CesiumTerrainProvider.fromUrl`.

## Supported Ion 3D Types

### `base3d`

Uses a Cesium ion 3D tileset as the active scene base.

```yaml
type: base3d
assetId: 2275207
sceneKind: google-photorealistic
base3d:
  kind: google-photorealistic
  flyToOnLoad: false
  showGlobe: true
  showTerrain: false
```

This is meant for root scene assets like Google Photorealistic 3D Tiles.

### `tiles3d`

Uses a Cesium ion 3D tileset as an overlay primitive.

```yaml
type: tiles3d
assetId: 96188
tiles3d:
  kind: ion
  flyToOnLoad: false
  maximumScreenSpaceError: 16
```

This is meant for add-on 3D tilesets such as Cesium OSM Buildings.

## Authentication

Token-protected layers use the `usage` block:

```yaml
usage:
  type: freemium
  signin: 'https://provider.example/account'
  doc: 'https://provider.example/docs'
  name: key
```

The user token is stored in the local vault store by layer id. At runtime:

- URL-template providers replace `{%authent%}` with `{usage.name}={usage.token}`.
- Thunderforest appends `?{usage.name}={usage.token}`.
- URL terrain replaces `{%authent%}` with `{usage.name}={usage.token}`.

Do not commit personal provider tokens in `layers-terrains.yaml`.

## Zoom Levels

Every imagery layer should define both:

```yaml
minimumLevel: 0
maximumLevel: 19
```

Use provider capabilities or documentation as the source of truth:

- WMTS: read `TileMatrixSetLimits` from GetCapabilities.
- XYZ/slippy templates: verify provider `minzoom` and `maxzoom`, or check documented tile JSON.
- If a layer returns 400/404 above a given zoom level, set `maximumLevel` to the highest valid level.

This is important because Cesium will otherwise keep requesting unavailable high-zoom tiles, which can flood the console
with `Failed to obtain image tile` errors.

## Adding a Provider

1. Add a provider entry under `providers`.
2. Add one or more layers with stable unique ids.
3. Choose the correct `type`: `base`, `overlay`, `terrain`, `base3d`, or `tiles3d`.
4. Choose the correct `tile` or `terrainType`.
5. Add `minimumLevel` and `maximumLevel` for each imagery layer.
6. Add `usage.signin`, `usage.doc`, and `usage.name` for token-protected providers.
7. Add `assetId` / `ionAssetId` and the relevant `base3d` or `tiles3d` block for ion 3D layers.
8. Add thumbnails under `public/assets/images/layers/thumbnails/` and logos under `public/assets/images/layers/logos/` when needed.
9. Add proper credits.
10. Parse the YAML and run a build before committing.

Useful local checks:

```bash
node -e "const fs=require('fs'); const YAML=require('yaml'); YAML.parse(fs.readFileSync('public/layers-terrains.yaml','utf8')); console.log('ok')"
bun run build
```

## Current Imagery Bounds

| Layer id | Tile type | Min | Max |
| --- | --- | ---: | ---: |
| `ign-cadastral` | `wmts` | 0 | 19 |
| `ign-map-v2` | `wmts` | 0 | 19 |
| `ign-map` | `wmts-legacy` | 0 | 18 |
| `ign-scan25` | `wmts-legacy` | 6 | 16 |
| `ign-drone` | `wmts` | 3 | 15 |
| `ign-photo` | `wmts` | 0 | 19 |
| `ign-cassini` | `wmts` | 6 | 14 |
| `ign-em-1820` | `wmts` | 6 | 15 |
| `ign-winter-trek` | `wmts` | 6 | 16 |
| `wmt-map-hiking` | `slippy` | 0 | 18 |
| `swtopo-map` | `swisstopo` | 0 | 19 |
| `swtopo-img` | `swisstopo` | 0 | 20 |
| `arcgis-wayback-last` | `wayback` | 0 | 23 |
| `arcgis-wayback-20191212` | `wayback` | 0 | 23 |
| `osm-map` | `slippy` | 0 | 19 |
| `otm-map` | `slippy` | 0 | 17 |
| `mpt-aqua` | `maptiler` | 0 | 22 |
| `mpt-sat` | `maptiler` | 0 | 22 |
| `mpt-winter` | `maptiler` | 0 | 22 |
| `osmorg-tracks` | `slippy` | 0 | 20 |
| `thdfrst-cycle` | `thunderforest` | 0 | 22 |
| `thdfrst-ldscp` | `thunderforest` | 0 | 22 |
| `thdfrst-out` | `thunderforest` | 0 | 22 |
