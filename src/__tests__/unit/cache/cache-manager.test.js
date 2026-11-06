/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cache-manager.test.js
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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { CacheManager } from '@Core/cache/CacheManager'
import { CartographicCacheController, $cartographicCache } from '@Core/cache/CartographicCacheController'

/** Create a controllable service worker channel and lifecycle boundary. */
const bridgeFixture = () => {
    const channels = []
    class TestMessageChannel {
        /** Create channel ports whose acknowledgements are explicitly controlled. */
        constructor() {
            this.port1 = {close: vi.fn(), onmessage: null, onmessageerror: null}
            this.port2 = {close: vi.fn()}
            channels.push(this)
        }
    }
    const serviceWorker = {
        controller: {postMessage: vi.fn()},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }
    vi.stubGlobal('MessageChannel', TestMessageChannel)
    vi.stubGlobal('navigator', {serviceWorker})
    return {channels, serviceWorker}
}

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('CacheManager acknowledged commands', () => {
    it('resolves an acknowledgement and releases both ports', async () => {
        const {channels, serviceWorker} = bridgeFixture()
        const manager = new CacheManager()
        const response = manager.getStatus()
        expect(serviceWorker.controller.postMessage.mock.calls[0][0].type).toBe('GET_TILE_CACHE_STATUS')
        channels[0].port1.onmessage({data: {usage: 120, available: true}})
        await expect(response).resolves.toMatchObject({usage: 120})
        expect(channels[0].port1.close).toHaveBeenCalledOnce()
        expect(channels[0].port2.close).toHaveBeenCalledOnce()
    })

    it('waits for purge completion and scopes Ion purges independently', async () => {
        const {channels, serviceWorker} = bridgeFixture()
        const response = new CacheManager('cesium-ion-assets').clear()
        expect(serviceWorker.controller.postMessage.mock.calls[0][0]).toMatchObject({type: 'CLEAR_CACHE', scope: 'ion'})
        channels[0].port1.onmessage({data: {available: true, usage: 0}})
        await expect(response).resolves.toMatchObject({usage: 0})
    })

    it('clears every tile partition and deletes app-data metadata through acknowledged commands', async () => {
        const {channels, serviceWorker} = bridgeFixture()
        const manager = new CacheManager()
        const clearResponse = manager.clearAll()
        expect(serviceWorker.controller.postMessage.mock.calls[0][0]).toMatchObject({type: 'CLEAR_CACHE', scope: 'all'})
        channels[0].port1.onmessage({data: {available: true, usage: 0, entries: 0}})
        await expect(clearResponse).resolves.toMatchObject({entries: 0})

        const deleteResponse = manager.deleteAll()
        expect(serviceWorker.controller.postMessage.mock.calls[1][0]).toMatchObject({type: 'CLEAR_CACHE', scope: 'app-data'})
        channels[1].port1.onmessage({data: {available: true, usage: 0, entries: 0}})
        await expect(deleteResponse).resolves.toMatchObject({entries: 0})
    })

    it('waits for acknowledgement before clearing private tile partitions', async () => {
        const {channels, serviceWorker} = bridgeFixture()
        const response = new CacheManager().clearPrivate()
        expect(serviceWorker.controller.postMessage.mock.calls[0][0]).toMatchObject({type: 'CLEAR_CACHE', scope: 'private'})
        channels[0].port1.onmessage({data: {available: true, usage: 0, entries: 0}})
        await expect(response).resolves.toMatchObject({entries: 0})
    })

    it('does not report deletion success when the service worker is unavailable', async () => {
        vi.stubGlobal('navigator', {})
        await expect(new CacheManager().deleteAll()).rejects.toThrow('Service workers are unavailable')
    })

    it('rejects a missing acknowledgement within a bounded timeout', async () => {
        vi.useFakeTimers()
        const {channels} = bridgeFixture()
        const response = new CacheManager().getStatus()
        const assertion = expect(response).rejects.toThrow('did not respond')
        await vi.advanceTimersByTimeAsync(8000)
        await assertion
        expect(channels[0].port1.close).toHaveBeenCalledOnce()
        expect(channels[0].port2.close).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('returns an unavailable state when the page is not controlled', async () => {
        vi.stubGlobal('navigator', {})
        await expect(new CacheManager().getStatus()).resolves.toMatchObject({available: false, usage: 0, reason: expect.stringContaining('Service workers are unavailable')})
        const {serviceWorker} = bridgeFixture()
        serviceWorker.controller = null
        await expect(new CacheManager().getStatus()).resolves.toMatchObject({available: false, reason: expect.stringContaining('no active service worker')})
    })

    it('cleans up ports and rejects when posting fails', async () => {
        const {channels, serviceWorker} = bridgeFixture()
        serviceWorker.controller.postMessage.mockImplementation(() => { throw new Error('Worker stopped') })
        await expect(new CacheManager().clear()).rejects.toThrow('Worker stopped')
        expect(channels[0].port1.close).toHaveBeenCalledOnce()
    })
})

describe('cartographic preference lifecycle', () => {
    it('publishes the unavailable reason and clears it after recovery', async () => {
        const bridge = new CacheManager()
        vi.spyOn(bridge, 'getStatus')
            .mockResolvedValueOnce({available: false, reason: 'This page has no active service worker.'})
            .mockRejectedValueOnce(new Error('The cartographic cache did not respond.'))
            .mockResolvedValueOnce({available: true, usage: 10})
        const controller = new CartographicCacheController(bridge)
        try {
            Object.assign($cartographicCache, {checking: true, error: ''})
            await controller.refresh()
            expect($cartographicCache).toMatchObject({checking: false, available: false, error: 'This page has no active service worker.'})
            await controller.refresh()
            expect($cartographicCache.error).toBe('The cartographic cache did not respond.')
            await controller.refresh()
            expect($cartographicCache).toMatchObject({checking: false, available: true, error: ''})
        }
        finally { controller.destroy() }
    })

    it('normalizes hydration and synchronizes changes without duplicate listeners', async () => {
        const {serviceWorker} = bridgeFixture()
        const bridge = new CacheManager()
        const configured = vi.spyOn(bridge, 'configure').mockResolvedValue({available: true})
        vi.stubGlobal('lgs', {settings: {app: proxy({tileCacheMaxBytes: 'broken'}), layers: proxy({providers: []})}})
        const controller = new CartographicCacheController(bridge)
        try {
            controller.init()
            expect(lgs.settings.app.tileCacheMaxBytes).toBe(512 * 1024 ** 2)
            expect(configured).toHaveBeenCalledWith(512 * 1024 ** 2, [])
            lgs.settings.app.tileCacheMaxBytes = 1024 ** 3
            await Promise.resolve()
            expect(configured).toHaveBeenLastCalledWith(1024 ** 3, [])
            controller.init()
            expect(serviceWorker.removeEventListener).toHaveBeenCalledOnce()
        }
        finally { controller.destroy() }
        expect(serviceWorker.removeEventListener).toHaveBeenCalledTimes(2)
    })

    it('awaits complete cache deletion before publishing success', async () => {
        const bridge = new CacheManager()
        const controller = new CartographicCacheController(bridge)
        const deleted = vi.fn(async () => ({available: true, usage: 0, entries: 0}))
        bridge.deleteAll = deleted
        try {
            await expect(controller.deleteAll()).resolves.toMatchObject({entries: 0})
            expect(deleted).toHaveBeenCalledOnce()
            expect($cartographicCache).toMatchObject({available: true, usage: 0, entries: 0})
        }
        finally { controller.destroy() }
    })

    it('prevents an obsolete diagnostics result from replacing newer usage', async () => {
        let resolveOld
        const old = new Promise(resolve => { resolveOld = resolve })
        const bridge = new CacheManager()
        const status = vi.spyOn(bridge, 'getStatus').mockReturnValueOnce(old)
            .mockResolvedValueOnce({available: true, usage: 20})
        const controller = new CartographicCacheController(bridge)
        try {
            const first = controller.refresh()
            await controller.refresh()
            resolveOld({available: true, usage: 10})
            await first
            expect($cartographicCache.usage).toBe(20)
            expect(status).toHaveBeenCalledTimes(2)
        }
        finally { controller.destroy() }
    })
})
