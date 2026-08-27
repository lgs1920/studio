/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: panorama-widget-interactions.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { CURRENT_POI } from '@Core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'
import { Cartesian3 } from 'cesium'
import * as CameraPath from '@Core/ui/replay/JourneyReplayCameraPath'

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, className = '', config, isVisible = true}) => isVisible ? (
        <div className={className} data-widget={config?.id}>
            {children}
        </div>
    ) : null,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton:  ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCard:    ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon:    ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaSlider:  ({value, onInput, onChange, ...props}) => (
        <input
            type="range"
            value={value}
            onInput={onInput}
            onChange={onChange}
            readOnly
            {...props}
        />
    ),
    WaTooltip: ({children}) => <span>{children}</span>,
}))

vi.mock('@Utils/UnitUtils', () => ({
    foot:      {symbol: 'ft'},
    meter:     {symbol: 'm'},
    UnitUtils: {
        formatMetric: value => ({full: `${Math.round(Number(value) || 0)} m`}),
    },
}))

vi.mock('@Utils/FA2SL', () => ({
    FA2SL: {
        set: icon => icon?.iconName ?? `${icon ?? ''}`,
    },
}))

vi.mock('@Core/ui/replay/JourneyReplayCameraPath', () => ({
    buildCameraTransferPath: vi.fn(),
    selectCameraTransferMode: vi.fn(() => 'spiral-conical'),
}))

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        Math: {
            ...actual.Math,
            toDegrees: radians => radians * 180 / globalThis.Math.PI,
            toRadians: degrees => degrees * globalThis.Math.PI / 180,
        },
    }
})

vi.mock('@Components/MainUI/cameraAdjustmentWidgetPosition', () => ({
    scheduleCameraAdjustmentWidgetCenter: vi.fn(() => vi.fn()),
}))

vi.mock('@Components/MainUI/orbitWidgetConfig', () => ({
    getOrbitWidgetConfig: id => ({
        id,
        group:        'scene-widgets',
        widgetsBoard: 'scene-widgets-board',
    }),
}))

vi.mock('@Components/MainUI/orbitWidgetPresentation', () => ({
    getOrbitRPMGaugeIcon: () => 'gauge',
}))

const makeMatchMedia = matches => vi.fn(() => ({
    matches,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
}))

const setupPanoramaGlobals = ({panoramaActive = true} = {}) => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)

        globalThis.lgs = {
        camera: {
            heading:              0,
            pitch:                -0.2,
            roll:                 0,
            positionCartographic: {
                longitude: 1,
                latitude:  2,
                height:    1200,
            },
            positionWC: Cartesian3.fromDegrees(1, 2, 1200),
            changed: {
                addEventListener: vi.fn(() => vi.fn()),
            },
            flyTo:   vi.fn(),
            setView: vi.fn(),
        },
        gutter: {
            s: '8px',
        },
        scene: {
            requestRender: vi.fn(),
            screenSpaceCameraController: {
                enableInputs:    true,
                enableLook:      true,
                enableRotate:    true,
                enableTilt:      true,
                enableTranslate: true,
                enableZoom:      true,
            },
        },
        settings: {
            ui: {
                camera: proxy({
                    showMovementWidget: false,
                }),
                menu: proxy({
                    toolBar: {
                        fromStart: false,
                    },
                }),
            },
            unitSystem: proxy({}),
        },
        stores: {
            main: {
                components: {
                    pois: {
                        list: new Map(),
                    },
                },
            },
            ui: {
                device: proxy({
                    mobile: false,
                }),
                mainUI: {
                    cameraFlight: proxy({
                        running: false,
                    }),
                    panorama: proxy({
                        active:       panoramaActive,
                        direction:    1,
                        heading:      0,
                        heightOffset: 100,
                        pitch:        -12,
                        rpm:          1,
                        target:       {
                            element: CURRENT_POI,
                            slug:    'poi-1',
                            longitude: 1,
                            latitude:  2,
                            height:    1200,
                        },
                        visible:      true,
                    }),
                    rotate: proxy({
                        running: false,
                    }),
                },
                widget: proxy({
                    current: {id: null},
                    list:    proxyMap(),
                }),
            },
        },
        viewer: {
            canvas,
        },
    }

    globalThis.__ = {
        device: {
            isMobile: false,
        },
        ui: {
            cameraManager: {
                beginFlight:                    vi.fn(),
                endFlight:                      vi.fn(),
                optimizeContinuousCameraRender: vi.fn(),
                raiseUpdateEvent:               vi.fn(() => undefined),
                restoreContinuousCameraRender:  vi.fn(),
                setPanoramicCancel:             vi.fn(() => vi.fn()),
            },
            poiManager: {
                updatePOI: vi.fn(),
            },
            widgetManager: {
                getWidgetConfig: vi.fn(() => ({})),
                setConfig:       vi.fn(),
            },
        },
    }

    return {canvas}
}

