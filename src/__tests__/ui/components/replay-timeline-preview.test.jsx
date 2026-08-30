import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

const timelineMocks = vi.hoisted(() => ({
    props: null,
}))

vi.mock('@xzdarcy/react-timeline-editor', async () => {
    const React = await vi.importActual('react')

    return {
        Timeline: React.forwardRef((props, ref) => {
            timelineMocks.props = props
            const timelineElementRef = React.useRef(null)
            React.useImperativeHandle(ref, () => ({
                get target() {
                    return timelineElementRef.current
                },
                setTime: vi.fn(),
            }))
            const [draggedRows, setDraggedRows] = React.useState([])
            return (
                <div ref={timelineElementRef} data-testid="timeline-editor" data-disable-drag={props.disableDrag}>
                    {props.editorData.map(row => (
                        <div className={`timeline-editor-edit-row ${row.classNames.join(' ')}`} key={row.id}>
                            <div className="timeline-editor-edit-row-drag-handle"
                                 data-drag-started={draggedRows.includes(row.id)}
                                 data-testid={`timeline-drag-handle-${row.id}`}
                                 onMouseDown={() => {
                                     setDraggedRows(current => [...current, row.id])
                                     props.onRowDragStart?.({row})
                                 }}/>
                        </div>
                    ))}
                </div>
            )
        }),
    }
})

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaButtonGroup: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaPopup: ({active, children, ...props}) => active ? <div {...props}>{children}</div> : null,
}))

vi.mock('@Components/MainUI/widgets/WidgetsPanelContent', () => ({
    WidgetsPanelContent: ({themeClassName}) => <div data-testid="replay-widget-menu" data-theme={themeClassName}/>,
}))

import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'

