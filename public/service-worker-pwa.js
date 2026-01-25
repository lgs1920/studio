/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-25
 * Last modified: 2026-01-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Service Worker for LGS1920 Studio PWA - Balanced caching strategy
 * Only clears cache when build metadata changes.
 */

const getCacheName = async () => {
    try {
        const servers = await fetch('servers.json').then(res => res.json())
        return `lgs-studio-${servers.platform}`
    }
    catch (e) {
        return 'lgs-studio-default'
    }
}

/**
 * Fetches build metadata with cache-busting to ensure we compare fresh data
 */
const getBuildMetadata = async () => {
    let buildTime = `${Date.now()}`
    let version = '0.0.0'
    let branch = 'main'
    const cb = `?t=${Date.now()}`

    try {
        const [b, v, br] = await Promise.all([
                                                 fetch(`./build.json${cb}`).then(r => r.json()).catch(() => ({})),
                                                 fetch(`./version.json${cb}`).then(r => r.json()).catch(() => ({})),
                                                 fetch(`./branch.json${cb}`).then(r => r.json()).catch(() => ({})),
                                             ])
        return {
            buildTime: b.date || buildTime,
            version:   v.studio || v.backend || version,
            branch:    br.branch || branch,
        }
    }
    catch (err) {
        return {buildTime, version, branch}
    }
}

/**
 * Checks if version has changed compared to what's stored in the specific cache
 */
const hasVersionChanged = async () => {
    try {
        const current = await getBuildMetadata()
        const cacheName = await getCacheName()
        const cache = await caches.open(cacheName)
        const cachedResp = await cache.match('build_metadata')

        if (!cachedResp) {
            return true
        }

        const previous = await cachedResp.json()
        return previous.buildTime !== current.buildTime ||
            previous.version !== current.version ||
            previous.branch !== current.branch
    }
    catch (err) {
        return false
    }
}

// ====================================
// Install
// ====================================
self.addEventListener('install', () => {
    self.skipWaiting()
})

// ====================================
// Activate
// ====================================
self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            await self.clients.claim()

            const changed = await hasVersionChanged()
            if (changed) {
                const cacheName = await getCacheName()
                const names = await caches.keys()

                // Effective cleanup of previous cached assets
                await Promise.all(names.map(n => caches.delete(n)))

                const current = await getBuildMetadata()
                const newCache = await caches.open(cacheName)
                await newCache.put('build_metadata', new Response(JSON.stringify(current)))

                const clients = await self.clients.matchAll()
                clients.forEach(c => c.postMessage({type: 'VERSION_UPDATED', ...current}))
            }
        })()
    )
})

// ====================================
// Fetch (Stale-while-revalidate for speed)
// ====================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url)

    // Filter out unsupported schemes and specific routes
    if (
        !url.protocol.startsWith('http') ||
        url.hostname === 'localhost' ||
        url.pathname.endsWith('.json') ||
        event.request.method !== 'GET'
    ) {
        return
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    // Cache only valid same-origin or CORS responses
                    if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
                        const cacheCopy = networkResponse.clone()
                        getCacheName().then(name => {
                            caches.open(name).then(cache => cache.put(event.request, cacheCopy))
                        })
                    }
                    return networkResponse
                })
                .catch(() => cachedResponse)

            return cachedResponse || fetchPromise
        }),
    )
})