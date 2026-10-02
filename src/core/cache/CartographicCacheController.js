/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CartographicCacheController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { proxy, subscribe } from 'valtio'
import { CacheManager } from './CacheManager'
import { buildTileCacheRules, DEFAULT_TILE_CACHE_BYTES, normalizeTileCacheBudget } from '../../../public/cartographic-cache-policy.js'

/** Transient cache diagnostics, separate from persisted application preferences. */
export const $cartographicCache = proxy({
    usage: 0,
    entries: 0,
    maxBytes: DEFAULT_TILE_CACHE_BYTES,
    effectiveMaxBytes: 0,
    available: false,
    error: '',
})

/** Own the cache preference subscription and the service worker lifecycle bridge. */
export class CartographicCacheController {
    #bridge
    #cleanup = null
    #version = 0

    /** Create the lifecycle owner with an optional isolated worker bridge. */
    constructor(bridge = new CacheManager()) {
        this.#bridge = bridge
    }

    /** Publish only the latest requested diagnostics without leaking bridge failures. */
    #update = async operation => {
        const version = ++this.#version
        try {
            const result = await operation()
            if (version === this.#version) Object.assign($cartographicCache, result, {error: ''})
            return result
        }
        catch {
            if (version === this.#version) Object.assign($cartographicCache, {available: false, error: 'The cartographic cache is unavailable.'})
            return null
        }
    }

    /** Synchronize the current hydrated preference and credential-free source catalog. */
    configure = () => this.#update(() => this.#bridge.configure(
        normalizeTileCacheBudget(globalThis.lgs?.settings?.app?.tileCacheMaxBytes),
        buildTileCacheRules(globalThis.lgs?.settings?.layers?.providers, globalThis.location?.origin),
    ))

    /** Attach one preference subscription and retry configuration after worker activation. */
    init = () => {
        this.destroy()
        const $app = globalThis.lgs?.settings?.app
        const serviceWorker = globalThis.navigator?.serviceWorker
        if (!$app || !serviceWorker?.addEventListener) return
        $app.tileCacheMaxBytes = normalizeTileCacheBudget($app.tileCacheMaxBytes)
        let previous = $app.tileCacheMaxBytes
        const unsubscribe = subscribe($app, () => {
            const current = normalizeTileCacheBudget($app.tileCacheMaxBytes)
            if (current === previous) return
            previous = current
            void this.configure()
        })
        const configure = this.configure
        serviceWorker.addEventListener('controllerchange', configure)
        this.#cleanup = () => {
            unsubscribe()
            serviceWorker.removeEventListener('controllerchange', configure)
        }
        void this.configure()
    }

    /** Refresh usage while settings are visible or after an explicit operation. */
    refresh = () => this.#update(() => this.#bridge.getStatus())

    /** Purge cartographic resources while retaining settings and saved journeys. */
    clear = () => this.#update(() => this.#bridge.clear())

    /** Remove subscriptions and invalidate diagnostics from obsolete requests. */
    destroy = () => {
        this.#cleanup?.()
        this.#cleanup = null
        this.#version++
    }
}

/** Shared cartographic lifecycle owner used by startup and settings. */
export const cartographicCacheController = new CartographicCacheController()
