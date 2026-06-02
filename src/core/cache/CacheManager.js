/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CacheManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * CacheManager: Controls the persistent Cesium cache.
 * Provides a robust interface to communicate with the LGS1920 Service Worker.
 */
export class CacheManager {
    /**
     * @param {string} cacheName
     * @param {number} maxQuota
     */
    constructor(cacheName, maxQuota) {
        this.cacheName = cacheName
        this.maxQuota = maxQuota
        this.sourceTag = 'LGS_CACHE_MANAGER'
        this._initListeners()
    }

    /**
     * Initializes listener for messages received from the Service Worker.
     * Dispatches global CustomEvents for UI updates.
     * @private
     */
    _initListeners() {
        // Correct target: navigator.serviceWorker
        if (!('serviceWorker' in navigator)) {
            return
        }

        // Utilisation de navigator.serviceWorker au lieu de navigator
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.source !== this.sourceTag) {
                return
            }

            if (event.data.type === 'BROADCAST_EVENT') {
                window.dispatchEvent(new CustomEvent(event.data.eventName, {
                    detail: event.data.payload,
                }))
            }
        })
    }

    /**
     * Calculates the current cache usage (in bytes) for Cesium assets.
     * @returns {Promise<number>}
     */
    async getUsage() {
        return new Promise((resolve) => {
            const channel = new MessageChannel()
            channel.port1.onmessage = (e) => resolve(e.data.usage)

            const sw = navigator.serviceWorker.controller
            if (sw) {
                const name = typeof this.cacheName === 'string'
                             ? this.cacheName
                             : this.cacheName.cacheName

                sw.postMessage(
                    {
                        type:      'GET_USAGE',
                        source:    this.sourceTag,
                        cacheName: name,
                    },
                    [channel.port2],
                )
            }
            else {
                resolve(0)
            }
        })
    }

    /**
     * Purges the entire Cesium cache via the Service Worker.
     * Triggers a 'lgs:cache-cleared' event upon success.
     */
    clear() {
        const sw = navigator.serviceWorker.controller
        if (sw) {
            const name = typeof this.cacheName === 'string'
                         ? this.cacheName
                         : this.cacheName.cacheName

            sw.postMessage({
                               type:      'CLEAR_CACHE',
                               source:    this.sourceTag,
                               cacheName: name,
                           })
        }
    }
}