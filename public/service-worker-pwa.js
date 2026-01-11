/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-11
 * Last modified: 2026-01-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Service Worker for LGS1920 Studio PWA - Auto-update mode
 * Automatically updates the app as soon as a new version is available
 */

/**
 * Generates a cache name based on the current platform (from servers.json)
 * @returns {Promise<string>} The cache name for the current environment
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
 * Fetches build metadata from JSON manifest files
 * @returns {Promise<{buildTime: string, version: string, branch: string}>}
 */
const getBuildMetadata = async () => {
    let buildTime = `${Date.now()}`
    let version = '0.0.0'
    let branch = 'main'

    // Use a timestamp query param to bypass SW fetch interception for metadata
    const cacheBuster = `?t=${Date.now()}`

    try {
        const buildRes = await fetch(`./build.json${cacheBuster}`)
        if (buildRes.ok) {
            const data = await buildRes.json()
            buildTime = data.date ? `${data.date}` : buildTime
        }
    }
    catch (err) {
        console.error('[Service Worker] Failed to fetch build.json:', err)
    }

    try {
        const verRes = await fetch(`./version.json${cacheBuster}`)
        if (verRes.ok) {
            const data = await verRes.json()
            version = data.studio || data.backend || version
        }
    }
    catch (err) {
        console.error('[Service Worker] Failed to fetch version.json:', err)
    }

    try {
        const branchRes = await fetch(`./branch.json${cacheBuster}`)
        if (branchRes.ok) {
            const data = await branchRes.json()
            branch = data.branch || branch
        }
    }
    catch (err) {
        console.error('[Service Worker] Failed to fetch branch.json:', err)
    }

    return {buildTime, version, branch}
}

/**
 * Notifies all clients that a new version has been installed and activated
 */
const notifyNewVersion = async () => {
    try {
        const {buildTime, version, branch} = await getBuildMetadata()
        const allClients = await self.clients.matchAll({includeUncontrolled: true})
        const message = {
            type: 'NEW_VERSION_AUTO_APPLIED',
            buildTime,
            version,
            branch,
        }
        allClients.forEach(client => client.postMessage(message))
    }
    catch (err) {
        console.error('[Service Worker] Failed to notify clients:', err)
    }
}

/**
 * Checks if current build differs from the one stored in cache
 * @returns {Promise<boolean>}
 */
const isNewVersionAvailable = async () => {
    try {
        const current = await getBuildMetadata()
        const cacheName = await getCacheName()
        const cache = await caches.open(cacheName)
        const cachedResp = await cache.match('build_metadata')
        const previous = cachedResp ? await cachedResp.json() : {}

        const isNew =
                  previous.buildTime !== current.buildTime ||
                  previous.version !== current.version ||
                  previous.branch !== current.branch

        if (isNew) {
            // Update stored metadata for next check
            await cache.put(
                'build_metadata',
                new Response(JSON.stringify(current), {
                    headers: {'Content-Type': 'application/json'},
                }),
            )
        }

        return isNew
    }
    catch (err) {
        return false
    }
}

// ====================================
// Install
// ====================================
self.addEventListener('install', event => {
    console.info('[Service Worker] Install event: skipping waiting...')
    // Force this service worker to become the active service worker immediately
    self.skipWaiting()
})

// ====================================
// Activate
// ====================================
self.addEventListener('activate', event => {
    console.info('[Service Worker] Activate event: taking control and clearing cache...')
    event.waitUntil(
        (async () => {
            // Become available to all clients (tabs) immediately
            await self.clients.claim()

            const hasNewVersion = await isNewVersionAvailable()

            if (hasNewVersion) {
                // If version changed, clear ALL caches to ensure mobile
                // doesn't hold old CSS/JS chunks
                const names = await caches.keys()
                await Promise.all(
                    names.map(name => caches.delete(name)),
                )
                console.info('[Service Worker] Cache cleared due to version update')
                await notifyNewVersion()
            }
        })()
    )
})

// ====================================
// Fetch
// ====================================
self.addEventListener('fetch', event => {
    // Network-only strategy for metadata files to always get fresh version info
    if (event.request.url.includes('.json')) {
        return event.respondWith(fetch(event.request))
    }

    // Default strategy: Network first
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request)
        }),
    )
})

// ====================================
// Message
// ====================================
self.addEventListener('message', event => {
    if (event.data?.type === 'GET_BUILD_INFO') {
        (async () => {
            const {buildTime, version, branch} = await getBuildMetadata()
            event.source?.postMessage({
                                          type: 'BUILD_INFO_RESPONSE',
                                          buildTime,
                                          version,
                                          branch,
                                      })
        })()
    }
})