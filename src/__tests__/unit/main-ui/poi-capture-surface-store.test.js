/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-capture-surface-store.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {createPOICaptureSurfaceStore} from '@Components/MainUI/MapPOI/poiCaptureSurfaceStore'

describe('POI capture surface scheduler', () => {
    it('bounds routine surfaces and promotes queued POIs when a surface is released', async () => {
        const store = createPOICaptureSurfaceStore(2)
        store.request('poi-1')
        store.request('poi-2')
        store.request('poi-3')
        await Promise.resolve()

        expect(['poi-1', 'poi-2', 'poi-3'].map(poiId => store.getSnapshot(poiId))).toEqual([
            true,
            true,
            false,
        ])

        store.release('poi-1')

        expect(['poi-1', 'poi-2', 'poi-3'].map(poiId => store.getSnapshot(poiId))).toEqual([
            false,
            true,
            true,
        ])
    })

    it('promotes the highest-priority pending POI first', async () => {
        const store = createPOICaptureSurfaceStore(1)
        store.request('poi-1')
        await Promise.resolve()
        store.request('poi-2')
        store.request('poi-3', {priority: true})

        store.release('poi-1')

        expect(store.getSnapshot('poi-2')).toBe(false)
        expect(store.getSnapshot('poi-3')).toBe(true)
    })

    it('mounts urgent Replay work in the overflow slot while a background surface waits', async () => {
        const store = createPOICaptureSurfaceStore(1)
        store.request('background-poi')
        await Promise.resolve()

        store.request('animated-poi', {priority: true, allowOverflow: true})

        expect(store.getActiveSnapshot()).toEqual(['background-poi', 'animated-poi'])
        store.release('animated-poi')
        expect(store.getActiveSnapshot()).toEqual(['background-poi'])
    })

    it('keeps a retained overflow surface without blocking a freed routine slot', async () => {
        const store = createPOICaptureSurfaceStore(2)
        store.request('poi-1')
        store.request('poi-2')
        await Promise.resolve()
        store.request('poi-3')
        const releaseRetainedSurface = store.retain('poi-4')

        expect(store.getSnapshot('poi-4')).toBe(true)
        expect(store.getSnapshot('poi-3')).toBe(false)

        store.release('poi-1')

        expect(store.getSnapshot('poi-2')).toBe(true)
        expect(store.getSnapshot('poi-3')).toBe(true)
        expect(store.getSnapshot('poi-4')).toBe(true)

        releaseRetainedSurface()

        expect(store.getSnapshot('poi-4')).toBe(false)
        expect(store.getSnapshot('poi-2')).toBe(true)
        expect(store.getSnapshot('poi-3')).toBe(true)
    })

    it('prioritizes visible nearby POIs and promotes the oldest request after a bounded burst', async () => {
        const store = createPOICaptureSurfaceStore(1)
        const visiblePOIs = ['visible-1', 'visible-2', 'visible-3', 'visible-4', 'visible-5']

        store.request('oldest-offscreen', {getPriority: () => 0})
        visiblePOIs.forEach((poiId, index) => {
            store.request(poiId, {getPriority: () => 10 - index})
        })
        await Promise.resolve()

        expect(store.getActiveSnapshot()).toEqual(['visible-1'])
        for (const poiId of visiblePOIs.slice(0, 4)) {
            expect(store.getActiveSnapshot()).toEqual([poiId])
            store.release(poiId)
        }

        expect(store.getActiveSnapshot()).toEqual(['oldest-offscreen'])
    })
})
