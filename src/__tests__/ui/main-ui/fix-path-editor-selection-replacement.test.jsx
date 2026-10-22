// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-selection-replacement.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-21
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import {Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {DRAWING_FROM_UI, NO_FOCUS} from '@Core/constants'
import {Utils} from '@Editor/Utils'
import {getFixPathSourceFingerprint} from '@Utils/cesium/fixPathCorrections'
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

describe('FixPathEditor replacement selection', () => {
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

    it.each([
        {name: 'Alt freehand lasso', modifiers: {altKey: true}},
        {name: 'Ctrl+Alt rectangle', modifiers: {ctrlKey: true, altKey: true}, rectangle: true},
        {name: 'Alt click-vertex lasso', modifiers: {altKey: true}, clickVertices: true},
    ])('replaces the selection with $name and preserves Shift addition', async gesture => {
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
        const correctionSection = {
            id: 'selection-section',
            segmentIndex: 0,
            startIndex: 1,
            endIndex: 3,
            sourceFingerprint: getFixPathSourceFingerprint(content, 0, 1, 3),
            controlPoints: [1, 2, 3].map(sourceIndex => ({
                id: 'fix-point-0-' + sourceIndex,
                sourceIndex,
                progress: (sourceIndex - 1) / 2,
                coordinate: content.geometry.coordinates[sourceIndex],
                fixed: false,
                removed: false,
            })),
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
                tracks: {'track-a': [correctionSection]},
                currentSection: {trackSlug: 'track-a', correctionId: 'selection-section'},
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

        await waitFor(() => expect(document.querySelectorAll('.fix-path-control-point')).toHaveLength(3))
        const updateCallsBeforeSelection = updateJourney.mock.calls.length

        /** Find the visible correction marker for a source point. */
        const marker = sourceIndex => document.querySelector(
            '.fix-path-control-point[data-control-point-id="fix-point-0-' + sourceIndex + '"]',
        )
        /** Read the selected correction points through their public marker state. */
        const selectedIds = () => [...document.querySelectorAll('.fix-path-control-point.is-selected')]
            .map(point => point.dataset.controlPointId)
        /** Complete a map selection with the specified shape and modifier keys. */
        const drawArea = (centerX, {modifiers, rectangle = false, clickVertices = false, startTarget = canvas}) => {
            const vertices = [
                {x: centerX - 3, y: 44},
                {x: centerX + 3, y: 44},
                {x: centerX + 3, y: 56},
                {x: centerX - 3, y: 56},
            ]
            /** Build the coordinates and modifiers for a selection event. */
            const pointer = position => ({
                pointerId: 60,
                button: 0,
                ...modifiers,
                clientX: position.x,
                clientY: position.y,
            })
            if (clickVertices) {
                vertices.forEach(position => {
                    fireEvent.pointerDown(canvas, pointer(position))
                    fireEvent.pointerUp(viewerContainer, pointer(position))
                    fireEvent.click(canvas, pointer(position))
                })
                fireEvent.doubleClick(canvas, pointer(vertices.at(-1)))
                return
            }
            fireEvent.pointerDown(startTarget, pointer(vertices[0]))
            if (rectangle) {
                const corner = {x: centerX + 3, y: 56}
                fireEvent.pointerMove(viewerContainer, pointer(corner))
                fireEvent.pointerUp(viewerContainer, pointer(corner))
                return
            }
            vertices.slice(1).forEach(position => fireEvent.pointerMove(viewerContainer, pointer(position)))
            fireEvent.pointerUp(viewerContainer, pointer(vertices.at(-1)))
        }

        fireEvent.click(marker(1))
        expect(selectedIds()).toEqual(['fix-point-0-1'])
        drawArea(16, gesture)
        expect(selectedIds()).toEqual(['fix-point-0-2'])
        drawArea(24, gesture)
        expect(selectedIds()).toEqual(['fix-point-0-3'])

        // An empty area preserves the selection without creating a source section.
        drawArea(70, gesture)
        expect(selectedIds()).toEqual(['fix-point-0-3'])
        expect(journey.fixPathCorrectionData.revision).toBe(1)
        expect(journey.fixPathCorrectionData.tracks['track-a']).toHaveLength(1)
        expect(journey.fixPathCorrectionData.tracks['track-a'][0].controlPoints).toHaveLength(3)
        expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeSelection)

        fireEvent.click(marker(1))
        drawArea(16, {modifiers: {shiftKey: true}, startTarget: marker(2)})
        expect(selectedIds()).toEqual(['fix-point-0-1', 'fix-point-0-2'])

        const originalHeights = [...document.querySelectorAll('input[aria-label="Height (m)"]')].map(input => input.value)
        expect(originalHeights).toHaveLength(3)
        const originalData = JSON.stringify(journey.fixPathCorrectionData)
        const originalDisplay = JSON.stringify(TrackUtils.setDisplayContentOverride.mock.lastCall[1])
        /** Build a primary-button event for the selected group's owning pointer. */
        const dragPointer = overrides => ({
            pointerId: 71,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: 8,
            clientY: 50,
            ...overrides,
        })
        /** Verify that a discarded gesture preserves the route, selection, and saved data. */
        const expectUnchanged = () => {
            expect([...document.querySelectorAll('input[aria-label="Height (m)"]')].map(input => input.value)).toEqual(originalHeights)
            expect(JSON.stringify(journey.fixPathCorrectionData)).toBe(originalData)
            expect(JSON.stringify(TrackUtils.setDisplayContentOverride.mock.lastCall[1])).toBe(originalDisplay)
            expect(selectedIds()).toEqual(['fix-point-0-1', 'fix-point-0-2'])
            expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeSelection)
            expect(lgs.viewer.scene.screenSpaceCameraController.enableInputs).toBe(true)
        }

        marker(1).setPointerCapture = vi.fn(() => { throw new Error('Pointer capture failed') })
        fireEvent.pointerDown(marker(1), dragPointer())
        fireEvent.pointerUp(window, dragPointer({buttons: 0, clientX: 40, clientY: 40}))
        fireEvent.pointerMove(marker(2), dragPointer({buttons: 0, clientX: 50, clientY: 30}))
        expectUnchanged()

        for (const interruption of ['released button', 'pointercancel', 'lostpointercapture', 'blur', 'hidden tab']) {
            fireEvent.pointerDown(marker(1), dragPointer())

            // Another pointer must neither move the selected group nor end its gesture.
            fireEvent.pointerMove(window, dragPointer({pointerId: 72, clientX: 40, clientY: 40}))
            fireEvent.pointerUp(window, dragPointer({pointerId: 72, buttons: 0}))
            expectUnchanged()
            fireEvent.pointerMove(window, dragPointer({clientX: 40, clientY: 40}))
            expect(JSON.stringify(TrackUtils.setDisplayContentOverride.mock.lastCall[1]), interruption).not.toBe(originalDisplay)

            if (interruption === 'released button') {
                // The release was lost entirely: the next hover must discard the preview.
                fireEvent.pointerMove(canvas, dragPointer({buttons: 0, clientX: 50, clientY: 30}))
            }
            else if (interruption === 'blur') fireEvent.blur(window)
            else if (interruption === 'hidden tab') {
                const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
                fireEvent(document, new Event('visibilitychange'))
                visibility.mockRestore()
            }
            else fireEvent(window, new PointerEvent(interruption, dragPointer()))

            expectUnchanged()
            fireEvent.pointerMove(marker(2), dragPointer({buttons: 0, clientX: 50, clientY: 30}))
            fireEvent.pointerUp(window, dragPointer({buttons: 0}))
            expectUnchanged()
        }

        // Right clicks and non-primary pointers cannot arm a later hover as a drag.
        for (const pointer of [{button: 2, buttons: 2}, {isPrimary: false}]) {
            fireEvent.pointerDown(marker(1), dragPointer(pointer))
            fireEvent.pointerMove(marker(2), dragPointer({clientX: 40, clientY: 40}))
            fireEvent.pointerUp(window, dragPointer({buttons: 0}))
            expectUnchanged()
        }

        const drawCallsBeforeDelete = TrackUtils.draw.mock.calls.length
        const overrideCallsBeforeDelete = TrackUtils.setDisplayContentOverride.mock.calls.length
        const updateCallsBeforeDelete = updateJourney.mock.calls.length
        const drawUpdatedTrack = vi.fn(options => TrackUtils.draw(journey.tracks.get('track-a'), options))
        updateJourney.mockResolvedValue({
            tracks: new Map([['track-a', {draw: drawUpdatedTrack}]]),
            draw: vi.fn(),
        })
        fireEvent.click(document.querySelector('button[aria-label="Delete entire section"]'))

        await waitFor(() => expect(journey.fixPathCorrectionData.tracks['track-a'] ?? []).toEqual([]))
        await waitFor(() => expect(updateJourney).toHaveBeenCalledTimes(updateCallsBeforeDelete + 1))
        await waitFor(() => expect(drawUpdatedTrack).toHaveBeenCalledWith({
            action: DRAWING_FROM_UI,
            mode: NO_FOCUS,
        }))
        expect(TrackUtils.draw.mock.calls.slice(drawCallsBeforeDelete)
            .some(([track, options]) => track === journey.tracks.get('track-a')
                && options?.mode === NO_FOCUS)).toBe(true)
        expect(TrackUtils.setDisplayContentOverride.mock.calls.slice(overrideCallsBeforeDelete)
            .some(([track, content]) => track === journey.tracks.get('track-a') && content === null)).toBe(true)
        expect(journey.fixPathEnabled).toBe(false)
        expect(journey.fixPathCorrectionData.tracks).toEqual({})
    }, 20000)
})
