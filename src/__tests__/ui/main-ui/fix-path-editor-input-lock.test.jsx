// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-input-lock.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {Utils} from '@Editor/Utils'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'

const activeAppShortcutRemovers = []

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, disabled, title, id, className, 'aria-label': ariaLabel, 'aria-haspopup': ariaHaspopup, 'aria-controls': ariaControls, 'aria-expanded': ariaExpanded}) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            id={id}
            className={className}
            aria-label={ariaLabel}
            aria-haspopup={ariaHaspopup}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
        >
            {children}
        </button>
    ),
    WaIcon: ({name, 'aria-hidden': ariaHidden}) => <span aria-hidden={ariaHidden}>{name}</span>,
    WaTooltip: ({children, for: target, placement}) => <wa-tooltip for={target} placement={placement}>{children}</wa-tooltip>,
    WaInput: ({'aria-label': ariaLabel, label, value, onChange, type, step, readOnly, inputMode}) => (
        <input
            aria-label={ariaLabel ?? label}
            value={value}
            onChange={onChange}
            type={type}
            step={step}
            readOnly={readOnly}
            inputMode={inputMode}
        />
    ),
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => (
        <div
            data-testid="fix-path-widget"
            data-draggable={String(config.draggable)}
            data-drag-handle={config.handle ?? ''}
            data-z-index={String(config.zIndex)}
        >
            {children}
        </div>
    ),
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children, autoHeight, autoHeightMax}) => (
        <div data-testid="fix-path-scrollbars" data-auto-height={String(autoHeight)} data-auto-height-max={autoHeightMax}>{children}</div>
    ),
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({active, children, className, id, role, placement, 'aria-label': ariaLabel}) => active
        ? <div data-testid="fix-path-help-popup" data-placement={placement} className={className} id={id} role={role} aria-label={ariaLabel}>{children}</div>
        : null,
}))

import {FixPathEditor} from '@Components/MainUI/FixPathEditor'

