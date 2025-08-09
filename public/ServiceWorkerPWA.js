/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ServiceWorkerCacheManagement.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-09
 * Last modified: 2025-08-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

    // Cache name for storing resources
const CACHE_NAME = 'lgs1920-studio-v1';

// URLs to cache during installation
const urlsToCache = [
    '/',
    '/static/js/bundle.js',
    '/static/css/main.css',
    '/manifest.json',
];

/**
 * Handles the Service Worker installation event.
 * Opens the cache and adds specified resources from urlsToCache.
 * @param {ExtendableEvent} event - The install event triggered by the Service Worker.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[ServiceWorker] Opening cache: ${CACHE_NAME}`)
                return cache.addAll(urlsToCache)
                    .catch((error) => {
                        console.error(`[ServiceWorker] Cache add failed: ${error}`)
                        throw error
                    })
            })
            .then(() => {
                console.log('[ServiceWorker] Installation successful')
                // Force immediate activation
                return self.skipWaiting()
            })
            .catch((error) => {
                console.error(`[ServiceWorker] Installation error: ${error}`)
            }),
    )
});

/**
 * Handles the Service Worker activation event.
 * Deletes outdated caches that don't match the current CACHE_NAME.
 * @param {ExtendableEvent} event - The activate event triggered by the Service Worker.
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log(`[ServiceWorker] Deleting outdated cache: ${cacheName}`)
                            return caches.delete(cacheName)
                        }
                    }),
                )
            })
            .then(() => {
                console.log('[ServiceWorker] Activation successful')
                // Take immediate control of pages
                return self.clients.claim()
            })
            .catch((error) => {
                console.error(`[ServiceWorker] Activation error: ${error}`)
            }),
    )
});

/**
 * Handles fetch requests using a Cache First strategy.
 * Checks the cache first, then falls back to the network if needed.
 * @param {FetchEvent} event - The fetch event triggered by a network request.
 */
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests (e.g., POST)
    if (event.request.method !== 'GET') {
        return
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if available
                if (response) {
                    console.log(`[ServiceWorker] Cache hit for: ${event.request.url}`)
                    return response
                }

                // Otherwise, fetch from network
                console.log(`[ServiceWorker] Network fetch for: ${event.request.url}`)
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Validate response before caching
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse
                        }

                        // Clone response for caching
                        const responseToCache = networkResponse.clone()
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache)
                                console.log(`[ServiceWorker] Cached: ${event.request.url}`)
                            })
                            .catch((error) => {
                                console.error(`[ServiceWorker] Cache put error: ${error}`)
                            })

                        return networkResponse
                    })
                    .catch((error) => {
                        console.error(`[ServiceWorker] Network error for: ${event.request.url}`, error)
                        // TODO: Return fallback response (e.g., offline page)
                    });
            })
    );
});