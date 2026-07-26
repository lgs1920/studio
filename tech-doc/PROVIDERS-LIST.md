# Provider Candidates for Terrain, WMTS, and WMS

Date: 2026-05-04

The request mentioned `WPTS`; this document treats it as `WMTS` (`Web Map Tile Service`).

## Scope

This list focuses on providers that supply at least one of:

- Cesium-compatible terrain, especially Cesium terrain / quantized mesh.
- WMTS raster or imagery layers.
- WMS raster or imagery layers.

Current LGS1920 support:

- Ready now: Cesium terrain (`terrainType: cesium`), URL terrain (`terrainType: url`), `wmts`, `wmts-legacy`, URL-template tile layers.
- Needs code: WMS. Cesium supports this through `WebMapServiceImageryProvider`, but `MapLayer.jsx` does not currently expose a `tile: wms` branch.
- Needs per-provider checks: WMTS services with non-standard tiling schemes, custom `TileMatrixSet`, unusual axis order, or missing EPSG:3857 support.

Cost model vocabulary:

- `free`: public/free access is documented, sometimes with attribution, fair-use, or registration requirements.
- `freemium`: a free tier, trial, quota, or evaluation exists, then paid usage applies.
- `premium`: paid or contract access is the normal model.
- `unknown`: not clear enough from public documentation; verify before integration.

## Current YAML Providers

This table is extracted from `public/layers-terrains.yaml`. `Usage type`, `LGS type`, and `Tile / terrain type` use the
same vocabulary as the YAML file.

| Provider | Layer id | Country / area | Usage type | LGS type | Tile / terrain type | Endpoint URL | Zoom |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cesium | `cesium-world` | Global | `free` | `terrain` | `cesium` | `https://cesium.com/platform/cesiumjs/` | n/a |
| Cesium | `cesium-ellipsoid` | Global | `free` | `terrain` | `ellipsoid` | `https://cesium.com/platform/cesiumjs/` | n/a |
| IGN (France) | `ign-cadastral` | `FR` | `free` | `overlay` | `wmts` | `https://data.geopf.fr/wmts` | 0-19 |
| IGN (France) | `ign-map-v2` | `FR` | `free` | `base` | `wmts` | `https://data.geopf.fr/wmts` | 0-19 |
| IGN (France) | `ign-map` | `FR` | `free` | `base` | `wmts-legacy` | `https://data.geopf.fr/private/wmts` | 0-18 |
| IGN (France) | `ign-scan25` | `FR` | `free` | `base` | `wmts-legacy` | `https://data.geopf.fr/private/wmts` | 6-16 |
| IGN (France) | `ign-drone` | `FR` | `free` | `overlay` | `wmts` | `https://data.geopf.fr/wmts` | 3-15 |
| IGN (France) | `ign-photo` | `FR` | `free` | `base` | `wmts` | `https://data.geopf.fr/wmts` | 0-19 |
| IGN (France) | `ign-cassini` | `FR` | `free` | `base` | `wmts` | `https://data.geopf.fr/wmts` | 6-14 |
| IGN (France) | `ign-em-1820` | `FR` | `free` | `base` | `wmts` | `https://data.geopf.fr/wmts` | 6-15 |
| IGN (France) | `ign-winter-trek` | `FR` | `free` | `overlay` | `wmts` | `https://data.geopf.fr/wmts` | 6-16 |
| WayMarked Trail | `wmt-map-hiking` | Global | `free` | `overlay` | `slippy` | `https://tile.waymarkedtrails.org/hiking/` | 0-18 |
| Swisstopo | `swtopo-map` | `CH` | `free` | `base` | `swisstopo` | `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.landeskarte-farbe-10/default/current/3857/{z}/{x}/{y}.png` | 0-19 |
| Swisstopo | `swtopo-img` | `CH` | `free` | `base` | `swisstopo` | `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg` | 0-20 |
| ArcGIS | `arcgis-wayback-last` | Global | `free` | `base` | `wayback` | `https://wayback-b.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/49849/` | 0-23 |
| ArcGIS | `arcgis-wayback-20191212` | Global | `free` | `base` | `wayback` | `https://wayback-b.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/4756/` | 0-23 |
| OpenStreetMap | `osm-map` | Global | `free` | `base` | `slippy` | `https://tile.openstreetmap.org/` | 0-19 |
| OpenTopoMap | `otm-map` | Global | `free` | `base` | `slippy` | `https://tile.opentopomap.org/` | 0-17 |
| MapTiler | `mpt-terrain` | Global | `freemium` | `terrain` | `url` | `https://api.maptiler.com/tiles/terrain-quantized-mesh-v2?{%authent%}` | n/a |
| MapTiler | `mpt-aqua` | Global | `freemium` | `base` | `maptiler` | `https://api.maptiler.com/maps/aquarelle/256/{z}/{x}/{y}@2x.png?{%authent%}` | 0-22 |
| MapTiler | `mpt-sat` | Global | `freemium` | `base` | `maptiler` | `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?{%authent%}` | 0-22 |
| MapTiler | `mpt-winter` | Global | `freemium` | `base` | `maptiler` | `https://api.maptiler.com/maps/winter-v4/256/{z}/{x}/{y}@2x.png?{%authent%}` | 0-22 |
| OpenSnowMap | `osmorg-tracks` | Global / snow regions | `free` | `overlay` | `slippy` | `https://tiles.opensnowmap.org/pistes/` | 0-20 |
| Thunderforest | `thdfrst-cycle` | Global | `freemium` | `base` | `thunderforest` | `https://tile.thunderforest.com/cycle/` | 0-22 |
| Thunderforest | `thdfrst-ldscp` | Global | `freemium` | `base` | `thunderforest` | `https://tile.thunderforest.com/landscape/` | 0-22 |
| Thunderforest | `thdfrst-out` | Global | `freemium` | `base` | `thunderforest` | `https://tile.thunderforest.com/outdoors/` | 0-22 |

