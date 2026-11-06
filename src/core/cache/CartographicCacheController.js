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
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { proxy, subscribe } from 'valtio'
import { CacheManager } from './CacheManager'
import {buildTileCacheRules, DEFAULT_TILE_CACHE_BYTES, normalizeTileCacheBudget} from './CartographicCachePolicy'

/** Transient cache diagnostics, separate from persisted application preferences. */
export const $cartographicCache = proxy({
    usage: 0,
    entries: 0,
    maxBytes: DEFAULT_TILE_CACHE_BYTES,
    effectiveMaxBytes: 0,
    available: false,
    checking: true,
    error: '',
})

/** Own the cache preference subscription and the service worker lifecycle bridge. */
export class CartographicCacheController {
    #bridge
    #cleanup = null
    #version = 0
    #rulesSignature = ''

    /** Create the lifecycle owner with an optional isolated worker bridge. */
    constructor(bridge = new CacheManager()) {
        this.#bridge = bridge
    }

    /** Publish only the latest requested diagnostics without leaking bridge failures. */
    #update = async (operation, {throwOnError = false} = {}) => {
        const version = ++this.#version
        try {
            const result = await operation()
            if (version === this.#version) Object.assign($cartographicCache, result, {checking: false, error: result.reason ?? ''})
            return result
        }
        catch (error) {
            if (version === this.#version) Object.assign($cartographicCache, {
                available: false,
                checking: false,
                error: error instanceof Error ? error.message : 'The cartographic cache is unavailable.',
            })
            if (throwOnError) throw error
            return null
        }
    }

    /** Synchronize the current hydrated preference and credential-free source catalog. */
    configure = (force = false) => {
        const rules = buildTileCacheRules(globalThis.lgs?.settings?.layers?.providers, globalThis.location?.origin)
        const signature = JSON.stringify(rules)
        if (!force && signature === this.#rulesSignature) return Promise.resolve(null)
        this.#rulesSignature = signature
        return this.#update(() => this.#bridge.configure(
            normalizeTileCacheBudget(globalThis.lgs?.settings?.app?.tileCacheMaxBytes),
            rules,
        ))
    }

    /** Attach one preference subscription and retry configuration after worker activation. */
    init = () => {
        this.destroy()
        const $app = globalThis.lgs?.settings?.app
        const $layers = globalThis.lgs?.settings?.layers
        const serviceWorker = globalThis.navigator?.serviceWorker
        if (!$app || !$layers || !serviceWorker?.addEventListener) return
        $app.tileCacheMaxBytes = normalizeTileCacheBudget($app.tileCacheMaxBytes)
        let previous = $app.tileCacheMaxBytes
        let previousRules = JSON.stringify(buildTileCacheRules($layers.providers, globalThis.location?.origin))
        const unsubscribe = subscribe($app, () => {
            const current = normalizeTileCacheBudget($app.tileCacheMaxBytes)
            if (current === previous) return
            previous = current
            void this.configure(true)
        })
        const unsubscribeLayers = subscribe($layers, () => {
            const signature = JSON.stringify(buildTileCacheRules($layers.providers, globalThis.location?.origin))
            if (signature === previousRules) return
            previousRules = signature
            void this.configure()
        })
        const configure = () => this.configure(true)
        serviceWorker.addEventListener('controllerchange', configure)
        this.#cleanup = () => {
            unsubscribe()
            unsubscribeLayers()
            serviceWorker.removeEventListener('controllerchange', configure)
        }
        void this.configure(true)
    }

    /** Refresh usage while settings are visible or after an explicit operation. */
    refresh = () => this.#update(() => this.#bridge.getStatus())

    /** Purge cartographic resources while retaining settings and saved journeys. */
    clear = () => this.#update(() => this.#bridge.clear(), {throwOnError: true})

    /** Purge every account partition before the app removes its local databases. */
    deleteAll = () => this.#update(() => (this.#bridge.deleteAll?.() ?? this.#bridge.clearAll?.() ?? this.#bridge.clear()), {throwOnError: true})

    /** Purge account-scoped resources before Studio changes a provider credential. */
    clearPrivate = () => this.#update(() => this.#bridge.clearPrivate(), {throwOnError: true})

    /** Remove subscriptions and invalidate diagnostics from obsolete requests. */
    destroy = () => {
        this.#cleanup?.()
        this.#cleanup = null
        this.#version++
    }
}

/** Shared cartographic lifecycle owner used by startup and settings. */
export const cartographicCacheController = new CartographicCacheController()
