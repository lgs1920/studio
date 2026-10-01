/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-user-modes.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-10-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    defaultSimpleReplaySettings,
    hasExpertReplayConfiguration,
    initializeExpertReplayFromSimple,
    normalizeSimpleReplaySettings,
    normalizeReplayUserMode,
    resolveSimpleReplaySettings,
    syncJourneyExpertReplayCamera,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
} from '@Core/ui/replay/ReplayUserModes'
import {
    getJourneyReplaySettings,
    normalizeJourneyReplaySettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {describe, expect, it, vi} from 'vitest'

describe('Replay user modes', () => {
    it('defaults to Basic and normalizes unknown modes', () => {
        expect(normalizeReplayUserMode()).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode('unknown')).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode(REPLAY_USER_MODE_EXPERT)).toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('resolves journey settings over user and product settings', () => {
        const product = defaultSimpleReplaySettings()
        const resolved = resolveSimpleReplaySettings({
            product,
            user: {camera: {altitude: 900}},
            journey: {camera: {heading: 45}},
        })

        expect(resolved.camera.altitude).toBe(900)
        expect(resolved.camera.heading).toBe(45)
        expect(resolved.camera.altitudeMode).toBe('constant')
    })

    it('keeps Simple Replay in progressive Navigation mode behind the journey without camera debug', () => {
        const defaults = defaultSimpleReplaySettings()
        const normalized = normalizeSimpleReplaySettings({
            camera: {debug: true, positionMode: 'ahead'},
            marker: {mode: 'trace'},
            trace: {mode: 'full'},
        })

        expect(defaults.camera).toMatchObject({debug: false, positionMode: 'behind'})
        expect(defaults.marker.mode).toBe('navigation')
        expect(defaults.trace.mode).toBe('progressive')
        expect(normalized.camera).toMatchObject({debug: false, positionMode: 'behind'})
        expect(normalized.marker.mode).toBe('navigation')
        expect(normalized.trace.mode).toBe('progressive')
    })

    it('forces camera debug off in Basic settings while preserving the stored Expert value', () => {
        expect(normalizeJourneyReplaySettings({
            userMode: REPLAY_USER_MODE_BASIC,
            camera: {debug: true},
        }).camera.debug).toBe(false)
        expect(normalizeJourneyReplaySettings({
            userMode: REPLAY_USER_MODE_EXPERT,
            camera: {debug: true},
        }).camera.debug).toBe(true)
    })

    it('defaults Simple Replay to 15 seconds and accepts only the supported durations', () => {
        expect(defaultSimpleReplaySettings().duration).toBe(15)
        expect(normalizeSimpleReplaySettings({duration: 10}).duration).toBe(10)
        expect(normalizeSimpleReplaySettings({duration: 20}).duration).toBe(20)
        expect(normalizeSimpleReplaySettings({duration: 25}).duration).toBe(15)

        const resolved = resolveSimpleReplaySettings({
            user: {duration: 10},
            journey: {duration: 30},
        })
        expect(resolved.duration).toBe(30)
    })

    it('initializes Expert once and preserves it on mode switches', () => {
        const simple = defaultSimpleReplaySettings()
        const journey = {replay: {start: [], stop: []}}
        const initialized = initializeExpertReplayFromSimple(journey, simple)
        const existing = {replay: {expert: {camera: {altitude: 500}}}}

        expect(hasExpertReplayConfiguration(journey)).toBe(false)
        expect(initialized.expert.camera.altitude).toBe(simple.camera.altitude)
        expect(initializeExpertReplayFromSimple({replay: {start: [], stop: []}}, {
            camera: {positionMode: 'system'},
        }).expert.camera.positionMode).toBe('behind')
        expect(initializeExpertReplayFromSimple(existing, simple)).toBe(existing.replay)
    })

    it('uses and persists the edited Expert camera as the journey replay camera', () => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn()
        const journey = {
            replay: {
                expert: {
                    camera: {altitude: 900, pitch: -60},
                    timeline: {zoomPercent: 70},
                },
            },
            persistToDatabase,
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay: {
                        userMode: REPLAY_USER_MODE_EXPERT,
                        camera: {altitude: 900, pitch: -60},
                    },
                },
            },
            stores: {replay: {}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            syncJourneyExpertReplayCamera({altitude: 2400, pitch: -42})

            expect(journey.replay.expert.camera).toMatchObject({altitude: 2400, pitch: -42})
            expect(journey.replay.expert.timeline).toEqual({zoomPercent: 70})
            expect(globalThis.lgs.stores.replay.camera).toMatchObject({altitude: 2400, pitch: -42})
            expect(getJourneyReplaySettings().camera).toMatchObject({altitude: 2400, pitch: -42})
            expect(persistToDatabase).not.toHaveBeenCalled()

            vi.advanceTimersByTime(250)
            expect(persistToDatabase).toHaveBeenCalledOnce()
        } finally {
            vi.useRealTimers()
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
    })

    it('does not synchronize Expert camera edits while Simple Replay is active', () => {
        const previousLgs = globalThis.lgs
        const journey = {
            replay: {expert: {camera: {altitude: 900, pitch: -60}}},
            persistToDatabase: vi.fn(),
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            theJourney: journey,
        }

        try {
            expect(syncJourneyExpertReplayCamera({altitude: 2400, pitch: -42})).toBeNull()
            expect(journey.replay.expert.camera).toEqual({altitude: 900, pitch: -60})
            expect(journey.persistToDatabase).not.toHaveBeenCalled()
        } finally {
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
    })
})
