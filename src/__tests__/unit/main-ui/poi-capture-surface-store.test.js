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
    it('bounds routine surfaces and promotes queued POIs when a surface is released', () => {
        const store = createPOICaptureSurfaceStore(2)
        store.request('poi-1')
        store.request('poi-2')
        store.request('poi-3')

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

    it('promotes the highest-priority pending POI first', () => {
        const store = createPOICaptureSurfaceStore(1)
        store.request('poi-1')
        store.request('poi-2')
        store.request('poi-3', {priority: true})

        store.release('poi-1')

        expect(store.getSnapshot('poi-2')).toBe(false)
        expect(store.getSnapshot('poi-3')).toBe(true)
    })

    it('keeps a retained overflow surface without blocking a freed routine slot', () => {
        const store = createPOICaptureSurfaceStore(2)
        store.request('poi-1')
        store.request('poi-2')
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
})
