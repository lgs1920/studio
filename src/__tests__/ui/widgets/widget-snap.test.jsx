/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-snap.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-18
 * Last modified: 2026-09-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'
import { LGS_TOOLBAR, LGS_VISUAL_WIDGET } from '@Core/constants'
import { forwardRef, useImperativeHandle } from 'react'

const moveableState = vi.hoisted(() => ({
    props: [],
}))

const widgetCanvasState = vi.hoisted(() => ({
    init:      () => Promise.resolve(),
    instances: [],
}))

vi.mock('react-moveable', () => ({
    default: forwardRef((props, ref) => {
        useImperativeHandle(ref, () => ({
            updateRect: vi.fn(),
        }), [])
        moveableState.props.push(props)
        return <div data-testid="moveable"/>
    }),
}))

vi.mock('@Components/MainUI/context-menu/usePointerInteractions', () => ({
    usePointerInteractions: () => () => {},
}))

vi.mock('@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas', () => {
    class Widget2CanvasMock {
        /**
         * Creates a controllable widget canvas mirror for lifecycle tests.
         */
        constructor() {
            const canvas = document.createElement('canvas')
            const instance = {
                destroy:   vi.fn(),
                getCanvas: vi.fn(() => canvas),
                init:      vi.fn(() => widgetCanvasState.init()),
            }
            widgetCanvasState.instances.push(instance)
            return instance
        }
    }

    return {Widget2Canvas: vi.fn(Widget2CanvasMock)}
})

