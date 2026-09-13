# CesiumJS MVT Layers Research and LGS1920 Studio TODO

Status: research and future implementation guidance

Research date: 2026-09-04

Project CesiumJS version: 1.145.0

## Executive conclusion

CesiumJS `MVTDataProvider` is a useful new integration point for LGS1920
Studio, but it is not a drop-in replacement for the current imagery layer
catalog. It loads Mapbox Vector Tiles (`.mvt` or `.pbf`) from a `{z}/{x}/{y}`
URL template, converts them to a runtime 3D Tiles hierarchy, and exposes
feature attributes for styling and picking.

The recommended first use in Studio is a single experimental vector overlay
for large, mostly static datasets such as roads, trails, rivers, parcels, or
administrative boundaries. The overlay should be draped onto the active terrain
when appropriate. Existing raster bases, aerial photography, satellite
imagery, hillshade, and terrain providers should remain available because MVT
does not contain rendered pixels or elevation data.

An MVT layer does not require a Cesium Ion token by itself. A token is required
only when the selected source, terrain, or receiving 3D content is Cesium Ion
based. A vector tile service may instead require its own API key, access token,
custom query parameter, or request header.

## What CesiumJS provides

`MVTDataProvider.fromUrl` accepts either a URL template or a Cesium `Resource`.
The template must contain `{z}`, `{x}`, and `{y}` and the source must return
valid MVT binary data. The provider is added directly to `scene.primitives`.
Its generated `provider.tileset` can be used for styling, tile events, runtime
statistics, and picking.

The current API supports:

- Point, line, and polygon MVT features
- Runtime `Cesium3DTileStyle` expressions based on source attributes
- Per-feature visibility with the style `show` expression
- Screen-space line widths for vector polylines
- Feature picking through `Scene.pick`
- Stable source identifiers through `featureIdProperty`
- Optional clamping to terrain, 3D Tiles, or both through `heightReference`
  and `scene`
- Sparse services where HTTP 404 and 204 tiles are treated as empty tiles
- Authentication through `Cesium.Resource` query parameters or request options

The API is still marked experimental and can change without the normal Cesium
deprecation policy. MVT support should therefore be isolated behind a Studio
provider abstraction rather than spread through the existing imagery code.

### Important current limitations

The provider currently creates the complete runtime tile hierarchy during
initialization. A broad extent combined with a high `maxZoom` can allocate a
large number of nodes before the camera renders anything. Studio should always
store a small, accurate geographic extent and the source zoom range. The
Cesium documentation warns that a global hierarchy through zoom level 8 is
already large, and the related Cesium issue tracks lazy hierarchy creation.

Cesium does not automatically apply a Mapbox or MapLibre style JSON to an MVT
provider. Studio would need to translate a supported style subset into
`Cesium3DTileStyle` conditions. Lines and polygons are primarily controlled by
color, visibility, and line width. Point labels are exposed by the current
style API, but cartographic symbol placement and collision behavior require a
separate design.

## Styling and filtering MVT features

This is one of the strongest reasons to use MVT in Studio. The geometry is
vector data and the feature attributes are available at runtime, so Studio can
change the appearance or visibility of loaded features without changing the
source tiles.

### Filter roads by their type

The exact property name depends on the MVT service. A road service may expose
`highway`, `class`, `subclass`, `kind`, or another schema-specific property.
The property must be present in the tile and the spelling and capitalization
are case-sensitive.

For a source exposing `highway`, a filter that keeps only major roads could be
written as follows:

```js
provider.tileset.style = new Cesium3DTileStyle({
    show: {
        conditions: [
            ["${highway} === 'motorway'", 'true'],
            ["${highway} === 'trunk'", 'true'],
            ["${highway} === 'primary'", 'true'],
            ['true', 'false'],
        ],
    },
    color: {
        conditions: [
            ["${highway} === 'motorway'", "color('#e63946')"],
            ["${highway} === 'trunk'", "color('#f77f00')"],
            ["${highway} === 'primary'", "color('#fcbf49')"],
            ['true', "color('#999999', 0.35)"],
        ],
    },
    lineWidth: {
        conditions: [
            ["${highway} === 'motorway'", '4.0'],
            ["${highway} === 'trunk'", '3.0'],
            ["${highway} === 'primary'", '2.0'],
            ['true', '1.0'],
        ],
    },
})
```

