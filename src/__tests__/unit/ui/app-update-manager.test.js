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
 * Last modified: 2026-09-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

describe('AppUpdateManager webapp updates', () => {
    afterEach(() => {
        globalThis.lgs = undefined
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

    it('skips service worker registration in development by default', async () => {
        vi.stubEnv('DEV', true)
        vi.stubEnv('VITE_PWA_DEV', 'false')
        const serviceWorker = {
            addEventListener: vi.fn(),
            getRegistration: vi.fn(),
            register: vi.fn(),
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

        expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
        expect(serviceWorker.register).not.toHaveBeenCalled()
    })

    it('registers the app service worker in development when PWA testing is enabled', async () => {
        vi.stubEnv('DEV', true)
        vi.stubEnv('VITE_PWA_DEV', 'true')
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
