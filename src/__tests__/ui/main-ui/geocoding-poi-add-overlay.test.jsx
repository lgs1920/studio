/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: geocoding-poi-add-overlay.test.jsx
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

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GeocodingPOIAddOverlay } from '@Components/MainUI/geocoding/GeocodingPOIAddOverlay'
import {
    $geocodingPOIAddOverlay, hideGeocodingPOIAddOverlay, showGeocodingPOIAddOverlay,
} from '@Core/stores/geocodingPOIAddOverlay'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const { addPOIToLibrary } = vi.hoisted(() => ({addPOIToLibrary: vi.fn()}))
vi.mock('@Components/MainUI/MapPOI/addPOIToLibrary', () => ({addPOIToLibrary}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

describe('GeocodingPOIAddOverlay', () => {
    let poi
    let viewerContainer
    let canvas
    let removePostRender
    let removeCameraChanged

    beforeEach(() => {
        vi.clearAllMocks()
        hideGeocodingPOIAddOverlay()
        poi = proxy({
            id: 'temporary-overlay-poi',
            type: undefined,
            longitude: 2.3522,
            latitude: 48.8566,
            simulatedHeight: 34,
        })
        viewerContainer = document.createElement('div')
        document.body.append(viewerContainer)
        canvas = document.createElement('canvas')
        Object.defineProperty(canvas, 'clientWidth', {configurable: true, value: 800})
        Object.defineProperty(canvas, 'clientHeight', {configurable: true, value: 600})
        viewerContainer.getBoundingClientRect = () => ({left: 50, top: 80, width: 800, height: 600})
        canvas.getBoundingClientRect = () => ({left: 50, top: 80, width: 800, height: 600})
        removePostRender = vi.fn()
        removeCameraChanged = vi.fn()
        globalThis.lgs = {
            viewer: {
                container: viewerContainer,
                canvas,
                scene: {
                    cartesianToCanvasCoordinates: vi.fn(() => ({x: 400, y: 300})),
                    postRender: {addEventListener: vi.fn(() => removePostRender)},
                },
                camera: {changed: {addEventListener: vi.fn(() => removeCameraChanged)}},
            },
            stores: {main: {components: {pois: {list: proxyMap([[poi.id, poi]])}}}},
        }
        globalThis.__ = {ui: {}}
    })

    afterEach(() => {
        cleanup()
        hideGeocodingPOIAddOverlay()
        viewerContainer.remove()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('projects the active temporary POI and routes Add through the shared operation', () => {
        vi.useFakeTimers()
        showGeocodingPOIAddOverlay(poi.id)
        render(<GeocodingPOIAddOverlay/>)

        const button = screen.getByRole('button', {name: UI_ACTIONS.addPOIToLibrary.label})
        expect(button.querySelector('[data-icon="circle-plus"]')).not.toBeNull()
        expect(vi.getTimerCount()).toBe(1)
        fireEvent.click(button)

        expect(addPOIToLibrary).toHaveBeenCalledWith(poi.id)
        expect(button.parentElement.parentElement.style.left).toBe('400px')
        expect(button.parentElement.parentElement.style.top).toBe('300px')
        expect(lgs.viewer.scene.postRender.addEventListener).toHaveBeenCalledOnce()
        expect(lgs.viewer.camera.changed.addEventListener).toHaveBeenCalledOnce()
    })

    it('removes its Cesium listeners when the overlay host unmounts without removing the POI', () => {
        showGeocodingPOIAddOverlay(poi.id)
        const view = render(<GeocodingPOIAddOverlay/>)

        view.unmount()

        expect(removePostRender).toHaveBeenCalledOnce()
        expect(removeCameraChanged).toHaveBeenCalledOnce()
        expect(lgs.stores.main.components.pois.list.has(poi.id)).toBe(true)
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
    })
})