The `show` expression controls visibility. The `color` and `lineWidth`
expressions control the visual treatment of the same feature classes. The
last `true` condition is the fallback and must be explicit so that every
feature has a predictable result.

Other useful filters include:

```js
const filter = new Cesium3DTileStyle({
    // Keep public hiking routes that are longer than five kilometres.
    show: "${route_type} === 'hiking' && ${length_km} >= 5 && ${access} === 'public'",
    color: "color('#00b4d8', 0.9)",
    lineWidth: '2.5',
})
provider.tileset.style = filter
```

For property names containing punctuation or other special characters, use
the bracket form supported by the styling language:

```js
provider.tileset.style = new Cesium3DTileStyle({
    show: "${feature['route:type']} === 'hiking'",
})
```

### Runtime filter changes

Studio can assign a new style when the user changes a filter. Cesium evaluates
the expression against features in tiles that are loaded or subsequently
loaded. Reassigning the style does not require downloading the same tiles
again.

This is a rendering filter, not a network filter. Features are hidden after
their containing tiles have been downloaded and decoded. A filter that keeps
only primary roads does not prevent secondary roads from being transferred if
they are in the same source tiles. To reduce network traffic or decoded data,
the provider must publish a narrower dataset, a narrower endpoint, or a
server-side tileset generated with the desired selection.

### Styling by geometry and feature class

The source attribute should describe the distinction Studio wants to expose.
For example, a route dataset could publish `route_type`, `difficulty`,
`surface`, and `access` properties. A general basemap could publish `class`
and `subclass`. Studio should not guess that `class` means the same thing for
every provider.

The current Cesium style API supports these useful vector-tile properties:

| Geometry | Useful style properties |
| --- | --- |
| Points | `show`, `color`, `pointSize`, `pointOutlineWidth`, `pointOutlineColor`, and point label properties where supported by the Cesium version |
| Lines | `show`, `color`, and `lineWidth` |
| Polygons | `show` and `color` |

The current style reference also exposes point label expressions such as
`labelText`, `labelColor`, `labelOutlineColor`, `labelOutlineWidth`, `font`,
and `labelStyle`. Their usefulness for an MVT basemap must be verified with a
real provider because label density, collision handling, and cartographic
placement are not equivalent to a full Mapbox GL renderer.

### Filtering by MVT source layer

One MVT tile can contain several named source layers such as `transportation`,
`water`, and `landuse`. A source-layer name is not currently documented as a
public `MVTDataProvider` style selector. The CesiumJS 1.145 runtime conversion
currently writes an internal `_layer` metadata property, but Studio should not
make that internal detail a persisted product contract while the provider is
experimental.

The stable options are:

- Ask the provider for an endpoint containing only the required source layer
- Ask the data publisher to copy the source-layer name into an explicit
  feature property such as `dataset_layer`
- Generate a Studio-owned MVT endpoint with normalized properties
- Use `${dataset_layer}` in a `show` condition after verifying the source schema

If a pilot confirms that `_layer` is useful, it may be supported behind a
versioned adapter and covered by a Cesium upgrade test rather than exposed as
an undocumented user-facing field.

### Recommended Studio filter UI

The first Studio UI should not expose arbitrary expression strings as the main
workflow. It should offer a constrained filter builder with:

- Property selection from a documented provider schema
- Operators for equality, inequality, numeric comparison, and membership
- A value editor appropriate to the property type
- A preview of the generated `show` expression
- A reset action that restores the provider default style

