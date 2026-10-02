/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-update-manager.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-18
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

describe('AppUpdateManager webapp updates', () => {
    const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')

    afterEach(() => {
        globalThis.lgs = undefined
        if (serviceWorkerDescriptor) {
            Object.defineProperty(navigator, 'serviceWorker', serviceWorkerDescriptor)
        }
        else {
            delete navigator.serviceWorker
        }
        vi.unstubAllEnvs()
        vi.resetModules()
    })

    it('automatically activates a new service worker outside the installed PWA', async () => {
        vi.stubEnv('DEV', false)
        const serviceWorkerListeners = new Map()
        const waitingWorker = {
            postMessage: vi.fn(),
        }
        const registration = {
            addEventListener: vi.fn(),
            update: vi.fn().mockResolvedValue(),
            waiting: waitingWorker,
        }
        const serviceWorker = {
            addEventListener: vi.fn((eventName, listener) => serviceWorkerListeners.set(eventName, listener)),
            controller: {},
            getRegistration: vi.fn().mockResolvedValue(registration),
            register: vi.fn().mockResolvedValue(registration),
        }

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: serviceWorker,
        })
        globalThis.lgs = {
            pwa: false,
            stores: {
                ui: {
                    appUpdate: {},
                },
            },
        }

        const {AppUpdateManager} = await import('@Core/ui/AppUpdateManager')
        new AppUpdateManager()
        await Promise.resolve()
        await Promise.resolve()
        serviceWorkerListeners.get('message')({data: {type: 'NEW_VERSION'}})
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(waitingWorker.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'})
    })

    it('registers the app service worker in development', async () => {
        vi.stubEnv('DEV', true)
        const serviceWorkerListeners = new Map()
        const registration = {
            addEventListener: vi.fn(),
            update: vi.fn().mockResolvedValue(),
        }
        const serviceWorker = {
            addEventListener: vi.fn((eventName, listener) => serviceWorkerListeners.set(eventName, listener)),
            controller: {},
            getRegistration: vi.fn().mockResolvedValue(registration),
            register: vi.fn().mockResolvedValue(registration),
        }

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: serviceWorker,
        })
        globalThis.lgs = {
            pwa: false,
            stores: {
                ui: {
                    appUpdate: {},
                },
            },
        }

        const {AppUpdateManager} = await import('@Core/ui/AppUpdateManager')
        new AppUpdateManager()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(serviceWorker.register).toHaveBeenCalledWith('/service-worker-pwa.js', {updateViaCache: 'none'})
        expect(registration.update).toHaveBeenCalledOnce()
        expect(serviceWorkerListeners.has('controllerchange')).toBe(true)
    })
})

describe('AppUpdateManager cache reset', () => {
    const originalUtilities = window.__

    afterEach(() => {
        window.__ = originalUtilities
        globalThis.lgs = undefined
        vi.restoreAllMocks()
        vi.resetModules()
    })

    it('waits for the cache purge acknowledgement before applying the update', async () => {
        globalThis.lgs = undefined
        const {AppUpdateManager} = await import('@Core/ui/AppUpdateManager')
        const manager = new AppUpdateManager()
        const apply = vi.spyOn(manager, 'applyUpdate').mockResolvedValue()
        let acknowledge
        const clear = vi.fn(() => new Promise(resolve => { acknowledge = resolve }))
        window.__ = {app: {cesiumCache: {clear}}}

        const update = manager.applyUpdateWithCacheReset()
        expect(clear).toHaveBeenCalledOnce()
        expect(apply).not.toHaveBeenCalled()
        acknowledge()
        await update
        expect(apply).toHaveBeenCalledOnce()
    })

    it('still replaces an obsolete worker when the cache bridge cannot acknowledge', async () => {
        globalThis.lgs = undefined
        const {AppUpdateManager} = await import('@Core/ui/AppUpdateManager')
        const manager = new AppUpdateManager()
        const apply = vi.spyOn(manager, 'applyUpdate').mockResolvedValue()
        window.__ = {app: {cesiumCache: {clear: vi.fn().mockRejectedValue(new Error('Cache command timed out'))}}}

        await manager.applyUpdateWithCacheReset()
        expect(apply).toHaveBeenCalledOnce()
    })
})
