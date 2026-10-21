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
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {DRAWING_FROM_UI} from '@Core/constants'
import {Utils} from '@Editor/Utils'
import {applyFixPathCorrections, getCorrectedTrackContent, getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'
import {TrackUtils} from '@Utils/cesium/TrackUtils'

const activeAppShortcutRemovers = []
const fixPathWidgetMockState = vi.hoisted(() => ({childRef: null}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, disabled, title, id, className, 'aria-label': ariaLabel, 'aria-haspopup': ariaHaspopup, 'aria-controls': ariaControls, 'aria-expanded': ariaExpanded, 'aria-pressed': ariaPressed}) => (
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
            aria-pressed={ariaPressed}
        >
            {children}
        </button>
    ),
    WaIcon: ({name, className, style, family, variant, 'aria-hidden': ariaHidden}) => (
        <span aria-hidden={ariaHidden} className={className} style={style} data-family={family} data-variant={variant}>{name}</span>
    ),
    WaTooltip: ({children, for: target, placement}) => <wa-tooltip for={target} placement={placement}>{children}</wa-tooltip>,
    WaCallout: ({children, ...props}) => <div {...props}>{children}</div>,
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
    WaNumberInput: ({'aria-label': ariaLabel, value, onInput, onChange, disabled}) => (
        <input aria-label={ariaLabel} type="number" value={value} onInput={onInput} onChange={onChange} disabled={disabled}/>
    ),
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config, childRef}) => {
        fixPathWidgetMockState.childRef = childRef
        return (
            <div
                data-testid="fix-path-widget"
                data-draggable={String(config.draggable)}
                data-drag-handle={config.handle ?? ''}
                data-z-index={String(config.zIndex)}
            >
                {children}
            </div>
        )
    },
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
        fixPathWidgetMockState.childRef = null
        cleanup()
        document.querySelectorAll('.fix-path-test-viewer-container').forEach(element => element.remove())
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
        const unitSystem = proxy({current: 0})
        const rotateState = proxy({running: true})
        const panoramaState = proxy({active: true})
        const stopRotationAndSync = vi.fn(async () => {
            rotateState.running = false
            panoramaState.active = false
        })
        const journey = proxy({
            slug: 'journey-a',
            focus: vi.fn(async () => {}),
            tracks: proxyMap([[
                'track-a',
                {
                    slug: 'track-a',
                    parent: 'journey-a',
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
                                {id: 'fix-point-0-1', progress: 0.5, coordinate: [-122.009, 37.001, 10], fixed: false},
                                {id: 'fix-point-0-1b', progress: 0.75, coordinate: [-122.008, 37.001, 20]},
                            ],
                        },
                        {
                            id: 'section-b',
                            segmentIndex: 0,
                            startIndex: 3,
                            endIndex: 5,
                            sourceFingerprint: '',
                            controlPoints: [{id: 'fix-point-0-4', progress: 0.5, coordinate: [-122.006, 37.001, 10]}],
                        },
                    ],
                },
            },
            fixPathEnabled: false,
            persistToDatabase: vi.fn(async () => {}),
        })
        journey.fixPathCorrectionData.tracks['track-a'].forEach(correction => {
            correction.sourceFingerprint = getFixPathSourceFingerprint(
                journey.tracks.get('track-a').content,
                correction.segmentIndex,
                correction.startIndex,
                correction.endIndex,
            )
        })
        const initialCorrectionSections = JSON.parse(JSON.stringify(journey.fixPathCorrectionData.tracks['track-a']))
        editorStore.journey = journey
        const controller = {
            enableInputs: false,
            enableRotate: true,
            enableTranslate: false,
            enableZoom: true,
            enableTilt: true,
            enableLook: true,
        }
        const camera = {
            setView: vi.fn(),
            flyTo: vi.fn(),
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            positionWC: Cartesian3.fromDegrees(-122.011, 37, 1000),
            directionWC: new Cartesian3(0, 0, -1),
            upWC: new Cartesian3(0, 1, 0),
            pickEllipsoid: vi.fn(() => Cartesian3.fromDegrees(-122.011, 37, 0)),
        }
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
        viewerContainer.append(canvas)
        document.body.append(viewerContainer)
        const fixPathWidgetRuntimeConfig = {dimensions: {width: 200, height: 200}}
        const updateFixPathWidgetRect = vi.fn()
        const canvasEventCallbacks = {}
        const canvasEvents = {
            onRightClick: vi.fn((callback, options) => {
                canvasEventCallbacks.rightClick = callback
                canvasEventCallbacks.rightClickOptions = options
            }),
            offRightClick: vi.fn(),
        }
        globalThis.lgs = {
            getJourneyBySlug: vi.fn(slug => slug === journey.slug ? journey : null),
            stores: {
                journeyEditor: editorStore,
                ui: {
                    mainUI: {rotate: rotateState, panorama: panoramaState},
                    widget: {list: widgetList},
                },
            },
            theJourneyEditorProxy: proxy({journey, track: null}),
            settings: {
                journey: proxy({}),
                unitSystem,
            },
            viewer: {
                container: viewerContainer,
                canvas,
                scene: {
                    screenSpaceCameraController: controller,
                    pick: vi.fn(() => null),
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
            canvasEvents,
            ui: {
                poiManager: {stopRotationAndSync},
                widgetManager: {
                    getElementById: vi.fn(() => document.querySelector('[data-testid="fix-path-widget"]')),
                    getMoveable: vi.fn(() => ({current: {updateRect: updateFixPathWidgetRect}})),
                    getWidgetConfig: vi.fn(widgetId => widgetId === 'fix-path-editor-widget'
                        ? fixPathWidgetRuntimeConfig
                        : {
                            type: widgetId.includes('toolbar') ? 'lgs-toolbar' : 'lgs-visual-widget',
                            widgetsBoard: widgetList.get(widgetId)?.widgetsBoard,
                        }),
                },
            },
        }
        const redraw = vi.fn()
        const updateJourney = vi.spyOn(Utils, 'updateJourney').mockResolvedValue({draw: redraw})
        const setDisplayContentOverride = vi.spyOn(TrackUtils, 'setDisplayContentOverride')
        const drawTrack = vi.spyOn(TrackUtils, 'draw').mockResolvedValue(undefined)

        render(<FixPathEditor/>)

        await waitFor(() => expect(stopRotationAndSync).toHaveBeenCalledOnce())
        await waitFor(() => expect(setDisplayContentOverride).toHaveBeenCalledWith(
            journey.tracks.get('track-a'),
            applyFixPathCorrections(
                journey.tracks.get('track-a').content,
                initialCorrectionSections,
            ).content,
        ))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point')).toHaveLength(6))
        lgs.viewer.scene.pick.mockReturnValue({id: 'track-a'})
        act(() => fireEvent.pointerMove(canvas, {clientX: 50, clientY: 50, pointerType: 'mouse'}))
        const journeyCursor = document.querySelector('.fix-path-journey-cursor')
        expect(journeyCursor.classList.contains('is-visible')).toBe(true)
        expect(journeyCursor.textContent).toBe('circle-plus')
        fireEvent.pointerMove(document.querySelector('.fix-path-control-point'), {
            clientX: 50,
            clientY: 50,
            shiftKey: true,
            pointerType: 'mouse',
        })
        expect(journeyCursor.textContent).toBe('lasso')
        expect(journeyCursor.classList.contains('is-visible')).toBe(true)
        expect(viewerContainer.classList.contains('fix-path-custom-cursor')).toBe(true)
        act(() => {
            fireEvent.keyDown(document, {key: 'Shift', shiftKey: true})
        })
        expect(journeyCursor.textContent).toBe('lasso')
        act(() => {
            fireEvent.keyUp(document, {key: 'Shift', shiftKey: false})
            fireEvent.keyDown(document, {key: 'Alt', altKey: true})
        })
        expect(journeyCursor.textContent).toBe('lasso')
        act(() => fireEvent.keyDown(document, {key: 'Control', ctrlKey: true, altKey: true}))
        expect(journeyCursor.textContent).toBe('square-dashed')
        act(() => fireEvent.keyUp(document, {key: 'Control', ctrlKey: false, altKey: true}))
        expect(journeyCursor.textContent).toBe('lasso')
        act(() => fireEvent.keyUp(document, {key: 'Alt', altKey: false}))
        expect(journeyCursor.textContent).toBe('circle-plus')
        act(() => fireEvent.pointerLeave(canvas))
        expect(document.querySelectorAll('.fix-path-preview-line, .fix-path-markers polyline')).toHaveLength(0)
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
        expect(screen.getByRole('button', {name: 'Undo correction change'}).disabled).toBe(true)
        expect(screen.getByRole('button', {name: 'Redo correction change'}).disabled).toBe(true)
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        const selectAllCorrectionPoints = screen.getByRole('checkbox', {name: 'Select all correction points'})
        const initialCorrectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
        expect(initialCorrectionRows.every(row => !row.classList.contains('is-selected'))).toBe(true)
        fireEvent.click(selectAllCorrectionPoints)
        await waitFor(() => expect(initialCorrectionRows.every(row => row.classList.contains('is-selected'))).toBe(true))
        expect(initialCorrectionRows.every(row => document.querySelector(
            '.fix-path-control-point[data-control-point-id="' + row.dataset.controlPointId + '"]',
        )?.classList.contains('is-selected'))).toBe(true)
        fireEvent.click(screen.getByRole('checkbox', {name: 'Select all correction points'}))
        await waitFor(() => expect(initialCorrectionRows.every(row => !row.classList.contains('is-selected'))).toBe(true))
        expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(0)
        const setViewCallsAfterOpening = camera.setView.mock.calls.length
        const fixPathWidget = screen.getByTestId('fix-path-widget')
        fixPathWidget.style.top = '24px'
        fixPathWidget.getBoundingClientRect = () => {
            const height = Number.parseFloat(fixPathWidget.style.height) || 100
            return {left: 0, top: 24, right: 100, bottom: 24 + height, width: 100, height}
        }
        act(() => {
            fixPathWidgetMockState.childRef.current.onResizeStart()
            fixPathWidget.style.height = '600px'
        })
        expect(screen.getByLabelText('Fix Path editor').classList.contains('is-resized')).toBe(true)
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        expect(screen.getByLabelText('Fix Path editor').classList.contains('is-resized')).toBe(true)
        expect(fixPathWidget.style.height).toBe('600px')
        expect(fixPathWidget.style.top).toBe('24px')
        await waitFor(() => expect(fixPathWidgetRuntimeConfig.dimensions).toEqual({width: 100, height: 600}))
        expect(updateFixPathWidgetRect).toHaveBeenCalled()
        expect(document.querySelectorAll('.fix-path-control-point:not(.is-inactive)')).toHaveLength(3)
        const correctionMarkerSizes = [...document.querySelectorAll('.fix-path-control-point-visual')].map(marker => {
            if (marker.tagName.toLowerCase() === 'circle') {
                return [Number(marker.getAttribute('r')) * 2, Number(marker.getAttribute('r')) * 2]
            }
            const coordinates = marker.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)
            const xCoordinates = coordinates.filter((_, index) => index % 2 === 0)
            const yCoordinates = coordinates.filter((_, index) => index % 2 === 1)
            return [
                Math.max(...xCoordinates) - Math.min(...xCoordinates),
                Math.max(...yCoordinates) - Math.min(...yCoordinates),
            ]
        })
        expect(correctionMarkerSizes).toEqual(Array.from({length: 6}, () => [14, 14]))
        fireEvent.click(screen.getByRole('button', {name: 'Previous section'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        expect(camera.setView).toHaveBeenCalledTimes(setViewCallsAfterOpening + 2)
        expect(camera.setView.mock.lastCall[0].orientation).toEqual({
            direction: camera.directionWC,
            up: camera.upWC,
        })
        await waitFor(() => expect(journey.persistToDatabase).toHaveBeenCalled())
        journey.fixPathEnabled = true
        const savedCorrectionData = JSON.parse(JSON.stringify(journey.fixPathCorrectionData))
        fireEvent.click(screen.getByRole('button', {name: 'Hide section fixes'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point[data-correction-id="section-a"]')).toHaveLength(0))
        expect(document.querySelectorAll('.fix-path-control-point[data-correction-id="section-b"]')).toHaveLength(3)
        expect(setDisplayContentOverride).toHaveBeenLastCalledWith(
            journey.tracks.get('track-a'),
            applyFixPathCorrections(
                journey.tracks.get('track-a').content,
                [initialCorrectionSections[1]],
            ).content,
        )
        expect(drawTrack).toHaveBeenLastCalledWith(journey.tracks.get('track-a'), {action: DRAWING_FROM_UI})
        expect(journey.fixPathEnabled).toBe(true)
        expect(journey.fixPathCorrectionData).toEqual(savedCorrectionData)
        expect(getCorrectedTrackContent(journey.tracks.get('track-a')).geometry.coordinates)
            .toEqual(applyFixPathCorrections(journey.tracks.get('track-a').content, initialCorrectionSections).content.geometry.coordinates)
        fireEvent.click(screen.getByRole('button', {name: 'Show section fixes'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point')).toHaveLength(6))
        expect(setDisplayContentOverride).toHaveBeenLastCalledWith(
            journey.tracks.get('track-a'),
            applyFixPathCorrections(
                journey.tracks.get('track-a').content,
                initialCorrectionSections,
            ).content,
        )

        const updateCallsBeforeInitialShiftAdd = updateJourney.mock.calls.length
        const shiftAdd = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            ctrlKey: true,
            shiftKey: true,
            clientX: 16,
            clientY: 50,
        })
        act(() => expect(canvas.dispatchEvent(shiftAdd)).toBe(false))
        expect(shiftAdd.defaultPrevented).toBe(true)
        expect(document.querySelector('.fix-path-selection-rectangle')).not.toBeNull()
        fireEvent.pointerUp(canvas, {
            button: 0,
            ctrlKey: true,
            shiftKey: true,
            clientX: 16,
            clientY: 50,
        })
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-2"]',
        )).not.toBeNull())
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(7))
        expect(document.querySelectorAll('.fix-path-correction-point-row[data-correction-id="section-a"]')).toHaveLength(7)
        const shiftAddedMarker = document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-2"]')
        expect(shiftAddedMarker?.classList.contains('is-unmodified')).toBe(true)
        expect(shiftAddedMarker?.classList.contains('is-selected')).toBe(false)
        expect(document.querySelector('.fix-path-source-points')).toBeNull()
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeInitialShiftAdd + 1))
        expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(1)
        expect(journey.fixPathCorrectionData.tracks['track-a'][0].endIndex).toBe(5)
        const updateCallsBeforeFixtureRestore = updateJourney.mock.calls.length
        act(() => {
            journey.fixPathCorrectionData = {
                revision: journey.fixPathCorrectionData.revision + 1,
                tracks: {'track-a': initialCorrectionSections},
            }
        })
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeFixtureRestore))
        updateJourney.mockClear()
        redraw.mockClear()
        const unmodifiedStatus = document.querySelector('[data-control-point-id="fix-point-0-1"] .fix-path-correction-point-status-indicator')
        const movedStatus = document.querySelector('[data-control-point-id="fix-point-0-1b"] .fix-path-correction-point-status-indicator')
        expect(unmodifiedStatus.textContent).toBe('diamond')
        expect(unmodifiedStatus.classList.contains('is-unmodified')).toBe(true)
        expect(unmodifiedStatus.hasAttribute('style')).toBe(false)
        expect(movedStatus.textContent).toBe('circle')
        expect(movedStatus.classList.contains('is-moved')).toBe(true)
        expect(movedStatus.hasAttribute('style')).toBe(false)
        expect(camera.flyTo).not.toHaveBeenCalled()
        expect(camera.zoomIn).not.toHaveBeenCalled()
        expect(camera.zoomOut).not.toHaveBeenCalled()

        const ordinaryMapGesture = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(ordinaryMapGesture)).toBe(true)

        expect(lgs.viewer.camera.flyTo).not.toHaveBeenCalled()
        expect(controller.enableRotate).toBe(true)
        expect(document.querySelectorAll('.fix-path-correction-section')).toHaveLength(1)
        const standardMapGestureAfterNavigation = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(standardMapGestureAfterNavigation)).toBe(true)
        expect(standardMapGestureAfterNavigation.defaultPrevented).toBe(false)

        let correctionPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        expect(correctionPoints).toHaveLength(6)

        const setViewCallsBeforePointClick = camera.setView.mock.calls.length
        fireEvent.click(correctionPoints[1], {clientX: 15, clientY: 40})
        expect(camera.setView).toHaveBeenCalledTimes(setViewCallsBeforePointClick)
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
            name: /Correction point/,
        })
        const unmodifiedPoint = correctionPoints.find(point => point.classList.contains('is-unmodified'))
        expect(unmodifiedPoint).toBeDefined()
        expect(unmodifiedPoint.querySelector('.fix-path-control-point-visual').tagName.toLowerCase()).toBe('path')
        const movedPoint = correctionPoints.find(point => point.classList.contains('is-moved'))
        expect(movedPoint?.querySelector('.fix-path-control-point-visual').tagName.toLowerCase()).toBe('circle')
        const manualPoint = correctionPoints.find(point => point.dataset.controlPointId === 'fix-point-0-1b')
        expect(manualPoint?.classList.contains('is-moved')).toBe(true)
        expect(manualPoint?.querySelector('.fix-path-control-point-visual').tagName.toLowerCase()).toBe('circle')
        const clickProjectedPoint = (point, modifiers = {}) => {
            const hitbox = point.querySelector('.fix-path-control-point-hitbox')
            fireEvent.click(point, {
                clientX: Number(hitbox.getAttribute('cx')),
                clientY: Number(hitbox.getAttribute('cy')),
                ...modifiers,
            })
        }
        /** Dispatch a complete pointer click so capture-phase map gestures are exercised. */
        const pointerClickProjectedPoint = (point, modifiers = {}) => {
            const hitbox = point.querySelector('.fix-path-control-point-hitbox')
            const pointer = {
                pointerId: 59,
                button: 0,
                clientX: Number(hitbox.getAttribute('cx')),
                clientY: Number(hitbox.getAttribute('cy')),
                ...modifiers,
            }
            fireEvent.pointerDown(point, pointer)
            fireEvent.pointerUp(point, pointer)
            fireEvent.click(point, pointer)
        }
        const firstSectionPoint = correctionPoints.find(point => !point.classList.contains('is-inactive'))
        const sameSectionPoints = correctionPoints.filter(point => (
            point.dataset.correctionId === firstSectionPoint.dataset.correctionId
        ))
        let otherSectionPoint = correctionPoints.find(point => (
            point.dataset.correctionId !== firstSectionPoint.dataset.correctionId
        ))
        expect(sameSectionPoints.length).toBeGreaterThan(1)
        expect(otherSectionPoint).toBeDefined()
        expect(otherSectionPoint.getAttribute('aria-label')).toContain('click to activate')
        const unmodifiedSameSectionPoint = sameSectionPoints.find(point => point.classList.contains('is-unmodified'))
        expect(unmodifiedSameSectionPoint).toBeDefined()
        clickProjectedPoint(firstSectionPoint)
        const additionalSameSectionPoint = unmodifiedSameSectionPoint !== firstSectionPoint
            ? unmodifiedSameSectionPoint
            : sameSectionPoints.find(point => point !== firstSectionPoint)
        expect(additionalSameSectionPoint).toBeDefined()
        pointerClickProjectedPoint(additionalSameSectionPoint, {shiftKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected'))
            .toHaveLength(2))
        const mapGestureAfterShiftClick = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(mapGestureAfterShiftClick)).toBe(true)
        expect(mapGestureAfterShiftClick.defaultPrevented).toBe(false)
        correctionPoints = screen.getAllByRole('button', {name: /Correction point/})
        const currentSectionId = document.querySelector('.fix-path-correction-point-row')?.dataset.correctionId
        otherSectionPoint = correctionPoints.find(point => point.dataset.correctionId !== currentSectionId)

        const updateCallsBeforeInactiveDrag = updateJourney.mock.calls.length
        const inactivePointCapture = vi.fn()
        otherSectionPoint.setPointerCapture = inactivePointCapture
        const inactivePointHitbox = otherSectionPoint.querySelector('.fix-path-control-point-hitbox')
        fireEvent.pointerDown(otherSectionPoint, {
            pointerId: 61,
            button: 0,
            clientX: Number(inactivePointHitbox.getAttribute('cx')),
            clientY: Number(inactivePointHitbox.getAttribute('cy')),
        })
        fireEvent.pointerMove(otherSectionPoint, {pointerId: 61, button: 0, clientX: 60, clientY: 50})
        fireEvent.pointerUp(otherSectionPoint, {pointerId: 61, button: 0, clientX: 60, clientY: 50})
        expect(inactivePointCapture).not.toHaveBeenCalled()
        expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeInactiveDrag)

        clickProjectedPoint(otherSectionPoint, {altKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(1))
        correctionPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        expect(correctionPoints.filter(point => point.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
        expect(correctionPoints.find(point => point.dataset.controlPointId === otherSectionPoint.dataset.controlPointId)
            .getAttribute('aria-pressed')).toBe('true')
        expect(correctionPoints.find(point => point.dataset.controlPointId === otherSectionPoint.dataset.controlPointId)
            .getAttribute('aria-label')).toContain('drag to move')
        expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === otherSectionPoint.dataset.correctionId)).toBe(true)
        const selectedMapVisual = document.querySelector('.fix-path-control-point.is-selected .fix-path-control-point-visual')
        expect(selectedMapVisual?.tagName.toLowerCase()).toBe(
            document.querySelector('.fix-path-control-point.is-selected').classList.contains('is-unmodified') ? 'path' : 'circle',
        )
        fireEvent.keyDown(correctionPoints.find(point => (
            point.dataset.controlPointId === firstSectionPoint.dataset.controlPointId
        )), {key: 'Enter'})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(1))
        correctionPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        expect(correctionPoints.filter(point => point.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
        fireEvent.click(correctionPoints[2], {clientX: 24, clientY: 40})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(1))

        const selectedMapPoint = document.querySelector('.fix-path-control-point.is-selected')
        const selectedMapPointId = selectedMapPoint.dataset.correctionId
        const selectedControlPointId = selectedMapPoint.dataset.controlPointId
        const selectedMapPointHitbox = selectedMapPoint.querySelector('.fix-path-control-point-hitbox')
        const selectionX = Number(selectedMapPointHitbox.getAttribute('cx'))
        const selectionY = Number(selectedMapPointHitbox.getAttribute('cy'))
        fireEvent.pointerDown(selectedMapPoint, {
            pointerId: 17,
            button: 0,
            ctrlKey: true,
            altKey: true,
            clientX: selectionX - 2,
            clientY: selectionY - 2,
        })
        fireEvent.pointerMove(viewerContainer, {
            pointerId: 17,
            button: 0,
            ctrlKey: true,
            altKey: true,
            clientX: selectionX + 2,
            clientY: selectionY + 2,
        })
        const journeyCursorDuringRectangle = document.querySelector('.fix-path-journey-cursor')
        expect(journeyCursorDuringRectangle.textContent).toBe('square-dashed')
        expect(journeyCursorDuringRectangle.classList.contains('is-visible')).toBe(true)
        expect(viewerContainer.classList.contains('fix-path-custom-cursor')).toBe(true)
        expect(document.querySelector('.fix-path-selection-rectangle')).not.toBeNull()
        expect(document.querySelector('.fix-path-selection-lasso')).toBeNull()
        fireEvent.pointerUp(viewerContainer, {
            pointerId: 17,
            button: 0,
            ctrlKey: true,
            altKey: true,
            clientX: selectionX + 2,
            clientY: selectionY + 2,
        })
        const selectedPointSelector = '.fix-path-control-point[data-control-point-id="' + selectedControlPointId + '"]'
        await waitFor(() => expect(document.querySelector(selectedPointSelector + '.is-selected')).not.toBeNull())
        pointerClickProjectedPoint(document.querySelector(selectedPointSelector), {shiftKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(0))
        const controlLassoVertices = [
            {x: selectionX - 3, y: selectionY - 3},
            {x: selectionX + 6, y: selectionY - 3},
            {x: selectionX + 2, y: selectionY + 6},
        ]
        controlLassoVertices.forEach(({x, y}, index) => {
            const pointer = {
                pointerId: 18,
                button: 0,
                altKey: true,
                clientX: x,
                clientY: y,
            }
            if (index === 0) fireEvent.pointerDown(viewerContainer, pointer)
            else fireEvent.pointerMove(viewerContainer, pointer)
        })
        const journeyCursorDuringLasso = document.querySelector('.fix-path-journey-cursor')
        expect(journeyCursorDuringLasso.textContent).toBe('lasso')
        expect(journeyCursorDuringLasso.classList.contains('is-visible')).toBe(true)
        expect(viewerContainer.classList.contains('fix-path-custom-cursor')).toBe(true)
        const renderedControlLasso = document.querySelector('.fix-path-selection-lasso')
        expect(renderedControlLasso).not.toBeNull()
        expect(renderedControlLasso.tagName.toLowerCase()).toBe('path')
        expect(renderedControlLasso.getAttribute('d')).toMatch(/ C/)
        expect(document.querySelector('.fix-path-selection-guide')?.textContent)
            .toContain('Alt: drag around correction points and release, or click vertices and double-click to select')
        expect(document.querySelector('.fix-path-selection-guide')?.classList.contains('wa-theme-lgs1920-on-map'))
            .toBe(true)
        fireEvent.pointerUp(viewerContainer, {
            pointerId: 18,
            button: 0,
            altKey: true,
            clientX: controlLassoVertices.at(-1).x,
            clientY: controlLassoVertices.at(-1).y,
        })
        await waitFor(() => expect(document.querySelector(selectedPointSelector + '.is-selected')).not.toBeNull())
        expect(document.querySelector('.fix-path-control-point.is-selected')?.dataset.correctionId)
            .toBe(selectedMapPointId)
        pointerClickProjectedPoint(document.querySelector(selectedPointSelector), {shiftKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(0))
        const clickLassoVertices = [
            {x: selectionX - 10, y: selectionY - 10},
            {x: selectionX + 10, y: selectionY - 10},
            {x: selectionX, y: selectionY + 10},
        ]
        clickLassoVertices.forEach(({x, y}, index) => {
            const pointer = {
                pointerId: 20 + index,
                button: 0,
                altKey: true,
                clientX: x,
                clientY: y,
            }
            fireEvent.pointerDown(viewerContainer, pointer)
            fireEvent.pointerUp(viewerContainer, pointer)
            fireEvent.click(viewerContainer, {altKey: true, clientX: x, clientY: y})
        })
        expect(document.querySelector('.fix-path-selection-lasso')).not.toBeNull()
        expect(document.querySelector('.fix-path-selection-guide')?.textContent)
            .toContain('Alt: drag around correction points and release, or click vertices and double-click to select')
        expect(document.querySelector('.fix-path-selection-lasso-vertex')).toBeNull()
        fireEvent.doubleClick(viewerContainer, {
            altKey: true,
            clientX: clickLassoVertices.at(-1).x,
            clientY: clickLassoVertices.at(-1).y,
        })
        await waitFor(() => expect(document.querySelector(selectedPointSelector + '.is-selected')).not.toBeNull())
        const selectedPointIdsAfterClickLasso = [...document.querySelectorAll('.fix-path-control-point.is-selected')]
            .map(point => point.dataset.controlPointId)
        selectedPointIdsAfterClickLasso.forEach(controlPointId => {
            const selectedMarker = document.querySelector(
                '.fix-path-control-point[data-control-point-id="' + controlPointId + '"]',
            )
            if (selectedMarker) pointerClickProjectedPoint(selectedMarker, {shiftKey: true})
        })
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(0))
        expect(document.querySelector('.fix-path-selection-rectangle')).toBeNull()
        expect(document.querySelector('.fix-path-selection-lasso')).toBeNull()
        expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(0)
        const standardMapGestureAfterAlt = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(standardMapGestureAfterAlt)).toBe(true)
        expect(standardMapGestureAfterAlt.defaultPrevented).toBe(false)
        const cmdShiftMapGesture = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            metaKey: true,
            shiftKey: true,
        })
        expect(canvas.dispatchEvent(cmdShiftMapGesture)).toBe(true)
        expect(cmdShiftMapGesture.defaultPrevented).toBe(false)
        const cmdShiftMapMove = new MouseEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            metaKey: true,
            shiftKey: true,
            clientX: 60,
            clientY: 60,
        })
        expect(canvas.dispatchEvent(cmdShiftMapMove)).toBe(true)
        expect(cmdShiftMapMove.defaultPrevented).toBe(false)
        const cmdShiftMapUp = new MouseEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            button: 0,
            metaKey: true,
            shiftKey: true,
            clientX: 60,
            clientY: 60,
        })
        expect(canvas.dispatchEvent(cmdShiftMapUp)).toBe(true)
        expect(cmdShiftMapUp.defaultPrevented).toBe(false)
        expect(document.querySelector('.fix-path-selection-rectangle')).toBeNull()
        expect(document.querySelector('.fix-path-selection-lasso')).toBeNull()

        const tailSection = {
            id: 'tail-section',
            segmentIndex: 0,
            startIndex: 8,
            endIndex: 9,
            sourceFingerprint: getFixPathSourceFingerprint(journey.tracks.get('track-a').content, 0, 8, 9),
            controlPoints: [8, 9].map(index => ({
                id: 'fix-point-0-' + index,
                sourceIndex: index,
                progress: index === 8 ? 0.25 : 0.75,
                coordinate: [-122.01 + index * 0.001, 37, 10],
                fixed: false,
            })),
        }
        act(() => {
            journey.fixPathCorrectionData = {
                revision: journey.fixPathCorrectionData.revision + 1,
                tracks: {'track-a': [...initialCorrectionSections, tailSection]},
                currentSection: {trackSlug: 'track-a', correctionId: 'tail-section'},
            }
        })
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'tail-section')).toBe(true))
        const updateCallsBeforeTailShiftAdd = updateJourney.mock.calls.length
        const tailSourceLasso = [{x: 68, y: 45}, {x: 84, y: 45}, {x: 84, y: 55}, {x: 68, y: 55}]
        tailSourceLasso.forEach(({x, y}, index) => {
            const pointer = {
                pointerId: 40,
                button: 0,
                shiftKey: true,
                clientX: x,
                clientY: y,
            }
            if (index === 0) fireEvent.pointerDown(viewerContainer, pointer)
            else fireEvent.pointerMove(viewerContainer, pointer)
        })
        expect(document.querySelector('.fix-path-selection-lasso')).not.toBeNull()
        expect(document.querySelector('.fix-path-selection-guide')?.textContent)
            .toContain('Shift: drag around Journey points and release, or click vertices and double-click to select')
        fireEvent.pointerUp(viewerContainer, {
            pointerId: 40,
            button: 0,
            shiftKey: true,
            clientX: tailSourceLasso.at(-1).x,
            clientY: tailSourceLasso.at(-1).y,
        })
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-9"]',
        )).not.toBeNull())
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="fix-point-0-10"]',
        )).not.toBeNull())
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .map(row => row.dataset.controlPointId)).toEqual([
            'fix-point-0-8',
            'fix-point-0-9',
            'fix-point-0-10',
        ]))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeTailShiftAdd + 1))
        const tailAddedMarker = document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-10"]')
        expect(tailAddedMarker?.classList.contains('is-unmodified')).toBe(true)
        expect(tailAddedMarker?.classList.contains('is-selected')).toBe(false)
        const tailUnmodifiedMarker = document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-9"]')
        expect(tailUnmodifiedMarker?.classList.contains('is-unmodified')).toBe(true)
        expect(tailUnmodifiedMarker?.classList.contains('is-selected')).toBe(false)
        const tailSourcePoint = journey.fixPathCorrectionData.tracks['track-a']
            .find(correction => correction.id === 'tail-section')
            .controlPoints.find(point => point.sourceIndex === 9)
        expect(tailSourcePoint).toMatchObject({fixed: false, removed: false})
        expect(tailSourcePoint.erased).toBeUndefined()
        expect(document.querySelector('.fix-path-source-points')).toBeNull()
        const updateCallsBeforeUndoAddition = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(2))
        expect(document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-9"]')).not.toBeNull()
        expect(document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-10"]')).toBeNull()
        expect(document.querySelector('.fix-path-source-points')).toBeNull()
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeUndoAddition + 1))
        const updateCallsBeforeRedoAddition = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Redo correction change'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeRedoAddition + 1))
        expect(editorStore.fixPathEditorOpen).toBe(true)
        expect(journey.fixPathEnabled).toBe(true)
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
            name: /Correction point/,
        })
        fireEvent.pointerDown(correctionPoints[2], {pointerId: 1, clientX: 24, clientY: 40})
        fireEvent.pointerUp(correctionPoints[2], {pointerId: 1, clientX: 24, clientY: 40})
        fireEvent.click(correctionPoints[2], {clientX: 24, clientY: 40})

        await waitFor(() => {
            expect(controller.enableRotate).toBe(true)
            expect(controller.enableInputs).toBe(true)
            expect(controller.enableTranslate).toBe(true)
            expect(controller.enableTilt).toBe(true)
            expect(controller.enableLook).toBe(true)
            expect(screen.getByRole('heading', {name: 'Fix Path'})).not.toBeNull()
            expect(screen.getByRole('heading', {name: 'Fix Path'}).querySelector('[aria-hidden="true"]')?.textContent).toBe('draw-polygon')
            expect(screen.queryByText(/Each section is limited/)).toBeNull()
            expect(screen.getByText('Lat')).not.toBeNull()
            expect(screen.getByText('Lon')).not.toBeNull()
            expect(screen.getByText('Height (m)')).not.toBeNull()
        })
        unitSystem.current = 1
        await waitFor(() => expect(screen.getByText('Height (ft)')).not.toBeNull())
        expect(Number(screen.getAllByRole('spinbutton', {name: 'Height (ft)'})[0].value)).toBe(33)
        unitSystem.current = 0
        await waitFor(() => expect(screen.getByText('Height (m)')).not.toBeNull())
        const standardMapGesture = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        expect(canvas.dispatchEvent(standardMapGesture)).toBe(true)
        expect(standardMapGesture.defaultPrevented).toBe(false)
        expect(camera.flyTo).not.toHaveBeenCalled()
        expect(camera.zoomIn).not.toHaveBeenCalled()
        expect(camera.zoomOut).not.toHaveBeenCalled()
        const resetButtons = screen.getAllByRole('button', {name: 'Reset correction point'})
        const removeButtons = screen.getAllByRole('button', {name: 'Remove correction point'})
        expect(screen.getByRole('button', {name: 'Erase selection'})).not.toBeNull()
        expect(screen.queryByText('Erase', {exact: true})).toBeNull()
        expect(document.querySelector('wa-tooltip[for="fix-path-erase"]')?.textContent)
            .toBe('Erase selection')
        const unmodifiedMapPoint = document.querySelector('.fix-path-control-point.is-unmodified:not(.is-inactive)')
        expect(unmodifiedMapPoint).not.toBeNull()
        fireEvent.contextMenu(unmodifiedMapPoint, {button: 2, clientX: 120, clientY: 80})
        const pointContextMenu = screen.getByRole('menu', {name: 'Correction point actions'})
        expect(pointContextMenu.classList.contains('wa-theme-lgs1920-on-map')).toBe(true)
        expect(pointContextMenu.classList.contains('lgs-context-menu')).toBe(true)
        expect(screen.queryByRole('menuitem', {name: 'Reset'})).toBeNull()
        expect(screen.getByRole('menuitem', {name: 'Remove'})).not.toBeNull()
        fireEvent.keyDown(pointContextMenu, {key: 'Escape'})
        await waitFor(() => expect(screen.queryByRole('menu', {name: 'Correction point actions'})).toBeNull())
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
        expect(screen.queryByText(/Plain click selects one point/)).toBeNull()
        const helpButton = screen.getByRole('button', {name: 'Help'})
        expect(helpButton.closest('.fix-path-panel-header-actions')).not.toBeNull()
        expect(document.querySelector('.fix-path-main-toolbar .fix-path-panel-header-actions')).toBeNull()
        expect(screen.getByRole('button', {name: 'Close Fix Path editor'}).closest('.fix-path-panel-header-actions')).not.toBeNull()
        const focusJourneyButton = screen.getByRole('button', {name: 'Focus Journey'})
        expect(focusJourneyButton.closest('.fix-path-panel-header-actions')).not.toBeNull()
        expect(document.querySelector('wa-tooltip[for="fix-path-focus-journey"]')?.textContent).toBe('Focus Journey')
        expect(focusJourneyButton.querySelector('span')?.textContent).toBe('crosshairs-simple')
        fireEvent.click(focusJourneyButton)
        await waitFor(() => expect(journey.focus).toHaveBeenCalledWith({resetCamera: true, rotate: false}))
        expect(document.querySelector('wa-tooltip[for="fix-path-help-trigger"]')?.textContent).toBe('Help')
        expect(helpButton.querySelector('span')?.textContent).toBe('question')
        expect(helpButton.querySelector('span')?.getAttribute('aria-hidden')).toBe('true')
        expect(helpButton.getAttribute('aria-expanded')).toBe('false')
        fireEvent.click(helpButton)
        expect(screen.getByRole('dialog', {name: 'Fix Path help'})).not.toBeNull()
        expect(document.querySelector('.fix-path-help-content')?.textContent)
            .toContain('Shift-drag or Alt-drag draws a lasso; Ctrl+Shift-drag or Ctrl+Alt-drag draws a rectangle')
        expect(document.querySelector('.fix-path-help-content')?.textContent)
            .toContain('Shift and Ctrl gestures select Journey points when they start over the route')
        expect(document.querySelector('.fix-path-help-content')?.textContent)
            .toContain('Press Escape to cancel')
        expect(document.querySelector('.fix-path-help-content')?.textContent)
            .toContain('Alt gestures select correction points in the current section')
        expect(document.querySelector('.fix-path-help-content')?.textContent)
            .toContain('accepted corrections remain stored and continue to apply')
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
        expect(document.querySelector('.fix-path-correction-selection-hint')).toBeNull()
        expect(screen.getByText(/move focus between rows without changing the selected points/)).not.toBeNull()
        expect(document.querySelectorAll('.fix-path-correction-section')).toHaveLength(1)
        expect(screen.queryByText('Track A')).toBeNull()
        expect(screen.queryByText(/Segment/)).toBeNull()

        expect(screen.getAllByRole('textbox', {name: 'Lat'})[0].readOnly).toBe(true)
        expect(screen.getAllByRole('textbox', {name: 'Lon'})[0].readOnly).toBe(true)
        const selectedCorrectionRow = document.querySelector('.fix-path-correction-point-row[aria-current="true"]')
        const heightInput = selectedCorrectionRow.querySelector('[aria-label="Height (m)"]')
        expect(heightInput.readOnly).toBe(false)
        expect(heightInput.type).toBe('number')
        heightInput.focus()
        fireEvent.keyDown(heightInput, {key: 'ArrowDown'})
        const focusedCorrectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
        const selectedRowIndex = focusedCorrectionRows.indexOf(selectedCorrectionRow)
        const nextFocusedRow = focusedCorrectionRows[Math.min(focusedCorrectionRows.length - 1, selectedRowIndex + 1)]
        expect(document.activeElement).toBe(nextFocusedRow)
        expect(selectedCorrectionRow.getAttribute('aria-current')).toBe('true')
        const originalHeightValue = heightInput.value
        const updateCallsBeforeHeight = updateJourney.mock.calls.length
        fireEvent.input(heightInput, {target: {value: '12.6'}})
        fireEvent.change(heightInput, {target: {value: '12.6'}})
        await waitFor(() => expect(heightInput.value).toBe('13'))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeHeight + 1))
        await waitFor(() => expect(screen.queryByText('Validating and applying Journey changes…')).toBeNull())
        const editedHeightValue = heightInput.value
        const updateCallsBeforeHeightUndo = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(heightInput.value).toBe(originalHeightValue))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeHeightUndo + 1))
        const updateCallsBeforeHeightRedo = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Redo correction change'}))
        await waitFor(() => expect(heightInput.value).toBe(editedHeightValue))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeHeightRedo + 1))

        let currentControlPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        const clickControlPoint = (point, modifiers = {}) => {
            const hitbox = point.querySelector('.fix-path-control-point-hitbox')
            fireEvent.click(point, {
                clientX: Number(hitbox.getAttribute('cx')),
                clientY: Number(hitbox.getAttribute('cy')),
                ...modifiers,
            })
        }
        const rangeAnchor = currentControlPoints.find(point => point.classList.contains('is-selected'))
            ?? currentControlPoints.find(point => !point.classList.contains('is-inactive'))
        const rangeTarget = currentControlPoints.find(point => (
            point.dataset.correctionId === rangeAnchor.dataset.correctionId
            && point.dataset.controlPointId !== rangeAnchor.dataset.controlPointId
        ))
        expect(rangeTarget).toBeDefined()
        clickControlPoint(rangeAnchor)
        currentControlPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        const currentRangeTarget = currentControlPoints.find(point => (
            point.dataset.controlPointId === rangeTarget.dataset.controlPointId
        ))
        const sectionPoints = currentControlPoints.filter(point => (
            point.dataset.correctionId === rangeAnchor.dataset.correctionId
        ))
        const rangeAnchorIndex = sectionPoints.findIndex(point => (
            point.dataset.controlPointId === rangeAnchor.dataset.controlPointId
        ))
        const rangeTargetIndex = sectionPoints.findIndex(point => (
            point.dataset.controlPointId === currentRangeTarget.dataset.controlPointId
        ))
        const expectedRangeCount = Math.abs(rangeTargetIndex - rangeAnchorIndex) + 1
        const rangeTargetRow = document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="' + currentRangeTarget.dataset.controlPointId + '"]',
        )
        fireEvent.click(rangeTargetRow, {shiftKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected')).toHaveLength(expectedRangeCount))
        currentControlPoints = screen.getAllByRole('button', {
            name: /Correction point/,
        })
        const selectedRangePoints = currentControlPoints.filter(point => point.getAttribute('aria-pressed') === 'true')
        expect(selectedRangePoints).toHaveLength(expectedRangeCount)
        expect(screen.getByText(new RegExp(expectedRangeCount + ' correction points selected'))).not.toBeNull()
        expect(selectedRangePoints.every(point => point.dataset.correctionId === rangeAnchor.dataset.correctionId)).toBe(true)
        const dragPoint = currentControlPoints.find(point => (
            point.dataset.controlPointId === rangeTarget.dataset.controlPointId
        ))
        const updateCallsBeforeMove = updateJourney.mock.calls.length
        const originalTrackContent = journey.tracks.get('track-a').content
        const setPointerCapture = vi.fn(() => { throw new Error('Pointer is no longer active') })
        dragPoint.setPointerCapture = setPointerCapture
        const dragPointHitbox = dragPoint.querySelector('.fix-path-control-point-hitbox')
        const originalHeights = screen.getAllByRole('spinbutton', {name: 'Height (m)'}).map(input => input.value)
        fireEvent.pointerDown(dragPoint, {
            pointerId: 2,
            clientX: Number(dragPointHitbox.getAttribute('cx')),
            clientY: Number(dragPointHitbox.getAttribute('cy')),
        })
        expect(setPointerCapture).toHaveBeenCalledOnce()
        fireEvent.pointerMove(dragPoint, {pointerId: 2, clientX: 40, clientY: 40})
        fireEvent.pointerUp(dragPoint, {pointerId: 2, clientX: 40, clientY: 40})
        fireEvent.click(dragPoint, {clientX: 40, clientY: 40})
        await waitFor(() => expect(screen.getAllByRole('spinbutton', {name: 'Height (m)'}).map(input => input.value))
            .not.toEqual(originalHeights))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeMove + 1))
        await waitFor(() => expect(screen.queryByText('Validating and applying Journey changes…')).toBeNull())
        expect(redraw).toHaveBeenCalledTimes(updateCallsBeforeMove + 1)
        expect(getCorrectedTrackContent(journey.tracks.get('track-a')).geometry.coordinates)
            .not.toEqual(originalTrackContent.geometry.coordinates)
        const movedHeights = screen.getAllByRole('spinbutton', {name: 'Height (m)'}).map(input => input.value)
        const shortcutRow = screen.getAllByRole('button', {name: 'Reset correction point'})[0]
            .closest('.fix-path-correction-point-row')
        const shortcutPoint = [...document.querySelectorAll('.fix-path-control-point')].find(point => (
            point.dataset.correctionId === shortcutRow.dataset.correctionId
            && point.dataset.controlPointId === shortcutRow.dataset.controlPointId
        ))
        expect(shortcutPoint).not.toBeNull()
        fireEvent.contextMenu(shortcutPoint, {button: 2, clientX: 140, clientY: 90})
        const movedPointContextMenu = screen.getByRole('menu', {name: 'Correction point actions'})
        expect(screen.getByRole('menuitem', {name: 'Reset'})).not.toBeNull()
        expect(screen.getByRole('menuitem', {name: 'Remove'})).not.toBeNull()
        fireEvent.keyDown(movedPointContextMenu, {key: 'Escape'})
        await waitFor(() => expect(screen.queryByRole('menu', {name: 'Correction point actions'})).toBeNull())
        const updateCallsBeforeReset = updateJourney.mock.calls.length
        fireEvent.keyDown(shortcutPoint, {key: 'Backspace'})
        await waitFor(() => expect(screen.getAllByRole('spinbutton', {name: 'Height (m)'}).map(input => input.value))
            .not.toEqual(movedHeights))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeReset + 1))
        await waitFor(() => expect(screen.queryByText('Validating and applying Journey changes…')).toBeNull())
        const updateCallsBeforeRemoveShortcut = updateJourney.mock.calls.length
        fireEvent.keyDown(shortcutPoint, {key: 'Delete'})
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="' + shortcutPoint.dataset.controlPointId + '"].is-removed',
        )).not.toBeNull())
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeRemoveShortcut + 1))
        const updateCallsBeforeUndoRemoveShortcut = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(document.querySelector(
            '.fix-path-correction-point-row[data-control-point-id="' + shortcutPoint.dataset.controlPointId + '"].is-removed',
        )).toBeNull())
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeUndoRemoveShortcut + 1))
        expect(screen.queryByRole('button', {name: /Journey points in selected area/})).toBeNull()

        const tailMapPoint = document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-9"]')
        expect(tailMapPoint).not.toBeNull()
        fireEvent.click(tailMapPoint)
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'tail-section')).toBe(true))
        const activeSectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
        expect(activeSectionRows).toHaveLength(3)
        fireEvent.keyDown(activeSectionRows[0], {key: 'a', ctrlKey: true})
        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point.is-selected'))
            .toHaveLength(activeSectionRows.length))
        const selectedPointIds = [...document.querySelectorAll('.fix-path-control-point.is-selected')]
            .map(point => point.dataset.controlPointId)
        expect(selectedPointIds).toHaveLength(activeSectionRows.length)
        const updateCallsBeforeErase = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Erase selection'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId !== 'tail-section')).toBe(true))
        expect(screen.getByRole('button', {name: 'Erase selection'}).getAttribute('aria-pressed')).toBe('false')
        selectedPointIds.forEach(id => {
            expect(document.querySelector('.fix-path-control-point[data-control-point-id="' + id + '"]')).toBeNull()
        })
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeErase + 1))
        await waitFor(() => expect(screen.queryByText('Validating and applying Journey changes…')).toBeNull())
        const erasedSection = journey.fixPathCorrectionData.tracks['track-a'].find(section => section.id === 'tail-section')
        expect(erasedSection).toBeUndefined()
        expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(2)
        expect(screen.getByRole('button', {name: 'Undo correction change'}).disabled).toBe(false)

        const updateCallsBeforeUndo = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeUndo + 1))
        expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(3)
        expect(screen.getByRole('button', {name: 'Redo correction change'}).disabled).toBe(false)
        const updateCallsBeforeRedo = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Redo correction change'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId !== 'tail-section')).toBe(true))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeRedo + 1))
        expect(journey.fixPathCorrectionData.tracks['track-a'].find(section => section.id === 'tail-section'))
            .toBeUndefined()
        expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(2)

        const sectionRowToDelete = document.querySelector('.fix-path-correction-point-row')
        const sectionIdToDelete = sectionRowToDelete?.dataset.correctionId
        const updateCallsBeforeSectionDelete = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Delete entire section'}))
        await waitFor(() => expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(1))
        expect(journey.fixPathCorrectionData.tracks['track-a'].some(section => section.id === sectionIdToDelete))
            .toBe(false)
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeSectionDelete + 1))
        const updateCallsBeforeUndoSectionDelete = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(2))
        expect(journey.fixPathCorrectionData.tracks['track-a'].some(section => section.id === sectionIdToDelete))
            .toBe(true)
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeUndoSectionDelete + 1))

        const fixtureSection = journey.fixPathCorrectionData.tracks['track-a']
            .find(section => section.id === sectionIdToDelete)
        const initialPointCoordinates = new Map(initialCorrectionSections.flatMap(section => (
            section.controlPoints.map(point => [point.id, point.coordinate])
        )))
        const editedPointCoordinates = new Map()
        act(() => {
            journey.fixPathCorrectionData = {
                ...journey.fixPathCorrectionData,
                revision: journey.fixPathCorrectionData.revision + 1,
                currentSection: {trackSlug: 'track-a', correctionId: sectionIdToDelete},
                tracks: {
                    'track-a': journey.fixPathCorrectionData.tracks['track-a'].map(section => section.id !== sectionIdToDelete
                        ? section
                        : {
                            ...section,
                            controlPoints: section.controlPoints.map(point => {
                                const coordinate = [
                                    Number(point.coordinate[0]) + 0.01,
                                    Number(point.coordinate[1]) + 0.01,
                                    Number(point.coordinate[2] ?? 0) + 100,
                                ]
                                editedPointCoordinates.set(point.id, coordinate)
                                return {...point, coordinate, fixed: true, removed: false, erased: false}
                            }),
                        }),
                },
            }
        })
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .filter(row => row.dataset.correctionId === sectionIdToDelete).length).toBe(fixtureSection.controlPoints.length))
        const selectedSectionRows = [...document.querySelectorAll('.fix-path-correction-point-row')]
            .filter(row => row.dataset.correctionId === sectionIdToDelete)
        expect(selectedSectionRows.length).toBeGreaterThan(1)
        fireEvent.click(selectedSectionRows[0])
        fireEvent.click(selectedSectionRows.at(-1), {shiftKey: true})
        await waitFor(() => expect(screen.getByRole('button', {name: 'Reset selected correction points'})).not.toBeNull())
        expect(screen.getByRole('button', {name: 'Remove selected correction points'}).disabled).toBe(false)
        expect(screen.getAllByRole('button', {name: 'Reset correction point'}).every(button => button.disabled)).toBe(true)
        expect(screen.getAllByRole('button', {name: 'Remove correction point'}).every(button => button.disabled)).toBe(true)

        const selectedPointIdsForBulkActions = selectedSectionRows.map(row => row.dataset.controlPointId)
        const updateCallsBeforeBulkReset = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Reset selected correction points'}))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeBulkReset + 1))
        const resetSection = journey.fixPathCorrectionData.tracks['track-a']
            .find(section => section.id === sectionIdToDelete)
        selectedPointIdsForBulkActions.forEach(controlPointId => {
            const point = resetSection.controlPoints.find(control => control.id === controlPointId)
            const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(controlPointId)
            const sourceIndex = Number.isInteger(point.sourceIndex)
                ? point.sourceIndex
                : sourcePoint ? Number(sourcePoint[2]) : Number.NaN
            const expectedCoordinate = Number.isInteger(sourceIndex)
                ? journey.tracks.get('track-a').content.geometry.coordinates[sourceIndex]
                : initialPointCoordinates.get(controlPointId) ?? editedPointCoordinates.get(controlPointId)
            expect(point.coordinate).toEqual(expectedCoordinate)
        })

        const updateCallsBeforeBulkRemove = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Remove selected correction points'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .filter(row => row.dataset.correctionId === sectionIdToDelete)
            .every(row => row.classList.contains('is-removed'))).toBe(true))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeBulkRemove + 1))
        expect(screen.queryByRole('button', {name: 'Reset selected correction points'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Remove selected correction points'})).toBeNull()

        const updateCallsBeforeUndoBulkRemove = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .filter(row => row.dataset.correctionId === sectionIdToDelete)
            .every(row => !row.classList.contains('is-removed'))).toBe(true))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeUndoBulkRemove + 1))

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
                tracks: {'track-a': [firstValidationSection, secondValidationSection, makeValidationSection('validation-c', 8, 9)]},
            }
        })
        await waitFor(() => expect(screen.getByRole('button', {name: 'Next section'})).not.toBeNull())
        expect(screen.getByRole('button', {name: 'First section'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Last section'})).not.toBeNull()
        const setViewCallsBeforeNavigation = camera.setView.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'validation-b')).toBe(true))
        await waitFor(() => expect(journey.fixPathCorrectionData.currentSection)
            .toEqual({trackSlug: 'track-a', correctionId: 'validation-b'}))
        fireEvent.click(screen.getByRole('button', {name: 'Last section'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'validation-c')).toBe(true))
        fireEvent.click(screen.getByRole('button', {name: 'First section'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'validation-a')).toBe(true))
        fireEvent.click(screen.getByRole('button', {name: 'Next section'}))
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'validation-b')).toBe(true))
        expect(camera.setView).toHaveBeenCalledTimes(setViewCallsBeforeNavigation + 4)
        expect(camera.setView.mock.lastCall[0].orientation).toEqual({
            direction: camera.directionWC,
            up: camera.upWC,
        })
        expect(camera.zoomIn).not.toHaveBeenCalled()
        expect(camera.zoomOut).not.toHaveBeenCalled()
        expect(widgetConfig.position).toEqual({left: 30, top: 40})
        expect(applyWidgetPosition).not.toHaveBeenCalled()

        const updateCallsBeforeClose = updateJourney.mock.calls.length
        const setViewCallsBeforeClose = camera.setView.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Close Fix Path editor'}))
        await waitFor(() => expect(editorStore.fixPathEditorOpen).toBe(false))
        await waitFor(() => expect(setDisplayContentOverride).toHaveBeenLastCalledWith(
            journey.tracks.get('track-a'),
            null,
        ))
        expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeClose)
        expect(redraw).toHaveBeenCalledTimes(updateCallsBeforeClose)

        await waitFor(() => {
            expect(controller.enableInputs).toBe(false)
            expect(controller.enableRotate).toBe(true)
            expect(controller.enableTranslate).toBe(false)
            expect(controller.enableZoom).toBe(true)
            expect(controller.enableTilt).toBe(true)
            expect(controller.enableLook).toBe(true)
        })
        act(() => {
            editorStore.fixPathEditorOpen = true
        })
        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .every(row => row.dataset.correctionId === 'validation-b')).toBe(true))
        await waitFor(() => expect(camera.setView).toHaveBeenCalledTimes(setViewCallsBeforeClose + 1))
        const expectedTarget = Cartesian3.fromDegrees(-122.0055, 37.001, 20)
        const previousSurface = Cartesian3.fromDegrees(-122.011, 37, 0)
        const expectedDestination = Cartesian3.add(
            camera.positionWC,
            Cartesian3.subtract(expectedTarget, previousSurface, new Cartesian3()),
            new Cartesian3(),
        )
        expect(Cartesian3.distance(camera.setView.mock.lastCall[0].destination, expectedDestination)).toBeLessThan(0.01)

        act(() => {
            journey.fixPathCorrectionData = {
                revision: journey.fixPathCorrectionData.revision + 1,
                tracks: {},
            }
        })
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(0))
        const initialSectionLasso = [
            {x: 6, y: 42},
            {x: 26, y: 42},
            {x: 26, y: 58},
            {x: 6, y: 58},
        ]
        initialSectionLasso.forEach(({x, y}, index) => {
            const pointer = {
                pointerId: 50,
                button: 0,
                shiftKey: true,
                clientX: x,
                clientY: y,
            }
            if (index === 0) fireEvent.pointerDown(viewerContainer, pointer)
            else fireEvent.pointerMove(viewerContainer, pointer)
        })
        fireEvent.pointerUp(viewerContainer, {
            pointerId: 50,
            button: 0,
            shiftKey: true,
            clientX: initialSectionLasso.at(-1).x,
            clientY: initialSectionLasso.at(-1).y,
        })
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(3))
        const initialSectionMarkers = [...document.querySelectorAll('.fix-path-control-point')]
        expect(initialSectionMarkers).toHaveLength(3)
        expect(initialSectionMarkers.every(point => point.classList.contains('is-unmodified'))).toBe(true)
        expect(initialSectionMarkers.every(point => !point.classList.contains('is-selected'))).toBe(true)
        expect(document.querySelector('.fix-path-source-points')).toBeNull()
        expect(document.querySelector('.fix-path-pending-point')).toBeNull()
        expect(journey.fixPathCorrectionData.tracks['track-a'][0].startIndex).toBe(1)
        expect(journey.fixPathCorrectionData.tracks['track-a'][0].endIndex).toBe(3)
        expect(journey.fixPathCorrectionData.currentSection).toEqual({
            trackSlug: 'track-a',
            correctionId: journey.fixPathCorrectionData.tracks['track-a'][0].id,
        })

        lgs.viewer.scene.pick.mockReturnValue({id: 'track-a'})
        act(() => fireEvent.pointerMove(canvas, {clientX: 50, clientY: 50, pointerType: 'mouse'}))
        expect(canvas.classList.contains('fix-path-journey-hover')).toBe(true)
        const journeyCursorAfterPointerMove = document.querySelector('.fix-path-journey-cursor')
        expect(journeyCursorAfterPointerMove.classList.contains('is-visible')).toBe(true)
        expect(journeyCursorAfterPointerMove.textContent).toBe('circle-plus')
        expect(canvasEventCallbacks.rightClickOptions).toMatchObject({
            entity: false,
            priority: 100,
            preventLowerPriority: 'handled',
        })
        act(() => expect(canvasEventCallbacks.rightClick({position: {x: 50, y: 50}})).toBe(true))
        const mapContextMenu = vi.fn()
        canvas.addEventListener('contextmenu', mapContextMenu)
        fireEvent.contextMenu(canvas, {button: 2, clientX: 50, clientY: 50})
        expect(mapContextMenu).not.toHaveBeenCalled()
        expect(screen.getByRole('menu', {name: 'Journey route actions'}).classList.contains('wa-theme-lgs1920-on-map'))
            .toBe(true)
        fireEvent.keyDown(screen.getByRole('menu', {name: 'Journey route actions'}), {key: 'Escape'})
        await waitFor(() => expect(screen.queryByRole('menu', {name: 'Journey route actions'})).toBeNull())
        fireEvent.click(canvas, {button: 0, clientX: 50, clientY: 50})
        await waitFor(() => expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(2))
        await waitFor(() => expect(document.querySelectorAll('.fix-path-correction-point-row')).toHaveLength(1))
        const routeAddedSection = journey.fixPathCorrectionData.tracks['track-a'].find(section => section.startIndex > 3)
        expect(routeAddedSection).toBeDefined()
        expect(routeAddedSection.startIndex).toBe(5)
        expect(routeAddedSection.endIndex).toBe(6)
        expect(routeAddedSection.controlPoints).toHaveLength(1)
        expect(routeAddedSection.controlPoints[0]).toMatchObject({fixed: true, removed: false})

        const updateCallsBeforeRouteUndo = updateJourney.mock.calls.length
        fireEvent.click(screen.getByRole('button', {name: 'Undo correction change'}))
        await waitFor(() => expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(1))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeRouteUndo + 1))
        viewerContainer.remove()
    }, 45000)

    it('does not restore a removed source point when Shift-Lasso selects it', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
        }))

        const editorStore = proxy({fixPathEditorOpen: true})
        const rotateState = proxy({running: false})
        const panoramaState = proxy({active: false})
        const unitSystem = proxy({current: 0})
        const content = {
            geometry: {
                type: 'LineString',
                coordinates: Array.from({length: 12}, (_, index) => [-122.01 + index * 0.001, 37, 10]),
            },
        }
        const removedSection = {
            id: 'tail-section',
            segmentIndex: 0,
            startIndex: 8,
            endIndex: 9,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 8, 9),
            controlPoints: [
                {
                    id: 'fix-point-0-8',
                    sourceIndex: 8,
                    progress: 0,
                    coordinate: content.geometry.coordinates[8],
                    fixed: false,
                    removed: false,
                },
                {
                    id: 'fix-point-0-9',
                    sourceIndex: 9,
                    progress: 1,
                    coordinate: content.geometry.coordinates[9],
                    fixed: false,
                    removed: true,
                    erased: true,
                },
            ],
        }
        const journey = proxy({
            slug: 'journey-a',
            focus: vi.fn(async () => {}),
            tracks: proxyMap([['track-a', {
                slug: 'track-a',
                parent: 'journey-a',
                title: 'Track A',
                content,
            }]]),
            fixPathCorrectionData: {
                revision: 1,
                tracks: {'track-a': [removedSection]},
                currentSection: {trackSlug: 'track-a', correctionId: 'tail-section'},
            },
            fixPathEnabled: true,
            persistToDatabase: vi.fn(async () => {}),
        })
        const camera = {
            setView: vi.fn(),
            flyTo: vi.fn(),
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            positionWC: Cartesian3.fromDegrees(-122.011, 37, 1000),
            directionWC: new Cartesian3(0, 0, -1),
            upWC: new Cartesian3(0, 1, 0),
            pickEllipsoid: vi.fn(() => Cartesian3.fromDegrees(-122.011, 37, 0)),
        }
        const canvas = document.createElement('canvas')
        canvas.width = 100
        canvas.height = 100
        const viewerContainer = document.createElement('div')
        viewerContainer.className = 'fix-path-test-viewer-container'
        viewerContainer.append(canvas)
        document.body.append(viewerContainer)
        const widgetList = proxyMap([['journey-toolbar-widget', {widgetsBoard: 'scene', zIndex: 4100}]])
        const updateFixPathWidgetRect = vi.fn()

        globalThis.lgs = {
            getJourneyBySlug: vi.fn(slug => slug === journey.slug ? journey : null),
            stores: {
                journeyEditor: editorStore,
                ui: {
                    mainUI: {rotate: rotateState, panorama: panoramaState},
                    widget: {list: widgetList},
                },
            },
            theJourneyEditorProxy: proxy({journey, track: null}),
            settings: {journey: proxy({}), unitSystem},
            viewer: {
                container: viewerContainer,
                canvas,
                scene: {
                    camera,
                    screenSpaceCameraController: {
                        enableInputs: true,
                        enableRotate: true,
                        enableTranslate: true,
                        enableZoom: true,
                        enableTilt: true,
                        enableLook: true,
                    },
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
                poiManager: {stopRotationAndSync: vi.fn(async () => {})},
                widgetManager: {
                    getElementById: vi.fn(() => document.querySelector('[data-testid="fix-path-widget"]')),
                    getMoveable: vi.fn(() => ({current: {updateRect: updateFixPathWidgetRect}})),
                    getWidgetConfig: vi.fn(() => ({type: 'lgs-visual-widget', widgetsBoard: 'scene'})),
                },
            },
        }
        const updateJourney = vi.spyOn(Utils, 'updateJourney').mockResolvedValue({draw: vi.fn()})
        vi.spyOn(TrackUtils, 'setDisplayContentOverride')
        vi.spyOn(TrackUtils, 'draw').mockResolvedValue(undefined)

        render(<FixPathEditor/>)

        await waitFor(() => expect([...document.querySelectorAll('.fix-path-correction-point-row')]
            .map(row => row.dataset.controlPointId)).toEqual(['fix-point-0-8']))
        const updateCallsBeforeLasso = updateJourney.mock.calls.length
        const removedPointLasso = [
            {x: 70, y: 46},
            {x: 76, y: 46},
            {x: 76, y: 54},
            {x: 70, y: 54},
        ]
        removedPointLasso.forEach(({x, y}, index) => {
            const pointer = {pointerId: 60, button: 0, shiftKey: true, clientX: x, clientY: y}
            if (index === 0) fireEvent.pointerDown(viewerContainer, pointer)
            else fireEvent.pointerMove(viewerContainer, pointer)
        })
        fireEvent.pointerUp(viewerContainer, {
            pointerId: 60,
            button: 0,
            shiftKey: true,
            clientX: removedPointLasso.at(-1).x,
            clientY: removedPointLasso.at(-1).y,
        })
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(journey.fixPathCorrectionData.revision).toBe(1)
        expect(journey.fixPathCorrectionData.tracks['track-a'][0].controlPoints.find(point => point.sourceIndex === 9))
            .toMatchObject({fixed: false, removed: true, erased: true})
        expect(document.querySelector('.fix-path-control-point[data-control-point-id="fix-point-0-9"]')).toBeNull()
        expect(document.querySelector('.fix-path-correction-point-row[data-control-point-id="fix-point-0-9"]'))
            .toBeNull()
        expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeLasso)
    }, 20000)
})
