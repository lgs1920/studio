/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cartographic-cache.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_TILE_CACHE_BYTES, classifyTileRequest, tileFreshnessDeadline } from './cartographic-cache-policy.js'

/** Dedicated response cache, independent of journeys and the PWA shell. */
export const TILE_CACHE_NAME = 'lgs-cartographic-tiles-v1'
/** Dedicated small metadata records for byte accounting, routing, and LRU. */
export const TILE_CACHE_METADATA_NAME = 'lgs-cartographic-metadata-v1'

/** Create a persistent cartographic cache with injectable browser boundaries. */
export const createCartographicCache = ({
    storage = globalThis.caches,
    network = request => fetch(request),
    digest = value => globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    estimate = () => globalThis.navigator?.storage?.estimate?.(),
    now = () => Date.now(),
    origin = globalThis.location?.origin ?? 'https://studio.invalid',
} = {}) => {
    let dataCache
    let metadataCache
    let initialization
    let queue = Promise.resolve()
    let generation = 0
    let maxBytes = DEFAULT_TILE_CACHE_BYTES
    let effectiveMaxBytes = maxBytes
    let rules = []
    let available = true
    let accessSequence = 0
    let totalBytes = 0
    let lastEstimateAt = -Infinity
    let pressureLimit = Infinity
    const records = new Map()
    const pending = new Map()
    const configurationKey = `${origin}/__lgs_tile_cache__/configuration`

    /** Serialize cache mutations while allowing network requests to run concurrently. */
    const serialize = operation => {
        const result = queue.then(operation)
        queue = result.catch(() => {})
        return result
    }

    /** Sum tracked response payload sizes without rereading binary contents. */
    const usage = () => totalBytes

    /** Return a monotonic access timestamp, including hits within the same millisecond. */
    const nextAccess = () => accessSequence = Math.max(now(), accessSequence + 1)

    /** Persist one small metadata record without rewriting a tile's binary payload. */
    const saveRecord = record => metadataCache.put(record.key, new Response(JSON.stringify(record)))

    /** Remove one resource and its accounting record together. */
    const remove = async record => {
        await dataCache.delete(record.key)
        await metadataCache.delete(record.key)
        if (records.delete(record.key)) totalBytes -= record.size
    }

    /** Delete resource batches with bounded CacheStorage concurrency. */
    const removeRecords = async entries => {
        let offset = 0
        while (offset < entries.length) {
            await Promise.all(entries.slice(offset, offset + 32).map(remove))
            offset += 32
        }
    }

    /** Reserve origin storage for journeys and leave headroom for concurrent writes. */
    const resolveBudget = async (force = false) => {
        if (!force && now() - lastEstimateAt < 5000) return effectiveMaxBytes
        lastEstimateAt = now()
        effectiveMaxBytes = Math.min(maxBytes, pressureLimit)
        try {
            const storageEstimate = await estimate()
            if (Number.isFinite(storageEstimate?.quota) && Number.isFinite(storageEstimate?.usage)) {
                const otherUsage = Math.max(0, storageEstimate.usage - usage())
                const reserve = Math.max(64 * 1024 * 1024, Math.min(256 * 1024 * 1024, storageEstimate.quota * 0.05))
                effectiveMaxBytes = Math.min(maxBytes, pressureLimit, Math.max(0, Math.floor((storageEstimate.quota - otherUsage - reserve) * 0.8)))
            }
        }
        catch { /* Keep the configured cap when estimates are unavailable. */ }
        return effectiveMaxBytes
    }

    /** Evict expired resources first, then LRU resources with soft category reserves. */
    const trim = async (target = effectiveMaxBytes) => {
        await removeRecords([...records.values()].filter(record => record.expiresAt <= now()))
        const ordered = [...records.values()].sort((left, right) => left.lastAccess - right.lastAccess)
        const shares = {imagery: 0.2, terrain: 0.1}
        const totals = {imagery: 0, terrain: 0, tiles3d: 0}
        ordered.forEach(record => totals[record.kind] += record.size)
        const victims = []
        let total = usage()
        while (total > target && ordered.length) {
            const index = ordered.findIndex(record => record.kind === 'tiles3d'
                || totals[record.kind] - record.size >= Math.min(totals[record.kind], effectiveMaxBytes * shares[record.kind]))
            const [victim] = ordered.splice(index < 0 ? 0 : index, 1)
            victims.push(victim)
            totals[victim.kind] -= victim.size
            total -= victim.size
        }
        await removeRecords(victims)
    }

    /** Open owned caches and recover durable accounting after worker restarts. */
    const initialize = () => {
        if (initialization) return initialization
        initialization = (async () => {
            dataCache = await storage.open(TILE_CACHE_NAME)
            metadataCache = await storage.open(TILE_CACHE_METADATA_NAME)
            const saved = await metadataCache.match(configurationKey)
            if (saved) {
                try {
                    const configuration = await saved.json()
                    const value = Number(configuration.maxBytes)
                    maxBytes = Number.isSafeInteger(value) && value > 0 && value <= 2 * 1024 ** 3 ? value : DEFAULT_TILE_CACHE_BYTES
                    rules = Array.isArray(configuration.rules) ? configuration.rules : []
                }
                catch { /* Use defaults when a configuration record is corrupt. */ }
            }
            // Read small records in bounded batches instead of loading tile bodies.
            const keys = await metadataCache.keys()
            let offset = 0
            while (offset < keys.length) {
                await Promise.all(keys.slice(offset, offset + 32).map(async request => {
                    if (request.url === configurationKey) return
                    try {
                        const record = await (await metadataCache.match(request)).json()
                        if (record.key !== request.url || !Number.isFinite(record.size) || record.size < 0
                            || !Number.isFinite(record.lastAccess) || !Number.isFinite(record.expiresAt)
                            || !['imagery', 'terrain', 'tiles3d'].includes(record.kind)) throw new Error('Invalid cache record')
                        records.set(record.key, record)
                        totalBytes += record.size
                        accessSequence = Math.max(accessSequence, record.lastAccess)
                    }
                    catch { await metadataCache.delete(request) }
                }))
                offset += 32
            }
            // Discard orphaned payloads and the old cache that lacked freshness metadata.
            const payloadKeys = await dataCache.keys()
            const payloadSet = new Set(payloadKeys.map(request => request.url))
            for (const record of records.values()) {
                if (!payloadSet.has(record.key)) await remove(record)
            }
            await Promise.all(payloadKeys.filter(request => !records.has(request.url)).map(request => dataCache.delete(request)))
            const cacheNames = await storage.keys()
            await Promise.all(cacheNames.filter(name => name === 'cesium-ion-assets' || name.startsWith('cesium-ion-assets-')).map(name => storage.delete(name)))
            await resolveBudget()
            await trim()
            available = true
        })().catch(error => {
            available = false
            initialization = null
            records.clear()
            totalBytes = 0
            throw error
        })
        return initialization
    }

    /** Hash the complete request identity without persisting provider credentials. */
    const resourceKey = async request => {
        const identity = JSON.stringify([request.url, [...request.headers].sort(([left], [right]) => left.localeCompare(right)), request.credentials, request.mode])
        const hash = await digest(identity)
        const suffix = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('')
        return `${origin}/__lgs_tile_cache__/resource/${suffix}`
    }

    /** Return cache statistics and the effective storage-pressure limit. */
    const status = async () => {
        try {
            await initialize()
            await serialize(async () => {
                await resolveBudget(true)
                await trim()
            })
        }
        catch { available = false }
        return {usage: usage(), entries: records.size, maxBytes, effectiveMaxBytes, available}
    }

    /** Save a new budget and routing rules, trimming immediately after a reduction. */
    const configure = async configuration => {
        await initialize()
        return serialize(async () => {
            const value = Number(configuration.maxBytes)
            maxBytes = Number.isSafeInteger(value) && value > 0 && value <= 2 * 1024 ** 3 ? value : DEFAULT_TILE_CACHE_BYTES
            if (Array.isArray(configuration.rules)) rules = configuration.rules
            pressureLimit = Infinity
            await metadataCache.put(configurationKey, new Response(JSON.stringify({maxBytes, rules})))
            await resolveBudget(true)
            await trim()
            return {usage: usage(), entries: records.size, maxBytes, effectiveMaxBytes, available}
        })
    }

    /** Clear only cartographic data, invalidating downloads already in progress. */
    const clear = async (scope = 'all') => {
        generation++
        pending.clear()
        await initialize()
        await serialize(async () => {
            if (scope === 'all') {
                // Delete owned caches in bulk instead of issuing thousands of tile deletions.
                await Promise.all([storage.delete(TILE_CACHE_NAME), storage.delete(TILE_CACHE_METADATA_NAME)])
                dataCache = await storage.open(TILE_CACHE_NAME)
                metadataCache = await storage.open(TILE_CACHE_METADATA_NAME)
                records.clear()
                totalBytes = 0
                await metadataCache.put(configurationKey, new Response(JSON.stringify({maxBytes, rules})))
            }
            else await removeRecords([...records.values()].filter(record => record.ion))
        })
        return status()
    }

    /** Read or download a permitted resource; cache failures always preserve network loading. */
    const load = async (request, classification, key, startedGeneration) => {
        let stale
        try {
            const hit = await serialize(async () => {
                const record = records.get(key)
                if (!record) return null
                const response = await dataCache.match(key)
                if (!response) {
                    await remove(record)
                    return null
                }
                if (record.expiresAt <= now() || ['reload', 'no-cache'].includes(request.cache)) {
                    stale = response
                    return null
                }
                record.lastAccess = nextAccess()
                await saveRecord(record)
                return response
            })
            if (hit) return hit
        }
        catch { available = false }

        let networkRequest = request
        if (stale?.headers.get('etag')) {
            const headers = new Headers(request.headers)
            headers.set('If-None-Match', stale.headers.get('etag'))
            networkRequest = new Request(request, {headers})
        }
        else if (stale?.headers.get('last-modified')) {
            const headers = new Headers(request.headers)
            headers.set('If-Modified-Since', stale.headers.get('last-modified'))
            networkRequest = new Request(request, {headers})
        }
        let response
        try { response = await network(networkRequest) }
        catch (error) {
            // Some providers do not allow conditional headers in their CORS preflight.
            if (networkRequest === request) throw error
            response = await network(request)
        }
        if (response.status === 304 && stale) {
            const headers = new Headers(stale.headers)
            response.headers.forEach((value, name) => headers.set(name, value))
            response = new Response(stale.body, {status: 200, headers})
        }
        try {
            const expiresAt = tileFreshnessDeadline(response, now())
            if (expiresAt <= now()) {
                await serialize(async () => {
                    if (generation === startedGeneration && records.has(key)) await remove(records.get(key))
                })
                return response
            }
            const size = (await response.clone().blob()).size
            await serialize(async () => {
                if (generation !== startedGeneration) return
                await resolveBudget()
                if (size > effectiveMaxBytes) return
                // Evict before writing so a large tile cannot exceed the payload budget.
                if (records.has(key)) await remove(records.get(key))
                if (usage() + size > effectiveMaxBytes) await trim(Math.max(0, effectiveMaxBytes - size))
                // Persist only rendering and freshness headers, with no authenticated response URL.
                const headers = new Headers()
                for (const name of ['content-type', 'cache-control', 'etag', 'last-modified', 'date', 'expires', 'age', 'vary']) {
                    const value = response.headers.get(name)
                    if (value !== null) headers.set(name, value)
                }
                const storedResponse = new Response(response.clone().body, {status: 200, headers})
                try { await dataCache.put(key, storedResponse) }
                catch (error) {
                    if (error?.name !== 'QuotaExceededError') throw error
                    pressureLimit = Math.min(effectiveMaxBytes, Math.floor(usage() / 2))
                    effectiveMaxBytes = pressureLimit
                    await trim()
                    available = false
                    return
                }
                const record = {key, size, expiresAt, lastAccess: nextAccess(), ...classification}
                try { await saveRecord(record) }
                catch (error) {
                    await dataCache.delete(key)
                    throw error
                }
                records.set(key, record)
                totalBytes += record.size
                available = true
            })
        }
        catch { available = false }
        return response
    }

    /** Handle a request through the cache or the existing application fetch policy. */
    const handle = async (request, fallback = () => network(request)) => {
        const startedGeneration = generation
        try { await initialize() }
        catch { return network(request) }
        const classification = classifyTileRequest(request, rules)
        if (!classification) return fallback()
        let key
        try { key = await resourceKey(request) }
        catch { return network(request) }
        const pendingKey = `${startedGeneration}:${key}`
        if (!pending.has(pendingKey)) {
            const task = load(request, classification, key, startedGeneration)
            pending.set(pendingKey, task)
            task.finally(() => pending.delete(pendingKey)).catch(() => {})
        }
        return (await pending.get(pendingKey)).clone()
    }

    return {handle, configure, clear, status}
}
