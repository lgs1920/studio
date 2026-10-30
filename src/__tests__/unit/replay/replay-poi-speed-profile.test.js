/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-poi-speed-profile.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    createReplayPOISpeedProfile,
    replayPlaybackTimeAtRouteTime,
    replayRouteTimeAtPlaybackTime,
} from '@Core/ui/replay/ReplayPOISpeedProfile'
import {JourneyReplayPlaybackController} from '@Core/ui/replay/JourneyReplayPlaybackController'
import {buildReplayVideoTimeline, resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {describe, expect, it} from 'vitest'

const basicSettings = {
    animatePoisDuringJourneyReplay: true,
    poiAnimationDurationSeconds: 2,
    poiVisibilityMode: 'user',
}

/** Build a visible, animated POI trigger for speed-profile coverage. */
const poiEntry = (id, projectedAbscissa) => ({
    projectedAbscissa,
    poi: {id, type: 'poi', expanded: true, replay: {animated: true, visible: true}},
})

describe('Basic Replay POI speed profile', () => {
    it('slows down for animated Start and Stop POIs at the route boundaries', () => {
        const start = poiEntry('start', 0)
        start.poi.type = 'start'
        start.poi.expanded = false
        const stop = poiEntry('stop', 1000)
        stop.poi.type = 'stop'
        stop.poi.expanded = false
        const profile = createReplayPOISpeedProfile({
            entries: [start, stop],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })

        expect(profile.playbackDurationMillis).toBeGreaterThan(10000)
    })

    it('merges overlapping POI windows, ramps around each POI, and preserves each crawl zone', () => {
        const profile = createReplayPOISpeedProfile({
            entries: [poiEntry('first', 500), poiEntry('second', 550)],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })

        const crawlSegments = profile.segments.filter(segment => segment.poiCrawl)
        expect(profile.playbackDurationMillis).toBeGreaterThan(12500)
        expect(profile.playbackDurationMillis).toBeLessThan(14159)
        expect(crawlSegments).toHaveLength(64)
        expect(crawlSegments.some(({routeStartMillis, routeEndMillis}) => (
            routeStartMillis < 5000 && routeEndMillis > 5000
        ))).toBe(false)
        expect(crawlSegments.some(({routeStartMillis, routeEndMillis}) => (
            routeStartMillis < 5500 && routeEndMillis > 5500
        ))).toBe(false)
        const playbackTime = replayPlaybackTimeAtRouteTime(profile, 5250)
        expect(replayRouteTimeAtPlaybackTime(profile, playbackTime)).toBeCloseTo(5250)
    })

    it('adds the slowdown duration of separate POI windows', () => {
        const profile = createReplayPOISpeedProfile({
            entries: [poiEntry('first', 250), poiEntry('second', 750)],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })

        expect(profile.playbackDurationMillis).toBeGreaterThan(14000)
        expect(profile.playbackDurationMillis).toBeLessThan(14200)
        expect(profile.segments.filter(segment => segment.poiCrawl)).toHaveLength(64)
    })

    it('slows down for the animated POI when a hidden POI overlaps it', () => {
        const hiddenAndNonAnimated = poiEntry('hidden', 750)
        hiddenAndNonAnimated.poi.expanded = true
        hiddenAndNonAnimated.poi.replay.animated = false
        const animationExpanded = poiEntry('animation-expanded', 750)
        animationExpanded.poi.expanded = false
        const animatedOnly = createReplayPOISpeedProfile({
            entries: [animationExpanded],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })
        const profile = createReplayPOISpeedProfile({
            entries: [hiddenAndNonAnimated, animationExpanded],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })

        expect(profile.playbackDurationMillis).toBe(animatedOnly.playbackDurationMillis)
        expect(profile.segments.filter(segment => segment.poiCrawl)).toHaveLength(
            animatedOnly.segments.filter(segment => segment.poiCrawl).length,
        )
    })

    it('does not slow down for manually expanded POIs when Replay animation is disabled', () => {
        const expanded = poiEntry('expanded', 500)
        expanded.poi.replay.animated = false
        const collapsed = poiEntry('collapsed', 800)
        collapsed.poi.expanded = false
        collapsed.poi.replay.animated = false
        const profile = createReplayPOISpeedProfile({
            entries: [expanded, collapsed],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings: {...basicSettings, animatePoisDuringJourneyReplay: false},
            enabled: true,
        })

        expect(profile.playbackDurationMillis).toBe(10000)
        expect(profile.shouldSlowdown).toBe(false)
    })

    it('does not slow down for POIs hidden by visibility settings or outside the video crop', () => {
        const hiddenByReplay = poiEntry('replay-hidden', 250)
        hiddenByReplay.poi.replay.visible = false
        const hiddenOnMap = poiEntry('map-hidden', 500)
        hiddenOnMap.poi.visible = false
        const outsideCrop = poiEntry('outside-crop', 750)
        let cropChecks = 0
        const profile = createReplayPOISpeedProfile({
            entries: [hiddenByReplay, hiddenOnMap, outsideCrop],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
            isPOIInVideoCrop: () => {
                cropChecks += 1
                return false
            },
        })

        expect(profile.playbackDurationMillis).toBe(10000)
        expect(profile.shouldSlowdown).toBe(false)
        expect(cropChecks).toBe(3)
    })

    it('slows down when a POI enters the crop during its display window', () => {
        const entry = poiEntry('crop-entry', 750)
        const profile = createReplayPOISpeedProfile({
            entries: [entry],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
            isPOIInVideoCrop: (_entry, progress) => progress >= 0.85,
        })

        expect(profile.playbackDurationMillis).toBeGreaterThan(10000)
    })

    it('maps extended Replay timeline timestamps back to route progress', () => {
        const profile = createReplayPOISpeedProfile({
            entries: [poiEntry('first', 500), poiEntry('second', 550)],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: profile.playbackDurationMillis,
            replayProgressProfile: profile,
            fps: 10,
        })

        expect(timeline.durationMillis).toBe(profile.playbackDurationMillis)
        const playbackTime = replayPlaybackTimeAtRouteTime(profile, 5000)
        expect(resolveReplayVideoFramePhase({timeline, frameTimeMs: playbackTime}).progress)
            .toBeCloseTo(0.5)
    })

    it('keeps route endpoints finite when a POI hold touches the start or end', () => {
        const startProfile = createReplayPOISpeedProfile({
            entries: [poiEntry('start', 0)],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })
        const endProfile = createReplayPOISpeedProfile({
            entries: [poiEntry('end', 1000)],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings,
            enabled: true,
        })

        expect(replayPlaybackTimeAtRouteTime(startProfile, 0)).toBe(0)
        expect(replayRouteTimeAtPlaybackTime(startProfile, startProfile.playbackDurationMillis))
            .toBe(10000)
        expect(Number.isFinite(replayPlaybackTimeAtRouteTime(endProfile, 10000))).toBe(true)
        expect(replayRouteTimeAtPlaybackTime(endProfile, endProfile.playbackDurationMillis))
            .toBe(10000)
    })

    it('keeps the route duration when Basic Replay POI animation is disabled', () => {
        const collapsed = poiEntry('first', 500)
        collapsed.poi.expanded = false
        const profile = createReplayPOISpeedProfile({
            entries: [collapsed],
            totalDistance: 1000,
            replayDurationMillis: 10000,
            basicSettings: {...basicSettings, animatePoisDuringJourneyReplay: false},
            enabled: true,
        })

        expect(profile.playbackDurationMillis).toBe(10000)
    })

    it('publishes the extended Basic Replay duration to the playback toolbar state', () => {
        const previousLgs = globalThis.lgs
        const entries = [poiEntry('first', 500), poiEntry('second', 550)]
        const frames = []
        let now = 0
        const sampler = {
            hasSamples: true,
            totalDistance: 1000,
            durationMillis: 10000,
            journey: {slug: 'poi-speed-test'},
            atProgress: progress => ({
                progress,
                distanceFromStart: progress * 1000,
                remainingDistance: (1 - progress) * 1000,
                journeyElapsedMillis: progress * 10000,
                journeyDurationMillis: 10000,
            }),
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: 'basic', basic: basicSettings}}},
            stores: {replay: {captureFps: 30, nearbyPois: entries, userMode: 'basic'}},
            events: {emit: () => {}},
            scene: {requestRender: () => {}},
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now: () => now,
            })
            controller.configure({sampler, duration: 10})

            const profile = globalThis.lgs.stores.replay.poiPlaybackProfile
            expect(controller.playbackDuration).toBe(profile.playbackDurationMillis / 1000)
            expect(globalThis.lgs.stores.replay.durationMillis).toBe(profile.playbackDurationMillis)
            expect(controller.videoTimeline.durationMillis).toBe(profile.playbackDurationMillis)

            controller.start()
            now = 6500
            frames.shift()()
            expect(globalThis.lgs.stores.replay.sample.progress).toBeCloseTo(
                replayRouteTimeAtPlaybackTime(profile, 6500) / 10000,
            )
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })
})