An advanced style editor can be considered later, but it must use a bounded
Cesium styling subset and validate expressions before saving them. The layer
editor should also make clear that filtering affects visibility after download
and does not reduce provider quotas by itself.

## Relationship with the current Studio architecture

Studio currently has two different rendering paths:

| Current source | Studio path | MVT relationship |
| --- | --- | --- |
| Raster XYZ, WMTS, WMS, Wayback, MapTiler, and Ion imagery | `MapLayer.jsx` creates an `ImageryProvider`, then an `ImageryLayer` | MVT cannot use this path directly |
| Direct or Ion 3D Tiles | `Base3DLayer.jsx` and `Tiles3DLayer.jsx` add a tileset to `scene.primitives` | MVT has a similar primitive lifecycle, but its provider owns the generated tileset |
| Terrain | `TerrainUtils` and the terrain manager | MVT can drape onto the active surface, but it does not provide terrain |
| Journey and GPX data | Local GeoJSON, entities, primitives, and application state | MVT is not a good replacement for small, editable, time-aware journey data |

The current `base` and `overlay` settings are tied to imagery collections.
Adding `tile: mvt` to `MapLayer.jsx` would therefore be insufficient. The
implementation would need a dedicated vector primitive lifecycle that handles
creation, visibility, replacement, errors, cleanup, and layer ownership.

The first implementation should expose MVT as an overlay only. Treating MVT as
a base map would require explicit primitive ordering, a suitable globe
background, basemap label strategy, and a decision about how vector geometry
should interact with imagery. This is a larger design problem than loading a
vector overlay.

## What MVT can do for LGS1920 Studio

### Strong use cases

- Stream a large trail or road network without loading one large GeoJSON file
- Display administrative boundaries, protected areas, rivers, or parcels
- Filter or recolor features locally according to source attributes
- Keep line widths readable during camera movement with screen-space styling
- Pick a feature and expose its source properties in a Studio information panel
- Drape terrain-native features such as trails, rivers, and boundaries onto the
  active terrain
- Drape features onto a 3D base when the source represents geometry on that
  content
- Keep the source provider external and declarative rather than preprocessing
  every dataset into a Studio-specific format

### Weak or unsuitable use cases

- Replacing satellite or aerial imagery
- Replacing hillshade or other raster-rendered products
- Replacing a quantized-mesh or other elevation terrain provider
- Replacing Google Photorealistic 3D Tiles, Re:Earth Buildings, or other 3D
  content
- Replacing a small user journey that must remain editable and time-aware
- Replacing Studio's animated journey trace, POIs, or replay-specific geometry
- Reproducing a complete Mapbox basemap automatically from a style JSON
- Using a global high-zoom dataset without a tightly controlled extent

## Candidate sources and current layers

The following recommendations distinguish between a technical candidate and a
confirmed provider integration. Provider availability, terms, quotas, and
attribution must be checked again before adding any catalog entry.

| Candidate | Potential Studio use | Token situation | Recommendation |
| --- | --- | --- | --- |
| MapTiler vector tiles | A vector base alternative or, preferably, a styled vector overlay derived from the existing MapTiler provider | Requires a MapTiler API key. It does not require Cesium Ion | Best first external pilot because Studio already has MapTiler credential handling and provider metadata |
| CARTO vector basemaps | OSM-derived streets, boundaries, and land-use context as a vector overlay or carefully designed vector base | Depends on the CARTO service and plan. Do not assume unrestricted commercial use | Good comparison candidate after licensing and endpoint access are verified |
| A self-hosted MVT service | LGS-owned static geographic datasets, regional trail networks, or controlled provider data | No Cesium Ion token. Authentication can be owned by LGS1920 | Best long-term option when reproducibility, quotas, and data ownership matter |
| OpenMapTiles or another OSM-derived service | Vector cartography where a compatible hosted endpoint is available | Provider-specific. Hosting may be free while delivery still has operational cost | Consider as a data format or self-hosting source, not as a guaranteed public endpoint |
| IGN, GeoPF, PDOK, BKG, Kartverket, NGI, and similar national sources | Potential vector overlays if the specific service publishes MVT | Provider-specific and dataset-specific | Keep current WMTS/WMS entries until a concrete MVT endpoint and licence are verified |

