# Copernicus Data Space Sentinel-2 WMTS Integration

Status: proposed for validation

Target release: `1.1.0`

## 1. Context and objective

Add Sentinel-2 imagery from the Copernicus Data Space Ecosystem as a configurable LGS1920 Studio WMTS layer. The integration must use the temporal filtering capability defined in [Layer Time Filtering And User-Defined Time Windows](CORE-LAYER-TIME-FILTER-SPEC.md), including winter intervals and other user-selected periods.

The first user-facing temporal workflow is a scene selector. Its menu exposes a maximum cloud-coverage threshold and a date selector. Studio searches the last rolling month for Sentinel-2 acquisitions covering the current map area, displays only dates that satisfy the selected threshold, and applies the selected date to the active Sentinel-2 base layer. Catalog discovery and WMTS rendering are separate requests and must not be conflated.

The Copernicus service is not a single public anonymous WMTS endpoint. Sentinel Hub OGC services require a user-configured instance, and the current CDSE documentation specifies OAuth2 client credentials and short-lived bearer tokens. The integration therefore needs a clear authentication boundary before it can be shipped as a default catalogue entry.

## 2. Official service facts

The implementation must be validated against the Copernicus documentation and the instance's `GetCapabilities` response:

- WMTS base URL: `https://sh.dataspace.copernicus.eu/ogc/wmts/<INSTANCE_ID>`
- WMTS requires a user-preconfigured Sentinel Hub configuration instance.
- The service supports WMTS 1.0.0 and KVP `GetTile` requests.
- `TIME` is an ISO 8601 interval with two values separated by `/`.
- A missing `TIME` returns the last valid image by default.
- Reduced-accuracy dates are accepted by the service, but Studio should emit explicit UTC timestamps for deterministic persistence.
- OAuth2 token endpoint: `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
- OAuth access tokens are short-lived and must be reused until expiry rather than requested for every tile.
- Catalog search endpoint: `https://sh.dataspace.copernicus.eu/catalog/v1/search`
- Sentinel-2 L2A Catalog collection: `sentinel-2-l2a`
- Sentinel-2 L2A cloud property: `eo:cloud_cover`, expressed as a product/tile-average percentage rather than a viewport-accurate cloud percentage.
- Catalog search supports a temporal `datetime` interval, a WGS84 `bbox` or GeoJSON `intersects`, CQL2 filtering, and pagination through the response context.
- OGC requests support `MAXCC` from 0 to 100 as the maximum allowable cloud coverage and `PRIORITY=leastCC` for selecting the least-cloudy valid tile where several tiles overlap.

References:

- [Copernicus WMTS documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMTS.html)
- [Copernicus authentication documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html)
- [Copernicus OGC overview](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC.html)
- [Sentinel-2 L2A data documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)
- [Copernicus Catalog API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Catalog.html)
- [Catalog API examples](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Catalog/Examples.html)
- [Copernicus additional OGC request parameters](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/AdditionalRequestParameters.html)

## 3. Recommended product shape

Register one provider, `copernicus`, with one or more layer definitions created from a validated Sentinel Hub configuration instance. Do not hard-code a real instance id or OAuth credential in the repository.

Recommended first layer:

```yaml
- id: copernicus-sentinel2-true-color
  name: Sentinel-2 true color
  type: base
  image: copernicus-sentinel2.png
  tile: wmts
  url: 'https://sh.dataspace.copernicus.eu/ogc/wmts/{INSTANCE_ID}'
  layer: TRUE_COLOR
  style: default
  format: image/jpeg
  tileMatrixSetID: EPSG:3857
  minimumLevel: 0
  maximumLevel: 18
  timeFilter: true
  timeParameter: TIME
  sceneSelector:
    enabled: true
    collection: sentinel-2-l2a
    lookback: P1M
    geometry: viewport
    cloudProperty: eo:cloud_cover
    cloudParameter: MAXCC
    priorityParameter: PRIORITY
    priority: leastCC
    dateGranularity: day
  usage:
    type: account
    signin: 'https://shapps.dataspace.copernicus.eu/dashboard/'
    doc: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMTS.html'
```

