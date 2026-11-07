/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-export-frame-readiness.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {qualifyReplayExportFrameReadiness} from '@Core/ui/replay/ReplayExportFrameReadiness'

describe('qualifyReplayExportFrameReadiness', () => {
    it('preserves the adaptive single-attempt timeout behavior', async () => {
        const prepareForCapture = vi.fn(async () => false)

        await expect(qualifyReplayExportFrameReadiness({
            prepareForCapture,
            policy: 'adaptive',
            maxRetries: 4,
        })).resolves.toMatchObject({status: 'timeout', attempts: 1, timeouts: 1})
        expect(prepareForCapture).toHaveBeenCalledOnce()
    })

    it('bounds strict retries and records a timeout for each failed attempt', async () => {
        const prepareForCapture = vi.fn(async () => false)

        await expect(qualifyReplayExportFrameReadiness({
            prepareForCapture,
            policy: 'strict',
            maxRetries: 2,
        })).resolves.toMatchObject({status: 'timeout', attempts: 3, timeouts: 3})
        expect(prepareForCapture).toHaveBeenCalledTimes(3)
    })

    it('returns ready only after a bounded retry succeeds', async () => {
        const prepareForCapture = vi.fn()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)

        await expect(qualifyReplayExportFrameReadiness({
            prepareForCapture,
            policy: 'strict',
            maxRetries: 2,
        })).resolves.toMatchObject({status: 'ready', attempts: 2, timeouts: 1})
    })

    it('distinguishes loading failures and cancellation', async () => {
        const failure = new Error('3D tile request failed')
        await expect(qualifyReplayExportFrameReadiness({
            prepareForCapture: async () => { throw failure },
            policy: 'strict',
        })).resolves.toMatchObject({status: 'failed', attempts: 1, error: failure})

        const abortController = new AbortController()
        abortController.abort()
        await expect(qualifyReplayExportFrameReadiness({
            prepareForCapture: vi.fn(),
            policy: 'strict',
            signal: abortController.signal,
        })).resolves.toMatchObject({status: 'cancelled', attempts: 1, error: abortController.signal.reason})
    })
})
