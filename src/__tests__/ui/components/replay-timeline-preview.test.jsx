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
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render, waitFor} from '@testing-library/react'
import {createRef} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('../../../webcomponents/lgs1920-timeline/LGS1920Timeline.js', () => ({}))

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
        expect(timelineElement.className).toBe('lgs-widget-no-drag')
        expect(timelineElement.timeline).toMatchObject({
            durationMillis: 4_000,
            editable: true,
            interactive: true,
            collisionPolicy: 'prevent',
            rangeStartMillis: 0,
            rangeEndMillis: 4_000,
        })
        expect(timelineElement.currentTimeMillis).toBe(1_000)
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-min-width')).toBe('352px')
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-min-height')).toBe('204px')
        expect(timelineElement.parentElement.style.getPropertyValue('--lgs-replay-timeline-layout-min-height')).toBe('122px')
        expect(container.querySelector('[data-testid="replay-timeline-drag-handle"]')).not.toBeNull()
        expect(timelineElement.querySelector('[slot="legend-ruler"]')).not.toBeNull()
        expect(timelineElement.playing).toBe(false)
        expect(timelineElement.clipOptions).toEqual([])
        expect(timelineElement.tracks.map(track => track.id)).toEqual([
            'dynamic-stats-widget',
            'journey-stats-widget',
            'replay',
        ])
        expect(timelineElement.tracks.slice(0, 2).every(track => (
            track.editable === true
            && track.movable === true
            && track.fixed === false
            && track.droppable === true
        ))).toBe(true)
        expect(timelineElement.tracks[2]).toMatchObject({
            editable: false,
            movable: false,
            fixed: true,
            droppable: false,
        })
        expect(timelineElement.tracks.slice(0, 2).flatMap(track => track.clips).every(clip => (
            clip.fixed === false
            && clip.movable === true
            && clip.resizable === true
        ))).toBe(true)
        expect(timelineElement.tracks[2].clips.every(clip => (
            clip.fixed === true
            && clip.movable === false
            && clip.resizable === false
        ))).toBe(true)
        expect(globalThis.__.ui.replay.enterReplayPreparation).toHaveBeenCalledTimes(1)
    })

    it('updates only the current time when the published Replay frame changes', async () => {
        const {container} = render(<ReplayTimelinePreview/>)
        const timelineElement = container.querySelector('lgs1920-timeline')
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

        await waitFor(() => expect(currentTimeMillis).toBe(2_000))
        expect(timelineAssignments).toBe(0)
        expect(trackAssignments).toBe(0)
        expect(clipOptionAssignments).toBe(0)
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
        expect(tracks.slice(0, 2).every(track => track.fixed === true && track.movable === false)).toBe(true)
        expect(tracks.slice(2, -1).every(track => track.fixed === false && track.movable === true)).toBe(true)
        expect(tracks.at(-1)).toMatchObject({fixed: true, movable: false})
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
