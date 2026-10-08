/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cartographic-cache.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import { createCartographicCache, TILE_CACHE_NAME, TILE_CACHE_METADATA_NAME } from '../../../../public/cartographic-cache.js'
import { buildTileCacheRules, DEFAULT_TILE_CACHE_BYTES, normalizeTileCacheBudget } from '@Core/cache/CartographicCachePolicy'
import {
    classifyTileRequest,
    DEFAULT_TILE_CACHE_BYTES as WORKER_DEFAULT_TILE_CACHE_BYTES,
    tileFreshnessDeadline,
} from '../../../../public/cartographic-cache-policy.js'

/** Create an isolated CacheStorage double that clones bodies at the browser boundary. */
const createStorage = () => {
    const caches = new Map()
    return {
        caches,
        open: vi.fn(async name => {
            if (!caches.has(name)) {
                const entries = new Map()
                caches.set(name, {
                    entries,
                    match: vi.fn(async request => entries.get(typeof request === 'string' ? request : request.url)?.clone()),
                    put: vi.fn(async (request, response) => { entries.set(typeof request === 'string' ? request : request.url, response.clone()) }),
                    delete: vi.fn(async request => entries.delete(typeof request === 'string' ? request : request.url)),
                    keys: vi.fn(async () => [...entries.keys()].map(url => new Request(url))),
                })
            }
            return caches.get(name)
        }),
        keys: vi.fn(async () => [...caches.keys()]),
        delete: vi.fn(async name => caches.delete(name)),
    }
}

/** Create a cache engine with deterministic time, hashing, storage, and network responses. */
const fixture = (options = {}) => {
    const storage = options.storage ?? createStorage()
    const network = options.network ?? vi.fn(async () => new Response('tile', {headers: {'Cache-Control': 'max-age=3600', ETag: 'version-1'}}))
    let time = 1000
    const engine = createCartographicCache({
        storage, network, origin: 'https://studio.example',
        now: () => time,
        digest: value => webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
        estimate: options.estimate ?? (() => undefined),
    })
    return {engine, network, storage, advance: value => { time += value }}
}

/** Create an authenticated Ion terrain request without using real credentials. */
const terrain = (name = 'tile', token = 'test-token') => new Request(`https://assets.ion.cesium.com/1/${name}.terrain`, {headers: {Authorization: `Bearer ${token}`}})

/** Create an explicitly cacheable tile response. */
const tileResponse = (body = 'tile', headers = {}) => new Response(body, {headers: {'Cache-Control': 'max-age=3600', ...headers}})

/** Flush observable deferred network work through a controlled promise. */
const deferred = () => {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return {promise, resolve}
}

