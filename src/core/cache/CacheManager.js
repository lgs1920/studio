/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CacheManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-18
 * Last modified: 2026-10-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_TILE_CACHE_BYTES } from '../../../public/cartographic-cache-policy.js'

/** Communicate with the cartographic service worker using bounded acknowledgements. */
export class CacheManager {
    /** Create a cartographic bridge, retaining the legacy Ion scope identifier. */
    constructor(cacheName = 'cartographic', maxQuota = DEFAULT_TILE_CACHE_BYTES) {
        this.cacheName = cacheName
        this.maxQuota = maxQuota
    }

    /** Send one command, closing both ports on success, failure, or timeout. */
    request = (type, payload = {}) => {
        const controller = globalThis.navigator?.serviceWorker?.controller
        if (!controller || typeof MessageChannel !== 'function') {
            const reason = !globalThis.navigator?.serviceWorker
                ? 'Service workers are unavailable in this browser or connection.'
                : !controller
                    ? 'This page has no active service worker. Reload Studio after the worker activates.'
                    : 'Communication with the service worker is unavailable.'
            return Promise.resolve({available: false, usage: 0, maxBytes: this.maxQuota, effectiveMaxBytes: 0, reason})
        }
        return new Promise((resolve, reject) => {
            const channel = new MessageChannel()
            /** Release the timeout and channel after completing the command. */
            const finish = (result, error) => {
                clearTimeout(timeout)
                channel.port1.close()
                channel.port2.close()
                if (error) reject(error)
                else resolve(result)
            }
            const timeout = setTimeout(() => finish(null, new Error('The cartographic cache did not respond.')), 8000)
            channel.port1.onmessage = event => {
                if (event.data?.error) finish(null, new Error('The cartographic cache is unavailable.'))
                else finish(event.data)
            }
            channel.port1.onmessageerror = () => finish(null, new Error('The cartographic cache response could not be read.'))
            try { controller.postMessage({source: 'LGS_CACHE_MANAGER', type, ...payload}, [channel.port2]) }
            catch (error) { finish(null, error) }
        })
    }

    /** Return the tracked payload usage without rereading all cached tiles. */
    getUsage = async () => (await this.getStatus()).usage

    /** Return the configured budget, effective budget, and cached usage. */
    getStatus = () => this.request('GET_TILE_CACHE_STATUS')

    /** Apply the global cartographic budget and explicit provider routing rules. */
    configure = (maxBytes, rules) => {
        this.maxQuota = maxBytes
        return this.request('CONFIGURE_TILE_CACHE', {maxBytes, rules})
    }

    /** Purge only the requested cartographic scope and await completion. */
    clear = () => this.request('CLEAR_CACHE', {scope: this.cacheName === 'cesium-ion-assets' ? 'ion' : 'all'})
}
