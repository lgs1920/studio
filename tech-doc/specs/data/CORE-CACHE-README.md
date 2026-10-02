# Local Cartographic Cache

Status: current implementation

## Scope and settings

Studio keeps map tile, terrain, and direct 3D Tiles responses in a dedicated local
CacheStorage cache. Journeys, GPX files, POI data, statistics, rendered videos,
provider APIs, and Google tile endpoints are outside this cache. The PWA shell
retains its separate version-aware application cache.

**Settings > Global Settings > Cartographic cache** exposes:

- a maximum payload budget of 256 MiB, 512 MiB (default), 1 GiB, or 2 GiB;
- current cached payload usage;
- the effective budget when browser storage pressure reduces the configured cap;
- an acknowledged purge of cartographic responses only.

The preference is `app.tileCacheMaxBytes` in `public/settings.yaml`. The existing
Valtio settings owner persists it in IndexedDB and preserves it during hydration.
Changing the budget does not prefetch resources. Reducing it triggers eviction.

## Storage and routing

`public/service-worker-pwa.js` delegates cartographic requests to
`public/cartographic-cache.js`. The response cache is `lgs-cartographic-tiles-v1`;
small accounting records and credential-free configuration live in
`lgs-cartographic-metadata-v1`.

The application supplies source rules built from its configured provider catalog.
Rules restrict persistence to imagery tile operations, terrain resources, and
3D content under configured source roots. WMS and WMTS capability and feature
queries are excluded. WMS routing supports the existing allowlisted PHP proxy.
A catalog layer can opt out with `cache: false`.

Ion content requests are scoped by their authenticated request identity. Only
SHA-256 resource keys are persisted: original request URLs and authorization
headers are not written to the response or accounting cache. The cache does not
forward credentials to other providers. Responses themselves remain readable by
scripts executing in the Studio origin; this is not encrypted storage.

The old `cesium-ion-assets` caches are discarded on first initialization because
they lack trustworthy size and freshness metadata.

## Freshness and limits

A response is persisted only when its visible HTTP headers establish a positive
freshness lifetime through `max-age` or `Expires`. `Age` and `Date` reduce the
remaining lifetime. `no-store`, `no-cache`, opaque responses, wildcard `Vary`,
range requests, partial responses, and resources larger than the effective
budget are excluded. Cross-origin responses without readable freshness headers
retain the browser's HTTP caching behavior.

Fresh entries are reused locally. Expired entries still present at access time
are revalidated with `ETag` or `Last-Modified`; a 304 updates their freshness.
If conditional headers cause a CORS failure, Studio retries the original request.
Maintenance removes expired entries. Provider permissions and attribution remain
applicable; this cache does not authorize offline use or bulk downloading.

The budget measures response payload bytes, rather than all browser disk overhead.
Per-resource metadata makes routine usage reporting independent of rereading
binary contents. Eviction protects soft reserves of 20% for imagery and 10% for
terrain against growing 3D content. 3D resources use the remaining capacity and
can borrow unused reserves. The hard overall cap takes precedence when individual
resources cannot fit alongside the reserves. LRU ordering applies within the
eligible categories.

`navigator.storage.estimate()` is consulted with bounded frequency. The effective
cap leaves origin storage for IndexedDB and concurrent writes. A quota failure
reduces retention and preserves the downloaded network response. CacheStorage
or hashing failures also preserve network loading.

## Lifecycle and validation

`CartographicCacheController` synchronizes the hydrated preference and resends it
after service worker controller changes. `CacheManager` uses acknowledged
MessageChannel commands with an eight-second timeout and closes both ports on
completion or failure. No cache operation requires backend storage.

Cache mutations are serialized. Concurrent identical requests share a download;
returned responses can be consumed independently. A purge invalidates pending
download writes. Ion credential changes await an Ion-only purge, preserving
unrelated cartographic resources and the PWA shell.

Regression tests cover source classification, freshness, byte accounting, worker
restart recovery, budget reduction, LRU, storage pressure, failure fallback,
request coalescing, credential isolation, purge races, message acknowledgements,
settings hydration, native Web Awesome controls, and refresh cleanup.
