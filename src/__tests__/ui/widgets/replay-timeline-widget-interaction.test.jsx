// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-widget-interaction.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-08
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react'
import {LGS_VISUAL_WIDGET} from '@Core/constants'

const moveableState = vi.hoisted(() => ({props: []}))
const widgetCanvasState = vi.hoisted(() => ({instances: []}))

vi.mock('react-moveable', () => ({
    default: forwardRef((props, ref) => {
        useImperativeHandle(ref, () => ({updateRect: vi.fn()}), [])
        moveableState.props.push(props)
        return <div data-testid="moveable"/>
    }),
}))

vi.mock('@Components/MainUI/context-menu/usePointerInteractions', () => ({
    usePointerInteractions: () => () => {},
}))

vi.mock('@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas', () => {
    class Widget2CanvasMock {
        constructor() {
            const canvas = document.createElement('canvas')
            const instance = {
                destroy:   vi.fn(),
                getCanvas: vi.fn(() => canvas),
                init:      vi.fn(() => Promise.resolve()),
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
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: ({children, ...props}) => <span data-tooltip {...props}>{children}</span>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar', () => ({
    VideoRecordingSettingsToolbar: () => <div data-testid="video-recording-settings-toolbar"/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/card/card.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/color-picker/color-picker.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/drawer/drawer.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/tooltip/tooltip.js', () => ({}))

import {Widget} from '@Components/MainUI/widgets/Widget'
import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'
import {LGS1920Timeline} from '../../../webcomponents/lgs1920-timeline/LGS1920Timeline'

const rect = {
    left:   10,
    top:    20,
    right:  210,
    bottom: 120,
    width:  200,
    height: 100,
}

const installGlobals = () => {
    globalThis.ResizeObserver = class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
    }

    const canvas = document.createElement('div')
    canvas.getBoundingClientRect = vi.fn(() => rect)
    document.body.append(canvas)

    globalThis.lgs = {
        canvas,
        scene: {render: vi.fn()},
        settings: {
            widgets: {},
            ui: {
                toolbars: proxy({opacity: 1}),
                widgets:  {grid: proxy({enabled: false, size: 30, snap: true})},
                replay:  {duration: 4, clips: {catalog: {}, start: [], stop: []}},
            },
        },
        stores: {
            main: proxy({theJourney: null}),
            replay: proxy({
                recordingSync: true,
                direction:      1,
                playing:        false,
                dynamicFrameState: {frameTimeMs: 1_000},
                clips:           {catalog: {}, start: [], stop: []},
            }),
            ui: proxy({
                contextMenu: {visible: false, type: null, targetId: null, position: null},
                drawers: {open: null, entity: null},
                video: {
                    editing:             true,
                    timelinePreviewActive: true,
                    fps:                  0,
                    preRecording:         false,
                    recording:             false,
                    recordingHQ:           false,
                    finalizing:            false,
                },
                widget: {current: {id: null, rotate: 0}, list: proxyMap()},
            }),
        },
    }

    globalThis.__ = {
        app: {parsePx: value => parseFloat(value) || 0},
        widgets: new Map(),
        recorder: {addEventListener: vi.fn(), removeEventListener: vi.fn()},
        ui: {
            drawerManager: {close: vi.fn()},
            widgetCache: {mount: vi.fn()},
            widgetManager: {
                cloneContext: vi.fn(context => context),
                defineElementId: vi.fn((group, id) => `${id}#test`),
                disposeElement: vi.fn(),
                getTransform: vi.fn(() => ({scale: {x: 1, y: 1}, rotate: 0})),
                getWidgetConfig: vi.fn(id => ({id, ratio: {locked: false}})),
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
                        moveable.current = {...(moveable.current ?? {}), target: element}
                    }
                    return true
                }),
            },
            replay: {
                enterReplayPreparation: vi.fn(async () => true),
            },
        },
    }
}

const renderWidget = children => render(
    <Widget isVisible={true} config={{
        id:             'timeline-isolation-widget',
        group:          'test-widgets',
        type:           LGS_VISUAL_WIDGET,
        showControlBox: true,
        draggable:      true,
        resizable:      true,
        handle:         'lgs1920-timeline',
    }}>
        {children}
    </Widget>,
)

const createTimeline = () => {
    const timeline = new LGS1920Timeline()
    timeline.timeline = {
        durationMillis: 10_000,
        visible: true,
        hostInteraction: 'selectable',
        hostNoDragClass: 'lgs-widget-no-drag',
    }
    timeline.tracks = []
    timeline.currentTimeMillis = 0
    return timeline
}

const TimelineMount = ({timeline}) => {
    const containerRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current?.contains(timeline)) containerRef.current?.append(timeline)
        return () => timeline.remove()
    }, [timeline])

    return <div ref={containerRef}/>
}

const pointerDown = element => {
    act(() => {
        element.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            button: 0,
        }))
    })
}