### Existing Studio catalog assessment

| Current layer family | Can MVT replace it? | Assessment |
| --- | --- | --- |
| `mpt-aqua`, `mpt-winter`, and other rendered map bases | Partially | A vector streets or topographic map could replace the visual role, but not the raster style without recreating it in Cesium styling |
| `mpt-sat`, IGN photos, national orthophotos, Google 2D photos, ArcGIS imagery | No | These are pixel imagery products. MVT has no image texture equivalent |
| `bkg-de-topplus-hillshade`, Kartverket hillshade, NGI hillshade | No direct replacement | Hillshade is a rendered raster or a terrain-derived product. It is not ordinary vector tile content |
| `wmt-map-hiking`, `osmorg-tracks`, `ign-drone`, and `ign-winter-trek` | Only if a compatible MVT service exists | The current catalog entries are raster tile services. The existing URLs cannot be passed to `MVTDataProvider` |
| `cesium-world`, `reearth-world`, and `mpt-terrain` | No | These provide elevation, not vector features |
| `reearth-buildings`, Google Photorealistic 3D, and other 3D layers | No | MVT can be draped onto 3D content, but cannot replace the 3D content |
| Local journey tracks and POIs | Usually no | Keep application-owned journey data in the existing editable and replay-aware model |

The most realistic replacement experiment is therefore a new vector map or
trail overlay, not the removal of an existing imagery or terrain layer.

## Cesium Ion token answer

### No Ion token is required for the MVT provider itself

This is valid with a direct MVT endpoint:

```js
const provider = await MVTDataProvider.fromUrl(
    new Resource({
        url: 'https://example.com/tiles/{z}/{x}/{y}.pbf',
        queryParameters: {api_key: providerKey},
    }),
    {
        minZoom: 6,
        maxZoom: 14,
        extent: Rectangle.fromDegrees(west, south, east, north),
        heightReference: HeightReference.CLAMP_TO_TERRAIN,
        scene: viewer.scene,
    },
)
viewer.scene.primitives.add(provider)
```

The source service still controls its own authentication, quotas, licence,
and CORS policy. A direct service may need no credential, an API key, a custom
query parameter, or a request header.

### When Ion is still involved

An Ion token is needed when Studio uses an Ion-dependent resource such as:

- Cesium World Terrain as the receiving terrain
- An Ion-hosted vector or 3D Tiles asset
- Cesium Ion imagery
- Google Photorealistic 3D Tiles through the Cesium Ion resource flow

If Studio uses Re:Earth terrain, the ellipsoid, a direct terrain URL, direct
3D Tiles, or a non-Ion MVT endpoint, the MVT feature itself does not create an
Ion dependency. The MVT implementation must not route non-Ion credentials
through `IonLayerUtils` or store a provider key as `cesium_ion_token`.

Studio should keep the existing separation between the provider-level Ion
credential and other provider credentials. A MapTiler or CARTO key belongs to
that provider's vault entry and must never be committed to
`layers-terrains.yaml`, displayed in logs, or included in exported project
data unless the existing product policy explicitly allows that behavior.

## Proposed Studio model

The following is a proposal for validation, not an implemented contract.

```yaml
- name: Regional vector trails
  id: vector-regional-trails
  type: overlay
  tile: mvt
  url: 'https://provider.example/tiles/{z}/{x}/{y}.pbf'
  extent: [ -1.2, 43.0, 2.0, 45.5 ]
  minimumLevel: 6
  maximumLevel: 14
  featureIdProperty: osm_id
  heightReference: clampToTerrain
  style:
    show: "${class} !== 'service'"
    color: "color('#f4d35e')"
    lineWidth: "2.0"
  usage:
    type: freemium
    name: key
```

