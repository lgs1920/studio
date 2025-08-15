/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-15
 * Last modified: 2025-08-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Service Worker for LGS1920 Studio PWA
 * Handles installation, activation, fetch events, and client messaging
 * Manages versioning using __BUILD_TIME__, __VERSION__, and __BRANCH__
 * Notifies clients of new versions when build time, version, or branch changes
 * Controlled by AppUpdateManager for updates via SKIP_WAITING
 */

    // Build metadata with fallback values
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : `${Date.now()}`
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0'
const BRANCH = typeof __BRANCH__ !== 'undefined' ? __BRANCH__ : 'main'

/**
 * Logs build metadata for debugging
 */
const logBuildInfo = () => {
    console.log(`[Service Worker] LGS1920 Studio - Build Time: ${BUILD_TIME}, Version: ${VERSION}, Branch: ${BRANCH}`)
}

/**
 * Notifies clients of a new version with build metadata
 * @async
 */
const notifyNewVersion = async () => {
    try {
        const clients = await self.clients.matchAll({includeUncontrolled: true})
        const message = {
            type: 'NEW_VERSION',
            buildTime: BUILD_TIME,
            version:   VERSION,
            branch:    BRANCH,
        }
        clients.forEach(client => client.postMessage(message))
        console.log('[Service Worker] New version notification sent:', message)
    }
    catch (error) {
        console.error('[Service Worker] Failed to notify clients:', error)
    }
}

/**
 * Checks if a new version is available by comparing build metadata
 * Uses Cache API to store and compare previous values
 * @async
 * @returns {boolean} True if a new version is detected
 */
const isNewVersionAvailable = async () => {
    try {
        const cache = await caches.open('lgs-version')
        const cachedResponse = await cache.match('version-info')
        const previousVersion = cachedResponse ? await cachedResponse.json() : {}

        // Compare current and previous metadata
        const isNew = previousVersion.buildTime !== BUILD_TIME ||
            previousVersion.version !== VERSION ||
            previousVersion.branch !== BRANCH

        // Store current metadata
        await cache.put('version-info', new Response(JSON.stringify({
                                                                        buildTime: BUILD_TIME,
                                                                        version:   VERSION,
                                                                        branch:    BRANCH,
                                                                    })))

        return isNew
    }
    catch (error) {
        console.error('[Service Worker] Failed to check version:', error)
        return false
    }
}

// Install event
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...')
    event.waitUntil(
        (async () => {
            try {
                logBuildInfo()
                // Do not call skipWaiting automatically - controlled by AppUpdateManager
                console.log('[Service Worker] Installation complete - awaiting activation')
            }
            catch (error) {
                console.error('[Service Worker] Installation failed:', error)
            }
        })()
    )
})

// Activate event
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...')
    event.waitUntil(
        (async () => {
            try {
                await self.clients.claim()
                // Notify clients if a new version is detected
                if (await isNewVersionAvailable()) {
                    await notifyNewVersion()
                }
                console.log('[Service Worker] Activation complete')
            }
            catch (error) {
                console.error('[Service Worker] Activation failed:', error)
            }
        })()
    )
})

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request))
})

// Message event
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Skip waiting requested')
        self.skipWaiting()
    }

    if (event.data?.type === 'GET_BUILD_INFO') {
        event.source?.postMessage({
                                      type:      'BUILD_INFO_RESPONSE',
                                      buildTime: BUILD_TIME,
                                      version:   VERSION,
                                      branch:    BRANCH,
                                  })
    }
})