describe('Replay timeline widget interaction isolation', () => {
    beforeEach(() => {
        moveableState.props = []
        widgetCanvasState.instances = []
        installGlobals()
    })

    afterEach(() => {
        cleanup()
        document.body.innerHTML = ''
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('keeps the empty widget frame selectable', () => {
        const {container} = renderWidget(<div data-testid="empty-frame"/>)

        pointerDown(container.querySelector('[data-testid="empty-frame"]'))

        expect(lgs.stores.ui.widget.current.id).toBe('timeline-isolation-widget#test')
    })

    it('keeps an empty timeline host selectable', () => {
        const timeline = document.createElement('lgs1920-timeline')
        timeline.setAttribute('data-widget-selectable', '')
        const {container} = renderWidget(<TimelineMount timeline={timeline}/>)

        pointerDown(container.querySelector('lgs1920-timeline'))

        expect(lgs.stores.ui.widget.current.id).toBe('timeline-isolation-widget#test')
    })

    it('keeps the empty rendered timeline selectable before internal controls exist', async () => {
        const timeline = createTimeline()
        const {container} = renderWidget(<TimelineMount timeline={timeline}/>)

        await waitFor(() => expect(container.querySelector('lgs1920-timeline')?.shadowRoot?.querySelector('[data-surface]')).not.toBeNull())
        pointerDown(container.querySelector('lgs1920-timeline').shadowRoot.querySelector('[part="header"]'))

        expect(lgs.stores.ui.widget.current.id).toBe('timeline-isolation-widget#test')
    })

    it('stops widget selection at the interactive timeline surface', async () => {
        const timeline = createTimeline()
        const {container} = renderWidget(<TimelineMount timeline={timeline}/>)

        await waitFor(() => expect(container.querySelector('lgs1920-timeline')?.shadowRoot?.querySelector('[data-surface]')).not.toBeNull())
        pointerDown(container.querySelector('lgs1920-timeline').shadowRoot.querySelector('[data-surface]'))

        expect(lgs.stores.ui.widget.current.id).toBeNull()
    })

    it('stops widget selection at a rendered track and clip', async () => {
        const timeline = createTimeline()
        timeline.tracks = [{
            id:       'track',
            label:    'Track',
            editable: true,
            clips:    [{id: 'clip', kind: 'video', label: 'Clip', start: 0, end: 2}],
        }]
        const {container} = renderWidget(<TimelineMount timeline={timeline}/>)

        await waitFor(() => expect(container.querySelector('lgs1920-timeline')?.shadowRoot?.querySelector('[data-clip-id="clip"]')).not.toBeNull())
        const shadowRoot = container.querySelector('lgs1920-timeline').shadowRoot
        pointerDown(shadowRoot.querySelector('[data-row-id="track"]'))
        expect(lgs.stores.ui.widget.current.id).toBeNull()

        pointerDown(shadowRoot.querySelector('[data-clip-id="clip"]'))
        expect(lgs.stores.ui.widget.current.id).toBeNull()
    })

    it('uses the timeline host as the moveable target and blocks only marked drag starts', async () => {
        const timeline = createTimeline()
        const {container} = renderWidget(<TimelineMount timeline={timeline}/>)

        await waitFor(() => expect(moveableState.props.at(-1)?.dragTarget?.()).toBe(container.querySelector('lgs1920-timeline')))
        const props = moveableState.props.at(-1)
        const shadowRoot = container.querySelector('lgs1920-timeline').shadowRoot
        const neutralStart = {inputEvent: {composedPath: () => [shadowRoot.querySelector('[part="header"]')]}, stopDrag: vi.fn()}
        const blockedStart = {inputEvent: {composedPath: () => [shadowRoot.querySelector('[data-surface]')]}, stopDrag: vi.fn()}

        props.onDragStart(neutralStart)
        props.onDragStart(blockedStart)

        expect(neutralStart.stopDrag).not.toHaveBeenCalled()
        expect(blockedStart.stopDrag).toHaveBeenCalledOnce()
    })

    it('keeps the real ReplayTimelinePreview selectable outside its interactive regions', async () => {
        const {container} = renderWidget(<ReplayTimelinePreview/>)
        const timeline = container.querySelector('lgs1920-timeline')

        await waitFor(() => expect(timeline?.shadowRoot?.querySelector('[data-surface]')).not.toBeNull())
        pointerDown(timeline.shadowRoot.querySelector('[part="header"]'))
        expect(lgs.stores.ui.widget.current.id).toBe('timeline-isolation-widget#test')

        lgs.stores.ui.widget.current.id = null
        pointerDown(timeline.shadowRoot.querySelector('[data-surface]'))
        expect(lgs.stores.ui.widget.current.id).toBeNull()
    })

    it('keeps the widget shell when the empty timeline diagnostic is enabled', () => {
        const originalUrl = window.location.href
        window.history.replaceState(null, '', '?lgs-empty-timeline=1')

        const {container} = renderWidget(<ReplayTimelinePreview/>)

        expect(container.querySelector('[data-testid="replay-timeline-empty-debug"]')).not.toBeNull()
        expect(container.querySelector('lgs1920-timeline')).toBeNull()
        expect(moveableState.props.at(-1).dragTarget()).toBe(container.querySelector('.lgs-widget'))

        pointerDown(container.querySelector('[data-testid="replay-timeline-empty-debug"]'))
        expect(lgs.stores.ui.widget.current.id).toBe('timeline-isolation-widget#test')

        window.history.replaceState(null, '', originalUrl)
    })
})
