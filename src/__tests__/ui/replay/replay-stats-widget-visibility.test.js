/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-stats-widget-visibility.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-02
 * Last modified on: 2026-07-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    isVideoWidgetEditorPhase,
    resolveReplayExportFrameState,
    resolveReplayVisibilityState,
    resolveVideoOverlayVisibility,
    shouldShowDynamicStatsWidget,
    shouldShowJourneyStatsWidget,
    shouldShowVideoStatsWidget,
} from '@Core/ui/replay/ReplayOverlayResolver'
import { buildDynamicJourneyReplayStatsMetrics } from '@Components/Stats/replayStatsWidgetUtils'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { isWidgetAvailable } from '@Core/ui/widget-manager/widgetAvailability'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { proxy } from 'valtio'

describe('replay stats widget visibility', () => {
    beforeEach(() => {
        globalThis.lgs = {
            theJourney: {
                slug: 'journey-a',
                hasElevation: true,
            },
            stores: {
                ui: {
                    video: proxy({
                        editing: true,
                        preRecording: false,
                        recording: false,
                        finalizing: false,
                        snapshot: false,
                    }),
                },
                replay: proxy({
                    recordingSync: true,
                    playing:       true,
                    paused:        false,
                    progress:      0.4,
                    durationMillis: 10000,
                    elapsedMillis:  4000,
                    direction:     1,
                    clipSequenceActive: false,
                    sample: {
                        distanceFromStart: 120,
                        remainingDistance:  80,
                        altitude:           1337,
                        height:             1337,
                        cumulativeElevationGain: 87,
                    },
                }),
            },
            settings: {
                ui: {
                    replay: {
                        clips: {
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
        }
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('shows the dynamic stats widget while the replay is active and not near the end', () => {
        expect(shouldShowDynamicStatsWidget(globalThis.lgs.stores.replay)).toBe(true)
    })

    it('hides the dynamic stats widget on the last two replay frames', () => {
        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'replay',
            slot: 'replay',
            replayFrameIndex: 8,
            replayFrameCount: 10,
            isLastTwoReplayFrames: true,
        }

        expect(shouldShowDynamicStatsWidget(globalThis.lgs.stores.replay)).toBe(false)
    })

    it('shows the journey stats widget only on the last two replay frames', () => {
        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'replay',
            slot: 'replay',
            replayFrameIndex: 8,
            replayFrameCount: 10,
            isLastTwoReplayFrames: true,
        }
        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(true)

        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'replay',
            slot: 'replay',
            replayFrameIndex: 7,
            replayFrameCount: 10,
            isLastTwoReplayFrames: false,
        }
        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(false)
    })

    it('keeps the journey stats widget visible on the final replay frame', () => {
        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'replay',
            slot: 'replay',
            replayFrameIndex: 9,
            replayFrameCount: 10,
            isLastTwoReplayFrames: true,
        }

        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(true)
    })

    it('builds live metrics from the replay sample', () => {
        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.distance).toBe(120)
        expect(metrics.positive.elevation).toBe(87)
        expect(metrics.hasElevation).toBe(true)
        expect(metrics.duration).toBe(4)
    })

    it('prefers an explicit live sample override for dynamic metrics', () => {
        const metrics = buildDynamicJourneyReplayStatsMetrics(
            globalThis.lgs.stores.replay,
            globalThis.lgs.theJourney,
            {
                distanceFromStart: 123,
                remainingDistance:  77,
                cumulativeElevationGain: 99,
                journeyElapsedMillis: 9876,
            },
        )

        expect(metrics.distance).toBe(123)
        expect(metrics.positive.elevation).toBe(99)
        expect(metrics.duration).toBeCloseTo(9.876)
    })

    it('keeps elevation visible at zero when the journey has elevation data', () => {
        globalThis.lgs.stores.replay.sample.cumulativeElevationGain = 0

        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.positive.elevation).toBe(0)
        expect(metrics.hasElevation).toBe(true)
    })

    it('hides elevation when the journey has no elevation data', () => {
        globalThis.lgs.theJourney.hasElevation = false

        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.hasElevation).toBe(false)
    })

    it('treats the video editor phase as mountable before recording starts', () => {
        expect(isVideoWidgetEditorPhase()).toBe(true)
        globalThis.lgs.stores.ui.video.preRecording = true
        expect(isVideoWidgetEditorPhase()).toBe(true)
        globalThis.lgs.stores.ui.video.recording = true
        expect(isVideoWidgetEditorPhase()).toBe(false)
    })

    it('shows stats widgets during the video editor phase for placement', () => {
        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(true)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(true)
    })

    it('keeps dynamic stats visible while an HQ export frame is being rendered', () => {
        globalThis.lgs.stores.ui.video.finalizing = true
        globalThis.lgs.stores.replay.playing = false
        globalThis.lgs.stores.replay.deferredExportPlan = {
            runtime: {
                status: 'exporting',
                frameState: {
                    active: true,
                    playing: true,
                    paused: false,
                    progress: 0.4,
                    direction: 1,
                    durationMillis: 10000,
                    elapsedMillis: 4000,
                    sample: {
                        distanceFromStart: 333,
                        remainingDistance:  667,
                        cumulativeElevationGain: 44,
                        journeyElapsedMillis: 4000,
                        journeyDurationMillis: 10000,
                    },
                },
            },
        }

        expect(resolveReplayExportFrameState(globalThis.lgs.stores.replay)?.progress).toBe(0.4)
        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(true)

        const resolvedReplayState = resolveReplayVisibilityState({replay: globalThis.lgs.stores.replay})
        expect(resolvedReplayState.progress).toBe(0.4)
        expect(resolvedReplayState.sample.distanceFromStart).toBe(333)

        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.distance).toBe(333)
        expect(metrics.positive.elevation).toBe(44)
        expect(metrics.duration).toBe(4)
    })

    it('uses the shared dynamic replay frame state for live widget metrics', () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.playing = false
        globalThis.lgs.stores.replay.dynamicFrameState = {
            active: true,
            playing: true,
            paused: false,
            progress: 0.25,
            direction: 1,
            durationMillis: 10000,
            elapsedMillis: 2500,
            frameId: 10,
            source: 'controller',
            sample: {
                distanceFromStart: 222,
                remainingDistance:  778,
                cumulativeElevationGain: 66,
                journeyElapsedMillis: 2500,
                journeyDurationMillis: 10000,
            },
        }

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(true)

        const resolvedReplayState = resolveReplayVisibilityState({replay: globalThis.lgs.stores.replay})
        expect(resolvedReplayState.progress).toBe(0.25)
        expect(resolvedReplayState.sample.distanceFromStart).toBe(222)

        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.distance).toBe(222)
        expect(metrics.positive.elevation).toBe(66)
        expect(metrics.duration).toBe(2.5)
    })

    it('uses the last-two-replay-frame window outside the editor phase', () => {
        globalThis.lgs.stores.ui.video.recording = true

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(true)

        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'replay',
            slot: 'replay',
            replayFrameIndex: 9,
            replayFrameCount: 10,
            isLastTwoReplayFrames: true,
        }
        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(true)
    })

    it('applies clip-phase visibility only to dynamic and journey stats', () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.clipSequenceActive = true
        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'start',
            slot: 'start',
        }

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(false)
        expect(resolveVideoOverlayVisibility({widgetId: 'text-widget#1'})).toBe(true)

        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'stop',
            slot: 'stop',
        }

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(true)
        expect(resolveVideoOverlayVisibility({widgetId: 'text-widget#1'})).toBe(true)
    })

    it('does not leak stale stop-phase visibility after replay completion', () => {
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.active = false
        globalThis.lgs.stores.replay.playing = false
        globalThis.lgs.stores.replay.paused = false
        globalThis.lgs.stores.replay.clipSequenceActive = false
        globalThis.lgs.stores.replay.replayFramePhase = {
            kind: 'stop',
            slot: 'stop',
        }

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(false)
    })

    it('prefers the live replay controller over a throttled store snapshot for visibility', () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.progress = 0.1
        globalThis.__ = {
            ui: {
                replay: {
                    controller: {
                        progress: 0.998,
                        direction: 1,
                        duration: 10,
                        playing: true,
                        paused: false,
                        running: true,
                        currentSample: () => ({
                            distanceFromStart:  180,
                            remainingDistance:  20,
                            cumulativeElevationGain: 95,
                            journeyElapsedMillis: 9980,
                            journeyDurationMillis: 10000,
                        }),
                    },
                },
            },
        }

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(true)
    })

    it('resolves video overlay visibility for stats widgets from the live replay state', () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.progress = 0.1
        globalThis.__ = {
            ui: {
                replay: {
                    controller: {
                        progress: 0.998,
                        direction: 1,
                        duration: 10,
                        playing: true,
                        paused: false,
                        running: true,
                        currentSample: () => ({
                            journeyElapsedMillis: 9980,
                            journeyDurationMillis: 10000,
                        }),
                    },
                },
            },
        }

        expect(resolveVideoOverlayVisibility({widgetId: 'dynamic-stats-widget#1'})).toBe(false)
        expect(resolveVideoOverlayVisibility({widgetId: 'journey-stats-widget#1'})).toBe(true)
    })

    it('respects explicit dataset visibility for non-replay overlays', () => {
        const widgetEl = document.createElement('div')
        const overlay = document.createElement('div')
        overlay.dataset.videoOverlayVisible = 'false'
        widgetEl.appendChild(overlay)

        expect(resolveVideoOverlayVisibility({widgetId: 'text-widget#1', widgetEl})).toBe(false)

        overlay.dataset.videoOverlayVisible = 'true'
        expect(resolveVideoOverlayVisibility({widgetId: 'text-widget#1', widgetEl})).toBe(true)
    })

    it('filters widget availability through the generic availability gate', () => {
        const widgetDef = {
            availability: {
                boards: ['video'],
                requires: ['hasJourney'],
            },
        }

        expect(isWidgetAvailable(widgetDef, {widgetsBoard: VIDEO_WIDGETS_BOARD})).toBe(true)
        globalThis.lgs.theJourney = null
        expect(isWidgetAvailable(widgetDef, {widgetsBoard: VIDEO_WIDGETS_BOARD})).toBe(false)
    })

})
