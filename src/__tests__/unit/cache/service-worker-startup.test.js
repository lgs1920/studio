/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: service-worker-startup.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-25
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

/** Capture the service worker's public fetch events in an isolated environment. */
const loadWorker = async ({fetch, storage}) => {
    vi.resetModules()
    const listeners = new Map()
    vi.stubGlobal('self', {
        location:        {origin: 'https://studio.example'},
        addEventListener: (type, listener) => listeners.set(type, listener),
    })
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('caches', storage)
    await import('../../../../public/service-worker-pwa.js')

    /** Dispatch a request and capture its response and background work. */
    return path => {
        const request = new Request(new URL(path, self.location.origin))
        const event = {request, respondWith: vi.fn(), waitUntil: vi.fn()}
        listeners.get('fetch')(event)
        return {response: event.respondWith.mock.calls[0][0], waitUntil: event.waitUntil}
    }
}

describe('Studio service worker startup requests', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('starts configuration and module requests while cache storage is blocked', async () => {
        const cacheOpened = Promise.withResolvers()
        const releaseCache = Promise.withResolvers()
        const fetchStarted = Promise.withResolvers()
        const storage = {
            open: vi.fn(() => {
                cacheOpened.resolve('cache')
                return releaseCache.promise
            }),
        }
        const fetch = vi.fn(async request => {
            const path = new URL(request.url).pathname
            if (path === '/src/main.mjs') {
                fetchStarted.resolve('network')
            }
            const response = new Response(path)
            Object.defineProperty(response, 'type', {value: 'basic'})
            return response
        })
        const request = await loadWorker({fetch, storage})
        const module = request('/src/main.mjs')
        const settings = request('/settings.yaml')
        try {
            expect(await Promise.race([fetchStarted.promise, cacheOpened.promise])).toBe('network')
            expect(await (await module.response).text()).toBe('/src/main.mjs')
            expect(await (await settings.response).text()).toBe('/settings.yaml')
        }
        finally {
            releaseCache.resolve({put: vi.fn()})
            await Promise.allSettled([module.response, settings.response])
            await Promise.allSettled([...module.waitUntil.mock.calls.flat(), ...settings.waitUntil.mock.calls.flat()])
        }
    })

    it('sends backend startup requests without initializing the cartographic cache', async () => {
        const fetch = vi.fn(async () => Response.json({alive: true}))
        const storage = {open: vi.fn(async () => { throw new Error('Cache storage should not be opened') })}
        const request = await loadWorker({fetch, storage})

        for (const url of ['http://dev.lgs1920.fr:3333/ping', 'http://dev.lgs1920.fr:3333/versions']) {
            const result = request(url)
            await result.response
            await Promise.all(result.waitUntil.mock.calls.flat())
        }

        expect(fetch).toHaveBeenCalledTimes(2)
        expect(storage.open).not.toHaveBeenCalled()
    })

    it('routes local POI icons and welcome videos without opening cartographic caches', async () => {
        const fetch = vi.fn(async request => new Response(new URL(request.url).pathname))
        const appCache = {match: vi.fn(async () => null), put: vi.fn(async () => {})}
        const storage = {
            open: vi.fn(async name => {
                if (name.startsWith('lgs-cartographic-')) {
                    throw new Error('Local assets must not open cartographic caches')
                }
                return appCache
            }),
        }
        const request = await loadWorker({fetch, storage})

        for (const path of ['/icons/poi.svg', '/videos/welcome.mp4']) {
            const result = request(path)
            expect(await (await result.response).text()).toBe(path)
            await Promise.all(result.waitUntil.mock.calls.flat())
        }

        expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url: 'https://studio.example/icons/poi.svg'}))
        expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url: 'https://studio.example/videos/welcome.mp4'}))
        expect(storage.open.mock.calls.every(([name]) => !name.startsWith('lgs-cartographic-'))).toBe(true)
    })

    it('routes same-origin WMS proxy tiles through cartographic cache policy', async () => {
        const fetch = vi.fn(async () => new Response('proxy tile'))
        const storage = {open: vi.fn(async () => ({match: vi.fn(), put: vi.fn()}))}
        const request = await loadWorker({fetch, storage})
        const source = encodeURIComponent('https://wms.example/map?SERVICE=WMS&REQUEST=GetMap&LAYERS=public-map')

        const result = request(`/proxy.php?csurl=${source}`)

        expect(await (await result.response).text()).toBe('proxy tile')
        expect(fetch).toHaveBeenCalledOnce()
        expect(storage.open.mock.calls.some(([name]) => name.startsWith('lgs-cartographic-'))).toBe(true)
        expect(storage.open.mock.calls.some(([name]) => name.startsWith('lgs-studio-'))).toBe(false)
    })

    it('serves a cached startup module after a network failure', async () => {
        const fetch = vi.fn(async request => {
            if (request instanceof Request) {
                throw new Error('Offline')
            }
            return Response.json({})
        })
        const match = vi.fn(async () => new Response('cached module'))
        const storage = {open: vi.fn(async () => ({match}))}
        const request = await loadWorker({fetch, storage})

        expect(await (await request('/src/main.mjs').response).text()).toBe('cached module')
        expect(match).toHaveBeenCalledWith(expect.objectContaining({url: 'https://studio.example/src/main.mjs'}))
        expect(storage.open).toHaveBeenCalledTimes(1)
    })

    it('revalidates source modules and honors the browser cache for Vite fingerprints', async () => {
        const fetch = vi.fn(async () => new Response('module'))
        const request = await loadWorker({fetch, storage: {open: vi.fn()}})

        await request('/src/main.mjs').response
        await request('/node_modules/.vite/deps/cesium.js?v=1234').response

        expect(fetch).toHaveBeenNthCalledWith(1, expect.objectContaining({cache: 'no-cache'}))
        expect(fetch).toHaveBeenNthCalledWith(2, expect.objectContaining({cache: 'default'}))
    })
})