## Best External Candidates

| Provider | Country / area | Provides | Cost model | Suggested LGS type | Suggested tile / terrain type | Endpoint / URL | Official source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cesium ion / custom Cesium terrain | Global | Cesium terrain, quantized mesh | `freemium` | `terrain` | `cesium` or `url` | Account/asset dependent | [Cesium World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/), [Cesium ion](https://cesium.com/learn/ion/), [CesiumTerrainProvider](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html) |
| MapTiler Cloud / Server | Global | Cesium quantized mesh terrain, raster maps, WMTS-oriented workflows | `freemium` | `terrain`, `base` | `url`, `maptiler`, possible `wmts` | `https://api.maptiler.com/...` | [MapTiler cloud pricing](https://www.maptiler.com/cloud/pricing/), [MapTiler Cesium terrain](https://www.maptiler.com/news/2018/08/free-terrain-tiles-for-cesium/), [MapTiler Cesium guide](https://docs.maptiler.com/guides/map-tilling-hosting/data-hosting/photorealistic-3d-terrain-with-aerial-imagery-using-cesium-js/) |
| IGN / GeoPF / cartes.gouv.fr | `FR`, French territories | WMTS, WMS raster, WMS vector | `free` for essential public web services; some layers private/conditional | `base`, `overlay` | `wmts`, `wmts-legacy`, future `wms` | `https://data.geopf.fr/wmts`, `https://data.geopf.fr/wms-r/wms?` | [GeoPF web services](https://geoservices.ign.fr/services-web-essentiels), [GeoPF FAQ](https://geoservices.ign.fr/faq), [WMS/WMTS guide](https://geoservices.ign.fr/documentation/services/utilisation-sig/tutoriel-qgis/wms-wmts), [WMTS capabilities](https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities) |
| Swisstopo / geo.admin.ch | `CH` | WMTS, WMS | `free` OGD for many official geodata/geoservices | `base`, `overlay` | `swisstopo`, possible `wmts`, future `wms` | `https://wmts.geo.admin.ch/1.0.0/WMTSCapabilities.xml`, WMS endpoints via geo.admin.ch | [Free geodata](https://shop.swisstopo.admin.ch/en/free-geodata), [FAQ free geodata](https://www.swisstopo.admin.ch/en/faq-free-geodata), [Geoservices](https://www.swisstopo.admin.ch/en/geoservices-with-swisstopo-geodata), [WMS services](https://www.geo.admin.ch/en/wms-available-services-an-data) |
| ArcGIS Online / ArcGIS Enterprise / Esri Wayback | Global and regional public services | WMTS, WMS for OGC-enabled services; Wayback imagery WMTS | `freemium` for ArcGIS platform; current Wayback endpoint is public | `base`, `overlay` | `wayback`, possible `wmts`, future `wms` | `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/WMTS/1.0.0/WMTSCapabilities.xml` | [ArcGIS tile layers](https://doc.arcgis.com/en/arcgis-online/reference/tile-layers.htm), [ArcGIS pricing](https://location.arcgis.com/pricing/), [ArcGIS OGC support](https://pro.arcgis.com/en/pro-app/latest/help/data/services/ogc-services.htm) |
| NASA GIBS | Global | WMTS, WMS, TWMS, XYZ/TMS | `free` public science imagery service | `base`, `overlay` | possible `wmts`, future `wms` | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi` | [GIBS access basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/), [Map library / WMTS examples](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/) |
| USGS The National Map | `US`, U.S. territories | REST, WMS, WMTS cached basemaps, WFS, WCS | `free` / public domain for many datasets | `base`, `overlay` | possible `wmts`, future `wms` | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer` | [USGS National Map viewer](https://www.usgs.gov/tools/national-map-viewer), [USGS service URLs](https://www.usgs.gov/faqs/where-can-i-find-list-urls-national-map-services), [USGS Topo service](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer) |
| Sentinel Hub | Global | WMS, WMTS, WCS, WFS | `freemium` / trial and paid subscriptions | `base`, `overlay` | future `wms`, possible `wmts` | Instance-specific OGC URLs | [Sentinel Hub OGC services](https://docs.sentinel-hub.com/api/latest/api/ogc/), [Sentinel Hub WMS](https://docs.sentinel-hub.com/api/latest/api/ogc/wms/), [Sentinel Hub billing](https://docs.sentinel-hub.com/api/latest/api/overview/billing/) |
| Copernicus Data Space Ecosystem / Sentinel Hub APIs | Global | WMS, WMTS | `freemium` / account-based quotas | `base`, `overlay` | future `wms`, possible `wmts` | Instance-specific OGC URLs | [Copernicus WMTS docs](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMTS.html) |
| Ordnance Survey Data Hub | `GB` | WMTS, RESTful ZXY | `freemium` / API key; premium OS data quotas and paid usage | `base`, `overlay` | possible `wmts` | OS Maps API endpoint, key-dependent | [OS Maps API](https://www.ordnancesurvey.co.uk/mapsapi), [OS WMTS technical spec](https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api/technical-specification/wmts) |

## Public National or Institutional WMTS/WMS Providers

| Provider | Country / area | Provides | Cost model | Suggested LGS type | Suggested tile type | Endpoint / URL | Official source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| basemap.at | `AT` | WMTS, EPSG:3857 and EPSG:31256 | `free` / OGD CC-BY | `base` | `wmts` or URL template | `https://basemap.at/wmts/1.0.0/WMTSCapabilities.xml` | [basemap.at](https://basemap.at/), [WMTS capabilities](https://basemap.at/wmts/1.0.0/WMTSCapabilities.xml) |
| BKG / basemap.de | `DE` | WMS, WMTS | `free` for basemap.de Web Raster according to published licence | `base` | `wmts`, future `wms` | Service-specific BKG URLs | [basemap.de services](https://basemap.de/dienste/), [BKG WMTS product page](https://gdz.bkg.bund.de/index.php/default/webdienste/basemap-webdienste/wmts-basemapde-webraster-wmts-basemapde-webraster.html), [licence PDF](https://sgx.geodatenzentrum.de/public/gdz/dokumentation/deu/22-03-15_Lizenz_basemap.de_Web_Raster.pdf) |
| IGN Spain / CNIG | `ES` | WMS, WMTS | `free` / public national services, verify per service | `base`, `overlay` | `wmts`, future `wms` | Service-specific IGN/CNIG URLs | [IGN Spain IDE services](https://www.ign.es/web/ide-area-nodo-ide-ign) |
| Kartverket | `NO` | WMS, WFS, WMTS/cache services | `free` for many public map services; verify per layer | `base`, `overlay` | `wmts`, future `wms` | `https://cache.kartverket.no/` | [Kartverket APIs and data](https://www.kartverket.no/en/api-and-data), [Kartverket WMTS cache](https://cache.kartverket.no/), [Norway data service entry](https://data.norge.no/en/data-services/85e935ae-ec7e-3f1d-8ba2-2b507986673e/topografisk-norgeskart-wmts-cache) |
| PDOK | `NL` | WMS, WMTS, WFS, WCS depending dataset | `free` / open data for many services | `base`, `overlay` | `wmts`, future `wms` | Dataset-specific PDOK URLs | [PDOK webservices](https://www.pdok.nl/webservices), [PDOK OGC example](https://www.pdok.nl/ogc-webservices/-/article/basisregistratie-grootschalige-topografie-bgt-) |
| National Land Survey of Finland | `FI` | WMS, WMTS, vector tiles depending dataset | `free` or account/contract depending dataset | `base`, `overlay` | `wmts`, future `wms` | Dataset-specific NLS URLs | [NLS map image service](https://www.maanmittauslaitos.fi/karttakuvapalvelu), [Geoportti NLS overview](https://www.geoportti.fi/services/data/) |
| Datafordeler / Dataforsyningen | `DK` | WMS, WMTS, WFS depending dataset | `freemium` / many services need API key or OAuth | `base`, `overlay` | `wmts`, future `wms` | Dataset-specific URLs | [Datafordeler WMTS example](https://datafordeler.dk/dataoversigt/skaermkortet/skaermkortet-klassisk-wmts/), [Dataforsyningen GIS guide](https://dataforsyningen.dk/asset/PDF/vejledninger/gis-vejledninger.pdf) |
| LINZ Basemaps / LINZ Data Service | `NZ` | WMTS, raster tiles | `freemium` / API key for standard access | `base`, `overlay` | `wmts` | LINZ key-dependent URLs | [LINZ Basemaps API guide](https://www.linz.govt.nz/guidance/data-service/linz-basemaps-guide/how-use-linz-basemaps-apis), [LINZ technical docs](https://basemaps.linz.govt.nz/docs/user-guide/technical-documentation/), [LINZ WMTS in GIS](https://www.linz.govt.nz/guidance/data-service/linz-data-service-guide/map-tile-services/using-lds-wmts-qgis) |
| Natural Resources Canada | `CA` | WMS, WMTS, REST tiled services | `free` for many public government services; verify per service | `base`, `overlay` | `wmts`, future `wms` | Service-specific NRCan URLs | [NRCan web services](https://natural-resources.canada.ca/node/17216?=undefined&wbdisable=true), [NRCan WMS](https://natural-resources.canada.ca/science-data/data-analysis/geospatial-data-tools-services/web-map-service-wms), [NRCan WMTS](https://prod-natural-resources.azure.cloud.nrcan-rncan.gc.ca/science-data/data-analysis/geospatial-data-tools-services/web-map-tile-service-wmts) |
| Geoscience Australia / AUSGIN | `AU` | WMS, WMTS, WFS | `free` for many public geoscience services; verify per dataset | `overlay` | `wmts`, future `wms` | Dataset-specific GA URLs | [Geoscience Australia web services](https://www.geoscience.gov.au/web-services) |
| Arctic SDI | Arctic region | WMTS, cascaded WMS from national services | `free` public basemap services | `base`, `overlay` | `wmts`, future `wms` | Arctic SDI service URLs | [Arctic SDI Topographic Basemap](https://arctic-sdi.org/services/topografic-basemap/) |

## Commercial or Managed WMS/WMTS Providers

These are useful when licensing, SLA, or hosted management matters more than open public access.

| Provider | Country / area | Provides | Cost model | Suggested LGS type | Suggested tile type | Endpoint / URL | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MapSavvy / OnTerra Systems | Global | WMS, WMTS | `premium` / trial may exist | `base`, `overlay` | `wmts`, future `wms` | Customer/account dependent | [MapSavvy](https://www.mapsavvy.com/) |
| Giza | Global / commercial imagery programs | WMTS, WMS | `premium` | `base`, `overlay` | `wmts`, future `wms` | Customer/account dependent | [Giza](https://getgiza.com/) |
| Emapsite | `GB`, licensed datasets | WMS, WMTS | `premium` | `base`, `overlay` | `wmts`, future `wms` | Customer/account dependent | [Emapsite WMS/WMTS](https://www.emapsite.com/online-services/ogc-web-services/web-mapping-services-wms-wmts/) |
| StatMap / Cadcorp ecosystem | `GB`, Ordnance Survey and local datasets | WMS, WMTS, WFS | `premium` | `base`, `overlay` | `wmts`, future `wms` | Customer/account dependent | [StatMap data services](https://www.evo.statmap.co.uk/data-services) |

## Self-Hosted Bridges and Servers

These are not external data providers, but they are useful if a provider has a difficult projection, only WMS, only ArcGIS
REST, or if we need to cache/reproject services for LGS1920.

| Tool | Country / area | Provides | Cost model | Suggested LGS type | Suggested tile type | Endpoint / URL | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GeoServer | Self-hosted / any | WMS, WMTS, WFS, WCS | `free` open source; paid support optional | `base`, `overlay` | `wmts`, future `wms` | Your own service URL | [GeoServer overview](https://docs.geoserver.org/main/en/user/introduction/overview/), [GeoServer WMS basics](https://docs.geoserver.org/latest/en/user/services/wms/basics/) |
| MapProxy | Self-hosted / any | WMS/WMTS/TMS sources and cached outputs | `free` open source | `base`, `overlay` | `wmts`, future `wms` | Your own service URL | [MapProxy](https://mapproxy.org/) |
| MapServer / MapCache | Self-hosted / any | WMS and tile cache services | `free` open source | `base`, `overlay` | `wmts`, future `wms` | Your own service URL | [MapServer WMS server](https://mapserver.org/ogc/wms_server.html), [MapCache sources](https://mapserver.org/mapcache/sources.html) |

## Providers Not Prioritized Here

| Provider | Country / area | Current YAML usage type | Current LGS type | Current tile type | Reason |
| --- | --- | --- | --- | --- | --- |
| OpenStreetMap standard tiles | Global | `free` | `base` | `slippy` | Useful XYZ/slippy provider, already supported, but not a WMS/WMTS/terrain provider in the official public tile service. |
| OpenTopoMap | Global | `free` | `base` | `slippy` | Useful XYZ/slippy provider, already supported, but not an OGC WMS/WMTS service for the current use case. |
| Waymarked Trails | Global | `free` | `overlay` | `slippy` | Useful XYZ/slippy overlay, already supported, but not WMS/WMTS. |
| OpenSnowMap | Global / snow regions | `free` | `overlay` | `slippy` | Useful XYZ/slippy overlay, already supported, but not WMS/WMTS. |
| Thunderforest | Global | `freemium` | `base` | `thunderforest` | Useful XYZ-style commercial tile provider, already supported, but not WMS/WMTS. |
| Google Maps / Google Terrain / Bing / HERE direct APIs | Global | n/a | n/a | n/a | Usually tile APIs, not open OGC WMS/WMTS endpoints; licensing and API terms need separate handling. |

## Implementation Notes for LGS1920

To add WMS support:

1. Add a `WMS` tile constant, for example `export const WMS = 'wms'`.
2. Import Cesium `WebMapServiceImageryProvider`.
3. Add a `tile: wms` branch in `MapLayer.jsx`.
4. Extend YAML schema with at least:

```yaml
tile: wms
url: 'https://provider.example/wms?'
layers: layer_name
parameters:
  transparent: true
  format: image/png
minimumLevel: 0
maximumLevel: 18
```

5. Decide how to store WMS versions, CRS/SRS, styles, transparency, and time dimensions.
6. Keep `minimumLevel` and `maximumLevel` for every imagery layer where practical.

For WMTS providers, add fields only when needed by the provider:

```yaml
tile: wmts
url: 'https://provider.example/wmts'
layer: layer_name
style: default
format: image/png
tileMatrixSetID: EPSG:3857
minimumLevel: 0
maximumLevel: 18
```

Some WMTS providers will also require extra Cesium options that are not currently exposed in YAML, such as:

- `tileMatrixLabels`
- `tilingScheme`
- explicit rectangle / bounds
- dimensions such as date or time
- token headers or non-query authentication

## Discovery Sources

For broader discovery beyond this curated list:

- [GeoSeer](https://www.geoseer.net/) searches public WMS, WFS, WCS, and WMTS services.
- Provider GetCapabilities documents remain the source of truth for layer ids, formats, styles, CRS, matrix sets, and zoom limits.
