/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-08-13
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Unified LGS1920 Studio Service Worker
 * Manages PWA versioning, dynamic asset caching, and Cesium persistent storage.
 */
import { createCartographicCache } from './cartographic-cache.js'

/** Persistent tile cache with an independent payload budget. */
const cartographicCache = createCartographicCache()
const APP_CACHE_PREFIX = 'lgs-studio-'
const BUILD_METADATA_KEY = 'build_metadata'
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest', 'worker'])
const BLOCKED_CACHE_PATHS = [/^\/api(\/|$)/i, /^\/auth(\/|$)/i]
const STATIC_FILE_EXTENSIONS = /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|wasm|webmanifest|txt|json)$/i
const FRESHNESS_CRITICAL_PATHS = new Set([
                                             '/',
                                             '/index.html',
                                             '/service-worker-pwa.js',
                                             '/registerSW.js',
                                             '/manifest.webmanifest',
                                             '/build.json',
                                             '/version.json',
                                             '/branch.json',
                                             '/servers.json',
                                         ])
const HASHED_BUILD_ASSET_PATTERN = /^\/assets\/.+-[a-z0-9_-]{8,}\.[a-z0-9]+$/i
const DEPLOYMENT_BUILD_TIME = '__BUILD_TIME__'
const DEPLOYMENT_VERSION = typeof __LGS_SERVICE_WORKER_VERSION__ === 'string'
                           ? __LGS_SERVICE_WORKER_VERSION__
                           : '__VERSION__'
const DEPLOYMENT_TAG = typeof __LGS_SERVICE_WORKER_TAG__ === 'string'
                       ? __LGS_SERVICE_WORKER_TAG__
                       : '__TAG__'
const DEPLOYMENT_BRANCH = '__BRANCH__'

const getDeploymentValue = value => {
    const cleaned = String(value ?? '').trim().replace(/^"+|"+$/g, '')
    return cleaned && !cleaned.includes('__') ? cleaned : null
}

const DEFAULT_BUILD_META = Object.freeze({
                                             buildTime: getDeploymentValue(DEPLOYMENT_BUILD_TIME) ?? 'unknown',
                                             version:   getDeploymentValue(DEPLOYMENT_VERSION) ?? '0.0.0',
                                             tag:       getDeploymentValue(DEPLOYMENT_TAG) ?? 'untagged',
                                             branch:    getDeploymentValue(DEPLOYMENT_BRANCH) ?? 'main',
                                         })
const RUNTIME_STATE = {
    cacheName: null,
    metadata:  null,
    promise:   null,
}

const toCacheSegment = value =>
    String(value ?? 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown'

const fetchJson = async (path) => {
    try {
        const response = await fetch(path, {cache: 'no-store'})
        return response.ok ? response.json() : {}
    }
    catch {
        return {}
    }
}

/**
 * Resolves the appropriate cache name based on platform configuration.
 * @returns {Promise<string>}
 */
const getPlatformName = async () => {
    try {
        const response = await fetch('servers.json', {cache: 'no-store'})
        if (!response.ok) {
            return 'default'
        }
        const servers = await response.json()
        return servers.platform || 'default'
    }
    catch {
        return 'default'
    }
}

/**
 * Fetches build metadata to verify application version consistency.
 * @returns {Promise<object>}
 */
const getBuildMetadata = async () => {
    try {
        const [b, v, br] = await Promise.all([
                                                 fetchJson('./build.json'),
                                                 fetchJson('./version.json'),
                                                 fetchJson('./branch.json'),
                                             ])
        return {
            buildTime: b.date || b.buildTime || DEFAULT_BUILD_META.buildTime,
            version:   v.studio || v.version || DEFAULT_BUILD_META.version,
            tag:       DEFAULT_BUILD_META.tag,
            branch:    br.branch || DEFAULT_BUILD_META.branch,
        }
    }
    catch {
        return {...DEFAULT_BUILD_META}
    }
}

/**
 * Broadcasts an event to all connected clients via MessageChannel.
 * @param {string} eventName
 * @param {object} payload
 */
async function notifyClients(eventName, payload = {}) {
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
        client.postMessage({
                               source:    'LGS_CACHE_MANAGER',
                               type:      'BROADCAST_EVENT',
                               eventName: eventName,
                               payload:   payload,
                           })
    })
}

