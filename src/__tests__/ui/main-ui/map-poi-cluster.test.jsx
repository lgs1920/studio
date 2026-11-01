// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-cluster.test.jsx
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

import {act, cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/cesium/MapPOI', () => ({
    MapPOI: ({point}) => <div data-testid="projected-poi" data-poi={point}/>,
}))

import {MapPOICluster} from '@Components/MainUI/MapPOI/MapPOICluster'
import {
    clearPOIHoverTitlePreview, getActivePOIOverlayId, showPOIHoverTitlePreview,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'

afterEach(() => {
    cleanup()
    clearPOIHoverTitlePreview()
    delete globalThis.lgs
})

describe('Map POI overlay host', () => {
    it('mounts only the POI that currently owns the hover overlay', async () => {
        const canvas = document.createElement('canvas')
        globalThis.lgs = {viewer: {canvas, scene: {canvas}}}
        render(<MapPOICluster/>)

        expect(screen.queryByTestId('projected-poi')).toBeNull()

        await act(async () => {
            showPOIHoverTitlePreview({id: 'poi-visible'})
        })
        expect(getActivePOIOverlayId()).toBe('poi-visible')
        expect(screen.getByTestId('projected-poi').dataset.poi).toBe('poi-visible')

        await act(async () => {
            showPOIHoverTitlePreview({id: 'poi-next'})
        })
        expect(screen.getAllByTestId('projected-poi')).toHaveLength(1)
        expect(screen.getByTestId('projected-poi').dataset.poi).toBe('poi-next')

        await act(async () => {
            clearPOIHoverTitlePreview()
        })
        expect(screen.queryByTestId('projected-poi')).toBeNull()
    })
})