The exact `layer`, `style`, `format`, matrix set, and zoom limits must come from the selected instance's GetCapabilities document. `TRUE_COLOR` is a configuration-layer name, not a universal CDSE constant, and must not be shipped without confirmation. The `sceneSelector` block is a proposed schema and is not enabled until the Catalog and WMTS behavior has been validated for the selected instance.

## 4. Scene discovery and cloud-coverage selector

WMTS can render a selected time interval, but it does not provide the list of available acquisition dates. Studio must therefore use two distinct phases:

1. **Discovery:** query the authenticated Catalog API for Sentinel-2 L2A items in the last rolling month and keep items whose `eo:cloud_cover` is below the user-selected threshold.
2. **Rendering:** convert the selected calendar date into a one-day UTC `TIME` interval and rebuild the active WMTS imagery provider.

### 4.1 User experience

Add a `Sentinel-2 dates` action to the options menu of the active, accessible Sentinel-2 base layer. The menu contains:

- a maximum cloud-coverage input in percent, from 0 to 100
- a date select populated from the Catalog results
- the acquisition cloud percentage next to each date when available
- an apply action that remains disabled until a date is selected

The cloud-coverage input is a maximum threshold: a value of `20` means that dates with an estimated cloud coverage greater than 20% are excluded. The initial default must be validated as a product decision; the technical fallback is the service default of 100%.

Changing the threshold starts a new discovery request and replaces the date options. The selected date is cleared if it is no longer present in the result. Dates are sorted from newest to oldest. The list must represent the current map area, not just dates available somewhere in the world.

### 4.2 Catalog search

The default search period is a rolling calendar-month interval evaluated in UTC:

```text
end   = min(now, requestedEnd)
start = end minus one calendar month
```

For the initial implementation, `now` is the current UTC instant and `requestedEnd` is not user-editable. The query geometry is the current Cesium camera rectangle converted to a WGS84 `bbox`. If the camera rectangle cannot be resolved, use the journey or explicitly selected area of interest; do not issue a global search.

The preferred request is a POST to the Catalog API:

```json
{
  "collections": ["sentinel-2-l2a"],
  "datetime": "2026-07-04T00:00:00Z/2026-08-04T23:59:59Z",
  "bbox": [2.20, 48.80, 2.45, 48.95],
  "filter": "eo:cloud_cover <= 20",
  "filter-lang": "cql2-text",
  "limit": 100
}
```

The dates and coordinates in this example are illustrative. The implementation must generate them from the clock and current map area. The bearer token is sent in the `Authorization` header and never in the URL or persisted scene state.

The response processing must:

1. Follow the Catalog `context.next` pagination value until all relevant results have been read, subject to a bounded result limit.
2. Read `properties.datetime` and `properties.eo:cloud_cover` from every item.
3. Discard invalid timestamps and cloud values, even when the service accepted the query.
4. Normalize the timestamp to its UTC calendar date (`YYYY-MM-DD`).
5. Group items by date and retain the lowest cloud value and the item timestamp for diagnostics.
6. Sort the resulting dates descending before exposing them to the select control.

The Catalog `distinct: date` extension may reduce the response size, but it must only be used after confirming that the selected CDSE deployment returns the required cloud metadata with the filtered result. Grouping ordinary item results client-side is the safe baseline because one date may contain several tiles or acquisitions.

Cloud coverage is a product/tile estimate. It is not a pixel-accurate percentage for the current viewport, so the UI must label it as an estimated scene cloud coverage and must not promise that every displayed pixel is below the threshold.

### 4.3 Applying the selected date to WMTS

Selecting `2026-07-24` does not send a single timestamp. It creates the smallest explicit UTC interval for that calendar date:

