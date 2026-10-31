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
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('@Components/MainUI/MapPOI/MapPOIContent', () => ({
    MapPOIContent: ({domPreview}) => domPreview ? (
        <div className="poi-icon-wrapper">
            <div className="poi-card poi-card--expanded poi-card--stick-right">
                <div className="poi-card-inner"/>
                <div className="poi-expanded-leader-space">
                    <span className="poi-geographic-anchor"/>
                </div>
            </div>
        </div>
    ) : <div/>,
}))

vi.mock('@Utils/cesium/POIUtils', () => ({
    POIUtils: {getEntityContainer: vi.fn(() => null)},
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: () => <span/>,
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
    let resizeObserverObserve
    let viewer

    beforeEach(() => {
        drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({drawImage}))
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,captured-map')
        vi.stubGlobal('requestAnimationFrame', callback => {
            callback(0)
            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        resizeObserverObserve = vi.fn()
        vi.stubGlobal('ResizeObserver', class {
            observe = resizeObserverObserve
            disconnect = vi.fn()
        })
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
        POIUtils.getEntityContainer.mockReturnValue(null)

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

    it('shows the captured map at the Cesium canvas CSS-pixel width', async () => {
        const {container} = render(<MapPOIEditPreview poi="poi-1"/>)

        await waitFor(() => {
            expect(container.querySelector('.map-poi-edit-preview').style.backgroundSize).toBe('1440px')
        })
        expect(container.querySelector('.map-poi-edit-preview').style.backgroundRepeat).toBe('no-repeat')

        expect(drawImage).toHaveBeenCalledWith(
            globalThis.lgs.canvas,
            0,
            0,
            2880,
            1800,
            0,
            0,
            1024,
            640,
        )
    })

    it('copies the displayed canvas without changing visibility or requesting Cesium frames', () => {
        render(<MapPOIEditPreview poi="poi-1"/>)

        expect(drawImage).toHaveBeenCalledOnce()
        expect(entity.show).toBe(true)
        expect(entity.billboard.show).toBe(true)
        expect(viewer.render).not.toHaveBeenCalled()
        expect(globalThis.lgs.scene.requestRender).not.toHaveBeenCalled()
        expect(globalThis.lgs.scene.postRender.addEventListener).not.toHaveBeenCalled()
    })

    it('observes the POI card and stick slot when recalculating preview bounds', () => {
        const {container} = render(<MapPOIEditPreview poi="poi-1"/>)
        const card = container.querySelector('.poi-card-inner')
        const leaderSpace = container.querySelector('.poi-expanded-leader-space')
        const observedElements = resizeObserverObserve.mock.calls.map(([element]) => element)

        expect(observedElements).toContain(card)
        expect(observedElements).toContain(leaderSpace)
    })
})
