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

    it('hides the dynamic stats widget once the end threshold is reached without stop clips', () => {
        globalThis.lgs.stores.replay.progress = 0.9
        expect(shouldShowDynamicStatsWidget(globalThis.lgs.stores.replay)).toBe(false)
    })

    it('shows the journey stats widget only near the end of the replay', () => {
        globalThis.lgs.stores.replay.progress = 0.9
        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(true)

        globalThis.lgs.stores.replay.progress = 0.2
        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(false)
    })

    it('hides the journey stats widget exactly at the end when no stop clips exist', () => {
        globalThis.lgs.stores.replay.progress = 1
        expect(shouldShowJourneyStatsWidget(globalThis.lgs.stores.replay)).toBe(false)
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

    it('uses the replay end threshold outside the editor phase', () => {
        globalThis.lgs.stores.ui.video.recording = true

        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(true)

        globalThis.lgs.stores.replay.progress = 0.9
        expect(shouldShowVideoStatsWidget({mode: 'dynamic'})).toBe(false)
        expect(shouldShowVideoStatsWidget({mode: 'journey'})).toBe(true)
    })

    it('prefers the live replay controller over a throttled store snapshot for visibility', () => {
        globalThis.lgs.stores.ui.video.editing = false
        globalThis.lgs.stores.ui.video.recording = true
        globalThis.lgs.stores.replay.progress = 0.1
        globalThis.__ = {
            ui: {
                replay: {
                    controller: {
                        progress: 0.9,
                        direction: 1,
                        duration: 10,
                        playing: true,
                        paused: false,
                        running: true,
                        currentSample: () => ({
                            distanceFromStart:  180,
                            remainingDistance:  20,
                            cumulativeElevationGain: 95,
                            journeyElapsedMillis: 9000,
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
                        progress: 0.9,
                        direction: 1,
                        duration: 10,
                        playing: true,
                        paused: false,
                        running: true,
                        currentSample: () => ({
                            journeyElapsedMillis: 9000,
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
