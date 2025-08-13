
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-pwa.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-12
 * Last modified: 2025-08-12
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Service Worker for Git tag version detection
 * @module ServiceWorkerConfig
 */

/**
 * Current git tag (injected during deployment, fallback for development)
 */
const CURRENT_GITTAG = typeof __GITTAG__ !== 'undefined' ? __GITTAG__ : `dev-local-${Date.now()}`

/**
 * Logs the git tag information to console
 */
const logGitTagInfo = () => {
    console.log(`[Service Worker] LGS1920 Studio - Git Tag: ${CURRENT_GITTAG}`)
}

/**
 * Notifies all clients about a new git tag
 */
const notifyNewVersion = async () => {
    try {
        const clients = await self.clients.matchAll({includeUncontrolled: true})
        const message = {
            type: 'NEW_VERSION',
            tag:  CURRENT_GITTAG,  // Utilise 'tag' comme dans AppUpdateManager
        }

        clients.forEach(client => {
            client.postMessage(message)
        })

        console.log('[Service Worker] New version notification sent:', message)
    }
    catch (error) {
        console.error('[Service Worker] Failed to notify clients:', error)
    }
}

/**
 * Handles Service Worker installation
 */
const handleInstall = event => {
    console.log('[Service Worker] Installing...')
    event.waitUntil(
        (async () => {
            try {
                logGitTagInfo()
                // Ne pas faire skipWaiting automatiquement
                console.log('[Service Worker] Installation complete - waiting for activation')
            }
            catch (error) {
                console.error('[Service Worker] Installation failed:', error)
            }
        })(),
    )
}

/**
 * Handles Service Worker activation
 */
const handleActivate = event => {
    console.log('[Service Worker] Activating...')
    event.waitUntil(
        (async () => {
            try {
                await self.clients.claim()
                // Notifier après activation
                await notifyNewVersion()
                console.log('[Service Worker] Activation complete')
            }
            catch (error) {
                console.error('[Service Worker] Activation failed:', error)
            }
        })(),
    )
}

/**
 * Simple fetch handler - no caching
 */
const handleFetchEvent = event => {
    event.respondWith(fetch(event.request))
}

// Register event listeners
self.addEventListener('install', handleInstall)
self.addEventListener('activate', handleActivate)
self.addEventListener('fetch', handleFetchEvent)

// Handle messages from clients
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Skip waiting requested')
        self.skipWaiting()
    }

    if (event.data && event.data.type === 'GET_GITTAG') {
        event.source.postMessage({
                                     type: 'GITTAG_RESPONSE',
                                     tag:  CURRENT_GITTAG,
                                 })
    }
})