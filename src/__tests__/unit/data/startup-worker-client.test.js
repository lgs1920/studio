/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startup-worker-client.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {StartupWorkerClient, yieldStartupIdleTask} from '@Core/ui/startup/StartupWorkerClient'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('startup worker client', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('uses an idle callback for deferred startup work', async () => {
        const requestIdleCallback = vi.fn(callback => {
            callback()
            return 1
        })
        vi.stubGlobal('requestIdleCallback', requestIdleCallback)

        await yieldStartupIdleTask()

        expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {timeout: 500})
    })

    it('wraps application requests in the worker protocol envelope', async () => {
        const worker = {
            onmessage:   null,
            onmessageerror: null,
            onerror:     null,
            postMessage: vi.fn(message => {
                if (message.type === 'request') {
                    queueMicrotask(() => worker.onmessage?.({
                                                                     data: {
                                                                         result: true,
                                                                         type:   'done',
                                                                     },
                                                                 }))
                }
            }),
            terminate: vi.fn(),
        }
        const client = new StartupWorkerClient(worker)

        await expect(client.request({
                                        database: 'studio-db',
                                        type:     'journey',
                                    })).resolves.toBe(true)

        expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            database:   'studio-db',
            requestType: 'journey',
            requestId:  1,
            type:       'request',
        }))
    })

    it('rejects and terminates a worker request that exceeds its timeout', async () => {
        vi.useFakeTimers()
        const worker = {
            onmessage: null,
            onmessageerror: null,
            onerror: null,
            postMessage: vi.fn(),
            terminate: vi.fn(),
        }
        const client = new StartupWorkerClient(worker, {requestTimeout: 1000})
        const request = client.request({type: 'journey'})

        const rejection = expect(request).rejects.toThrow('timed out after 1000 ms; no packet received')
        await vi.advanceTimersByTimeAsync(1000)

        await rejection
        expect(worker.postMessage).toHaveBeenCalledWith({type: 'cancel', requestId: 1})
        expect(worker.terminate).toHaveBeenCalledOnce()
    })
})
