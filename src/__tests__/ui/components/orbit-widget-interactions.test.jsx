/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: orbit-widget-interactions.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-11
 * Last modified: 2026-07-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

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

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        Math: {
            ...actual.Math,
            toDegrees: radians => radians * 180 / globalThis.Math.PI,
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

const setupOrbitGlobals = ({showMovementWidget = false} = {}) => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    document.body.classList.add('lgs-app-visible')

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
        },
        canvas,
        gutter: {
            s: '8px',
        },
        scene: {
            requestRender: vi.fn(),
            screenSpaceCameraController: {
                enableZoom: true,
            },
        },
        settings: {
            ui: {
                camera: proxy({
                    showMovementWidget,
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
            ui: {
                device: proxy({
                    mobile: false,
                }),
                mainUI: {
                    cameraFlight: proxy({
                        running: false,
                    }),
                    panorama: proxy({
                        active:  false,
                        visible: true,
                    }),
                    rotate: proxy({
                        direction:    1,
                        heightOffset: 0,
                        rpm:          1,
                        running:      true,
                        target:       {
                            element:   'map-point',
                            longitude: 1,
                            latitude:  2,
                            height:    120,
                        },
                        visible: true,
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
        ui: {
            poiManager: {
                stopRotationAndSync: vi.fn(),
            },
            widgetManager: {
                getWidgetConfig: vi.fn(() => ({})),
                setConfig:       vi.fn(),
            },
        },
    }

    return {canvas}
}

describe('OrbitWidget interactions', () => {
    beforeEach(() => {
        vi.resetModules()
        cleanup()
        window.matchMedia = makeMatchMedia(true)
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => (
            window.setTimeout(() => callback(performance.now()), 0)
        ))
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id))
        vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    })

    afterEach(() => {
        cleanup()
        document.body.classList.remove('lgs-app-visible')
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.restoreAllMocks()
    })

    it('keeps Cesium zoom enabled and lets wheel adjust height through Cesium', async () => {
        const {canvas} = setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)

        fireEvent.wheel(canvas, {deltaY: 1})
        expect(lgs.scene.screenSpaceCameraController.enableZoom).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)
    })

    it('maps modified wheel events to orbit height steps', async () => {
        const {canvas} = setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)

        const beforeWheel = performance.now()
        const shiftWheel = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     1,
            shiftKey:   true,
        })
        canvas.dispatchEvent(shiftWheel)

        expect(shiftWheel.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(10)
        expect(lgs.stores.ui.mainUI.rotate.heightAdjustmentUntil).toBeGreaterThan(beforeWheel)

        const shiftWheelReverse = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     -1,
            shiftKey:   true,
        })
        canvas.dispatchEvent(shiftWheelReverse)

        expect(shiftWheelReverse.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)

        const ctrlWheel = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            deltaY:     1,
        })
        canvas.dispatchEvent(ctrlWheel)

        expect(ctrlWheel.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(1)

        const ctrlWheelReverse = new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            deltaY:     -1,
        })
        canvas.dispatchEvent(ctrlWheelReverse)

        expect(ctrlWheelReverse.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)
    })

    it('lets Cesium wheel events reach existing canvas handlers', async () => {
        const {canvas} = setupOrbitGlobals()
        let wheelReachedCesiumHandler = false
        canvas.addEventListener('wheel', event => {
            if (!event.defaultPrevented) {
                wheelReachedCesiumHandler = true
            }
        }, {capture: true})
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)
        canvas.dispatchEvent(new WheelEvent('wheel', {
            bubbles:    true,
            cancelable: true,
            deltaY:     1,
        }))

        expect(wheelReachedCesiumHandler).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)
    })

    it('lets Cesium pointer gestures handle orbit height and angle', async () => {
        const {canvas} = setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)

        fireEvent.pointerDown(canvas, {button: 2, clientY: 100, pointerType: 'mouse'})
        fireEvent.pointerMove(document, {clientY: 90, pointerType: 'mouse'})
        fireEvent.pointerUp(document, {clientY: 90, pointerType: 'mouse'})

        fireEvent.pointerDown(canvas, {altKey: true, button: 0, clientY: 100, pointerType: 'mouse'})
        fireEvent.pointerMove(document, {clientY: 80, pointerType: 'mouse'})
        fireEvent.pointerUp(document, {clientY: 80, pointerType: 'mouse'})

        fireEvent.pointerDown(canvas, {button: 0, clientY: 100, pointerType: 'mouse', shiftKey: true})
        fireEvent.pointerMove(document, {clientY: 110, pointerType: 'mouse'})
        fireEvent.pointerUp(document, {clientY: 110, pointerType: 'mouse'})
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)
    })

    it('maps arrow keys to orbit height steps', async () => {
        setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)

        const arrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowUp',
        })
        document.dispatchEvent(arrowUp)
        expect(arrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(100)

        const arrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowDown',
        })
        document.dispatchEvent(arrowDown)
        expect(arrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)

        const shiftArrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowUp',
            shiftKey:   true,
        })
        document.dispatchEvent(shiftArrowUp)
        expect(shiftArrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(10)

        const shiftArrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowDown',
            shiftKey:   true,
        })
        document.dispatchEvent(shiftArrowDown)
        expect(shiftArrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)

        const ctrlArrowUp = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            key:        'ArrowUp',
        })
        document.dispatchEvent(ctrlArrowUp)
        expect(ctrlArrowUp.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(1)

        const ctrlArrowDown = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            key:        'ArrowDown',
        })
        document.dispatchEvent(ctrlArrowDown)
        expect(ctrlArrowDown.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.heightOffset).toBe(0)
    })

    it('maps plus, minus, and horizontal arrows to orbit rpm and direction', async () => {
        setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        render(<OrbitWidget/>)

        const plus = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        '+',
        })
        document.dispatchEvent(plus)
        expect(plus.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.rpm).toBe(1.1)

        const minus = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        '-',
        })
        document.dispatchEvent(minus)
        expect(minus.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.rpm).toBe(1)

        const arrowLeft = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowLeft',
        })
        document.dispatchEvent(arrowLeft)
        expect(arrowLeft.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.direction).toBe(-1)

        const arrowRight = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            key:        'ArrowRight',
        })
        document.dispatchEvent(arrowRight)
        expect(arrowRight.defaultPrevented).toBe(true)
        expect(lgs.stores.ui.mainUI.rotate.direction).toBe(1)

        const ctrlPlus = new KeyboardEvent('keydown', {
            bubbles:    true,
            cancelable: true,
            ctrlKey:    true,
            key:        '+',
        })
        document.dispatchEvent(ctrlPlus)
        expect(ctrlPlus.defaultPrevented).toBe(false)
        expect(lgs.stores.ui.mainUI.rotate.rpm).toBe(1)
    })

    it('keeps interaction hints hidden by default and toggles them from orbit', async () => {
        setupOrbitGlobals()
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        const view = render(<OrbitWidget/>)
        const toggle = view.container.querySelector('#orbit-interaction-hints-toggle-orbit')

        expect(toggle).not.toBeNull()
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(false)
        expect(view.container.querySelector('.orbit-interaction-hints')).toBeNull()

        fireEvent.click(toggle)
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(true)
        await waitFor(() => {
            expect(view.container.querySelector('.orbit-interaction-hints')).not.toBeNull()
        })

        fireEvent.click(toggle)
        expect(lgs.stores.ui.widget.list.has('orbit-interaction-hints-widget')).toBe(false)
        await waitFor(() => {
            expect(view.container.querySelector('.orbit-interaction-hints')).toBeNull()
        })
    })

    it('shows the height and angle overlay during orbit adjustments even when the global camera movement widget is disabled', async () => {
        const {canvas} = setupOrbitGlobals({showMovementWidget: false})
        const {OrbitWidget} = await import('@Components/MainUI/OrbitWidget')

        const view = render(<OrbitWidget/>)
        fireEvent.wheel(canvas, {deltaY: 1})

        await waitFor(() => {
            expect(
                view.container.querySelector('.panorama-adjustment-widget-shell.adjustment-visible'),
            ).not.toBeNull()
        })
    })
})
