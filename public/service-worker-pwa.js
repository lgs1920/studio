/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-16
 * Last modified: 2026-03-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Unified LGS1920 Studio Service Worker
 * Manages PWA versioning, dynamic asset caching, and Cesium persistent storage.
 */
const CESIUM_CACHE = 'cesium-ion-assets'
const APP_CACHE_PREFIX = 'lgs-studio-'

/**
 * Resolves the appropriate cache name based on platform configuration.
 * @returns {Promise<string>}
 */
const getCacheName = async () => {
    try {
        const response = await fetch('servers.json')
        const servers = await response.json()
        return `${APP_CACHE_PREFIX}${servers.platform}`
    }
    catch {
        return `${APP_CACHE_PREFIX}default`
    }
}

/**
 * Fetches build metadata to verify application version consistency.
 * @returns {Promise<object>}
 */
const getBuildMetadata = async () => {
    const cb = `?t=${Date.now()}`
    try {
        const [b, v, br] = await Promise.all([
                                                 fetch(`./build.json${cb}`).then(r => r.json()).catch(() => ({})),
                                                 fetch(`./version.json${cb}`).then(r => r.json()).catch(() => ({})),
                                                 fetch(`./branch.json${cb}`).then(r => r.json()).catch(() => ({})),
                                             ])
        return {buildTime: b.date || Date.now(), version: v.studio || '0.0.0', branch: br.branch || 'main'}
    }
    catch {
        return {buildTime: Date.now(), version: '0.0.0', branch: 'main'}
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

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            await self.clients.claim()
            const currentMeta = await getBuildMetadata()
            const activeCacheName = await getCacheName()
            const cache = await caches.open(activeCacheName)

            const cachedMeta = await cache.match('build_metadata')
            const previous = cachedMeta ? await cachedMeta.json() : null

            const allKeys = await caches.keys()
            await Promise.all(
                allKeys.map(key => {
                    if (key.startsWith(APP_CACHE_PREFIX) && key !== activeCacheName) {
                        return caches.delete(key)
                    }
                    return null
                }),
            )

            if (!previous || previous.buildTime !== currentMeta.buildTime) {
                await cache.put('build_metadata', new Response(JSON.stringify(currentMeta)))
            }
        })()
    )
})

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url)

    if (url.hostname === 'assets.ion.cesium.com') {
        event.respondWith(handleCesiumFetch(event.request))
        return
    }

    if (event.request.method === 'GET' && url.protocol.startsWith('http')) {
        event.respondWith(handleAppFetch(event.request))
    }
})

/**
 * Handles persistent caching of Cesium assets.
 * @param {Request} request
 */
async function handleCesiumFetch(request) {
    const cache = await caches.open(CESIUM_CACHE)
    const cachedResp = await cache.match(request)
    if (cachedResp) {
        return cachedResp
    }

    const networkResp = await fetch(request)
    if (networkResp && networkResp.status === 200) {
        cache.put(request, networkResp.clone())
    }
    return networkResp
}

/**
 * Handles standard application resource caching.
 * @param {Request} request
 */
async function handleAppFetch(request) {
    const cacheName = await getCacheName()
    const cache = await caches.open(cacheName)

    const cached = await cache.match(request)
    const fetchPromise = fetch(request).then(networkResp => {
        if (networkResp.ok && networkResp.type === 'basic') {
            cache.put(request, networkResp.clone())
        }
        return networkResp
    })

    return cached || fetchPromise
}

self.addEventListener('message', async (event) => {
    if (event.data?.source !== 'LGS_CACHE_MANAGER') {
        return
    }

    if (event.data.type === 'GET_USAGE') {
        const cache = await caches.open(event.data.cacheName)
        const keys = await cache.keys()

        let totalSize = 0
        for (const req of keys) {
            const res = await cache.match(req)
            if (res) {
                const blob = await res.blob()
                totalSize += blob.size
            }
        }
        event.ports[0].postMessage({usage: totalSize})
    }

    if (event.data.type === 'CLEAR_CACHE') {
        await caches.delete(event.data.cacheName)
        await notifyClients('lgs:cache-cleared', {cacheName: event.data.cacheName})
    }
})