The exact schema needs validation before implementation. In particular:

- Use a dedicated `mvt` tile kind rather than overloading imagery providers
- Keep MVT as an overlay in the first iteration
- Require or strongly recommend `extent`, `minimumLevel`, and `maximumLevel`
- Represent `heightReference` with a safe Studio value mapped to Cesium's enum
- Store provider authentication metadata separately from Ion metadata
- Define a bounded style schema instead of allowing arbitrary persisted code
- Preserve provider credit, attribution URL, licence, and availability fields

## Required implementation work

### 1. Provider and scene lifecycle

- Add a dedicated `MvtLayer` component or equivalent scene service
- Construct `MVTDataProvider` with `fromUrl`, never with a direct constructor
- Add and remove the provider from `scene.primitives`
- Destroy or release the provider safely when the selected layer changes
- Handle asynchronous creation cancellation when the viewer or selection is
  replaced
- Propagate loading, 404/204, authentication, CORS, decode, and tile errors to
  the existing layer error UI
- Expose `provider.show` and preserve visibility across normal scene changes
- Track the active provider separately from `theLayerOverlay`, which currently
  represents an imagery layer

### 2. Catalog, settings, and credentials

- Extend the declarative layer schema with MVT-specific fields
- Decide whether the first release permits one MVT overlay or multiple vector
  overlays
- Add provider-specific key interpolation through `Resource`
- Keep credentials in the existing protected provider vault flow
- Classify Ion dependency independently from MVT availability
- Add accurate attribution and licence text to every candidate layer
- Define a regional extent policy to avoid accidental global hierarchy creation

### 3. Styling and interaction

- Translate a safe declarative style subset into `Cesium3DTileStyle`
- Support color, show, point size, point outline, and line width first
- Add a constrained filter builder for property, operator, and value
- Make it clear in the UI that client-side filtering does not reduce tile
  downloads
- Decide whether style values can be changed live from the layer editor
- Use `featureIdProperty` when the source offers a stable identifier
- Add a feature information path for `getPropertyIds` and `getProperty`
- Define how vector feature picking coexists with journey, POI, and 3D Tiles
  selection
- Do not promise automatic Mapbox GL style JSON compatibility in the first
  release

### 4. Terrain and 3D draping

- Default terrain-native data to `CLAMP_TO_TERRAIN` only when the source
  semantics justify it
- Use `CLAMP_TO_3D_TILE` or `CLAMP_TO_GROUND` only for content that should
  follow buildings or other supported 3D surfaces
- Ensure the receiving 3D content is created with the same Cesium `scene`
- Recreate the provider when `heightReference` changes because Cesium sets the
  clamping target at creation time
- Validate the result with Re:Earth terrain, ellipsoid terrain, Ion terrain,
  and the active 3D base where applicable

### 5. Replay and HQ video export

The current replay scene descriptor captures imagery layers, terrain, and the
configured 3D base. It does not capture arbitrary vector primitives. An MVT
implementation therefore needs to:

- Add a serializable vector layer descriptor containing source URL metadata,
  extent, zoom range, feature ID property, clamping mode, style, and provider
  credential reference
- Recreate MVT providers in `IsolatedHqReplayRenderHost`
- Include MVT providers in replay tile readiness and loading decisions
- Avoid serializing raw secrets into replay descriptors or exported projects
- Decide whether video export requires live network access, an application
  cache, or a preflight failure when the MVT source is unavailable
- Verify deterministic frame readiness when vector tiles refine during camera
  movement
- Test vector overlays on both the globe and the base 3D imagery collection

This work is required before an MVT layer can be considered fully compatible
with Studio replay and video export.

## Performance and reliability guardrails

- Always configure the smallest valid `extent`
- Match `maximumLevel` to the actual service. Do not guess a high value
- Start with regional datasets rather than global high-zoom datasets
- Measure initialization time, tile count, decoded feature count, GPU memory,
  and browser heap on representative desktop and mobile hardware
