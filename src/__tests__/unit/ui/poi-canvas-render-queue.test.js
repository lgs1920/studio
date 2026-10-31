/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-canvas-render-queue.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {createPOICanvasRenderQueue} from '@Components/MainUI/MapPOI/poiCanvasRenderQueue'

describe('POI canvas render queue', () => {
    it('limits concurrent captures while draining pending POIs', async () => {
        const enqueue = createPOICanvasRenderQueue(2)
        const started = []
        const resolvers = new Map()
        let active = 0
        let maxActive = 0

        for (let index = 0; index < 5; index++) {
            enqueue(index, () => {
                started.push(index)
                active++
                maxActive = Math.max(maxActive, active)
                return new Promise(resolve => {
                    resolvers.set(index, () => {
                        active--
                        resolve()
                    })
                })
            })
        }

        await vi.waitFor(() => expect(started).toEqual([0, 1]))
        expect(maxActive).toBe(2)

        resolvers.get(0)()
        await vi.waitFor(() => expect(started).toEqual([0, 1, 2]))
        resolvers.get(1)()
        await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]))
        resolvers.get(2)()
        await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3, 4]))
        resolvers.get(3)()
        resolvers.get(4)()
        await vi.waitFor(() => expect(active).toBe(0))

        expect(maxActive).toBe(2)
    })

    it('keeps only the newest pending capture for a POI', async () => {
        const enqueue = createPOICanvasRenderQueue(1)
        let releaseActive
        const activeCapture = new Promise(resolve => {
            releaseActive = resolve
        })
        const captureSuperseded = vi.fn()
        const captureLatest = vi.fn()

        enqueue('active', () => activeCapture)
        enqueue('queued-poi', captureSuperseded)
        enqueue('queued-poi', captureLatest)

        releaseActive()
        await vi.waitFor(() => expect(captureLatest).toHaveBeenCalledOnce())
        expect(captureSuperseded).not.toHaveBeenCalled()
    })

    it('runs an interactive expansion before older queued POI captures', async () => {
        const enqueue = createPOICanvasRenderQueue(1)
        let releaseActive
        const activeCapture = new Promise(resolve => {
            releaseActive = resolve
        })
        const started = []

        enqueue('active', () => activeCapture)
        enqueue('older', () => started.push('older'))
        enqueue('clicked', () => started.push('clicked'), {priority: true})

        releaseActive()
        await vi.waitFor(() => expect(started[0]).toBe('clicked'))
        await vi.waitFor(() => expect(started).toEqual(['clicked', 'older']))
    })
})
