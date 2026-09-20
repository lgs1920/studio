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
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {StartupWorkerClient} from '@Core/ui/startup/StartupWorkerClient'
import {describe, expect, it, vi} from 'vitest'

describe('startup worker client', () => {
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

        expect(worker.postMessage).toHaveBeenCalledWith({
                                                           database:   'studio-db',
                                                           requestType: 'journey',
                                                           type:       'request',
                                                       })
    })
})