```text
TIME=2026-07-24T00:00:00Z/2026-07-24T23:59:59.999Z
MAXCC=20
PRIORITY=leastCC
```

The renderer must attach `TIME` as the configured WMTS dimension and pass `MAXCC` and `PRIORITY` as supported OGC request parameters. The request must preserve the configured `LAYER`, `STYLE`, `FORMAT`, `TILEMATRIXSET`, tile coordinates, `SERVICE=WMTS`, `VERSION=1.0.0`, and `REQUEST=GetTile` values.

The selected Catalog item is metadata for the date chooser; it is not a direct tile URL. WMTS remains the sole rendering path. When several valid tiles overlap, `PRIORITY=leastCC` gives the service a deterministic least-cloudy preference. A date with no valid tile must not silently fall back to another date.

When no scene matches the area, month, and threshold, the UI displays an empty state with actions to increase the cloud threshold or widen the time range. The base layer is not replaced until a valid date is selected. A change of camera area invalidates the old date list and triggers a new search after a short debounce.

### 4.4 Persisted state and request lifecycle

The selected date becomes the active one-day time window described by the generic temporal filtering specification. Copernicus-specific scene-selection state is stored separately from Catalog results:

```javascript
{
  maxCloudCoverage: 20,
  selectedDate: '2026-07-24',
  searchRange: {
    start: '2026-07-04T00:00:00.000Z',
    end: '2026-08-04T23:59:59.999Z'
  },
  geometryHash: 'stable-hash-of-the-search-area'
}
```

Catalog items and date options are ephemeral and must be refreshed after reload or when the geometry changes. Persist the selected date and threshold only if the existing settings migration can safely associate them with the source layer id. On reload, recompute the rolling month, query the current geometry, and clear the saved date if it is no longer valid.

Discovery requests must be cancellable or protected by a request generation id so a slow response for an older threshold or map area cannot overwrite newer date options. Token expiry uses the shared token manager for both Catalog and WMTS. A 401 during discovery or tile loading invalidates the cached token and allows one bounded retry.

## 5. Provider registration

Add a provider entry in `public/layers-terrains.yaml`:

```yaml
- id: copernicus
  name: Copernicus Data Space
  fullname: Copernicus Data Space Ecosystem
  credits: Copernicus Data Space Ecosystem and Sentinel-2 mission
  url: 'https://dataspace.copernicus.eu/'
  layers:
    - ...
```

The provider logo and Sentinel-2 thumbnail are optional for the first technical slice, but the final catalogue should include compliant public assets and attribution. The provider must use `usage.type: account` unless a separately approved public access arrangement exists.

## 6. Authentication and secret boundary

The existing layer token flow persists a provider token in the browser vault and injects it into a configured URL. That is not appropriate for a CDSE OAuth client secret. The current Studio vault is local and unencrypted in backups and linked-folder exports, so it must not contain the CDSE `client_secret` for the server integration.

### 6.1 Recommended production design: backend proxy

Use the separately deployed Bun/Elysia backend as the CDSE trust boundary:

1. Store the CDSE OAuth client id, client secret, instance id, and fixed upstream URLs in the backend deployment environment or an external server secret manager.
2. Expose a backend scene-search endpoint that accepts only a validated geometry, rolling-month range, and cloud threshold. The backend obtains a CDSE bearer token and calls the Catalog API.
3. Expose a backend WMTS tile proxy or a server-side tile request path. The backend adds the bearer token and forwards only the validated WMTS parameters to the fixed CDSE host and configured instance.
4. Return normalized scene dates and cloud metadata to Studio. Do not return the CDSE client secret or the server bearer token.
5. Reuse the existing Studio-to-backend authentication/session boundary when available. If the endpoint is public, add strict rate limiting, quota protection, and an allow-list of upstream parameters; CORS and an Origin check are not authentication by themselves.

The browser then calls the application backend, not the CDSE Catalog and WMTS endpoints directly:

```text
Studio -> POST /api/copernicus/scenes -> backend -> CDSE Catalog API
Studio -> GET  /api/copernicus/tiles/... -> backend -> CDSE WMTS
```

This design keeps both the client secret and the short-lived CDSE bearer token on the server. It also makes token rotation, rate limiting, audit logging, and provider error redaction enforceable in one place. The tile proxy must reject arbitrary upstream URLs to prevent SSRF and must construct the upstream URL from a fixed host, instance id, and allow-listed WMTS parameters.

### 6.2 Server environment requirements

The exact deployment mechanism may be a hosting-provider secret store, GitHub environment secrets consumed during deployment, or a protected server-level environment file outside the release directory. The values must never be committed, copied into `public/`, or prefixed with `VITE_` because Vite variables are exposed to browser bundles.

The backend configuration should use names equivalent to:

```text
CDSE_OAUTH_CLIENT_ID
CDSE_OAUTH_CLIENT_SECRET
CDSE_OAUTH_TOKEN_URL
CDSE_SH_BASE_URL
CDSE_SH_INSTANCE_ID
```

The deployment must fail closed when a required value is missing. Startup diagnostics may report that a setting is present, but must never print its value. Secret rotation consists of updating the deployment secret and restarting or reloading the backend workers. The OAuth bearer token is cached in backend memory only, with an expiry safety margin, and is never written to IndexedDB, logs, backups, URLs, or persistent application data.

In Bun code, access server-only values through `Bun.env` or the existing backend configuration layer. Do not import server configuration into React code and do not add these values to `import.meta.env`.

### 6.3 Transitional alternative: backend token broker

If implementing a tile proxy is too large for the first slice, a backend endpoint may return a short-lived CDSE bearer token to an authenticated Studio session. The client secret remains server-side, but the bearer token is then visible to the browser and can be reused by anyone who obtains it until expiry. This is acceptable only as a temporary, explicitly approved compromise with short TTLs, rate limits, CSP, and no token persistence. The production target remains the backend proxy.

A pure browser SPA OAuth flow is not the recommended default. CDSE supports SPA OAuth clients, but exposing a bearer token in the browser leaves provider access and quota control to the client. A manual token pasted by the user is also unsuitable as the long-term workflow because it expires and can be copied into backups or logs.

All designs must:

- retry a 401 once after invalidating the cached server token;
- avoid retries for 403, quota, and invalid-configuration responses;
- redact `Authorization`, `client_secret`, access tokens, and sensitive upstream URLs from logs and errors;
- keep OAuth credentials out of `public/layers-terrains.yaml`, supplementary layer records, exports, issue bodies, and client diagnostics.

### 6.4 Application-wide deployment

The backend proxy can serve all LGS1920 users through one application gateway. This is technically feasible, but it is not an unlimited public Copernicus gateway. With a single CDSE account, all users consume the same account quota, rate limit, concurrent-request limit, and processing budget. The backend must therefore identify the application user, apply per-user rate limits, and expose usage metrics before the feature is enabled for everyone.

The selected account model is one dedicated, non-personal CDSE service account for the whole LGS1920 application. Studio users do not create individual CDSE credentials. LGS1920 owns the shared quota and must obtain approval for the intended usage and user volume.

This shared-account deployment must run behind the authenticated LGS1920 backend with these controls:

1. Require the existing application session or an explicit product entitlement before allowing scene searches and tile proxying.
2. Validate the incoming `bbox`, date interval, collection, layer, `MAXCC`, `PRIORITY`, and tile coordinates against fixed server-side limits.
3. Cache identical Catalog searches briefly and coalesce concurrent token and tile requests where practical.
4. Apply per-user and global rate limits, return a clear quota error, and never retry a request storm automatically.
5. Keep Copernicus attribution visible in the Studio layer information and document that the imagery is delivered through a shared application service.

