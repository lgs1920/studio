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
    buildDynamicJourneyReplayStatsMetrics,
    isVideoWidgetEditorPhase,
    shouldShowDynamicStatsWidget,
    shouldShowJourneyStatsWidget,
    shouldShowVideoStatsWidget,
} from '@Components/Stats/replayStatsWidgetUtils'
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

    it('builds live metrics from the replay sample', () => {
        const metrics = buildDynamicJourneyReplayStatsMetrics(globalThis.lgs.stores.replay)
        expect(metrics.distance).toBe(120)
        expect(metrics.positive.elevation).toBe(87)
        expect(metrics.hasElevation).toBe(true)
        expect(metrics.duration).toBe(4)
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
