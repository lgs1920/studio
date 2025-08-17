/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-17
 * Last modified: 2025-08-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Service Worker for LGS1920 Studio PWA
 * Handles installation, activation, fetch events, and client messaging
 * Manages versioning by fetching build.json, version.json, and branch.json
 * Notifies clients of new versions when build time, version, or branch changes
 * Controlled by AppUpdateManager for updates via SKIP_WAITING
 * Uses Cache Storage with environment-specific cache name based on lgs.platform
 */

/**
 * Generates a cache name based on the lgs.platform global variable
 * @returns {string} Cache name specific to the environment
 */
const getCacheName = async () => {
    // Read servers
    const servers = await fetch('servers.json').then(
        res => res.json(),
    )
    return servers.platform
}

/**
 * Fetches build metadata from JSON files
 * @async
 * @returns {Promise<{buildTime: string, version: string, branch: string}>} Metadata object
 */
const getBuildMetadata = async () => {
    let buildTime = `${Date.now()}`
    let version = '0.0.0'
    let branch = 'main'

    try {
        const buildResponse = await fetch('./build.json')
        if (buildResponse.ok) {
            const buildData = await buildResponse.json()
            buildTime = buildData.date ? `${buildData.date}` : buildTime
        }
    }
    catch (error) {
        console.error('[Service Worker] Failed to fetch build.json:', error)
    }

    try {
        const versionResponse = await fetch('./version.json')
        if (versionResponse.ok) {
            const versionData = await versionResponse.json()
            version = versionData.studio || versionData.backend || version
        }
    }
    catch (error) {
        console.error('[Service Worker] Failed to fetch version.json:', error)
    }

    try {
        const branchResponse = await fetch('./branch.json')
        if (branchResponse.ok) {
            const branchData = await branchResponse.json()
            branch = branchData.branch || branch
        }
    }
    catch (error) {
        console.error('[Service Worker] Failed to fetch branch.json:', error)
    }

    return {buildTime, version, branch}
}

/**
 * Logs build metadata for debugging
 * @async
 */
const logBuildInfo = async () => {
    const {buildTime, version, branch} = await getBuildMetadata()
    console.info(`[Service Worker] LGS1920 Studio - Build Time: ${buildTime}, Version: ${version}, Branch: ${branch}`)
}

/**
 * Notifies clients of a new version with build metadata
 * @async
 */
const notifyNewVersion = async () => {
    try {
        const {buildTime, version, branch} = await getBuildMetadata()
        const clients = await self.clients.matchAll({includeUncontrolled: true})
        const message = {
            type: 'NEW_VERSION',
            buildTime,
            version,
            branch,
        }
        clients.forEach(client => client.postMessage(message))
        console.info('[Service Worker] New version notification sent:', message)
    }
    catch (error) {
        console.error('[Service Worker] Failed to notify clients:', error)
    }
}

/**
 * Checks if a new version is available by comparing build metadata with stored values in Cache Storage
 * Stores current metadata in Cache Storage for future comparisons
 * @async
 * @returns {Promise<boolean>} True if a new version is detected
 */
const isNewVersionAvailable = async () => {
    try {
        const currentMetadata = await getBuildMetadata()
        // Open environment-specific cache
        const cache = await caches.open(getCacheName())
        // Retrieve previous metadata from cache
        const cachedResponse = await cache.match('build_metadata')
        const previousMetadata = cachedResponse ? await cachedResponse.json() : {}

        // Compare current and previous metadata
        const isNew =
                  previousMetadata.buildTime !== currentMetadata.buildTime ||
                  previousMetadata.version !== currentMetadata.version ||
                  previousMetadata.branch !== currentMetadata.branch

        // Store current metadata in cache
        await cache.put(
            'build_metadata',
            new Response(JSON.stringify(currentMetadata), {
                headers: {'Content-Type': 'application/json'},
            }),
        )

        return isNew
    }
    catch (error) {
        console.error('[Service Worker] Failed to check version in Cache Storage:', error)
        return false
    }
}

// Install event
self.addEventListener('install', event => {
    console.info('[Service Worker] Installing...')
    event.waitUntil(
        (async () => {
            try {
                await logBuildInfo()
                // Do not call skipWaiting automatically - controlled by AppUpdateManager
                console.info('[Service Worker] Installation complete - awaiting activation')
            }
            catch (error) {
                console.error('[Service Worker] Installation failed:', error)
            }
        })()
    )
})

// Activate event
self.addEventListener('activate', event => {
    console.info('[Service Worker] Activating...')
    event.waitUntil(
        (async () => {
            try {
                await self.clients.claim()
                // Notify clients if a new version is detected
                if (await isNewVersionAvailable()) {
                    await notifyNewVersion()
                }
                console.info('[Service Worker] Activation complete')
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
        console.info('[Service Worker] Skip waiting requested')
        self.skipWaiting()
    }
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