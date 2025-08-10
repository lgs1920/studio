/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ServiceWorkerPWA.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-10
 * Last modified: 2025-08-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

    // Cache name with version for cache busting
const CACHE_NAME = 'lgs1920-studio-v0.9.0'

// URLs to cache during installation
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.webmanifest', // Updated to cache .webmanifest
    '/offline.html',
]

// Flag to track first visit and version (stored in localStorage)
const FIRST_VISIT_KEY = 'lgs1920-first-visit'
const VERSION_KEY = 'lgs1920-version'

/**
 * Checks if this is the user's first visit and shows PWA install prompt
 * @returns {Promise<void>}
 */
async function checkFirstVisitAndPromptInstall() {
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
        localStorage.setItem(FIRST_VISIT_KEY, 'true')
        // Post message to client to show install prompt
        self.clients.matchAll({includeUncontrolled: true}).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                                       type:    'SHOW_INSTALL_PROMPT',
                                       message: 'Install LGS1920 Studio as a PWA for a better experience!',
                                   })
            })
        })
    }
}

/**
 * Notifies clients about a new Service Worker version
 * @param {string} version - The current cache version
 * @returns {Promise<void>}
 */
async function notifyNewVersion(version) {
    const storedVersion = localStorage.getItem(VERSION_KEY)
    if (storedVersion !== version) {
        localStorage.setItem(VERSION_KEY, version)
        self.clients.matchAll({includeUncontrolled: true}).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                                       type:    'NEW_VERSION',
                                       message: `A new version (${version}) of LGS1920 Studio is available!`,
                                   })
            })
        })
    }
}

/**
 * Handles the Service Worker installation event
 * Caches specified resources and forces immediate activation
 * @param {ExtendableEvent} event - The install event
 * @returns {Promise<void>}
 */
self.addEventListener('install', event => {
    console.log(`[ServiceWorker] Installing ${CACHE_NAME}`)
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`[ServiceWorker] Caching resources for ${CACHE_NAME}`)
                return Promise.all(
                    urlsToCache.map(url => {
                        console.log(`[ServiceWorker] Attempting to cache: ${url}`)
                        return fetch(url).then(response => {
                            if (!response.ok) {
                                console.error(`[ServiceWorker] Failed to fetch ${url}: ${response.status}`)
                                throw new Error(`Failed to fetch ${url}`)
                            }
                            return cache.put(url, response)
                        })
                    }),
                )
            })
            .then(() => {
                console.log('[ServiceWorker] Installation successful')
                return self.skipWaiting()
            })
            .catch(error => {
                console.error(`[ServiceWorker] Installation failed: ${error}`)
                throw error
            })
    )
})

/**
 * Handles the Service Worker activation event
 * Cleans up outdated caches and takes control of clients
 * @param {ExtendableEvent} event - The activate event
 * @returns {Promise<void>}
 */
self.addEventListener('activate', event => {
    console.log(`[ServiceWorker] Activating ${CACHE_NAME}`)
    event.waitUntil(
        Promise.all([
                        // Clean up old caches
                        caches.keys().then(cacheNames => {
                            return Promise.all(
                                cacheNames.map(cacheName => {
                                    if (cacheName !== CACHE_NAME) {
                                        console.log(`[ServiceWorker] Deleting outdated cache: ${cacheName}`)
                                        return caches.delete(cacheName)
                                    }
                                }),
                            )
                        }),
                        // Notify new version
                        notifyNewVersion(CACHE_NAME),
                        // Check for first visit
                        checkFirstVisitAndPromptInstall(),
                    ])
            .then(() => {
                console.log('[ServiceWorker] Activation successful')
                return self.clients.claim()
            })
            .catch(error => {
                console.error(`[ServiceWorker] Activation failed: ${error}`)
                throw error
            })
    )
})

/**
 * Handles fetch requests using a cache-first strategy with offline fallback
 * @param {FetchEvent} event - The fetch event
 * @returns {Promise<Response>} - The cached or network response
 */
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    console.log(`[ServiceWorker] Cache hit: ${event.request.url}`)
                    return cachedResponse
                }

                console.log(`[ServiceWorker] Fetching from network: ${event.request.url}`)
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            if (event.request.url.includes('manifest.webmanifest')) {
                                console.warn('[ServiceWorker] Manifest fetch failed, serving fallback')
                                return new Response(JSON.stringify({
                                                                       name:       'LGS1920 Studio',
                                                                       short_name: 'LGS1920',
                                                                       start_url:  '/',
                                                                       display:    'standalone',
                                                                   }), {
                                                        status:  200,
                                                        headers: {'Content-Type': 'application/manifest+json'},
                                                    })
                            }
                            return networkResponse
                        }

                        const responseToCache = networkResponse.clone()
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache)
                                console.log(`[ServiceWorker] Cached: ${event.request.url}`)
                            })
                            .catch(error => {
                                console.error(`[ServiceWorker] Cache put failed: ${error}`)
                            })

                        return networkResponse
                    })
                    .catch(error => {
                        console.error(`[ServiceWorker] Network fetch failed: ${error}`)
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html')
                        }
                        throw error
                    })
            })
            .catch(error => {
                console.error(`[ServiceWorker] Cache match failed: ${error}`)
                return new Response('Offline content unavailable', {status: 503})
            })
    )
})

/**
 * Handles messages from clients (e.g., to trigger skipWaiting)
 * @param {MessageEvent} event - The message event
 */
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[ServiceWorker] Received SKIP_WAITING message')
        self.skipWaiting()
    }
})