describe('ReplayTimelinePreview', () => {
    beforeEach(() => {
        timelineMocks.props = null
        globalThis.__ = {
            ui: {
                widgetManager: {
                    reorderWidgets: vi.fn(),
                    toggleWidgetVisibility: vi.fn((id, visible) => {
                        const current = globalThis.lgs.stores.ui.widget.list.get(id)
                        globalThis.lgs.stores.ui.widget.list.set(id, {...current, visible})
                        return visible
                    }),
                },
                replay: {
                    enterReplayPreparation: vi.fn(async () => true),
                    toggle: vi.fn(),
                    pause: vi.fn(),
                    start: vi.fn(),
                    seek: vi.fn(() => ({sample: null})),
                    refresh: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            settings: {
                widgets: {
                    'dynamic-stats-widget': {
                        name: 'Dynamic Stats',
                        icon: 'chart-line',
                        timelineColor: 'indigo',
                        canHide: true,
                    },
                    'journey-stats-widget': {
                        name: 'Journey Stats',
                        icon: 'mountain',
                        timelineColor: 'green',
                        canHide: true,
                    },
                },
                ui: {
                    replay: {
                        duration: 4,
                        clips: {catalog: {}, start: [], stop: []},
                    },
                },
            },
            stores: {
                main: proxy({theJourney: null}),
                ui: {
                    widget: {
                        list: proxyMap([
                            ['dynamic-stats-widget', {widgetsBoard: 'video-crop-zone', zIndex: 4001}],
                            ['journey-stats-widget', {widgetsBoard: 'video-crop-zone', zIndex: 4000}],
                        ]),
                    },
                    video: proxy({
                        editing: true,
                        timelinePreviewActive: true,
                        fps: 0,
                        preRecording: false,
                        recording: false,
                        recordingHQ: false,
                        finalizing: false,
                    }),
                },
                replay: proxy({
                    recordingSync: true,
                    durationMillis: 4000,
                    direction: 1,
                    playing: false,
                    dynamicFrameState: {frameTimeMs: 1000},
                    clips: {catalog: {}, start: [], stop: []},
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('renders one locked row per active widget and delegates transport controls to Replay', async () => {
        render(<ReplayTimelinePreview/>)

        expect(screen.getByTestId('replay-timeline-preview')).not.toBeNull()
        expect(screen.getByTestId('replay-timeline-preview').className)
            .not.toContain('lgs-on-map-theme-vars')
        expect(screen.getByTestId('replay-timeline-track-legend').textContent).toContain('Replay')
        expect(screen.getByTestId('replay-timeline-track-legend').textContent).toContain('Journey Stats')
        expect(screen.getByTestId('replay-timeline-track-legend').textContent).toContain('Dynamic Stats')
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="route"]')).not.toBeNull()
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="chart-line"]')).not.toBeNull()
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="mountain"]')).not.toBeNull()
        const journeyLegend = screen.getByLabelText('Journey Stats')
        const journeyDragIcon = journeyLegend.querySelector('.replay-timeline-preview__track-drag-icon [data-icon]')
        expect(journeyDragIcon?.getAttribute('data-icon'))
            .toBe('grip-dots-vertical')
        expect(journeyDragIcon?.getAttribute('variant'))
            .toBe('solid')
        const journeyVisibilityToggle = journeyLegend.querySelector('.replay-timeline-preview__track-visibility-toggle')
        expect(journeyVisibilityToggle?.nextElementSibling)
            .toBe(journeyLegend.querySelector('.replay-timeline-preview__track-icon-frame'))
        const replayLegend = screen.getByLabelText('Replay')
        expect(replayLegend.querySelector('.replay-timeline-preview__track-drag-icon [data-icon]')?.getAttribute('data-icon'))
            .toBe('thumbtack')
        expect(replayLegend.querySelector('.replay-timeline-preview__track-visibility-toggle')).not.toBeNull()
        expect(replayLegend.querySelector('.replay-timeline-preview__track-visibility-toggle button')).toBeNull()
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="chart-line"]')
            .className).toContain('wa-neutral wa-neutral-indigo')
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="chart-line"]')
            .parentElement.className).toContain('wa-neutral wa-neutral-indigo')
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-track-number]')).toBeNull()
        expect(screen.getByTestId('timeline-editor').getAttribute('data-disable-drag')).toBe('false')
        expect(timelineMocks.props.editorData).toHaveLength(3)
        expect(timelineMocks.props.editorData.map(row => row.id)).toEqual([
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ])
        expect(timelineMocks.props.scaleSplitCount).toBe(5)
        expect(timelineMocks.props.scaleWidth).toBe(40)
        expect(timelineMocks.props.rowHeight).toBe(24)
        expect(timelineMocks.props.enableRowDrag).toBe(true)
        expect(timelineMocks.props.hideCursor).toBe(false)
        expect(timelineMocks.props.onScroll).toBeTypeOf('function')
        expect(timelineMocks.props.getScaleRender(5020).props.children).toBe('5020')
        expect(timelineMocks.props.editorData.flatMap(row => row.actions).every(action => (
            action.locked === false && action.movable === true && action.flexible === false
        ))).toBe(true)
        expect(timelineMocks.props.onActionResizing({})).toBe(false)
        const dynamicAction = timelineMocks.props.editorData
            .find(row => row.id === 'dynamic-stats-widget').actions[0]
        const dynamicActionRender = timelineMocks.props.getActionRender(dynamicAction)
        expect(dynamicActionRender.props.children.props.action).toBe(dynamicAction)
        const {container: dynamicActionContainer} = render(dynamicActionRender)
        expect(dynamicActionContainer.querySelector('.replay-timeline-action')?.textContent).toBe('Dynamic Stats')
        expect(dynamicActionContainer.querySelector('.replay-timeline-action__icon-trigger [data-icon="chart-line"]')).not.toBeNull()
        expect(dynamicActionContainer.querySelector('.replay-timeline-action__icon-trigger [data-icon="chart-line"]')
            .getAttribute('variant')).toBe('solid')
        expect(dynamicActionContainer.querySelector('[data-tooltip]')).toBeNull()
        expect(dynamicActionContainer.querySelector('wa-tooltip')).toBeNull()
        expect(timelineMocks.props.editorData
            .find(row => row.id === 'dynamic-stats-widget').classNames)
            .toEqual(expect.arrayContaining(['wa-neutral', 'wa-neutral-indigo']))
        expect(dynamicActionRender.props.className)
            .toContain('wa-neutral wa-neutral-indigo')
        const journeyAction = timelineMocks.props.editorData
            .find(row => row.id === 'journey-stats-widget').actions[0]
        const journeyActionRender = timelineMocks.props.getActionRender(journeyAction)
        expect(journeyActionRender.props.className)
            .toContain('wa-neutral wa-neutral-green')
        const replayAction = timelineMocks.props.editorData
            .find(row => row.id === 'replay').actions[0]
        expect(timelineMocks.props.getActionRender(replayAction).props.children.props.action)
            .toBe(replayAction)
        timelineMocks.props.onRowDragEnd({
            row: {id: 'dynamic-stats-widget'},
            editorData: [
                {id: 'dynamic-stats-widget'},
                {id: 'journey-stats-widget'},
                {id: 'replay'},
            ],
        })
        expect(globalThis.__.ui.widgetManager.reorderWidgets).toHaveBeenCalledWith([
            'dynamic-stats-widget',
            'journey-stats-widget',
        ])

        fireEvent.click(screen.getByTestId('replay-timeline-play'))
        fireEvent.click(screen.getByTestId('replay-timeline-replay'))
        expect(globalThis.__.ui.replay.toggle).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replay.start).toHaveBeenCalledWith({progress: 0})

        const widgetMenuTrigger = screen.getByRole('button', {name: 'Add widget to timeline'})
        fireEvent.click(widgetMenuTrigger)
        expect(screen.getByTestId('replay-widget-menu').getAttribute('data-theme')).toBe('wa-theme-lgs1920')
        fireEvent.click(widgetMenuTrigger)
        expect(screen.queryByTestId('replay-widget-menu')).toBeNull()
    })

    it('moves the track legend with the timeline vertical scroll position', () => {
        render(<ReplayTimelinePreview/>)

        act(() => {
            timelineMocks.props.onScroll({scrollTop: 48})
        })

        expect(screen.getByTestId('replay-timeline-track-legend-rows').style.transform)
            .toBe('translateY(-48px)')
    })

    it('toggles a widget track and hatches every action with the track color', async () => {
        render(<ReplayTimelinePreview/>)

        const visibilityButton = screen.getByRole('link', {name: 'Hide Dynamic Stats'})
        fireEvent.mouseDown(visibilityButton, {button: 0})
        expect(screen.getByTestId('timeline-drag-handle-dynamic-stats-widget')
            .getAttribute('data-drag-started')).toBe('false')

        fireEvent.click(visibilityButton)

        await waitFor(() => {
            expect(globalThis.__.ui.widgetManager.toggleWidgetVisibility)
                .toHaveBeenCalledWith('dynamic-stats-widget', false)
            const hiddenRow = timelineMocks.props.editorData.find(row => row.id === 'dynamic-stats-widget')
            expect(hiddenRow.visible).toBe(false)
            expect(hiddenRow.actions.every(action => action.visible === false)).toBe(true)
            expect(timelineMocks.props.getActionRender(hiddenRow.actions[0]).props.className)
                .toContain('replay-timeline-action--hidden')
        })

        expect(screen.getByRole('link', {name: 'Show Dynamic Stats'})).not.toBeNull()
    })

    it('does not render hover tooltips for Replay or clip actions', () => {
        globalThis.lgs.settings.ui.replay.clips.catalog = {
            intro: {id: 'intro', label: 'Intro', slots: ['start'], defaults: {duration: 2}},
        }
        globalThis.lgs.stores.replay.clips = {
            catalog: {
                intro: {id: 'intro', label: 'Intro', slots: ['start'], defaults: {duration: 2}},
            },
            start: [{clipId: 'intro'}],
            stop: [],
        }
        render(<ReplayTimelinePreview/>)

        const replayRow = timelineMocks.props.editorData.find(row => row.id === 'replay')
        const startAction = replayRow.actions.find(action => action.kind === 'start')
        const replayAction = replayRow.actions.find(action => action.kind === 'replay')
        const {container: startContainer} = render(timelineMocks.props.getActionRender(startAction))
        const {container: replayContainer} = render(timelineMocks.props.getActionRender(replayAction))

        expect(startContainer.querySelector('.replay-timeline-action')?.textContent).toContain('Intro')
        expect(startContainer.querySelector('wa-tooltip')).toBeNull()
        expect(replayContainer.querySelector('wa-tooltip')).toBeNull()
    })

    it('starts a movable row drag from the track name', () => {
        render(<ReplayTimelinePreview/>)

        act(() => {
            fireEvent.mouseDown(screen.getByLabelText('Journey Stats'), {button: 0})
        })

        expect(screen.getByTestId('timeline-drag-handle-journey-stats-widget')
            .getAttribute('data-drag-started')).toBe('true')
        expect(screen.getByTestId('replay-timeline-layout').className)
            .toContain('replay-timeline-preview__timeline-layout--dragging')
        expect(screen.getByLabelText('Journey Stats').className)
            .toContain('replay-timeline-preview__track-legend-row--dragging')
        expect(screen.getByTestId('timeline-editor').parentElement.className)
            .toContain('wa-neutral wa-neutral-green')

        act(() => {
            timelineMocks.props.onRowDragEnd({
                row: {id: 'journey-stats-widget'},
                editorData: timelineMocks.props.editorData,
            })
        })

        expect(screen.getByTestId('replay-timeline-layout').className)
            .not.toContain('replay-timeline-preview__timeline-layout--dragging')
    })

    it('uses the journey clips before Replay has hydrated its transient clip store', () => {
        globalThis.lgs.theJourney = {
            replay: {
                start: [{clipId: 'intro'}],
                stop: [{clipId: 'outro'}],
            },
        }
        globalThis.lgs.settings.ui.replay.clips.catalog = {
            intro: {
                id: 'intro',
                label: 'Intro',
                icon: 'plane-departure',
                slots: ['start'],
                defaults: {duration: 2},
            },
            outro: {
                id: 'outro',
                label: 'Outro',
                icon: 'plane-arrival',
                slots: ['stop'],
                defaults: {duration: 1},
            },
        }

        render(<ReplayTimelinePreview/>)

        expect(timelineMocks.props.editorData.find(row => row.id === 'replay').actions.map(action => action.label)).toEqual([
            'Intro',
            'Replay',
            'Outro',
        ])

        const replayActions = timelineMocks.props.editorData.find(row => row.id === 'replay').actions
        expect(replayActions.map(action => action.icon)).toEqual([
            'plane-departure',
            'route',
            'plane-arrival',
        ])

        const {container: introContainer} = render(timelineMocks.props.getActionRender(replayActions[0]))
        const {container: replayContainer} = render(timelineMocks.props.getActionRender(replayActions[1]))
        const {container: outroContainer} = render(timelineMocks.props.getActionRender(replayActions[2]))

        expect(introContainer.querySelector('.replay-timeline-action__icon-trigger [data-icon="plane-departure"]'))
            .not.toBeNull()
        expect(replayContainer.querySelector('.replay-timeline-action__icon-trigger [data-icon="route"]'))
            .not.toBeNull()
        expect(outroContainer.querySelector('.replay-timeline-action__icon-trigger [data-icon="plane-arrival"]'))
            .not.toBeNull()
    })

    it('refreshes clip actions when Replay creates a clip after the timeline mounted', async () => {
        render(<ReplayTimelinePreview/>)

        expect(timelineMocks.props.editorData.find(row => row.id === 'replay').actions.map(action => action.label))
            .toEqual(['Replay'])

        act(() => {
            globalThis.lgs.stores.replay.clips = {
                catalog: {
                    intro: {id: 'intro', label: 'Intro', slots: ['start'], defaults: {duration: 2}},
                },
                start: [{clipId: 'intro'}],
                stop: [],
            }
        })

        await waitFor(() => {
            expect(timelineMocks.props.editorData.find(row => row.id === 'replay').actions.map(action => action.label))
                .toEqual(['Intro', 'Replay'])
        })
    })

    it('keeps Logo and Credits tracks above movable widget tracks', () => {
        globalThis.lgs.settings.widgets['logo-widget'] = {name: 'Logo', icon: 'image'}
        globalThis.lgs.settings.widgets['credits-widget'] = {name: 'Credits', icon: 'user'}
        globalThis.lgs.stores.ui.widget.list.set('logo-widget', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 10001,
        })
        globalThis.lgs.stores.ui.widget.list.set('credits-widget', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 10000,
        })

        render(<ReplayTimelinePreview/>)

        expect(timelineMocks.props.editorData.map(row => row.id)).toEqual([
            'logo-widget',
            'credits-widget',
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ])
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="image"]')).not.toBeNull()
        const fixedRows = timelineMocks.props.editorData.filter(row => (
            row.id === 'logo-widget' || row.id === 'credits-widget'
        ))
        expect(fixedRows.every(row => row.fixed === true && row.movable === false)).toBe(true)
        expect(fixedRows.flatMap(row => row.actions).every(action => action.movable === false)).toBe(true)
    })

    it('uses the text content and regular catalog icon for a text widget track', () => {
        globalThis.lgs.settings.widgets['text-widget'] = {
            name: 'Text',
            icon: 'font',
            timelineColor: 'pink',
            configuration: {
                default: {text: {content: 'My Route'}},
                elements: {
                    'text-widget#title': {text: {content: 'Actual text content'}},
                },
            },
        }
        globalThis.lgs.stores.ui.widget.list.set('text-widget#title', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 3999,
        })

        render(<ReplayTimelinePreview/>)

        expect(screen.getByTestId('replay-timeline-track-legend').textContent).toContain('Actual text content')
        expect(screen.getByTestId('replay-timeline-track-legend').textContent).not.toContain('Widget ·')
        expect(screen.getByTestId('replay-timeline-track-legend').querySelector('[data-icon="font"]')).not.toBeNull()
        const textAction = timelineMocks.props.editorData
            .find(row => row.id === 'text-widget#title').actions[0]
        const textActionRender = timelineMocks.props.getActionRender(textAction)
        expect(textActionRender.props.children.props.action).toBe(textAction)
        const {container: textActionContainer} = render(textActionRender)
        expect(textActionContainer.querySelector('wa-tooltip')).toBeNull()
        expect(textActionRender.props.className)
            .toContain('wa-neutral wa-neutral-pink')
    })

    it('uses the configured Replay duration instead of the journey elapsed duration', () => {
        globalThis.lgs.stores.replay.duration = 60
        globalThis.lgs.stores.replay.durationMillis = 5_020_000

        render(<ReplayTimelinePreview/>)

        expect(timelineMocks.props.maxScaleCount).toBe(60)
    })

    it('requests HQ export through the existing dialog lifecycle', () => {
        const requestHqExport = vi.fn()
        globalThis.window.addEventListener('lgs:video:start-hq-export', requestHqExport)

        render(<ReplayTimelinePreview/>)
        fireEvent.click(screen.getByTestId('replay-timeline-export'))

        expect(requestHqExport).toHaveBeenCalledTimes(1)
        globalThis.window.removeEventListener('lgs:video:start-hq-export', requestHqExport)
    })

    it('stays hidden outside linked timeline preparation', () => {
        globalThis.lgs.stores.ui.video.timelinePreviewActive = false

        render(<ReplayTimelinePreview/>)

        expect(screen.queryByTestId('replay-timeline-preview')).toBeNull()
    })
})