describe('cartographic routing and freshness', () => {
    const providers = YAML.parse(readFileSync('public/layers-terrains.yaml', 'utf8')).providers
    const rules = buildTileCacheRules(providers)

    it('keeps the app and static worker fallback cache budgets aligned', () => {
        expect(DEFAULT_TILE_CACHE_BYTES).toBe(WORKER_DEFAULT_TILE_CACHE_BYTES)
    })

    it('covers the default ArcGIS imagery, Re:Earth terrain, and direct 3D content', () => {
        expect(classifyTileRequest(new Request('https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/22869/12/123/456'), rules)?.kind).toBe('imagery')
        expect(classifyTileRequest(new Request('https://terrain.reearth.land/cesium-mesh/ellipsoid/1/2/3.terrain'), rules)?.kind).toBe('terrain')
        expect(classifyTileRequest(new Request('https://buildings.reearth.land/tileset.json'), rules)?.kind).toBe('tiles3d')
        expect(classifyTileRequest(new Request('https://buildings.reearth.land/tiles/1.glb'), rules)?.kind).toBe('tiles3d')
    })

    it('restricts WMS and WMTS to configured tile operations', () => {
        expect(classifyTileRequest(new Request('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIXSET=PM'), rules)?.kind).toBe('imagery')
        expect(classifyTileRequest(new Request('https://data.geopf.fr/wmts?REQUEST=GetCapabilities'), rules)).toBeNull()
        const wmsRules = buildTileCacheRules([{layers: [{tile: 'wms', type: 'base', layer: 'public-map', url: 'https://wms.example/map'}]}])
        const source = 'https://wms.example/map?REQUEST=GetMap&LAYERS=public-map'
        expect(classifyTileRequest(new Request(`https://studio.example/proxy.php?csurl=${encodeURIComponent(source)}`), wmsRules)?.kind).toBe('imagery')
        expect(classifyTileRequest(new Request('https://wms.example/map?REQUEST=GetFeatureInfo&LAYERS=public-map'), wmsRules)).toBeNull()
    })

    it('does not cache application data, Google tiles, ranges, or unknown endpoints', () => {
        for (const url of ['https://studio.example/journeys.json', 'https://studio.example/route.gpx', 'https://tile.googleapis.com/v1/2dtiles/1/2/3', 'https://unknown.example/1/2/3.png', 'https://terrain.reearth.land/cesium-mesh/ellipsoid-other/1.terrain']) {
            expect(classifyTileRequest(new Request(url), rules)).toBeNull()
        }
        expect(classifyTileRequest(new Request(terrain(), {headers: {Range: 'bytes=0-100'}}), rules)).toBeNull()
        expect(classifyTileRequest(new Request(terrain(), {cache: 'no-store'}), rules)).toBeNull()
    })

    it('keeps provider credentials out of persisted routing rules', () => {
        const rulesWithKey = buildTileCacheRules([{layers: [{tile: 'maptiler', url: 'https://tiles.example/maps/{z}/{x}/{y}.png?key=private-test-key'}]}])
        expect(JSON.stringify(rulesWithKey)).not.toContain('private-test-key')
    })

    it('normalizes missing, unsupported, or corrupt budget preferences', () => {
        for (const value of [undefined, null, -1, 'broken', 20 * 1024 ** 3]) expect(normalizeTileCacheBudget(value)).toBe(512 * 1024 ** 2)
        expect(normalizeTileCacheBudget(String(1024 ** 3))).toBe(1024 ** 3)
    })

    it('honors freshness, age, no-store, no-cache, and partial response policies', () => {
        expect(tileFreshnessDeadline(tileResponse('tile', {'Cache-Control': 'max-age=60', Age: '10'}), 1000)).toBe(51000)
        for (const control of ['no-store', 'private, no-store', 'no-cache', 'max-age=0']) expect(tileFreshnessDeadline(tileResponse('tile', {'Cache-Control': control}), 1000)).toBeLessThanOrEqual(1000)
        expect(tileFreshnessDeadline(new Response('tile'), 1000)).toBe(0)
        expect(tileFreshnessDeadline(new Response('partial', {status: 206}), 1000)).toBe(0)
    })
})

