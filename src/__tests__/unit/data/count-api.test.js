/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: count-api.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-30
 * Last modified: 2026-07-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CountApi } from '@Utils/CountApi'

describe('CountApi', () => {
    beforeEach(() => {
        CountApi.resetSessionForTests()
        globalThis.lgs = {BACKEND_API: 'https://backend.example.test/api/'}
        vi.stubGlobal('fetch', vi.fn(async () => ({ok: true})))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        delete globalThis.lgs
    })

    it('sends each anonymous count event with the browser time zone', async () => {
        await Promise.all([
            CountApi.sendVisit(),
            CountApi.sendJourney(),
            CountApi.sendDraftVideo(),
            CountApi.sendHqVideo(),
        ])

        expect(globalThis.fetch).toHaveBeenCalledTimes(4)
        const expectedRequest = {
            method:      'POST',
            credentials: 'omit',
            headers:     {'Content-Type': 'application/json'},
            body:        JSON.stringify({timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}),
            keepalive:   true,
        }
        expect(globalThis.fetch).toHaveBeenNthCalledWith(1, 'https://backend.example.test/api/count/visit', expectedRequest)
        expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://backend.example.test/api/count/journey', expectedRequest)
        expect(globalThis.fetch).toHaveBeenNthCalledWith(3, 'https://backend.example.test/api/count/video/draft', expectedRequest)
        expect(globalThis.fetch).toHaveBeenNthCalledWith(4, 'https://backend.example.test/api/count/video/hq', expectedRequest)
    })

    it('sends one visit event per application session while counting repeated journey loads', async () => {
        await Promise.all([
            CountApi.sendVisit(),
            CountApi.sendVisit(),
            CountApi.sendJourney(),
            CountApi.sendJourney(),
        ])

        expect(globalThis.fetch).toHaveBeenCalledTimes(3)
        expect(globalThis.fetch).toHaveBeenNthCalledWith(1, 'https://backend.example.test/api/count/visit', expect.any(Object))
        expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'https://backend.example.test/api/count/journey', expect.any(Object))
        expect(globalThis.fetch).toHaveBeenNthCalledWith(3, 'https://backend.example.test/api/count/journey', expect.any(Object))
    })

    it('swallows rejected and unsuccessful count requests', async () => {
        globalThis.fetch
            .mockRejectedValueOnce(new Error('network unavailable'))
            .mockResolvedValueOnce({ok: false})

        await expect(CountApi.sendJourney()).resolves.toBe(false)
        await expect(CountApi.sendDraftVideo()).resolves.toBe(false)
        expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('does not fail when the backend is not configured', async () => {
        delete globalThis.lgs

        await expect(CountApi.sendHqVideo()).resolves.toBe(false)
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })
})
