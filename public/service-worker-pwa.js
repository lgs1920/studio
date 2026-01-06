/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Service Worker for LGS1920 Studio PWA - Auto-update mode
 * Automatically updates the app as soon as a new version is available
 * No user action required - skipWaiting() is called immediately on new version
 * Uses build.json, version.json, branch.json to detect changes
 * Cache name based on platform from servers.json
 */

/**
 * Generates a cache name based on the current platform (from servers.json)
 * @returns {Promise<string>} The cache name for the current environment
 */
const getCacheName = async () => {
    const servers = await fetch('servers.json').then(res => res.json())
    return servers.platform
}

/**
 * Fetches build metadata from JSON manifest files
 * @returns {Promise<{buildTime: string, version: string, branch: string}>}
 */
const getBuildMetadata = async () => {
    let buildTime = `${Date.now()}`
    let version = '0.0.0'
    let branch = 'main'

    try {
        const buildRes = await fetch('./build.json')
        if (buildRes.ok) {
            const data = await buildRes.json()
            buildTime = data.date ? `${data.date}` : buildTime
        }
    }
    catch (err) {
        console.error('[Service Worker] Failed to fetch build.json:', err)
    }

    try {
        const verRes = await fetch('./version.json')
        if (verRes.ok) {
            const data = await verRes.json()
            version = data.studio || data.backend || version
        }
    }
    catch (err) {
        console.error('[Service Worker] Failed to fetch version.json:', err)
    }

    try {
        const branchRes = await fetch('./branch.json')
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
 * Logs current build information in console (debug)
 */
const logBuildInfo = async () => {
    const {buildTime, version, branch} = await getBuildMetadata()
    console.info(`[Service Worker] LGS1920 Studio - Build: ${buildTime} | Version: ${version} | Branch: ${branch}`)
}

/**
 * Notifies all clients that a new version has been installed and activated
 */
const notifyNewVersion = async () => {
    try {
        const {buildTime, version, branch} = await getBuildMetadata()
        const clients = await self.clients.matchAll({includeUncontrolled: true})
        const message = {
            type: 'NEW_VERSION_AUTO_APPLIED',
            buildTime,
            version,
            branch,
        }
        clients.forEach(client => client.postMessage(message))
        console.info('[Service Worker] New version auto-applied and clients notified:', message)
    }
    catch (err) {
        console.error('[Service Worker] Failed to notify clients of auto-update:', err)
    }
}

/**
 * Checks if current build differs from the one stored in cache
 * Updates the stored metadata and returns true if a new version is present
 * @returns {Promise<boolean>}
 */
const isNewVersionAvailable = async () => {
    try {
        const current = await getBuildMetadata()
        const cache = await caches.open(await getCacheName())
        const cachedResp = await cache.match('build_metadata')
        const previous = cachedResp ? await cachedResp.json() : {}

        const isNew =
                  previous.buildTime !== current.buildTime ||
                  previous.version !== current.version ||
                  previous.branch !== current.branch

        // Always update stored metadata
        await cache.put(
            'build_metadata',
            new Response(JSON.stringify(current), {
                headers: {'Content-Type': 'application/json'},
            }),
        )

        return isNew
    }
    catch (err) {
        console.error('[Service Worker] Error checking version:', err)
        return false
    }
}

// ====================================
// Install
// ====================================
self.addEventListener('install', event => {
    console.info('[Service Worker] Installing new version...')
    event.waitUntil(
        (async () => {
            await logBuildInfo()
            // Force immediate activation of the new worker
            self.skipWaiting()
            console.info('[Service Worker] Installation complete - skipWaiting() called')
        })()
    )
})

// ====================================
// Activate
// ====================================
self.addEventListener('activate', event => {
    console.info('[Service Worker] Activating new version...')
    event.waitUntil(
        (async () => {
            // Take control of all clients immediately
            await self.clients.claim()

            const hasNewVersion = await isNewVersionAvailable()
            if (hasNewVersion) {
                await notifyNewVersion()
                console.info('[Service Worker] New version automatically applied')
            }
            else {
                console.info('[Service Worker] Same version - no update needed')
            }
        })()
    )
})

// ====================================
// Fetch
// ====================================
self.addEventListener('fetch', event => {
    // Simple network-first strategy (you can customize later)
    event.respondWith(fetch(event.request))
})

// ====================================
// Message (optional - kept for debug or future use)
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