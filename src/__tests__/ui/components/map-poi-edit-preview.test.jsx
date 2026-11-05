/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-edit-preview.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-30
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('@Components/MainUI/MapPOI/MapPOIContent', () => ({
    MapPOIContent: ({domPreview, style}) => domPreview ? (
        <div
            className="poi-icon-wrapper"
            style={{
                '--poi-border-width': '6px',
                '--poi-custom-border-width': '6px',
                '--poi-expanded-leader-position': '50%',
                '--poi-expanded-leader-angle': '0deg',
                '--poi-expanded-leader-length': '16px',
                '--poi-expanded-leader-y': '0px',
                '--poi-widget-rotation': '0deg',
                ...style,
            }}
        >
            <div className="poi-card poi-card--expanded poi-card--style-open-frame poi-card--stick-right">
                <div className="poi-card-inner poi-card-inner--style-open-frame"/>
                <div className="poi-expanded-leader-space">
                    <span className="poi-geographic-anchor"/>
                </div>
            </div>
        </div>
    ) : <div/>,
}))

vi.mock('@Utils/cesium/POIUtils', () => ({
    POIUtils: {
        getEntityContainer: vi.fn(() => null),
        requestRender: vi.fn(scene => scene?.requestRender?.()),
    },
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: () => <span/>,
    WaTooltip: ({children}) => <span>{children}</span>,
}))

import {MapPOIEditPreview} from '@Components/MainUI/MapPOI/MapPOIEditPreview'
import {POIUtils} from '@Utils/cesium/POIUtils'

/**
 * Create the POI state required by the preview.
 *
 * @returns {Object} A minimal POI fixture.
 */
const createPOI = () => ({
    id: 'poi-1',
    display: {maxWidth: 200},
})

describe('MapPOIEditPreview', () => {
    let drawImage
    let entity
    let poiList
    let postRenderListeners
    let resizeObserverCallbacks
    let resizeObserverObserve
    let viewer
    let capturedBitmap

    beforeEach(() => {
        drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({drawImage}))
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['map'])))
        vi.stubGlobal('createImageBitmap', vi.fn(async () => capturedBitmap))
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:captured-map')
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        vi.stubGlobal('requestAnimationFrame', callback => {
            callback(0)
            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        resizeObserverObserve = vi.fn()
        resizeObserverCallbacks = []
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback) {
                resizeObserverCallbacks.push(callback)
            }

            observe = resizeObserverObserve
            disconnect = vi.fn()
        })
        capturedBitmap = {close: vi.fn()}
        entity = {show: true, billboard: {show: true}}
        postRenderListeners = new Set()
        viewer = {
            entities: {getById: vi.fn(() => entity)},
            render: vi.fn(() => {
                for (const listener of Array.from(postRenderListeners)) {
                    listener()
                }
            }),
        }
        POIUtils.getEntityContainer.mockReturnValue({getById: vi.fn(() => entity)})

        poiList = proxyMap([['poi-1', proxy(createPOI())]])
        globalThis.lgs = {
            canvas: {
                width: 2880,
                height: 1800,
                getBoundingClientRect: () => ({width: 1440}),
            },
            viewer,
            scene: {
                postRender: {
                    addEventListener: vi.fn(listener => {
                        postRenderListeners.add(listener)
                        return () => postRenderListeners.delete(listener)
                    }),
                },
                requestRender: vi.fn(),
            },
            stores: proxy({main: {components: {pois: {list: poiList}}}}),
        }
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        globalThis.lgs = undefined
    })

    it('shows the captured map at the Cesium canvas CSS-pixel width after removing the POI', async () => {
        const {container} = render(<MapPOIEditPreview poi="poi-1"/>)
        expect(entity.show).toBe(false)
        expect(entity.billboard.show).toBe(false)
        expect(globalThis.lgs.scene.postRender.addEventListener).toHaveBeenCalledOnce()

        await act(async () => {
            for (const listener of Array.from(postRenderListeners)) listener()
            for (const listener of Array.from(postRenderListeners)) listener()
        })

        await waitFor(() => {
            expect(container.querySelector('.map-poi-edit-preview-background').style.backgroundSize).toBe('1440px')
        })
        expect(container.querySelector('.map-poi-edit-preview-background').style.backgroundImage)
            .toContain('blob:captured-map')

        expect(drawImage).toHaveBeenCalledWith(
            capturedBitmap,
            0,
            0,
            1024,
            640,
        )
        expect(capturedBitmap.close).toHaveBeenCalledOnce()
        expect(entity.show).toBe(true)
        expect(entity.billboard.show).toBe(true)
    })

    it('restores the POI after the hidden capture and requests Cesium frames', async () => {
        render(<MapPOIEditPreview poi="poi-1"/>)

        expect(drawImage).not.toHaveBeenCalled()
        expect(entity.show).toBe(false)
        expect(entity.billboard.show).toBe(false)
        expect(viewer.render).not.toHaveBeenCalled()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledOnce()
        expect(globalThis.lgs.scene.postRender.addEventListener).toHaveBeenCalledOnce()

        await act(async () => {
            for (const listener of Array.from(postRenderListeners)) listener()
            for (const listener of Array.from(postRenderListeners)) listener()
        })

        await waitFor(() => {
            expect(entity.show).toBe(true)
            expect(entity.billboard.show).toBe(true)
        })
        expect(drawImage).toHaveBeenCalledOnce()
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalledTimes(3)
    })

    it('observes the POI card and stick slot when recalculating preview bounds', () => {
        const {container} = render(<MapPOIEditPreview poi="poi-1"/>)
        const card = container.querySelector('.poi-card-inner')
        const leaderSpace = container.querySelector('.poi-expanded-leader-space')
        const observedElements = resizeObserverObserve.mock.calls.map(([element]) => element)

        expect(observedElements).toContain(card)
        expect(observedElements).toContain(leaderSpace)
    })

    it('includes the open-frame border overhang when fitting a thick border', async () => {
        const {container} = render(<MapPOIEditPreview poi="poi-1"/>)
        const area = container.querySelector('.map-poi-edit-preview-open-area')
        const card = container.querySelector('.poi-card-inner')

        Object.defineProperties(area, {
            clientWidth: {configurable: true, value: 200},
            clientHeight: {configurable: true, value: 100},
        })
        Object.defineProperties(card, {
            offsetWidth: {configurable: true, value: 200},
            offsetHeight: {configurable: true, value: 50},
        })
        await act(async () => resizeObserverCallbacks.forEach(callback => callback()))

        const fitButton = await waitFor(() => {
            const button = container.querySelector('.map-poi-edit-preview-fit')
            expect(button).toBeTruthy()
            return button
        })

        fireEvent.click(fitButton)
        await waitFor(() => {
            const scale = Number.parseFloat(
                container.querySelector('.poi-icon-wrapper').style.transform.match(/scale\(([^)]+)\)/)?.[1],
            )
            expect(scale).toBeCloseTo(200 / 212)
        })
    })
})