/**
 * Notifies controlled and uncontrolled windows after this worker activates.
 *
 * @returns {Promise<void>}
 */
async function notifyUpdateActivated() {
    const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true})
    clients.forEach(client => {
        client.postMessage({type: 'UPDATE_ACTIVATED'})
    })
}

async function resolveRuntime(forceRefresh = false) {
    if (!forceRefresh && RUNTIME_STATE.cacheName && RUNTIME_STATE.metadata) {
        return {cacheName: RUNTIME_STATE.cacheName, metadata: RUNTIME_STATE.metadata}
    }
    if (!forceRefresh && RUNTIME_STATE.promise) {
        return RUNTIME_STATE.promise
    }

    RUNTIME_STATE.promise = (async () => {
        const [platform, metadata] = await Promise.all([getPlatformName(), getBuildMetadata()])
        const cacheName = `${APP_CACHE_PREFIX}${toCacheSegment(platform)}-${toCacheSegment(metadata.version)}-${toCacheSegment(metadata.tag)}-${toCacheSegment(metadata.buildTime)}`
        RUNTIME_STATE.cacheName = cacheName
        RUNTIME_STATE.metadata = metadata
        return {cacheName, metadata}
    })().finally(() => {
        RUNTIME_STATE.promise = null
    })

    return RUNTIME_STATE.promise
}

async function openAppCache() {
    const {cacheName} = await resolveRuntime()
    return caches.open(cacheName)
}

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            await self.clients.claim()
            const {cacheName: activeCacheName, metadata} = await resolveRuntime(true)
            const cache = await caches.open(activeCacheName)

            const allKeys = await caches.keys()
            await Promise.all(
                allKeys.map(key => {
                    if (key.startsWith(APP_CACHE_PREFIX) && key !== activeCacheName) {
                        return caches.delete(key)
                    }
                    return null
                }),
            )

            await cache.put(BUILD_METADATA_KEY, new Response(JSON.stringify(metadata), {
                headers: {'content-type': 'application/json'},
            }))
            await notifyClients('lgs:cache-ready', {cacheName: activeCacheName, metadata})
            await notifyUpdateActivated()
        })()
    )
})

self.addEventListener('fetch', event => {
    let url
    try {
        url = new URL(event.request.url)
    }
    catch {
        return
    }

    if (event.request.method === 'GET' && url.protocol.startsWith('http')) {
        const response = cartographicCache.handle(event.request, () => handleAppFetch(event))
            .catch(() => new Response('Offline', {status: 503, statusText: 'Offline'}))
        event.respondWith(response)
        event.waitUntil(response.then(() => undefined))
    }
})

/**
 * Handles standard application resource caching.
 * @param {FetchEvent} event
 */
async function handleAppFetch(event) {
    const {request} = event

    if (isNavigationRequest(request)) {
        return networkFirst(event, {cacheMode: 'reload'})
    }

    if (isFreshnessCriticalRequest(request) || isUnversionedScriptOrStyleRequest(request)) {
        return networkFirst(event, {cacheMode: 'reload'})
    }

    if (!shouldCacheRequest(request)) {
        try {
            return await fetch(request)
        }
        catch {
            return new Response('Offline', {status: 503, statusText: 'Offline'})
        }
    }

    return staleWhileRevalidate(event)
}

const isNavigationRequest = request => request.mode === 'navigate' || request.destination === 'document'

const isBlockedPath = pathname => BLOCKED_CACHE_PATHS.some(pattern => pattern.test(pathname))

const isHashedBuildAsset = pathname => HASHED_BUILD_ASSET_PATTERN.test(pathname)

const isRangeRequest = request => request.headers.has('range')

const isPartialResponse = response => response?.status === 206

const isHtmlResponse = response => /text\/html/i.test(response?.headers?.get('content-type') ?? '')

const isNonNavigationHtmlResponse = (request, response) => !isNavigationRequest(request) && isHtmlResponse(response)

function isFreshnessCriticalRequest(request) {
    const url = new URL(request.url)
    return url.origin === self.location.origin && FRESHNESS_CRITICAL_PATHS.has(url.pathname)
}