Do not deploy an unauthenticated open proxy. Copernicus documents account-level quotas and explicitly states that public-facing integrations require the integrator to implement its own authentication service. Review the current [CDSE quotas and limitations](https://documentation.dataspace.copernicus.eu/Quotas.html) before enabling the shared account.

### 6.5 Shared server-side tile cache

A shared backend tile cache is recommended for the single-account deployment. The browser service-worker cache can avoid repeated downloads for one user, but only the backend cache can reuse a tile between users and backend workers.

The cache key must include every value that can change the returned image:

```text
copernicus-wmts:v1:
  instanceId:layer:style:format:tileMatrixSet:
  tileMatrix:tileRow:tileColumn:
  time:maxcc:priority:evalscriptHash
```

The key must be built from normalized, allow-listed values. Never include the bearer token or `Authorization` header in the key. A cache hit is valid only for the exact same instance, configured layer, date interval, cloud threshold, priority, output format, matrix set, and tile coordinates.

Cache only successful image responses with an approved content type. Do not cache 401, 403, quota, configuration, CORS, or upstream error responses. Use a per-key request lock or promise coalescing so concurrent users requesting a cold tile produce one upstream request rather than a request burst.

The initial freshness policy should be conservative:

- Catalog date searches: short TTL, because new acquisitions can appear during the rolling month.
- Historical Sentinel-2 tiles for an exact selected date: longer TTL, because the request is deterministic and the same date/parameters must return the same visual result.
- The current day or the end of the rolling window: shorter TTL than historical dates.

The exact TTLs must be measured against CDSE reprocessing behavior and storage capacity. Invalidation must occur when the instance configuration, layer, evalscript, or cache-key version changes. A stale tile may be served only for the same exact key and only under an explicitly approved `stale-if-error` policy; it must never be used as a fallback for another date or cloud threshold.

An in-memory cache alone is insufficient when PM2 or multiple backend workers are used because each worker has a different cache. Use a shared disk cache, Redis, an object store, or an HTTP cache/CDN with a bounded size and eviction policy. The cache must expose hit/miss counts, upstream request counts, bytes stored, evictions, and quota errors so the shared CDSE account can be monitored.

## 7. WMTS and time integration

The layer is rendered by the existing `WebMapTileServiceImageryProvider` path. For a selected window, pass:

```javascript
dimensions: {
  TIME: '2025-12-01T00:00:00Z/2026-02-28T23:59:59Z'
}
```

The generic time-filter feature owns interval formatting. The Copernicus layer only declares `timeParameter: TIME`. Winter support therefore does not require a special season code or month exception. A winter range that crosses a year boundary is a normal interval and must be sent unchanged.

The provider must be rebuilt when either the resolved time window, cloud threshold, mosaicking priority, or bearer token changes. The tile URL must retain `SERVICE=WMTS`, `VERSION=1.0.0`, `REQUEST=GetTile`, layer, style, format, matrix set, row, column, the `TIME` query value generated by Cesium, and the approved `MAXCC` and `PRIORITY` parameters.

## 8. Capability discovery and configuration validation

Before enabling a configured layer, the implementation or release checklist must validate its GetCapabilities response:

- supported matrix set and CRS
- layer identifier
- style identifier
- output format
- tile matrix labels and zoom range
- KVP URL behavior
- whether `TIME` is accepted for `GetTile`
- whether the configured instance contains the intended Sentinel-2 collection and evalscript

GetCapabilities should not be fetched for every application startup. It may be a developer validation tool or an optional cached diagnostic. The runtime catalogue remains declarative for predictable startup and offline behavior.

## 9. Error and quota behavior

The UI must distinguish:

- missing or expired credentials
- invalid instance or layer configuration
- forbidden or unauthorized requests
- no usable scene in the selected time window
- provider rate or quota limits
- network and CORS failures

A no-scene result must not silently fall back to a different date. The user should be offered a wider interval. A winter request must be tested in a region and interval where Sentinel-2 coverage is known, while acknowledging cloud masking and acquisition gaps.

Provider errors must avoid logging bearer tokens, client secrets, full authorization headers, or URLs containing sensitive query data.

## 10. Persistence and security

- The provider and layer definition are public catalogue data.
- The instance id is non-secret configuration data, but the production instance id should be read from the backend configuration when the proxy design is used.
- The CDSE client id and client secret belong only in the backend deployment secret store or protected server environment. They must not be stored in the browser vault.
- Server-side bearer tokens are short-lived runtime cache entries and are never persisted.
- User time windows and supplementary layers are persisted by the generic temporal layer settings model.
- Backups and linked-folder synchronization must contain no CDSE credentials or bearer tokens. The current database architecture documents vault values as unencrypted, so the UI must not offer to export server-side credentials.
- Supplementary layers reference `sourceLayerId` and `timeWindowId`; they never duplicate Copernicus secrets.

## 11. Implementation plan

1. Validate a CDSE Sentinel Hub instance and record its GetCapabilities facts in a test fixture.
2. Implement the generic temporal layer model and WMTS dimensions from the companion specification.
3. Validate the backend proxy as the production boundary and explicitly approve the token-broker fallback only if needed for the first slice.
4. Implement the backend secret configuration and server-side token lifecycle for the selected approach.
5. Implement authenticated backend Catalog discovery for the current map area, rolling-month interval, cloud threshold, pagination, date grouping, and stale-request protection.
6. Implement the validated WMTS tile proxy, or explicitly approve the transitional token-broker alternative.
7. Provision one dedicated CDSE service account and add application authentication, per-user rate limits, global quota protection, and usage metrics.
8. Add the shared server-side Catalog and tile cache with bounded storage, request coalescing, and cache metrics.
9. Add the provider and the first Sentinel-2 layer to the catalogue with confirmed capabilities.
10. Attach the authorization mechanism and `TIME`, `MAXCC`, and `PRIORITY` parameters to the selected WMTS path.
11. Test ordinary dates, a cross-year winter range, a short range, token expiry, unauthorized access, secret redaction, rate limits, cache hits, cache misses, invalidation, and shared-quota exhaustion.
12. Add attribution, logo, thumbnail, release notes, and documentation after service validation.

## 12. Test plan

### Unit tests

- construct the CDSE WMTS URL from an instance id without duplicate slashes
- format `TIME` intervals including December-to-February ranges
- format one-day UTC intervals from a selected Catalog date
- build a rolling-month Catalog query with WGS84 geometry and a cloud threshold
- group Catalog items by UTC date and retain the lowest cloud value
- reject invalid Catalog timestamps and cloud values
- ignore stale discovery responses after a threshold or geometry change
- refresh an expired bearer token once and reuse a valid token
- fail closed when required server configuration is missing
- redact secrets and bearer tokens from diagnostics

### Integration tests

- configure a fixture instance and assert WMTS request parameters
- assert `TIME` is present for a saved interval and absent for provider-default mode
- assert `MAXCC` and `PRIORITY=leastCC` are sent only for the Copernicus scene-selection path
- assert the Authorization header is attached without leaking it into the URL
- assert token refresh recreates the provider and preserves the selected interval
- assert the backend rejects arbitrary upstream hosts and unapproved WMTS parameters
- assert unauthenticated users cannot consume the application proxy
- assert per-user and global rate limits are enforced without leaking provider credentials
- assert cache keys differ when date, cloud threshold, priority, layer, or tile coordinates differ
- assert cache hits do not call CDSE and cache misses coalesce concurrent upstream requests
- assert error responses and authorization headers are never cached

### Catalog discovery tests

- return only dates whose `eo:cloud_cover` is at or below the selected threshold
- follow `context.next` pagination and deduplicate dates
- clear a previously selected date when it is absent from a refreshed result
- show an empty state without replacing the current base layer when no scene is available
- refresh the result when the map geometry changes

### Service smoke test

- request GetCapabilities from the approved instance
- request a known summer interval
- request a known winter interval crossing a calendar year
- verify the returned image is non-empty and the response status is successful

The smoke test must use CI secrets or a manually triggered protected environment. No live credentials may be committed or embedded in ordinary pull-request tests.

## 13. Open decisions for validation

- Which approved Sentinel Hub instance and configured layer should be the release fixture?
- Is a browser-managed OAuth client acceptable, or is a backend token broker required?
- Is the backend tile proxy required for the first release, or is the transitional short-lived token broker explicitly accepted?
- Which deployment secret store supplies the `CDSE_*` backend environment values for production, staging, and test?
- What user entitlement and quota policy applies before the shared gateway is exposed to all users?
- Should the initial provider expose only true color, or also false color and NDVI layers?
- Should the initial search geometry follow the camera rectangle, the journey bounds, or an explicitly drawn area of interest?
- What default maximum cloud-coverage value should the scene selector use?
- Should the scene selector persist only the selected date and threshold, or also create a named reusable time window?
- What exact attribution, logo, and thumbnail assets are approved for distribution?

## 14. Proposed GitHub feature issue

This is a proposed issue body pending user validation. It must not be opened until the authentication approach, service instance, solution, implementation plan, and project fields are confirmed.

### Title

`[Feature] Add Copernicus Data Space Sentinel-2 WMTS imagery`

<!-- issue-type: feature -->

## Context

Studio has no Copernicus Data Space provider. Users cannot access Sentinel-2 imagery through the layer catalogue or choose a temporal interval for the imagery.

## Requested behavior

Register Copernicus Data Space as a provider and add a validated Sentinel-2 WMTS layer that uses the persistent temporal filtering feature. The active-layer menu must search Catalog scenes over the last rolling month, filter dates by the selected cloud-coverage threshold, and apply the selected date to the Sentinel-2 base layer. The layer must retrieve imagery for arbitrary supported periods, including winter intervals crossing calendar years, and authenticate requests according to the approved CDSE OAuth strategy.

## Acceptance criteria

- A `copernicus` provider and at least one validated Sentinel-2 WMTS layer are registered.
- The CDSE client secret is stored only in the backend deployment secret store and is never exposed to the browser bundle, browser vault, backups, logs, or URLs.
- Catalog and WMTS requests use the approved backend proxy boundary, or the explicitly approved transitional token-broker design.
- The layer uses the exact instance, layer, style, format, matrix set, and zoom values confirmed by GetCapabilities.
- A saved temporal window is sent as a WMTS `TIME` ISO 8601 interval.
- The Sentinel-2 menu queries the authenticated Catalog API for the current map area and last rolling month.
- The date selector contains only dates whose `eo:cloud_cover` is within the selected threshold, with duplicate dates removed.
- Selecting a date sends a one-day UTC `TIME` interval together with `MAXCC` and the approved mosaicking priority.
- A winter interval spanning two calendar years produces valid WMTS requests without special-case logic.
- Authentication handles the selected CDSE credential flow, server-side token expiry, unauthorized responses, secret redaction, rate limits, and bounded retry behavior.
- Credentials and bearer tokens are not committed, copied into supplementary layers, exported accidentally, or written to logs.
- Provider attribution and user-facing authentication/error guidance are present.
- Tests cover Catalog discovery, request construction, time windows, token lifecycle, redaction, and protected service smoke validation.

## Notes or questions

Target release: `1.1.0`. The approved Sentinel Hub instance and authentication approach are prerequisites. The final issue must use the shared Project fields, including `Target release`, `Status`, priority, labels, repository, and assignee, without inventing missing values.

## Technical notes

Primary implementation areas are `public/layers-terrains.yaml`, `src/components/cesium/MapLayer.jsx`, the layer manager, the temporal filtering components, and the separately deployed Bun/Elysia backend's Copernicus routes and deployment configuration. Official references are linked in the specification above.
