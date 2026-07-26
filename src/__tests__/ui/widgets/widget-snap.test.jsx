import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'
import { LGS_TOOLBAR, LGS_VISUAL_WIDGET } from '@Core/constants'

const moveableState = vi.hoisted(() => ({
    props: [],
}))

vi.mock('react-moveable', () => ({
    default: vi.fn((props) => {
        moveableState.props.push(props)
        if (props.ref && typeof props.ref === 'object') {
            props.ref.current = {
                updateRect: vi.fn(),
            }
        }
        return <div data-testid="moveable"/>
    }),
}))

vi.mock('@Components/MainUI/context-menu/usePointerInteractions', () => ({
    usePointerInteractions: () => () => {},
}))

vi.mock('@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas', () => ({
    Widget2Canvas: vi.fn(),
}))

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
                refreshEditorPreviewSnapshot: vi.fn(),
                resolveWidgetsBoardContainer: vi.fn(() => canvas),
                resolveWidgetsBoardReferenceContainer: vi.fn(() => canvas),
                retrieveConfig: vi.fn(async (_element, config) => config),
                retrieveElementId: vi.fn(element => element?.id),
                setBoundStatus: vi.fn(),
                setConfig: vi.fn(),
                setupElement: vi.fn(async (element, config) => {
                    element.id = config.id
                    return true
                }),
            },
        },
    }
}

const renderWidget = (config) => render(
    <Widget isVisible={true} config={{
        id:             'snap-widget',
        group:          'test-widgets',
        showControlBox: true,
        ...config,
    }}>
        <div>content</div>
    </Widget>,
)

const latestMoveableProps = () => moveableState.props.at(-1)

describe('Widget snap behavior', () => {
    beforeEach(() => {
        moveableState.props = []
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