describe('PanoramaWidget interactions', () => {
    beforeEach(() => {
        vi.resetModules()
        cleanup()
        window.matchMedia = makeMatchMedia(true)
        vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.restoreAllMocks()
    })

    it('maps wheel events to panorama height steps', async () => {
        const {canvas} = setupPanoramaGlobals()
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        render(<PanoramaWidget/>)

        const wheel = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     1,
        })
        canvas.dispatchEvent(wheel)
        expect(wheel.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(200)

        const wheelReverse = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     -1,
        })
        canvas.dispatchEvent(wheelReverse)
        expect(wheelReverse.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        const shiftWheel = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     1,
            shiftKey:   true,
        })
        canvas.dispatchEvent(shiftWheel)
        expect(shiftWheel.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(110)

        const shiftWheelReverse = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     -1,
            shiftKey:   true,
        })
        canvas.dispatchEvent(shiftWheelReverse)
        expect(shiftWheelReverse.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        const ctrlWheel = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            deltaY:     1,
        })
        canvas.dispatchEvent(ctrlWheel)
        expect(ctrlWheel.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(101)

        const ctrlWheelReverse = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            deltaY:     -1,
        })
        canvas.dispatchEvent(ctrlWheelReverse)
        expect(ctrlWheelReverse.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)
    })

    it('maps adjustment overlay wheel events to panorama height steps', async () => {
        setupPanoramaGlobals()
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        const {container} = render(<PanoramaWidget/>)
        const overlay = container.querySelector('.camera-adjustment-overlay')

        fireEvent.wheel(overlay, {deltaY: 1})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(200)

        fireEvent.wheel(overlay, {deltaY: -1})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        fireEvent.wheel(overlay, {deltaY: 1, shiftKey: true})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(110)

        fireEvent.wheel(overlay, {deltaY: -1, shiftKey: true})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        fireEvent.wheel(overlay, {ctrlKey: true, deltaY: 1})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(101)

        fireEvent.wheel(overlay, {ctrlKey: true, deltaY: -1})
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)
    })

    it('shows the camera overlay when changing the camera', async () => {
        const cameraChangedListeners = []
        setupPanoramaGlobals({panoramaActive: false})
        lgs.camera.changed.addEventListener = vi.fn(listener => {
            cameraChangedListeners.push(listener)
            return vi.fn()
        })
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        const view = render(<PanoramaWidget/>)
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).toBeNull()

        lgs.camera.positionCartographic.height = 1300
        cameraChangedListeners[0]()

        await waitFor(() => {
            expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()
        })
    })

    it('maps arrow keys to panorama height steps', async () => {
        setupPanoramaGlobals()
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        render(<PanoramaWidget/>)

        const arrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowUp',
        })
        document.dispatchEvent(arrowUp)
        expect(arrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(200)

        const arrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowDown',
        })
        document.dispatchEvent(arrowDown)
        expect(arrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        const shiftArrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowUp',
            shiftKey:   true,
        })
        document.dispatchEvent(shiftArrowUp)
        expect(shiftArrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(110)

        const shiftArrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowDown',
            shiftKey:   true,
        })
        document.dispatchEvent(shiftArrowDown)
        expect(shiftArrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)

        const ctrlArrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            key:        'ArrowUp',
        })
        document.dispatchEvent(ctrlArrowUp)
        expect(ctrlArrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(101)

        const ctrlArrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            key:        'ArrowDown',
        })
        document.dispatchEvent(ctrlArrowDown)
        expect(ctrlArrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.panorama.heightOffset).toBe(100)
    })

    it('toggles interaction hints from panorama', async () => {
        setupPanoramaGlobals()
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        const {container} = render(<PanoramaWidget/>)
        const toggle = container.querySelector('#panorama-interaction-hints-toggle-footer')

        expect(toggle).not.toBeNull()
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(false)

        fireEvent.click(toggle)
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(true)

        fireEvent.click(toggle)
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(false)
    })

    it('starts panorama movement with the path API instead of Cesium flyTo', async () => {
        setupPanoramaGlobals()
        const pathFlyTo = vi.fn(() => vi.fn())
        CameraPath.buildCameraTransferPath.mockReturnValue({
            flyTo: pathFlyTo,
            sampleAt: vi.fn(),
        })
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        render(<PanoramaWidget/>)

        expect(CameraPath.buildCameraTransferPath).toHaveBeenCalled()
        expect(pathFlyTo).toHaveBeenCalled()
        expect(pathFlyTo).toHaveBeenCalledWith(expect.objectContaining({
            orientation: {
                heading: 0,
                pitch:   -12 * globalThis.Math.PI / 180,
                roll:    0,
            },
        }))
        expect(pathFlyTo.mock.calls[0][0].target).toBeUndefined()
        expect(lgs.camera.flyTo).not.toHaveBeenCalled()
    })

    it('registers an immediate cancellation callback for panorama motion', async () => {
        setupPanoramaGlobals()
        const pathCancel = vi.fn()
        CameraPath.buildCameraTransferPath.mockReturnValue({
            flyTo: vi.fn(() => pathCancel),
            sampleAt: vi.fn(),
        })
        const {PanoramaWidget} = await import('@Components/MainUI/PanoramaWidget')

        render(<PanoramaWidget/>)

        const register = __.ui.cameraManager.setPanoramicCancel
        expect(register).toHaveBeenCalledWith(expect.any(Function))
        register.mock.calls[0][0]()

        expect(pathCancel).toHaveBeenCalledOnce()
    })
})