- Keep translucent styles limited because they can add rendering passes
- Prefer a stable `featureIdProperty` to improve cross-tile feature identity
- Test empty tiles, sparse coverage, invalid tiles, slow requests, and CORS
  failures
- Treat the experimental Cesium API as a replaceable adapter
- Re-check the Cesium release notes before upgrading or relying on an API
  detail that is marked experimental

## Suggested phased plan

### Phase 0: feasibility spike

- Select one regional public or account-backed MVT endpoint
- Load it in a minimal Cesium scene using the installed CesiumJS version
- Validate extent, zoom range, CORS, feature properties, styling, picking, and
  terrain draping
- Record browser memory and first-render timings
- Verify provider terms, attribution, quotas, and key restrictions

### Phase 1: Studio overlay pilot

- Add one `mvt` overlay catalog entry behind the existing layer settings
- Implement provider creation and cleanup in a dedicated component
- Add basic style conditions and feature picking
- Add tests for configuration, token isolation, lifecycle cleanup, and errors
- Keep raster bases and existing raster overlays unchanged

### Phase 2: replay and export support

- Extend the scene descriptor and isolated HQ render host
- Include vector providers in readiness tracking
- Test replay scrubbing, camera jumps, snapshots, and HQ export
- Decide on the network and caching policy for exported video

### Phase 3: broader provider support

- Add a second provider only after the first pilot is stable
- Consider multiple vector overlays and a vector base mode separately
- Evaluate style JSON import only if a real Studio use case justifies it
- Consider self-hosted MVT for LGS-owned or reproducibility-sensitive data

## Decision summary

| Question | Answer |
| --- | --- |
| Is MVT useful for Studio? | Yes, primarily for large static vector overlays that benefit from streaming, styling, picking, or draping |
| Can it replace current imagery layers? | Only the vector/cartographic role of some rendered map layers, and not as a drop-in replacement |
| Can it replace satellite, aerial, hillshade, or terrain layers? | No |
| Can it replace local journeys or replay traces? | Generally no. Those remain application-owned, editable, and time-aware |
| Is a Cesium Ion token mandatory? | No. It is required only for Ion-backed source or receiving resources |
| Best first candidate? | MapTiler vector tiles because MapTiler is already represented in the catalog, subject to endpoint and licence validation |
| Main technical risk? | Experimental API status and upfront runtime hierarchy allocation for broad or high-zoom coverage |
| First Studio shape? | A dedicated, regional, styled MVT overlay with explicit replay/export limitations |

## References

- [CesiumJS `MVTDataProvider` API reference](https://cesium.com/learn/cesiumjs/ref-doc/MVTDataProvider.html)
- [CesiumJS tutorial: Load Mapbox Vector Tiles](https://cesium.com/learn/cesiumjs-learn/load-mapbox-vector-tiles-in-cesiumjs/)
- [CesiumJS tutorial: Drape and style vector data](https://cesium.com/learn/cesiumjs-learn/drape-and-style-vector-data-on-terrain-and-3d-tile/)
- [CesiumJS `Cesium3DTileStyle` API reference](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileStyle.html)
- [3D Tiles Styling language](https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling)
- [CesiumJS 1.144 release highlights](https://github.com/CesiumGS/cesium/releases/tag/1.144)
- [Cesium issue: MVTDataProvider tileset traversal and memory](https://github.com/CesiumGS/cesium/issues/13535)
- [Cesium Ion access token guidance](https://cesium.com/learn/ion/cesium-ion-access-tokens/)
- [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec)
- [MapTiler OGC API Tiles and vector tile guidance](https://docs.maptiler.com/guides/maps-apis/maps-platform/ogc-api-tiles/)
- [MapTiler authentication and API key guidance](https://docs.maptiler.com/cloud/api/authentication-key/)
- [CARTO basemap documentation](https://docs.carto.com/faqs/carto-basemaps)