vi.mock('@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder', () => ({
    ScreenMediaRecorder: {
        events: {
            STOP:   'stop',
            CANCEL: 'cancel',
        },
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import { Widget } from '@Components/MainUI/widgets/Widget'

const rect = {
    left:   10,
    top:    20,
    right:  210,
    bottom: 120,
    width:  200,
    height: 100,
}

const installGlobals = ({grid = {enabled: false, size: 30, snap: true}} = {}) => {
    globalThis.ResizeObserver = class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
    }

    const canvas = document.createElement('div')
    canvas.getBoundingClientRect = vi.fn(() => rect)
    document.body.appendChild(canvas)

    globalThis.lgs = {
        canvas,
        scene:    {render: vi.fn()},
        settings: {
            ui: {
                toolbars: proxy({opacity: 1}),
                widgets:  {
                    grid: proxy(grid),
                },
            },
        },
        stores: {
            replay: proxy({recordingSync: false}),
            ui: proxy({
                contextMenu: {
                    visible:  false,
                    type:     null,
                    targetId: null,
                    position: null,
                },
                drawers: {
                    open:   null,
                    entity: null,
                },
                video: {
                    preRecording: false,
                    recording:    false,
                    snapshot:     false,
                    finalizing:   false,
                },
                widget: {
                    current: {id: null, rotate: 0},
                    list:    proxyMap(),
                },
            }),
        },
    }

    globalThis.__ = {
        app: {
            parsePx: value => parseFloat(value) || 0,
        },
        widgets: new Map(),
        recorder: {
            addEventListener:    vi.fn(),
            removeEventListener: vi.fn(),
        },
        ui: {
            drawerManager: {
                close: vi.fn(),
            },
            widgetCache: {
                mount: vi.fn(),
            },
            widgetManager: {
                cloneContext: vi.fn(context => context),
                defineElementId: vi.fn((group, id) => `${id}#test`),
                disposeElement: vi.fn(),
                getTransform: vi.fn(() => ({scale: {x: 1, y: 1}, rotate: 0})),
                getWidgetConfig: vi.fn(id => ({
                    id,
                    ratio: {locked: false},
                })),
                manageControlBox: vi.fn(),
                onDrag: vi.fn(),
                onDragEnd: vi.fn(),
                onDragStart: vi.fn(),
                onRotate: vi.fn(),
                refreshEditorPreviewSnapshot: vi.fn(),
                resolveWidgetsBoardContainer: vi.fn(() => canvas),
                resolveWidgetsBoardReferenceContainer: vi.fn(() => canvas),
                retrieveConfig: vi.fn(async (_element, config) => config),
                retrieveElementId: vi.fn(element => element?.id),
                setBoundStatus: vi.fn(),
                setConfig: vi.fn(),
                setupElement: vi.fn(async (element, config, setBounds, setPosition, moveable) => {
                    element.id = config.id
                    if (moveable) {
                        moveable.current = {
                            ...(moveable.current ?? {}),
                            target: element,
                        }
                    }
                    return true
                }),
            },
        },
    }
}

const renderWidget = (config, children = <div>content</div>) => render(
    <Widget isVisible={true} config={{
        id:             'snap-widget',
        group:          'test-widgets',
        showControlBox: true,
        ...config,
    }}>
        {children}
    </Widget>,
)

const latestMoveableProps = () => moveableState.props.at(-1)

describe('Widget snap behavior', () => {
    beforeEach(() => {
        moveableState.props = []
        widgetCanvasState.init = () => Promise.resolve()
        widgetCanvasState.instances = []
    })

    afterEach(() => {
        cleanup()
        document.body.innerHTML = ''
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('disables snap for non visual widgets even when grid snap is enabled', async () => {
        installGlobals({grid: {enabled: true, size: 30, snap: true}})

        renderWidget({type: LGS_TOOLBAR, snappable: true})

        expect(latestMoveableProps().snappable).toBe(false)
        expect(latestMoveableProps().snapCenter).toBe(false)
        expect(latestMoveableProps().snapElement).toBe(false)
        expect(latestMoveableProps().snapDirections).toBe(false)
        expect(latestMoveableProps().elementSnapDirections).toBe(false)
        expect(latestMoveableProps().elementGuidelines).toEqual([])
        expect(latestMoveableProps().maxSnapElementGuidelineDistance).toBe(0)
        await waitFor(() => {
            expect(latestMoveableProps().verticalGuidelines).toEqual([])
            expect(latestMoveableProps().horizontalGuidelines).toEqual([])
        })
        await waitFor(() => expect(__.ui.widgetManager.retrieveConfig).toHaveBeenCalled())
        expect(__.ui.widgetManager.retrieveConfig.mock.calls[0][1].snappable).toBe(false)
    })

    it('resolves a configured drag handle inside the widget and falls back safely', () => {
        installGlobals()

        renderWidget({handle: '.missing-drag-handle'})

        const widgetElement = document.querySelector('.lgs-widget')
        expect(latestMoveableProps().dragTarget()).toBe(widgetElement)
    })

    it('selects a widget from a selectable no-drag timeline surface', () => {
        installGlobals()

        const {container} = renderWidget({type: LGS_VISUAL_WIDGET}, (
            <lgs1920-timeline data-widget-selectable="">
                <div data-testid="timeline-surface"/>
            </lgs1920-timeline>
        ))
        const surface = container.querySelector('[data-testid="timeline-surface"]')

        act(() => {
            surface.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, composed: true, button: 0}))
        })

        expect(lgs.stores.ui.widget.current.id).toBe('snap-widget#test')
    })

    it('notifies child content when widget dragging starts and ends', async () => {
        installGlobals()
        const onDragStart = vi.fn()
        const onDragEnd = vi.fn()
        const childRef = {current: {onDragStart, onDragEnd}}

        render(
            <Widget
                isVisible={true}
                childRef={childRef}
                config={{
                    id:             'snap-widget',
                    group:          'test-widgets',
                    showControlBox: true,
                }}
            >
                <div>content</div>
            </Widget>,
        )

        const dragStartEvent = {
            composedPath: () => [],
            inputEvent: {
                clientX:      0,
                clientY:      0,
                composedPath: () => [],
                pointerType:  'mouse',
            },
            stopDrag: vi.fn(),
        }
        const dragEndEvent = {target: document.createElement('div')}

        await act(async () => latestMoveableProps().onDragStart(dragStartEvent))
        await act(async () => latestMoveableProps().onDragEnd(dragEndEvent))

        expect(onDragStart).toHaveBeenCalledWith(dragStartEvent)
        expect(onDragEnd).toHaveBeenCalledWith(dragEndEvent)
    })

    it('keeps rotation updates continuous for every widget preview', async () => {
        installGlobals()

        renderWidget({type: LGS_VISUAL_WIDGET, rotatable: true})

        await waitFor(() => expect(__.ui.widgetManager.retrieveConfig).toHaveBeenCalled())

        expect(latestMoveableProps().throttleRotate).toBe(0)

        latestMoveableProps().onRotate({rotate: 12.345})

        expect(lgs.stores.ui.widget.current.rotate).toBe(12.345)
    })

    it('keeps center snap enabled for visual widgets when grid snap is disabled', async () => {
        installGlobals({grid: {enabled: false, size: 30, snap: true}})

        renderWidget({type: LGS_VISUAL_WIDGET})

        await waitFor(() => {
            expect(latestMoveableProps().verticalGuidelines.map(guideline => guideline.pos)).toEqual([110])
            expect(latestMoveableProps().horizontalGuidelines.map(guideline => guideline.pos)).toEqual([70])
        })
        expect(latestMoveableProps().snappable).toBe(true)
    })

    it('limits crop snapping to the board edges', async () => {
        installGlobals({grid: {enabled: true, size: 50, snap: true}})

        renderWidget({
            type:      LGS_VISUAL_WIDGET,
            isCropper: true,
            snappable: true,
        })

        await waitFor(() => {
            expect(latestMoveableProps().elementGuidelines).toEqual([lgs.canvas])
            expect(latestMoveableProps().verticalGuidelines).toEqual([])
            expect(latestMoveableProps().horizontalGuidelines).toEqual([])
        })
        expect(latestMoveableProps().snapCenter).toBe(false)
        expect(latestMoveableProps().snapElement).toBe(true)
        expect(latestMoveableProps().snapDirections).toEqual({
            top:    true,
            right:  true,
            bottom: true,
            left:   true,
            center: false,
            middle: false,
        })
        expect(latestMoveableProps().elementSnapDirections).toEqual({
            top:    true,
            left:   true,
            bottom: true,
            right:  true,
            center: false,
            middle: false,
        })
    })

    it('adds grid guidelines for visual widgets only when grid snap is enabled', async () => {
        installGlobals({grid: {enabled: true, size: 50, snap: true}})

        renderWidget({type: LGS_VISUAL_WIDGET})

        await waitFor(() => {
            expect(latestMoveableProps().verticalGuidelines.map(guideline => guideline.pos)).toEqual([10, 60, 110, 160, 210])
            expect(latestMoveableProps().horizontalGuidelines.map(guideline => guideline.pos)).toEqual([20, 70, 120])
        })
        expect(latestMoveableProps().snappable).toBe(true)
    })

    it('snaps video widgets to other widgets on the same board', async () => {
        installGlobals()
        const videoBoard = document.createElement('div')
        videoBoard.dataset.widgetsBoard = 'video-crop-zone'
        videoBoard.getBoundingClientRect = vi.fn(() => rect)
        document.body.appendChild(videoBoard)
        const peer = document.createElement('div')
        peer.className = 'lgs-widget'
        const peerContainer = document.createElement('div')
        peerContainer.className = 'lgs-widget-container'
        peerContainer.dataset.widget = 'peer-widget#test'
        peerContainer.appendChild(peer)
        document.body.appendChild(peerContainer)
        lgs.stores.ui.widget.list.set('peer-widget#test', {widgetsBoard: 'video-crop-zone'})
        __.ui.widgetManager.resolveWidgetsBoardContainer.mockReturnValue(videoBoard)
        __.ui.widgetManager.resolveWidgetsBoardReferenceContainer.mockReturnValue(videoBoard)

        renderWidget({type: LGS_VISUAL_WIDGET, widgetsBoard: 'video-crop-zone'})

        await waitFor(() => expect(latestMoveableProps().elementGuidelines).toEqual([
            videoBoard,
            {element: peer, className: 'lgs-widget-snap-element-guideline', refresh: true},
        ]))
    })

    it('keeps the cropper host transparent to pointer events during capture lock', () => {
        installGlobals()
        lgs.stores.ui.video.preRecording = true

        const {container} = renderWidget({
            id:       'video-crop-zone',
            type:     LGS_VISUAL_WIDGET,
            isCropper: true,
        })

        expect(container.querySelector('.lgs-widget-container')?.style.pointerEvents).toBe('none')
        expect(container.querySelector('.lgs-widget')?.classList.contains('crop-pass-through')).toBe(true)
    })

    it('keeps an unselected cropper transparent while editing the video frame', () => {
        installGlobals()

        const {container} = renderWidget({
            id:        'video-crop-zone',
            type:      LGS_VISUAL_WIDGET,
            isCropper: true,
        })

        expect(container.querySelector('.lgs-widget-container')?.style.pointerEvents).toBe('none')
        expect(container.querySelector('.lgs-widget')?.classList.contains('crop-pass-through')).toBe(true)
        expect(latestMoveableProps().style).toEqual({opacity: 0, pointerEvents: 'none'})
    })

    it('locks visual widget input only during synchronized recording', () => {
        installGlobals()
        lgs.stores.ui.video.preRecording = true

        const view = renderWidget({type: LGS_VISUAL_WIDGET})

        expect(view.container.querySelector('.lgs-widget')?.classList.contains('recording-locked')).toBe(false)

        lgs.stores.ui.video.preRecording = false
        lgs.stores.ui.video.recording = true
        view.rerender(
            <Widget isVisible={true} config={{
                id:             'snap-widget',
                group:          'test-widgets',
                showControlBox: true,
                type:           LGS_VISUAL_WIDGET,
            }}>
                <div>content</div>
            </Widget>,
        )
        expect(view.container.querySelector('.lgs-widget')?.classList.contains('recording-locked')).toBe(false)

        lgs.stores.replay.recordingSync = true
        view.rerender(
            <Widget isVisible={true} config={{
                id:             'snap-widget',
                group:          'test-widgets',
                showControlBox: true,
                type:           LGS_VISUAL_WIDGET,
            }}>
                <div>content</div>
            </Widget>,
        )
        expect(view.container.querySelector('.lgs-widget')?.classList.contains('recording-locked')).toBe(true)
    })

    it('keeps the selected cropper content transparent while preserving its moveable handles', () => {
        installGlobals()
        lgs.stores.ui.widget.current = {id: 'video-crop-zone#test', rotate: 0}

        const {container} = renderWidget({
            id:        'video-crop-zone',
            type:      LGS_VISUAL_WIDGET,
            isCropper: true,
        })

        expect(container.querySelector('.lgs-widget-container')?.style.pointerEvents).toBe('none')
        expect(container.querySelector('.lgs-widget')?.classList.contains('crop-pass-through')).toBe(true)
        expect(latestMoveableProps().style).toEqual({opacity: 1, pointerEvents: 'auto'})
    })

    it('recognizes the cropper base identifier while its runtime identifier is being resolved', () => {
        installGlobals()
        lgs.stores.ui.widget.current = {id: 'video-crop-zone', rotate: 0}

        renderWidget({
            id:        'video-crop-zone',
            type:      LGS_VISUAL_WIDGET,
            isCropper: true,
        })

        expect(latestMoveableProps().style).toEqual({opacity: 1, pointerEvents: 'auto'})
        expect(latestMoveableProps().renderDirections).toEqual(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
        expect(latestMoveableProps().zoom).toBe(1)
    })

    it('selects a cropper when a selection request is received', async () => {
        installGlobals()

        render(
            <Widget
                isVisible={true}
                selectionRequestKey={1}
                config={{
                    id:            'video-crop-zone',
                    group:         'test-widgets',
                    showControlBox: true,
                    type:          LGS_VISUAL_WIDGET,
                    isCropper:     true,
                    resizable:     true,
                }}>
                <div>content</div>
            </Widget>,
        )

        await waitFor(() => expect(lgs.stores.ui.widget.current.id).toBe('video-crop-zone#test'))
        await waitFor(() => expect(latestMoveableProps().renderDirections).toEqual(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']))
        expect(latestMoveableProps().zoom).toBe(1)
        expect(latestMoveableProps().resizable).toBe(true)
        expect(__.ui.widgetManager.manageControlBox).toHaveBeenCalled()
    })

    it('cancels an in-flight canvas mirror initialization when the widget unmounts', async () => {
        installGlobals()
        lgs.stores.ui.video.preRecording = true

        let resolveInitialization = null
        widgetCanvasState.init = () => new Promise(resolve => {
            resolveInitialization = resolve
        })

        const {unmount} = renderWidget({
            type:         LGS_VISUAL_WIDGET,
            widgetsBoard: 'video-crop-zone',
        })

        await waitFor(() => expect(widgetCanvasState.instances).toHaveLength(1))
        const mirror = widgetCanvasState.instances[0]

        unmount()
        expect(mirror.destroy).toHaveBeenCalledTimes(1)

        resolveInitialization()
        await waitFor(() => expect(mirror.destroy).toHaveBeenCalledTimes(2))
        expect(mirror.getCanvas).not.toHaveBeenCalled()
    })

    it('cleans up a canvas mirror whose asynchronous initialization is aborted', async () => {
        installGlobals()
        lgs.stores.ui.video.preRecording = true
        widgetCanvasState.init = () => Promise.reject(new DOMException('Capture aborted', 'AbortError'))

        renderWidget({
            type:         LGS_VISUAL_WIDGET,
            widgetsBoard: 'video-crop-zone',
        })

        await waitFor(() => expect(widgetCanvasState.instances).toHaveLength(1))
        const mirror = widgetCanvasState.instances[0]
        await waitFor(() => expect(mirror.destroy).toHaveBeenCalledTimes(1))

        expect(mirror.getCanvas).not.toHaveBeenCalled()
    })

    it('does not snap a visual widget to widgets on another board', async () => {
        installGlobals()
        const otherBoardWidget = document.createElement('div')
        otherBoardWidget.className = 'lgs-widget'
        const otherContainer = document.createElement('div')
        otherContainer.className = 'lgs-widget-container'
        otherContainer.dataset.widget = 'other-widget#test'
        otherContainer.appendChild(otherBoardWidget)
        document.body.appendChild(otherContainer)
        lgs.stores.ui.widget.list.set('other-widget#test', {widgetsBoard: 'other-board'})

        renderWidget({type: LGS_VISUAL_WIDGET, widgetsBoard: 'video-crop-zone'})

        await waitFor(() => expect(latestMoveableProps().elementGuidelines).toEqual([lgs.canvas]))
    })
})