describe('persistent cartographic payload cache', () => {
    it('reuses a fresh response, counts bytes, and restores usage after worker restart', async () => {
        const {engine, storage, network} = fixture()
        expect(await (await engine.handle(terrain())).text()).toBe('tile')
        expect(await (await engine.handle(terrain())).text()).toBe('tile')
        expect(network).toHaveBeenCalledTimes(1)
        expect(await engine.status()).toMatchObject({usage: 4, entries: 1})
        const restarted = fixture({storage, network})
        expect(await restarted.engine.status()).toMatchObject({usage: 4, entries: 1})
        await restarted.engine.handle(terrain())
        expect(network).toHaveBeenCalledTimes(1)
    })

    it('trims the least recently used response immediately when the budget decreases', async () => {
        const {engine, network} = fixture()
        await engine.configure({maxBytes: 12})
        await engine.handle(terrain('old'))
        await engine.handle(terrain('middle'))
        await engine.handle(terrain('new'))
        await engine.handle(terrain('old'))
        await engine.configure({maxBytes: 8})
        expect(await engine.status()).toMatchObject({usage: 8, entries: 2})
        await engine.handle(terrain('old'))
        expect(network).toHaveBeenCalledTimes(3)
        await engine.handle(terrain('middle'))
        expect(network).toHaveBeenCalledTimes(4)
    })

    it('does not download anything when a budget increases', async () => {
        const {engine, network, storage} = fixture()
        await engine.configure({maxBytes: 1024 ** 3})
        expect(network).not.toHaveBeenCalled()
        const restarted = fixture({storage: storage})
        expect((await restarted.engine.status()).maxBytes).toBe(1024 ** 3)
    })

    it('does not persist no-store, opaque, partial, or oversized responses', async () => {
        const opaque = new Response('hidden')
        Object.defineProperty(opaque, 'type', {value: 'opaque'})
        for (const response of [tileResponse('tile', {'Cache-Control': 'no-store'}), new Response('partial', {status: 206}), opaque]) {
            const {engine} = fixture({network: vi.fn(async () => response)})
            await engine.handle(terrain())
            expect((await engine.status()).entries).toBe(0)
        }
        const {engine} = fixture()
        await engine.configure({maxBytes: 3})
        await engine.handle(terrain())
        expect((await engine.status()).entries).toBe(0)
    })

    it('revalidates an expired response and applies a 304 freshness update', async () => {
        const {engine, network, advance} = fixture()
        network.mockResolvedValueOnce(tileResponse('original', {'Cache-Control': 'max-age=1', ETag: 'v1'}))
        await engine.handle(terrain())
        advance(2000)
        network.mockResolvedValueOnce(new Response(null, {status: 304, headers: {'Cache-Control': 'max-age=60'}}))
        expect(await (await engine.handle(terrain())).text()).toBe('original')
        expect(network.mock.calls[1][0].headers.get('If-None-Match')).toBe('v1')
        await engine.handle(terrain())
        expect(network).toHaveBeenCalledTimes(2)
    })

    it('retries the original request when a provider rejects conditional CORS headers', async () => {
        const {engine, network, advance} = fixture()
        const request = terrain()
        network.mockResolvedValueOnce(tileResponse('original', {'Cache-Control': 'max-age=1', ETag: 'v1'}))
        await engine.handle(request)
        advance(2000)
        network.mockRejectedValueOnce(new TypeError('Conditional preflight rejected'))
        network.mockResolvedValueOnce(tileResponse('updated'))
        expect(await (await engine.handle(request)).text()).toBe('updated')
        expect(network.mock.calls[1][0].headers.get('If-None-Match')).toBe('v1')
        expect(network.mock.calls[2][0]).toBe(request)
        await engine.handle(request)
        expect(network).toHaveBeenCalledTimes(3)
    })

    it('preserves network access when CacheStorage fails', async () => {
        const storage = createStorage()
        storage.open.mockRejectedValue(new Error('Storage disabled'))
        const {engine, network} = fixture({storage})
        expect(await (await engine.handle(terrain())).text()).toBe('tile')
        expect(network).toHaveBeenCalledTimes(1)
        expect((await engine.status()).available).toBe(false)
    })

    it('coalesces simultaneous misses while returning independently consumable responses', async () => {
        const started = deferred()
        const response = deferred()
        const {engine, network} = fixture({network: vi.fn(() => { started.resolve()
            return response.promise })})
        const first = engine.handle(terrain())
        await started.promise
        const second = engine.handle(terrain())
        response.resolve(tileResponse())
        const results = await Promise.all([first, second])
        expect(await Promise.all(results.map(result => result.text()))).toEqual(['tile', 'tile'])
        expect(network).toHaveBeenCalledTimes(1)
    })

    it('does not repopulate after clearing an in-flight download', async () => {
        const started = deferred()
        const response = deferred()
        const {engine} = fixture({network: vi.fn(() => { started.resolve()
            return response.promise })})
        const loading = engine.handle(terrain())
        await started.promise
        await engine.clear()
        response.resolve(tileResponse())
        expect(await (await loading).text()).toBe('tile')
        expect((await engine.status()).entries).toBe(0)
    })

    it('partitions credentials and never persists raw tokens or authenticated URLs', async () => {
        const {engine, network, storage} = fixture()
        await engine.handle(terrain('tile', 'credential-one'))
        await engine.handle(terrain('tile', 'credential-two'))
        expect(network).toHaveBeenCalledTimes(2)
        for (const name of [TILE_CACHE_NAME, TILE_CACHE_METADATA_NAME]) {
            for (const [key, response] of storage.caches.get(name).entries) {
                expect(key).not.toContain('assets.ion')
                expect(`${key}${await response.clone().text()}`).not.toContain('credential-')
            }
        }
    })

    it('removes authenticated response URLs and sensitive response headers from storage', async () => {
        const response = tileResponse('tile', {'X-Provider-Credential': 'private-test-key'})
        Object.defineProperty(response, 'url', {value: 'https://assets.ion.cesium.com/1/tile.terrain?key=private-test-key'})
        const {engine, storage} = fixture({network: vi.fn(async () => response)})
        await engine.handle(terrain())
        const saved = [...storage.caches.get(TILE_CACHE_NAME).entries.values()][0]
        expect(saved.url).toBe('')
        expect(saved.headers.has('X-Provider-Credential')).toBe(false)
        expect(saved.headers.get('Cache-Control')).toBe('max-age=3600')
    })

    it('retains imagery and terrain reserves while 3D resources grow', async () => {
        const {engine, network} = fixture()
        await engine.configure({maxBytes: 20, rules: buildTileCacheRules([{layers: [{tile: 'slippy', url: 'https://tiles.example/'}]}])})
        const imagery = new Request('https://tiles.example/1/2/3.png')
        await engine.handle(imagery)
        await engine.handle(terrain())
        for (const id of [1, 2, 3, 4]) await engine.handle(new Request(`https://assets.ion.cesium.com/100/${id}.glb`))
        expect((await engine.status()).usage).toBe(20)
        await engine.handle(imagery)
        await engine.handle(terrain())
        expect(network).toHaveBeenCalledTimes(6)
    })

    it('keeps downloaded responses usable after a quota failure', async () => {
        const {engine, storage} = fixture()
        await engine.status()
        const error = new Error('Quota exceeded')
        error.name = 'QuotaExceededError'
        storage.caches.get(TILE_CACHE_NAME).put.mockRejectedValueOnce(error)
        expect(await (await engine.handle(terrain())).text()).toBe('tile')
        expect((await engine.status()).usage).toBe(0)
    })

    it('purges only Ion entries on token changes and preserves PWA caches', async () => {
        const {engine, storage} = fixture()
        const app = await storage.open('lgs-studio-existing')
        await app.put('https://studio.example/index.html', new Response('app'))
        await engine.configure({rules: buildTileCacheRules([{layers: [{tile: 'slippy', url: 'https://tiles.example/'}]}])})
        await engine.handle(terrain())
        await engine.handle(new Request('https://tiles.example/1/2/3.png'))
        await engine.clear('ion')
        expect((await engine.status()).entries).toBe(1)
        await engine.clear()
        expect((await engine.status()).entries).toBe(0)
        expect(await (await app.match('https://studio.example/index.html')).text()).toBe('app')
    })

    it('reduces the effective budget under origin storage pressure', async () => {
        const {engine} = fixture({estimate: () => ({quota: 100 * 1024 ** 2, usage: 30 * 1024 ** 2})})
        const status = await engine.status()
        expect(status.effectiveMaxBytes).toBe(Math.floor(6 * 1024 ** 2 * 0.8))
        expect(status.maxBytes).toBe(512 * 1024 ** 2)
    })

    it('discards the legacy Ion cache without modifying unrelated storage', async () => {
        const storage = createStorage()
        await storage.open('cesium-ion-assets')
        await storage.open('unrelated-cache')
        const {engine} = fixture({storage})
        await engine.status()
        expect(await storage.keys()).not.toContain('cesium-ion-assets')
        expect(await storage.keys()).toContain('unrelated-cache')
    })
})