function isUnversionedScriptOrStyleRequest(request) {
    const url = new URL(request.url)
    if (url.origin !== self.location.origin || isHashedBuildAsset(url.pathname)) {
        return false
    }

    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
        return true
    }

    return /\.(?:css|js|mjs)$/i.test(url.pathname)
}

function shouldCacheRequest(request) {
    if (request.method !== 'GET') {
        return false
    }

    if (isRangeRequest(request)) {
        return false
    }

    const url = new URL(request.url)
    if (url.origin !== self.location.origin || isBlockedPath(url.pathname)) {
        return false
    }

    if (CACHEABLE_DESTINATIONS.has(request.destination)) {
        return true
    }

    return STATIC_FILE_EXTENSIONS.test(url.pathname)
}

function isCacheableResponse(request, response) {
    if (!response || !response.ok || isPartialResponse(response)) {
        return false
    }

    if (isNonNavigationHtmlResponse(request, response)) {
        return false
    }

    if (response.status !== 200) {
        return false
    }

    if (response.type !== 'basic' && response.type !== 'cors') {
        return false
    }

    const cacheControl = response.headers.get('Cache-Control') || ''
    if (/no-store|private/i.test(cacheControl)) {
        return false
    }

    const url = new URL(request.url)
    return url.origin === self.location.origin
}

function withCacheMode(request, cacheMode) {
    if (!cacheMode || cacheMode === 'default') {
        return request
    }

    try {
        return new Request(request, {cache: cacheMode})
    }
    catch {
        return request
    }
}

async function networkFirst(event, options = {}) {
    const {request} = event
    const cache = await openAppCache()

    try {
        const networkResp = await fetch(withCacheMode(request, options.cacheMode))
        if (isNonNavigationHtmlResponse(request, networkResp)) {
            return new Response('Unexpected HTML response for application asset', {
                status:     502,
                statusText: 'Bad Gateway',
            })
        }
        if (isCacheableResponse(request, networkResp)) {
            event.waitUntil(cache.put(request, networkResp.clone()).catch(() => null))
        }
        return networkResp
    }
    catch {
        const cached = await cache.match(request)
        if (cached) {
            return cached
        }

        if (isNavigationRequest(request)) {
            const offlineFallback = await cache.match('/index.html')
            if (offlineFallback) {
                return offlineFallback
            }
        }

        return new Response('Offline', {status: 503, statusText: 'Offline'})
    }
}

async function staleWhileRevalidate(event) {
    const {request} = event
    const cache = await openAppCache()
    const cached = await cache.match(request)
    const networkPromise = (async () => {
        try {
            const networkResp = await fetch(request)
            if (isNonNavigationHtmlResponse(request, networkResp)) {
                return null
            }
            if (isCacheableResponse(request, networkResp)) {
                await cache.put(request, networkResp.clone()).catch(() => null)
            }
            return networkResp
        }
        catch {
            return null
        }
    })()

    event.waitUntil(networkPromise.catch(() => null))

    if (cached) {
        return cached
    }

    const networkResp = await networkPromise
    if (networkResp) {
        return networkResp
    }

    return new Response('Offline', {status: 503, statusText: 'Offline'})
}

/** Handle acknowledged cartographic commands independently of application caches. */
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        event.waitUntil(self.skipWaiting())
        return
    }
    if (event.data?.source !== 'LGS_CACHE_MANAGER') return
    const {type, scope, maxBytes, rules} = event.data
    const replyPort = event.ports?.[0]
    /** Execute one command and keep the worker alive through its acknowledgement. */
    const respond = async () => {
        try {
            let result
            if (type === 'CONFIGURE_TILE_CACHE') result = await cartographicCache.configure({maxBytes, rules})
            else if (type === 'GET_USAGE' || type === 'GET_TILE_CACHE_STATUS') result = await cartographicCache.status()
            else if (type === 'CLEAR_CACHE') {
                result = await cartographicCache.clear(scope ?? 'all')
                await notifyClients('lgs:cache-cleared', {scope: scope ?? 'all'})
            }
            else return
            replyPort?.postMessage(result)
        }
        catch { replyPort?.postMessage({error: 'cache_unavailable', available: false}) }
    }
    event.waitUntil(respond())
})
