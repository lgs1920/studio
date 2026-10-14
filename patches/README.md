# Mapterhorn provider: synchronous request deferral

## Upstream submission

The source-only patch ready to send to the maintainer is
[`upstream/cesium-mapterhorn-provider-request-deferral.patch`](upstream/cesium-mapterhorn-provider-request-deferral.patch).
It applies to `src/MapterhornTerrainProvider.js` in
[bertt/cesium-mapterhorn-provider](https://github.com/bertt/cesium-mapterhorn-provider).

Suggested title: **Preserve synchronous request deferral in requestTileGeometry**.

## Compatibility and affected case

The provider is compatible with CesiumJS. This correction addresses its return
value specifically when Cesium's request scheduler defers a tile request.

According to the [Cesium TerrainProvider contract](https://cesium.com/learn/cesiumjs/ref-doc/TerrainProvider.html#requestTileGeometry),
`requestTileGeometry` must return either a promise resolving to terrain data, or
**synchronous `undefined`** when the request should be retried later.

The original method is declared `async`. Consequently, both its early returns
are wrapped in promises:

- When `Resource.fetchBlob()` returns `undefined` because the scheduler defers
  the request, the method returns `Promise.resolve(undefined)`.
- When the requested level exceeds `maxLevel`, the same wrapping occurs.

Cesium treats the returned promise as an accepted request. When it resolves, its
terrain-loading path receives `undefined` instead of a `TerrainData` instance.
This can enter the tile failure path instead of the intended defer-and-retry path.
It does not affect every request: a request that downloads and decodes a tile
successfully already returns the expected terrain data.

## Correction

Remove `async` from `requestTileGeometry` and leave resource creation, scheduler
handling, and the zoom-limit check in that synchronous method. Move the existing
bitmap decoding and heightmap construction into an asynchronous
`_decodeTileBlob(blob, level)` helper.

The accepted request returns:

```js
return promise.then(blob => this._decodeTileBlob(blob, level))
```

This keeps the original Terrarium decoding, bilinear resampling, grid size,
child-tile mask, attribution, and network error propagation. Only the early
return semantics change. No Cesium version or public constructor option changes
are required.

## Minimal deterministic reproduction

Run this against the source module or the published ESM entry. It needs no
network or browser canvas because the request is deliberately deferred.

```js
import assert from 'node:assert/strict'
import {Resource} from 'cesium'
import {MapterhornTerrainProvider} from './src/MapterhornTerrainProvider.js'

const originalFetchBlob = Resource.prototype.fetchBlob
try {
    Resource.prototype.fetchBlob = () => undefined
    const provider = new MapterhornTerrainProvider()

    assert.equal(provider.requestTileGeometry(0, 0, 0), undefined)
    assert.equal(provider.requestTileGeometry(0, 0, 18), undefined)
}
finally {
    Resource.prototype.fetchBlob = originalFetchBlob
}
```

Before this correction, the assertions receive a promise and fail. After the
correction, both receive synchronous `undefined` and pass. Also verify an
accepted request still produces a `HeightmapTerrainData`, and a rejected download
still rejects with the original error.

## Applying and releasing upstream

```bash
git apply --check cesium-mapterhorn-provider-request-deferral.patch
git apply cesium-mapterhorn-provider-request-deferral.patch
npm run build
```

Rebuild the distributed ESM and browser bundles before publishing a corrected
package. The source-only submission deliberately does not include generated files.

## Studio package patch

Studio currently pins `@bertt/cesium-mapterhorn-provider` to `0.1.0` and applies
`patches/@bertt%2Fcesium-mapterhorn-provider@0.1.0.patch`
through Bun's `patchedDependencies`. This patch updates the published ESM entry
used by Studio and the source distributed with the package. Bun applies it during
installation, including frozen-lockfile installs.

The Studio-specific handling of sparse high-resolution coverage and altitude
sampling is separate from this upstream scheduling fix and is not included in
the source-only submission. Remove the package patch after adopting an upstream
release that includes and verifies the correction.
