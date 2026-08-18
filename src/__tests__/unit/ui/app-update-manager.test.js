/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-update-manager.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {AppUpdateManager} from '@Core/ui/AppUpdateManager'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('AppUpdateManager webapp updates', () => {
    afterEach(() => {
        globalThis.lgs = undefined
    })

    it('automatically activates a new service worker outside the installed PWA', async () => {
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

        new AppUpdateManager()
        await Promise.resolve()
        await Promise.resolve()
        serviceWorkerListeners.get('message')({data: {type: 'NEW_VERSION'}})
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(waitingWorker.postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'})
    })
})
