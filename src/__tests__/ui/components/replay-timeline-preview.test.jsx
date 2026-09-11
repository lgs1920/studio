/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-preview.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, waitFor} from '@testing-library/react'
import {createRef, Profiler} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('../../../webcomponents/lgs1920-timeline/LGS1920Timeline.js', () => ({}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaIcon: props => <span {...props}/>,
    WaTooltip: ({children, ...props}) => <span data-tooltip {...props}>{children}</span>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar', () => ({
    VideoRecordingSettingsToolbar: () => <div data-testid="video-recording-settings-toolbar"/>,
}))

import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'

describe('ReplayTimelinePreview', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                replay: {
                    enterReplayPreparation: vi.fn(async () => true),
                },
                widgetManager: {
                    getWidgetConfig: vi.fn(() => null),
                    updateWidgetGroups: vi.fn(),
                    reorderWidgets: vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            theJourney: null,
            settings: {
                widgets: {
                    'dynamic-stats-widget': {
                        name: 'Dynamic Stats',
                        icon: 'chart-line',
                        timelineColor: 'indigo',
                    },
                    'journey-stats-widget': {
                        name: 'Journey Stats',
                        icon: 'mountain',
                        timelineColor: 'green',
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

    it('renders the existing Replay projection with the Web Component interactions enabled', () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')

        expect(timelineElement).not.toBeNull()
        expect(timelineElement.hasAttribute('data-widget-selectable')).toBe(true)
        expect(timelineElement.parentElement.getAttribute('data-widget-capture')).toBe('exclude')
        expect(timelineElement.className).toBe('')
        expect(container.querySelector('[data-testid="replay-timeline-drag-handle"]')).toBeNull()
        expect(timelineElement.timeline).toMatchObject({
            durationMillis: 4_000,
            horizontalFit: true,
            editable: true,
            interactive: true,
            collisionPolicy: 'prevent',
            snapThresholdPixels: 8,
            legendMinWidth: 50,
            legendWidth: 150,
            legendMaxWidth: 250,
            rangeStartMillis: 0,
            rangeEndMillis: 4_000,
            durationPolicy: 'extend',
            hostInteraction: 'selectable',
            hostNoDragClass: 'lgs-widget-no-drag',
            resizeExtendsDuration: true,
        })
        expect(timelineElement.currentTimeMillis).toBe(1_000)
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-min-width')).toBe('352px')
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-min-height')).toBe('156px')
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-layout-min-height')).toBe('74px')
        expect(container.querySelector('[slot="custom-menu"] [data-testid="video-recording-settings-toolbar"]')).not.toBeNull()
        expect(container.querySelector('[slot="custom-menu"] [data-additional-content-toggle]')).not.toBeNull()
        expect(container.querySelector('[slot="additional-content"] [data-testid="video-recording-settings-toolbar"]')).not.toBeNull()
        expect(container.querySelector('[slot="additional-content-label"]')?.textContent).toBe('Video settings')
        expect(timelineElement.querySelector('[slot="legend-ruler"]')).toBeNull()
        expect(timelineElement.playing).toBe(false)
        expect(timelineElement.clipOptions).toBeUndefined()
        expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ])
        expect(timelineElement.tracks.slice(0, 2).every(track => (
            track.editable === true
            && !('movable' in track)
            && !('fixed' in track)
            && !('locked' in track)
            && track.droppable === true
        ))).toBe(true)
        expect(timelineElement.tracks[2]).toMatchObject({
            editable: false,
            droppable: true,
        })
        expect(timelineElement.tracks.slice(0, 2).flatMap(track => track.clips).every(clip => (
            clip.editable === true && clip.resizable === true
        ))).toBe(true)
        expect(timelineElement.tracks[2].clips.every(clip => (
            clip.editable === false && clip.resizable === false
        ))).toBe(true)
        expect(globalThis.__.ui.replay.enterReplayPreparation).toHaveBeenCalledTimes(1)
    })

    it('assigns application actions to the generic timeline header', () => {
        const headerActions = <button type="button">Open in drawer</button>
        const {container} = render(<ReplayTimelinePreview headerActions={headerActions}/>)
        const timelineElement = container.querySelector('lgs1920-timeline')

        expect(timelineElement.querySelector('[slot="header-actions"]')).toMatchObject({
            dataset: {widgetCapture: 'exclude'},
        })
    })

    it('updates only the current time when the published Replay frame changes', async () => {
        let commits = 0
        const {container} = render(
            <Profiler id="replay-timeline" onRender={() => { commits += 1 }}>
                <ReplayTimelinePreview/>
            </Profiler>,
        )
        const timelineElement = container.querySelector('lgs1920-timeline')
        const initialCommits = commits
        const initialTimeline = timelineElement.timeline
        const initialTracks = timelineElement.tracks
        const initialClipOptions = timelineElement.clipOptions
        let currentTimeMillis = timelineElement.currentTimeMillis
        let timelineAssignments = 0
        let trackAssignments = 0
        let clipOptionAssignments = 0
        Object.defineProperties(timelineElement, {
            timeline: {
                configurable: true,
                get: () => initialTimeline,
                set: () => {
                    timelineAssignments += 1
                },
            },
            tracks: {
                configurable: true,
                get: () => initialTracks,
                set: () => {
                    trackAssignments += 1
                },
            },
            currentTimeMillis: {
                configurable: true,
                get: () => currentTimeMillis,
                set: value => {
                    currentTimeMillis = value
                },
            },
            clipOptions: {
                configurable: true,
                get: () => initialClipOptions,
                set: () => {
                    clipOptionAssignments += 1
                },
            },
        })

        globalThis.lgs.stores.replay.dynamicFrameState = {frameTimeMs: 2_000}
        globalThis.lgs.stores.replay.playing = true

        await waitFor(() => expect(currentTimeMillis).toBe(2_000))
        expect(timelineElement.playing).toBe(true)
        expect(commits).toBe(initialCommits)
        expect(timelineAssignments).toBe(0)
        expect(trackAssignments).toBe(0)
        expect(clipOptionAssignments).toBe(0)
    })

    it('keeps the current time while widget changes rebuild the preparation state', async () => {
        const enterReplayPreparation = globalThis.__.ui.replay.enterReplayPreparation
        enterReplayPreparation.mockImplementation(async () => {
            if (enterReplayPreparation.mock.calls.length > 1) {
                globalThis.lgs.stores.replay.dynamicFrameState = null
            }
            return true
        })

        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')

        globalThis.lgs.stores.ui.widget.list.set('dynamic-stats-widget', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 3999,
        })

        await waitFor(() => expect(enterReplayPreparation).toHaveBeenCalledTimes(2))
        expect(timelineElement.currentTimeMillis).toBe(1_000)
    })

    it('keeps a locally sought time when the widget rerenders without a published frame', async () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')

        timelineElement.currentTimeMillis = 2_500
        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-seek', {
            bubbles: true,
            detail: {timeMillis: 2_500},
        }))
        globalThis.lgs.stores.replay.dynamicFrameState = null
        globalThis.lgs.stores.ui.widget.list.set('dynamic-stats-widget', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 3999,
        })

        await waitFor(() => expect(timelineElement.currentTimeMillis).toBe(2_500))
    })

    it('does not reassign the timeline when a local track event is emitted', () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const initialTimeline = timelineElement.timeline
        const initialTracks = timelineElement.tracks
        let timelineAssignments = 0
        let trackAssignments = 0
        Object.defineProperties(timelineElement, {
            timeline: {
                configurable: true,
                get: () => initialTimeline,
                set: () => {
                    timelineAssignments += 1
                },
            },
            tracks: {
                configurable: true,
                get: () => initialTracks,
                set: () => {
                    trackAssignments += 1
                },
            },
        })

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-clip-change', {
            detail: {tracks: initialTracks, committed: true},
        }))
        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-reorder', {
            detail: {trackIds: initialTracks.map(track => track.id), tracks: initialTracks},
        }))

        expect(timelineAssignments).toBe(0)
        expect(trackAssignments).toBe(0)
        expect(globalThis.__.ui.widgetManager.updateWidgetGroups).not.toHaveBeenCalled()
        expect(globalThis.__.ui.widgetManager.reorderWidgets).not.toHaveBeenCalled()
    })

    it('coordinates the external widget drag and resize lifecycle with the timeline host', () => {
        const _preview = createRef()
        const {container} = render(<ReplayTimelinePreview ref={_preview}/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        timelineElement.setExternalInteractionActive = vi.fn()
        timelineElement.handleResize = vi.fn()

        _preview.current.onResizeStart()
        _preview.current.handleResize()
        _preview.current.onResizeEnd()
        _preview.current.onDragStart()
        _preview.current.handleDrag()
        _preview.current.onDragEnd()

        expect(timelineElement.setExternalInteractionActive.mock.calls.map(([active]) => active))
            .toEqual([true, true, false, true, true, false])
        expect(timelineElement.handleResize).toHaveBeenCalledOnce()
    })

    it('keeps the existing journey clip labels and icons without track icons', () => {
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

        const {container} = render(<ReplayTimelinePreview/>)
        const replayTrack = container.querySelector('lgs1920-timeline').tracks.find(track => track.id === 'replay')

        expect(replayTrack.clips.map(clip => clip.label)).toEqual(['Intro', 'Replay', 'Outro'])
        expect(replayTrack.clips.map(clip => clip.icon)).toEqual([
            'plane-departure',
            'route',
            'plane-arrival',
        ])
        expect(container.querySelector('lgs1920-timeline').tracks.every(track => !Object.hasOwn(track, 'icon'))).toBe(true)
    })

    it('refreshes the displayed model when Replay creates a clip after mount', async () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')

        expect(timelineElement.tracks.find(track => track.id === 'replay').clips.map(clip => clip.label))
            .toEqual(['Replay'])

        globalThis.lgs.stores.replay.clips = {
            catalog: {
                intro: {id: 'intro', label: 'Intro', slots: ['start'], defaults: {duration: 2}},
            },
            start: [{clipId: 'intro'}],
            stop: [],
        }

        await waitFor(() => {
            expect(timelineElement.tracks.find(track => track.id === 'replay').clips.map(clip => clip.label))
                .toEqual(['Intro', 'Replay'])
        })
    })

    it('keeps Logo and Credits fixed above movable widget tracks', () => {
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

        const {container} = render(<ReplayTimelinePreview/>)
        const tracks = container.querySelector('lgs1920-timeline').tracks

        expect(tracks.map(track => track.id)).toEqual([
            'logo-widget',
            'credits-widget',
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ])
        expect(tracks.slice(0, 2).every(track => track.editable === false)).toBe(true)
        expect(tracks.every(track => !('fixed' in track))).toBe(true)
        expect(tracks.every(track => !('movable' in track))).toBe(true)
    })

    it('does not write widget groups when a timeline track contains multiple widget clips', async () => {
        globalThis.lgs.settings.widgets['text-widget'] = {
            name: 'Text',
            icon: 'font',
        }
        globalThis.lgs.stores.ui.widget.list.set('text-widget#one', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 4002,
        })
        globalThis.lgs.stores.ui.widget.list.set('text-widget#two', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 4001,
        })

        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const widgetTwoTrack = timelineElement.tracks.find(track => track.id === 'text-widget#two')
        const tracks = timelineElement.tracks.map(track => {
            if (track.id === 'text-widget#one') {
                return {
                    ...track,
                    clips: [...track.clips, {...widgetTwoTrack.clips[0], id: 'text-widget#two-on-one'}],
                }
            }
            if (track.id === 'text-widget#two') {
                return {...track, clips: []}
            }
            return track
        })

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-clip-change', {
            detail: {tracks},
        }))

        await waitFor(() => expect(globalThis.__.ui.widgetManager.updateWidgetGroups).not.toHaveBeenCalled())
        expect(globalThis.__.ui.widgetManager.reorderWidgets).not.toHaveBeenCalled()
    })

    it('does not replace widget groups when a member loses all clips in the timeline', async () => {
        globalThis.lgs.settings.widgets['text-widget'] = {
            name: 'Text',
            icon: 'font',
        }
        globalThis.lgs.stores.ui.widget.list.set('text-widget#one', {
            widgetsBoard: 'video-crop-zone',
            widgetGroup: 'group#one',
            zIndex: 4002,
        })
        globalThis.lgs.stores.ui.widget.list.set('text-widget#two', {
            widgetsBoard: 'video-crop-zone',
            widgetGroup: 'group#one',
            zIndex: 4001,
        })

        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const tracks = timelineElement.tracks.map(track => track.id === 'group#one'
            ? {
                ...track,
                clips: track.clips.filter(clip => clip.metadata?.widgetId !== 'text-widget#two'),
            }
            : track)

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-clip-change', {
            detail: {tracks},
        }))

        await waitFor(() => expect(globalThis.__.ui.widgetManager.updateWidgetGroups).not.toHaveBeenCalled())
        expect(globalThis.__.ui.widgetManager.reorderWidgets).not.toHaveBeenCalled()
    })

    it('keeps a clip resize when a new Replay projection is rendered', async () => {
        globalThis.lgs.settings.widgets['text-widget'] = {
            name: 'Text',
            icon: 'font',
        }
        globalThis.lgs.stores.ui.widget.list.set('text-widget#one', {
            widgetsBoard: 'video-crop-zone',
            zIndex: 4002,
        })

        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const editedTracks = timelineElement.tracks.map(track => track.id === 'text-widget#one'
            ? {...track, clips: track.clips.map(clip => ({...clip, end: 2}))}
            : track)

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-clip-change', {
            detail: {tracks: editedTracks, committed: true},
        }))
        timelineElement.tracks = editedTracks
        expect(timelineElement.tracks.find(track => track.id === 'text-widget#one').clips[0].end).toBe(2)

        globalThis.lgs.stores.replay.dynamicFrameState = {frameTimeMs: 2_000}
        await waitFor(() => expect(timelineElement.tracks.find(track => track.id === 'text-widget#one').clips[0].end).toBe(2))
    })

    it('keeps a newly created track at its rendered position when a clip edit refreshes the projection', async () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const genericTrack = {
            id: 'track-1',
            label: 'Track 1',
            kind: 'track',
            clips: [],
        }
        const orderedTracks = [
            genericTrack,
            ...timelineElement.tracks,
        ]

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-add-track', {
            detail: {tracks: orderedTracks, committed: true},
        }))
        timelineElement.tracks = orderedTracks
        await waitFor(() => expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'track-1',
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ]))

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-clip-change', {
            detail: {tracks: orderedTracks, committed: true},
        }))
        timelineElement.tracks = orderedTracks
        globalThis.lgs.stores.replay.dynamicFrameState = {frameTimeMs: 2_000}

        await waitFor(() => expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'track-1',
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ]))

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-after-remove-track', {
            detail: {
                trackId: 'track-1',
                tracks: orderedTracks.slice(1),
                committed: true,
            },
        }))
        timelineElement.tracks = orderedTracks.slice(1)
        await waitFor(() => expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ]))
    })

    it('keeps a track created from the first add-track event', async () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        const createdTrack = {
            id: 'track-1',
            label: 'Track 1',
            kind: 'track',
            autoNumbered: true,
            clips: [],
        }
        const tracks = [createdTrack, ...timelineElement.tracks]

        timelineElement.dispatchEvent(new CustomEvent('lgs1920-timeline-add-track', {
            detail: {tracks, track: createdTrack, trackId: createdTrack.id},
        }))
        timelineElement.tracks = tracks

        await waitFor(() => expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'track-1',
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ]))
    })

    it('uses the configured text content as the displayed track label', () => {
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

        const {container} = render(<ReplayTimelinePreview/>)
        const textTrack = container.querySelector('lgs1920-timeline').tracks
            .find(track => track.id === 'text-widget#title')

        expect(textTrack.label).toBe('Actual text content')
        expect(textTrack.icon).toBeUndefined()
        expect(textTrack.colorClasses).toEqual(['wa-neutral', 'wa-neutral-pink'])
    })

    it('uses the configured Replay duration and hides outside linked preparation', () => {
        globalThis.lgs.stores.replay.duration = 60
        globalThis.lgs.stores.replay.dynamicFrameState = {frameTimeMs: 5_020_000}

        const {container, rerender} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
        expect(timelineElement.timeline.durationMillis).toBe(60_000)
        expect(timelineElement.currentTimeMillis).toBe(60_000)

        globalThis.lgs.stores.ui.video.timelinePreviewActive = false
        rerender(<ReplayTimelinePreview/>)
        expect(container.querySelector('lgs1920-timeline')).toBeNull()
    })
})
