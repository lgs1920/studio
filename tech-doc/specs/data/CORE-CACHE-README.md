# Local Tile Cache

Status: current implementation

## Scope and provider rules

Studio stores eligible map resources in browser Cache Storage under a dedicated
tile cache. The version-aware PWA application-asset cache remains separate and
is not included in tile-cache usage.

The service worker only considers safe `GET` requests registered from the
provider catalog. Supported resource kinds are raster imagery, terrain and
elevation data, explicitly configured vector tiles (`.pbf` and `.mvt`), and 3D
Tiles resources, including tileset JSON, nested content, subtrees, and declared
additional resource hosts. WMS is limited to configured `GetMap` operations;
WMTS is limited to configured `GetTile` operations. A layer can opt out with
`cache: false`. A 3D provider can declare additional nested resource roots with
`cacheHosts` on the provider, layer, or `tiles3d` configuration.

The cache does not discover or persist arbitrary third-party requests. It only
stores responses with an explicit positive freshness lifetime from `max-age` or
`Expires`. Provider terms and response directives continue to apply. A provider
can opt out through its catalog entry, and a response with `no-store` or
`no-cache` is never stored. `private` responses are stored only when the request
has an explicit credential that can be hashed into an isolated partition.
Requests carrying browser-managed credentials, same-origin cookie requests,
and `Vary: Cookie` responses bypass persistence because Studio cannot reliably
identify that account context. WMS is limited to configured `GetMap` operations;
same-origin proxy requests with implicit browser credentials bypass persistence.

Google Maps content is excluded before cache-key lookup and storage. This covers
Google Maps tile hostnames and Google layers identified in the provider catalog,
including Google Photorealistic 3D Tiles and Google 2D Ion assets. Google Map
Tiles API terms prohibit storage except under limited agreement-specific
conditions, so Studio does not cache those endpoints.

## Local storage, privacy, and freshness

Tile responses and their accounting index stay on the current device, in the
current browser profile. Studio does not upload cache data or usage statistics
and does not request persistent browser storage. Cached responses normally
survive reloads and browser restarts until Studio or the user deletes them, or
the browser evicts site data. Browser quota and eviction rules remain in force.

Cache keys are SHA-256 digests of the complete request identity, including the
URL, visible request headers, and credential partition. This preserves query
parameters that distinguish resources without storing raw URLs or access
tokens. Account partitions are derived with SHA-256 from explicit authorization
or recognized credential query values. The local index records the opaque
partition, provider, resource kind, payload size, freshness metadata, and last
access time. Responses with no reliable account identity are not stored when
they are marked `private`.

Fresh responses are returned from Cache Storage. Expired entries are never
served stale: Studio revalidates with `ETag` or `Last-Modified` when available
and otherwise requests the resource again. `Vary: *`, cookie variation,
variation fields unavailable on the service-worker request, range requests,
partial responses, failed responses, opaque responses, and oversized
individual tiles are not stored. Successful network responses are
returned to Cesium without waiting for background cache writes.

The default tile-cache budget is 512 MiB. Settings offers 256 MiB, 512 MiB,
1 GiB, and 2 GiB choices. The byte-based limit applies across imagery, terrain,
vector and 3D resources and all account partitions. The local index tracks
usage incrementally; routine usage reporting does not reread cached tile
bodies. When space is needed, expired entries are removed first, then least
recently used entries are evicted by bytes. Browser storage estimates can lower
the effective limit to leave room for other Studio data, but are only a safety
signal and are not an exact measurement of this cache.

Changing or removing the Cesium Ion token clears Ion tile entries before the
credential changes. Changing or removing a personal provider key clears all
private account partitions while retaining public tiles. A failed
service-worker acknowledgement prevents Studio from changing the credential.
Cache operations handle quota and storage errors without blocking Cesium's
network response.

## Controls and deletion

**Settings > Global Settings > Cartographic cache** displays tile-cache usage,
the configured budget, any lower effective limit, and a clear-cache action.
Static application-file usage is separate and is not shown as tile usage. The
panel explains that browser quotas and eviction can reduce retention and that
Studio cannot guarantee permanent storage.

The clear tile-cache action removes every tile response and matching index
record, then waits for a service-worker acknowledgement. Studio's delete-profile
action removes every account partition, the cache index, usage metadata, and
saved routing configuration before deleting the local application databases.
The service worker blocks new tile persistence during that deletion and remains
disabled for tile caching until a later Studio session sends fresh settings.
Static application files retain the existing delete-profile behavior.

Older `v1` cartographic caches are discarded because they do not have the
current privacy and account-partition metadata. The browser may still evict any
tile or application cache independently of Studio's controls.
