# Copernicus Data Space Sentinel-2 WMTS Integration

Status: proposed for validation

Target release: `1.1.0`

## 1. Context and objective

Add Sentinel-2 imagery from the Copernicus Data Space Ecosystem as a configurable LGS1920 Studio WMTS layer. The integration must use the temporal filtering capability defined in [Layer Time Filtering And User-Defined Time Windows](CORE-LAYER-TIME-FILTER-SPEC.md), including winter intervals and other user-selected periods.

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

References:

- [Copernicus WMTS documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMTS.html)
- [Copernicus authentication documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html)
- [Copernicus OGC overview](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC.html)
- [Sentinel-2 L2A data documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)

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
  usage:
    type: account
    signin: 'https://shapps.dataspace.copernicus.eu/dashboard/'
    doc: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMTS.html'
```

The exact `layer`, `style`, `format`, matrix set, and zoom limits must come from the selected instance's GetCapabilities document. `TRUE_COLOR` is a configuration-layer name, not a universal CDSE constant, and must not be shipped without confirmation.

## 4. Provider registration

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

## 5. Authentication analysis

The existing layer token flow persists a provider token in the vault and injects it into a configured URL. That is insufficient for the full CDSE OAuth client-credentials flow because a browser application needs a client id and client secret to obtain a short-lived bearer token, and the bearer token must be sent in an `Authorization` header rather than exposed as a static URL query value.

Recommended design:

1. Add a Copernicus credential record to the vault containing the user-provided client id and client secret, with explicit security warnings.
2. Add a `CopernicusTokenManager` that requests a bearer token only when absent or expired, caches the expiry, and coalesces concurrent requests.
3. Use a Cesium `Resource` or request transformer to attach `Authorization: Bearer <token>` to WMTS tile requests.
4. On 401, invalidate the cached bearer token, refresh once, and retry within a bounded policy. Do not retry indefinitely for 401, 403, or quota failures.
5. Keep OAuth credentials out of `public/layers-terrains.yaml`, supplementary layer records, logs, exports, and issue bodies.

An alternative first slice is to let a user paste a valid bearer token manually. That is simpler but does not meet the expected long-term behavior because the token expires and must be replaced manually. The choice must be validated before implementation.

Because CDSE documents SPA OAuth clients with configurable web origins, a browser flow may be possible, but the exact CORS and credential-handling behavior must be verified in a staging instance. A backend token broker is the safer production option if client secrets cannot be safely handled in the Studio browser.

## 6. WMTS and time integration

The layer is rendered by the existing `WebMapTileServiceImageryProvider` path. For a selected window, pass:

```javascript
dimensions: {
  TIME: '2025-12-01T00:00:00Z/2026-02-28T23:59:59Z'
}
```

The generic time-filter feature owns interval formatting. The Copernicus layer only declares `timeParameter: TIME`. Winter support therefore does not require a special season code or month exception. A winter range that crosses a year boundary is a normal interval and must be sent unchanged.

The provider must be rebuilt when either the resolved time window or the bearer token changes. The tile URL must retain `SERVICE=WMTS`, `VERSION=1.0.0`, `REQUEST=GetTile`, layer, style, format, matrix set, row, column, and the `TIME` query value generated by Cesium.

## 7. Capability discovery and configuration validation

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

## 8. Error and quota behavior

The UI must distinguish:

- missing or expired credentials
- invalid instance or layer configuration
- forbidden or unauthorized requests
- no usable scene in the selected time window
- provider rate or quota limits
- network and CORS failures

A no-scene result must not silently fall back to a different date. The user should be offered a wider interval. A winter request must be tested in a region and interval where Sentinel-2 coverage is known, while acknowledging cloud masking and acquisition gaps.

Provider errors must avoid logging bearer tokens, client secrets, full authorization headers, or URLs containing sensitive query data.

## 9. Persistence and security

- The provider and layer definition are public catalogue data.
- The instance id is configuration data and may be stored with the user credential record or layer settings, depending on the final credential UX.
- OAuth credentials belong only in the existing vault path or a future secure broker.
- User time windows and supplementary layers are persisted by the generic temporal layer settings model.
- Backups and linked-folder synchronization must either exclude secrets or apply the existing vault handling rules. The current database architecture documents vault values as unencrypted, so the UI must warn users before exporting credentials.
- Supplementary layers reference `sourceLayerId` and `timeWindowId`; they never duplicate Copernicus secrets.

## 10. Implementation plan

1. Validate a CDSE Sentinel Hub instance and record its GetCapabilities facts in a test fixture.
2. Implement the generic temporal layer model and WMTS dimensions from the companion specification.
3. Decide between manual bearer token, browser OAuth client credentials, and a backend broker.
4. Implement Copernicus credential storage and token lifecycle for the selected approach.
5. Add the provider and the first Sentinel-2 layer to the catalogue with confirmed capabilities.
6. Attach the authorization mechanism to Cesium WMTS requests.
7. Test ordinary dates, a cross-year winter range, a short range, token expiry, and unauthorized access.
8. Add attribution, logo, thumbnail, release notes, and documentation after service validation.

## 11. Test plan

### Unit tests

- construct the CDSE WMTS URL from an instance id without duplicate slashes
- format `TIME` intervals including December-to-February ranges
- refresh an expired bearer token once and reuse a valid token
- redact credentials from diagnostic objects

### Integration tests

- configure a fixture instance and assert WMTS request parameters
- assert `TIME` is present for a saved interval and absent for provider-default mode
- assert the Authorization header is attached without leaking it into the URL
- assert token refresh recreates the provider and preserves the selected interval

### Service smoke test

- request GetCapabilities from the approved instance
- request a known summer interval
- request a known winter interval crossing a calendar year
- verify the returned image is non-empty and the response status is successful

The smoke test must use CI secrets or a manually triggered protected environment. No live credentials may be committed or embedded in ordinary pull-request tests.

## 12. Open decisions for validation

- Which approved Sentinel Hub instance and configured layer should be the release fixture?
- Is a browser-managed OAuth client acceptable, or is a backend token broker required?
- Should Studio support one Copernicus account per profile or one global credential?
- Should the initial provider expose only true color, or also false color and NDVI layers?
- What exact attribution, logo, and thumbnail assets are approved for distribution?

## 13. Proposed GitHub feature issue

This is a proposed issue body pending user validation. It must not be opened until the authentication approach, service instance, solution, implementation plan, and project fields are confirmed.

### Title

`[Feature] Add Copernicus Data Space Sentinel-2 WMTS imagery`

<!-- issue-type: feature -->

## Context

Studio has no Copernicus Data Space provider. Users cannot access Sentinel-2 imagery through the layer catalogue or choose a temporal interval for the imagery.

## Requested behavior

Register Copernicus Data Space as a provider and add a validated Sentinel-2 WMTS layer that uses the persistent temporal filtering feature. The layer must retrieve imagery for arbitrary supported periods, including winter intervals crossing calendar years, and authenticate requests according to the approved CDSE OAuth strategy.

## Acceptance criteria

- A `copernicus` provider and at least one validated Sentinel-2 WMTS layer are registered.
- The layer uses the exact instance, layer, style, format, matrix set, and zoom values confirmed by GetCapabilities.
- A saved temporal window is sent as a WMTS `TIME` ISO 8601 interval.
- A winter interval spanning two calendar years produces valid WMTS requests without special-case logic.
- Authentication handles the selected CDSE credential flow, token expiry, unauthorized responses, and bounded retry behavior.
- Credentials and bearer tokens are not committed, copied into supplementary layers, exported accidentally, or written to logs.
- Provider attribution and user-facing authentication/error guidance are present.
- Tests cover request construction, time windows, token lifecycle, redaction, and protected service smoke validation.

## Notes or questions

Target release: `1.1.0`. The approved Sentinel Hub instance and authentication approach are prerequisites. The final issue must use the shared Project fields, including `Target release`, `Status`, priority, labels, repository, and assignee, without inventing missing values.

## Technical notes

Primary implementation areas are `public/layers-terrains.yaml`, `src/components/cesium/MapLayer.jsx`, the layer manager, the vault/token manager, and the temporal filtering components. Official references are linked in the specification above.