describe('FixPathEditor map input ownership', () => {
    const previousLgs = globalThis.lgs
    const previousContext = globalThis.__

    afterEach(() => {
        activeAppShortcutRemovers.splice(0).forEach(remove => remove())
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        globalThis.lgs = previousLgs
        globalThis.__ = previousContext
    })

    it('stops active orbit and panorama, keeps map movement enabled, prevents selection zoom, and restores controls', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
        }))
        const editorStore = proxy({fixPathEditorOpen: true})
        const rotateState = proxy({running: true})
        const panoramaState = proxy({active: true})
        const stopRotationAndSync = vi.fn(async () => {
            rotateState.running = false
            panoramaState.active = false
        })
        const journey = proxy({
            slug: 'journey-a',
            tracks: proxyMap([[
                'track-a',
                {
                    slug: 'track-a',
                    title: 'Track A',
                    content: {
                        geometry: {
                            type: 'LineString',
                            coordinates: Array.from({length: 12}, (_, index) => [-122.01 + index * 0.001, 37, 10]),
                        },
                    },
                },
            ]]),
            fixPathCorrectionData: {
                revision: 0,
                tracks: {
                    'track-a': [
                        {
                            id: 'section-a',
                            segmentIndex: 0,
                            startIndex: 0,
                            endIndex: 1,
                            sourceFingerprint: '',
                            controlPoints: [
                                {id: 'fix-point-0-1', progress: 0.5, coordinate: [-122.009, 37.001, 10]},
                                {id: 'fix-point-0-1b', progress: 0.75, coordinate: [-122.008, 37.001, 20]},
                            ],
                        },
                        {
                            id: 'section-b',
                            segmentIndex: 0,
                            startIndex: 2,
                            endIndex: 3,
                            sourceFingerprint: '',
                            controlPoints: [{id: 'fix-point-0-3', progress: 0.5, coordinate: [-122.007, 37.001, 10]}],
                        },
                        {
                            id: 'section-c',
                            segmentIndex: 0,
                            startIndex: 4,
                            endIndex: 5,
                            sourceFingerprint: '',
                            controlPoints: [{id: 'fix-point-0-5', progress: 0.5, coordinate: [-122.005, 37.001, 10]}],
                        },
                        {
                            id: 'section-d',
                            segmentIndex: 0,
                            startIndex: 6,
                            endIndex: 7,
                            sourceFingerprint: '',
                            controlPoints: [{id: 'fix-point-0-7', progress: 0.5, coordinate: [-122.003, 37.001, 10]}],
                        },
                        {
                            id: 'section-e',
                            segmentIndex: 0,
                            startIndex: 8,
                            endIndex: 9,
                            sourceFingerprint: '',
                            controlPoints: [{id: 'fix-point-0-9', progress: 0.5, coordinate: [-122.001, 37.001, 10]}],
                        },
                    ],
                },
            },
            fixPathEnabled: false,
        })
        editorStore.journey = journey
        const controller = {
            enableInputs: false,
            enableRotate: true,
            enableTranslate: false,
            enableZoom: true,
            enableTilt: true,
            enableLook: true,
        }
        const camera = {flyTo: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn()}
        const canvas = document.createElement('canvas')
        canvas.width = 100
        canvas.height = 100
        canvas.getBoundingClientRect = () => ({left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100})
        const widgetList = proxyMap([
            ['journey-toolbar-widget', {widgetsBoard: 'scene', zIndex: 4100}],
            ['journey-toolbar-widget#secondary', {widgetsBoard: 'scene', zIndex: 4321}],
            ['video-toolbar-widget', {widgetsBoard: 'video-crop-zone', zIndex: 14000}],
            ['scene-profile-widget', {widgetsBoard: 'scene', zIndex: 17000}],
        ])
        const viewerContainer = document.createElement('div')
        document.body.append(viewerContainer)
        globalThis.lgs = {
            stores: {
                journeyEditor: editorStore,
                ui: {
                    mainUI: {rotate: rotateState, panorama: panoramaState},
                    widget: {list: widgetList},
                },
            },
            theJourneyEditorProxy: proxy({journey, track: null}),
            settings: {
                journey: proxy({fixPathMaxSegmentMeters: 500}),
            },
            viewer: {
                container: viewerContainer,
                canvas,
                scene: {
                    screenSpaceCameraController: controller,
                    cartesianToCanvasCoordinates: position => {
                        const cartographic = Cartographic.fromCartesian(position)
                        const longitude = CesiumMath.toDegrees(cartographic.longitude)
                        const latitude = CesiumMath.toDegrees(cartographic.latitude)
                        return {
                            x: Math.round((longitude + 122.01) * 8000),
                            y: Math.round((37.005 - latitude) * 10000),
                        }
                    },
                    pickPositionSupported: true,
                    pickPosition: () => Cartesian3.fromDegrees(-122.004, 37.002, 50),
                    postRender: {addEventListener: () => () => {}},
                },
                camera,
            },
        }
        globalThis.__ = {
            ui: {
                poiManager: {stopRotationAndSync},
                widgetManager: {
                    getWidgetConfig: vi.fn(widgetId => ({
                        type: widgetId.includes('toolbar') ? 'lgs-toolbar' : 'lgs-visual-widget',
                        widgetsBoard: widgetList.get(widgetId)?.widgetsBoard,
                    })),
                },
            },
        }

        render(<FixPathEditor/>)

        await waitFor(() => expect(stopRotationAndSync).toHaveBeenCalledOnce())
        expect(rotateState.running).toBe(false)
        expect(panoramaState.active).toBe(false)
        expect(controller.enableInputs).toBe(true)
        expect(controller.enableRotate).toBe(true)
        expect(controller.enableTranslate).toBe(true)
        expect(controller.enableZoom).toBe(true)
        expect(controller.enableTilt).toBe(true)
        expect(controller.enableLook).toBe(true)
        expect(screen.getByTestId('fix-path-widget').getAttribute('data-draggable')).toBe('true')
        expect(screen.getByTestId('fix-path-widget').getAttribute('data-drag-handle')).toBe('')
        expect(screen.getByTestId('fix-path-widget').getAttribute('data-z-index')).toBe('4321')
        expect(document.querySelector('.fix-path-overlay').style.zIndex).toBe('4321')
        expect(screen.getByLabelText('Fix Path editor').classList.contains('lgs-card')).toBe(true)
        expect(screen.getByLabelText('Fix Path editor').classList.contains('wa-theme-lgs1920-on-map')).toBe(true)
        expect(screen.getByTestId('fix-path-scrollbars')).not.toBeNull()
        expect(screen.getByTestId('fix-path-scrollbars').getAttribute('data-auto-height')).toBe('true')
        expect(screen.getByTestId('fix-path-scrollbars').getAttribute('data-auto-height-max'))
            .toBe('min(var(--fix-path-correction-list-max-height), max(0px, calc(100vh - 13rem)))')
        expect(document.querySelectorAll('.fix-path-correction-section')).toHaveLength(1)
        expect(screen.queryByRole('button', {name: /Select another area/})).toBeNull()
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(2))
        expect(document.querySelectorAll('.fix-path-control-point:not(.is-inactive)')).toHaveLength(2)
        fireEvent.click(screen.getByRole('button', {name: 'Previous section'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        expect(camera.flyTo).not.toHaveBeenCalled()
        expect(camera.zoomIn).not.toHaveBeenCalled()
        expect(camera.zoomOut).not.toHaveBeenCalled()

        const ordinaryMapGesture = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(ordinaryMapGesture)).toBe(true)

        const selectionStart = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            shiftKey: true,
            clientX: 0,
            clientY: 0,
        })
        expect(canvas.dispatchEvent(selectionStart)).toBe(false)
        canvas.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            button: 0,
            shiftKey: true,
            clientX: 90,
            clientY: 90,
        }))
        canvas.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            button: 0,
            shiftKey: true,
            clientX: 90,
            clientY: 90,
        }))

        await waitFor(() => expect(screen.getByText(/visible points selected/)).not.toBeNull())
        await waitFor(() => expect(screen.getByRole('button', {name: '2 Journey points in selected area'})).not.toBeNull())
        expect(lgs.viewer.camera.flyTo).not.toHaveBeenCalled()
        expect(controller.enableRotate).toBe(true)
        expect(document.querySelectorAll('.fix-path-correction-section')).toHaveLength(1)

        let correctionPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        expect(correctionPoints).toHaveLength(11)

        fireEvent.click(correctionPoints[1], {clientX: 15, clientY: 40})
        const getCorrectionRows = () => [...document.querySelectorAll('.fix-path-correction-point-row')]
        let correctionRows = []
        await waitFor(() => {
            correctionRows = getCorrectionRows()
            expect(correctionRows).toHaveLength(3)
        })

        const widgetConfig = {
            draggable: true,
            position: {left: 30, top: 40},
        }
        const widgetElement = document.createElement('div')
        const applyWidgetPosition = vi.fn()
        globalThis.lgs.stores.ui.widget = proxy({current: {id: 'fix-path-editor'}})
        globalThis.__.ui.widgetManager = {
            getElementById: vi.fn(() => widgetElement),
            getWidgetConfig: vi.fn(() => widgetConfig),
            applyPosition: applyWidgetPosition,
            setConfig: vi.fn(),
            getMoveable: vi.fn(() => null),
            refreshEditorPreviewSnapshot: vi.fn(),
        }
        vi.stubGlobal('fetch', vi.fn(async () => ({text: async () => '[]'})))
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        activeAppShortcutRemovers.push(...installAppShortcuts({addShortcut: vi.fn(() => vi.fn())}))

        const mouseSelectedRow = correctionRows.find(row => row.getAttribute('aria-current') === 'true')
        expect(mouseSelectedRow).toBeDefined()
        const mouseSelectedIndex = correctionRows.indexOf(mouseSelectedRow)
        const firstNavigationKey = mouseSelectedIndex === 0 ? 'ArrowDown' : 'ArrowUp'
        const otherIndex = firstNavigationKey === 'ArrowDown'
            ? Math.min(correctionRows.length - 1, mouseSelectedIndex + 1)
            : Math.max(0, mouseSelectedIndex - 1)
        const otherRow = correctionRows[otherIndex]
        mouseSelectedRow.focus()
        expect(document.activeElement).toBe(mouseSelectedRow)
        fireEvent.keyDown(mouseSelectedRow, {key: firstNavigationKey})
        await waitFor(() => {
            correctionRows = getCorrectionRows()
            expect(document.activeElement).toBe(otherRow)
            expect(mouseSelectedRow.getAttribute('aria-current')).toBe('true')
            expect(otherRow.getAttribute('aria-current')).toBeNull()
        })
        expect(widgetConfig.position).toEqual({left: 30, top: 40})
        expect(applyWidgetPosition).not.toHaveBeenCalled()
        fireEvent.keyDown(document.activeElement, {key: 'ArrowUp'})
        await waitFor(() => {
            correctionRows = getCorrectionRows()
            expect(document.activeElement).toBe(correctionRows[0])
            expect(mouseSelectedRow.getAttribute('aria-current')).toBe('true')
        })
        fireEvent.keyDown(document.activeElement, {key: 'PageDown'})
        await waitFor(() => {
            correctionRows = getCorrectionRows()
            expect(document.activeElement).toBe(correctionRows.at(-1))
            expect(mouseSelectedRow.getAttribute('aria-current')).toBe('true')
        })
        fireEvent.keyDown(document.activeElement, {key: 'PageUp'})
        await waitFor(() => {
            correctionRows = getCorrectionRows()
            expect(document.activeElement).toBe(correctionRows[0])
            expect(mouseSelectedRow.getAttribute('aria-current')).toBe('true')
        })
        correctionPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        fireEvent.click(correctionPoints[1], {clientX: 15, clientY: 40})

        fireEvent.click(correctionPoints[3], {ctrlKey: true, clientX: 40, clientY: 40})
        fireEvent.click(correctionPoints[5], {ctrlKey: true, clientX: 72, clientY: 40})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(3))
        correctionPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        expect(correctionPoints.filter(point => point.getAttribute('aria-pressed') === 'true')).toHaveLength(3)
        fireEvent.keyDown(correctionPoints[4], {key: 'Enter'})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(1))
        correctionPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        expect(correctionPoints.filter(point => point.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
        fireEvent.click(correctionPoints[2], {clientX: 24, clientY: 40})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(1))

        const sourcePoints = document.querySelector('.fix-path-source-points')
        fireEvent.pointerDown(sourcePoints, {pointerId: 8, clientX: 80, clientY: 50})
        fireEvent.pointerUp(sourcePoints, {pointerId: 8, clientX: 80, clientY: 50})
        await waitFor(() => expect(screen.getByRole('button', {name: 'Cancel section'})).not.toBeNull())
        expect(document.querySelectorAll('.fix-path-pending-point')).toHaveLength(1)
        const modifiedMapClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            ctrlKey: true,
            clientX: 50,
            clientY: 40,
        })
        expect(canvas.dispatchEvent(modifiedMapClick)).toBe(false)
        expect(document.querySelectorAll('.fix-path-pending-point')).toHaveLength(1)
        canvas.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 50,
            clientY: 40,
        }))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-pending-point')).toHaveLength(2))
        const selectedRoute = screen.getByRole('button', {name: '2 Journey points in selected area'})
        fireEvent.pointerDown(selectedRoute, {pointerId: 9, clientX: 88, clientY: 50})
        fireEvent.pointerUp(selectedRoute, {pointerId: 9, clientX: 88, clientY: 50})
        await waitFor(() => expect(screen.queryByRole('button', {name: 'Cancel section'})).toBeNull())
        expect(document.querySelectorAll('.fix-path-pending-point')).toHaveLength(0)
        canvas.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 50,
            clientY: 40,
        }))
        expect(document.querySelectorAll('.fix-path-pending-point')).toHaveLength(0)
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-10"]',
        )).not.toBeNull())
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-1"]',
        )).not.toBeNull())
        fireEvent.click(screen.getByRole('button', {name: 'Previous section'}))
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-10"]',
        )).not.toBeNull())
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-1"]',
        )).not.toBeNull())

        correctionPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        fireEvent.pointerDown(correctionPoints[2], {pointerId: 1, clientX: 24, clientY: 40})
        fireEvent.pointerUp(correctionPoints[2], {pointerId: 1, clientX: 24, clientY: 40})
        fireEvent.click(correctionPoints[2], {clientX: 24, clientY: 40})

        await waitFor(() => {
            expect(controller.enableRotate).toBe(false)
            expect(controller.enableInputs).toBe(true)
            expect(controller.enableTranslate).toBe(true)
            expect(controller.enableTilt).toBe(false)
            expect(controller.enableLook).toBe(false)
            expect(screen.getByRole('heading', {name: 'Fix Path'})).not.toBeNull()
            expect(screen.getByRole('heading', {name: 'Fix Path'}).querySelector('[aria-hidden="true"]')?.textContent).toBe('draw-polygon')
            expect(screen.queryByText(/Each section is limited/)).toBeNull()
            expect(screen.getByText('Lat')).not.toBeNull()
            expect(screen.getByText('Lon')).not.toBeNull()
            expect(screen.getByText('Height')).not.toBeNull()
        })
        expect(camera.flyTo).not.toHaveBeenCalled()
        expect(camera.zoomIn).not.toHaveBeenCalled()
        expect(camera.zoomOut).not.toHaveBeenCalled()
        const resetButtons = screen.getAllByRole('button', {name: 'Reset correction point'})
        const removeButtons = screen.getAllByRole('button', {name: 'Remove correction point'})
        const correctionTooltips = [...document.querySelectorAll(
            'wa-tooltip[for^="fix-path-reset-"], wa-tooltip[for^="fix-path-remove-"]',
        )]
        expect(resetButtons.every(button => !button.hasAttribute('title'))).toBe(true)
        expect(removeButtons.every(button => !button.hasAttribute('title'))).toBe(true)
        expect(correctionTooltips.map(tooltip => tooltip.textContent)).toEqual(Array.from(
            {length: resetButtons.length},
            () => ['Reset', 'Remove'],
        ).flat())
        expect(correctionTooltips.map(tooltip => tooltip.getAttribute('for')).sort((first, second) => first.localeCompare(second))).toEqual([
            ...resetButtons.map(button => button.id),
            ...removeButtons.map(button => button.id),
        ].sort((first, second) => first.localeCompare(second)))
        expect(screen.queryByText(/Drag with Shift to select a screen area/)).toBeNull()
        expect(screen.queryByText(/Plain click selects one point/)).toBeNull()
        const helpButton = screen.getByRole('button', {name: 'Help'})
        expect(helpButton.closest('.fix-path-panel-header-actions')).not.toBeNull()
        expect(document.querySelector('.fix-path-panel-footer [aria-label="Help"]')).toBeNull()
        expect(document.querySelector('wa-tooltip[for="fix-path-help-trigger"]')?.textContent).toBe('Help')
        expect(helpButton.querySelector('span')?.textContent).toBe('question')
        expect(helpButton.querySelector('span')?.getAttribute('aria-hidden')).toBe('true')
        expect(helpButton.getAttribute('aria-expanded')).toBe('false')
        fireEvent.click(helpButton)
        expect(screen.getByRole('dialog', {name: 'Fix Path help'})).not.toBeNull()
        expect(screen.getByText(/select a screen area/)).not.toBeNull()
        expect(screen.getByText(/Plain click selects one point/)).not.toBeNull()
        expect(screen.getByRole('heading', {name: 'Point selection'})).not.toBeNull()
        expect(screen.getByRole('heading', {name: 'Correcting the path'})).not.toBeNull()
        expect(screen.getByRole('heading', {name: 'Keyboard'})).not.toBeNull()
        expect(screen.queryByText(/Press F to open Fix Path when a Journey with tracks is active/)).toBeNull()
        expect(document.querySelector('[data-testid="fix-path-help-popup"]')?.getAttribute('data-placement')).toBe('bottom-start')
        const helpScrollbars = screen.getAllByTestId('fix-path-scrollbars')[1]
        expect(helpScrollbars.getAttribute('data-auto-height')).toBe('true')
        expect(helpScrollbars.getAttribute('data-auto-height-max'))
            .toBe('max(0px, calc(100vh - 2 * var(--lgs-gutter) - 2 * var(--lgs-gutter-s)))')
        expect(document.querySelectorAll('.fix-path-help-content kbd.lgs--shortcut-key').length).toBeGreaterThan(0)
        expect(document.querySelector('.fix-path-help-content kbd[aria-label="Arrow Up"]')?.textContent).toBe('↑')
        const selectionHint = document.querySelector('.fix-path-correction-selection-hint')
        expect(selectionHint?.textContent).toBe('[Shift + Drag to select points]')
        expect(selectionHint?.parentElement?.classList.contains('fix-path-panel-header')).toBe(true)
        expect(selectionHint?.previousElementSibling?.tagName).toBe('H2')
        expect(selectionHint?.nextElementSibling?.classList.contains('fix-path-panel-header-actions')).toBe(true)
        expect(selectionHint?.querySelector('kbd.lgs--shortcut-key')?.textContent).toBe('Shift')
        expect(screen.getByText(/move focus between rows without changing the selected points/)).not.toBeNull()
        expect(document.querySelectorAll('.fix-path-correction-section')).toHaveLength(1)
        expect(screen.queryByText('Track A')).toBeNull()
        expect(screen.queryByText(/Segment/)).toBeNull()

        expect(screen.getAllByRole('textbox', {name: 'Lat'})[0].readOnly).toBe(true)
        expect(screen.getAllByRole('textbox', {name: 'Lon'})[0].readOnly).toBe(true)
        const selectedCorrectionRow = document.querySelector('.fix-path-correction-point-row[aria-current="true"]')
        const heightInput = selectedCorrectionRow.querySelector('[aria-label="Height"]')
        expect(heightInput.readOnly).toBe(false)
        expect(heightInput.type).toBe('text')
        heightInput.focus()
        fireEvent.keyDown(heightInput, {key: 'ArrowDown'})
        const focusedCorrectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
        const selectedRowIndex = focusedCorrectionRows.indexOf(selectedCorrectionRow)
        const nextFocusedRow = focusedCorrectionRows[Math.min(focusedCorrectionRows.length - 1, selectedRowIndex + 1)]
        expect(document.activeElement).toBe(nextFocusedRow)
        expect(selectedCorrectionRow.getAttribute('aria-current')).toBe('true')
        fireEvent.change(heightInput, {target: {value: '12.6'}})
        await waitFor(() => expect(heightInput.value).toBe('13'))

        let currentControlPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        const clickControlPoint = (point, modifiers = {}) => {
            const hitbox = point.querySelector('.fix-path-control-point-hitbox')
            fireEvent.click(point, {
                clientX: Number(hitbox.getAttribute('cx')),
                clientY: Number(hitbox.getAttribute('cy')),
                ...modifiers,
            })
        }
        clickControlPoint(currentControlPoints[0])
        currentControlPoints = screen.getAllByRole('button', {
            name: 'Correction point, drag to move or right-click to remove',
        })
        clickControlPoint(currentControlPoints[1], {shiftKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(2))
        expect(currentControlPoints[0].getAttribute('aria-pressed')).toBe('true')
        expect(currentControlPoints[1].getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByText(/2 correction points selected/)).not.toBeNull()
        expect(currentControlPoints.slice(0, 2).map(point => point.getAttribute('aria-pressed'))).toEqual(['true', 'true'])
        const setPointerCapture = vi.fn(() => { throw new Error('Pointer is no longer active') })
        currentControlPoints[1].setPointerCapture = setPointerCapture
        fireEvent.pointerDown(currentControlPoints[1], {pointerId: 2, clientX: 16, clientY: 40})
        expect(setPointerCapture).toHaveBeenCalledOnce()
        fireEvent.pointerMove(currentControlPoints[1], {pointerId: 2, clientX: 40, clientY: 40})
        fireEvent.pointerUp(currentControlPoints[1], {pointerId: 2, clientX: 40, clientY: 40})
        fireEvent.click(currentControlPoints[1], {clientX: 40, clientY: 40})
        await waitFor(() => expect(screen.getAllByRole('textbox', {name: 'Height'}).map(input => input.value)).toEqual(['40', '50', '10']))
        fireEvent.click(screen.getAllByRole('button', {name: 'Reset correction point'})[0])
        await waitFor(() => expect(screen.getAllByRole('textbox', {name: 'Height'}).map(input => input.value)).toEqual(['10', '50', '10']))
        expect(screen.queryByRole('button', {name: /Journey points in selected area/})).toBeNull()

        const activeSectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
        fireEvent.keyDown(activeSectionRows[0], {key: 'a', ctrlKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected'))
            .toHaveLength(activeSectionRows.length))
        const deleteSectionButton = screen.getByRole('button', {name: 'Delete active section'})
        fireEvent.click(deleteSectionButton)
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(2))
        expect(screen.queryByRole('button', {name: 'Delete active section'})).toBeNull()

        /** Build a source-matched correction fixture for validation behavior. */
        const makeValidationSection = (id, startIndex, endIndex) => ({
            id,
            segmentIndex: 0,
            startIndex,
            endIndex,
            sourceFingerprint: getFixPathSourceFingerprint(
                journey.tracks.get('track-a').content,
                0,
                startIndex,
                endIndex,
            ),
            controlPoints: [{
                id: 'validation-' + id,
                progress: 0.5,
                coordinate: [-122.01 + (startIndex + endIndex) / 2000, 37.001, 20],
            }],
        })
        const firstValidationSection = makeValidationSection('validation-a', 0, 1)
        const secondValidationSection = makeValidationSection('validation-b', 4, 5)
        act(() => {
            journey.fixPathCorrectionData = {revision: 1, tracks: {'track-a': [firstValidationSection]}}
        })
        await waitFor(() => {
            expect(screen.queryByRole('button', {name: 'Previous section'})).toBeNull()
            expect(screen.queryByRole('button', {name: 'Next section'})).toBeNull()
        })

        act(() => {
            journey.fixPathCorrectionData = {
                revision: 2,
                tracks: {'track-a': [firstValidationSection, secondValidationSection]},
            }
        })
        await waitFor(() => expect(screen.getByRole('button', {name: 'Next section'})).not.toBeNull())

        let finishRedraw
        const redraw = vi.fn(() => new Promise(resolve => { finishRedraw = resolve }))
        vi.spyOn(Utils, 'updateJourney').mockResolvedValue({draw: redraw})
        fireEvent.click(screen.getByRole('button', {name: /Validate/}))
        await waitFor(() => expect(editorStore.fixPathEditorOpen).toBe(false))
        expect(Utils.updateJourney).toHaveBeenCalledOnce()
        expect(redraw).toHaveBeenCalledOnce()
        finishRedraw()

        await waitFor(() => {
            expect(controller.enableInputs).toBe(false)
            expect(controller.enableRotate).toBe(true)
            expect(controller.enableTranslate).toBe(false)
            expect(controller.enableZoom).toBe(true)
            expect(controller.enableTilt).toBe(true)
            expect(controller.enableLook).toBe(true)
        })
        viewerContainer.remove()
    }, 20000)
})
