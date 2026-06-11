/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-flythrough-scale.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, waitFor }  from '@testing-library/react'
import { MapPOI }                    from '@Components/cesium/MapPOI'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                     from 'valtio'
import { proxyMap }                  from 'valtio/utils'

vi.mock('@Components/MainUI/MapPOI/MapPOIContent', () => ({
    MapPOIContent: ({poi}) => <div data-testid={`poi-content-${poi}`}/>,
}))

vi.mock('@Utils/cesium/POIUtils', () => ({
    POIUtils: {
        adaptScaleToDistance: vi.fn(() => ({scale: 1, tooFar: false})),
    },
}))

describe('MapPOI flythrough scale', () => {
    beforeEach(() => {
        const poiList = proxyMap()
        poiList.set('poi-1', {
            id:        'poi-1',
            latitude:  48,
            longitude: 2,
            visible:   true,
            expanded:  true,
            flythrough: {
                scalePercent: 150,
            },
        })

        const visibleList = proxyMap()
        visibleList.set('poi-1', 7)

        globalThis.lgs = {
            colors: {
                poiDefault:           '#fff',
                poiDefaultBackground: '#000',
            },
            stores: {
                main: {
                    components: {
                        pois: {
                            list:        poiList,
                            visibleList,
                            context:     proxy({visible: false}),
                        },
                    },
                },
                flythrough: proxy({
                    active:     true,
                    playing:    true,
                    paused:     false,
                    nearbyPois: [{poi: {id: 'poi-1'}}],
                }),
            },
        }

        globalThis.__ = {
            requestAnimationFrame: vi.fn(() => 1),
            cancelAnimationFrame:  vi.fn(),
            ui: {
                sceneManager: {
                    degreesToPixelsCoordinates: vi.fn(async () => ({visible: true, x: 120, y: 80})),
                    propagateEventToCanvas:    vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('applies the flythrough scale on the screen wrapper without mixing it with the bounce animation', async () => {
        const view = render(<MapPOI point="poi-1"/>)

        await waitFor(() => {
            const wrapper = view.container.querySelector('.poi-screen-wrapper')
            expect(wrapper).toBeTruthy()
            expect(wrapper.style.transform).toContain('scale(1.5)')
            expect(wrapper.querySelector('.lgs-slide-in-from-top-bounced')).toBeTruthy()
        })
    })
})
