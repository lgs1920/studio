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
 * Last modified: 2026-10-10
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
    syncJourneyExpertReplayProgression,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
} from '@Core/ui/replay/ReplayUserModes'
import {isJourneyReplayBasicMode, resolveJourneyReplayUserMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {
    getJourneyReplaySettings,
    normalizeJourneyReplaySettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {describe, expect, it, vi} from 'vitest'
import {currentJourneyReplayCameraSettings} from '@Core/ui/replay/JourneyReplayRuntime'

describe('Replay user modes', () => {
    it('defaults to Basic and normalizes unknown modes', () => {
        expect(normalizeReplayUserMode()).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode('unknown')).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode(REPLAY_USER_MODE_EXPERT)).toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('prefers the saved mode to the runtime store default while Simple preparation stays Basic', () => {
        const settings = {userMode: REPLAY_USER_MODE_EXPERT}
        const replay = {userMode: REPLAY_USER_MODE_BASIC, simplePreparationActive: false}

        expect(resolveJourneyReplayUserMode({settings, replay})).toBe(REPLAY_USER_MODE_EXPERT)
        expect(isJourneyReplayBasicMode({settings, replay})).toBe(false)
        expect(resolveJourneyReplayUserMode({settings, replay: {...replay, simplePreparationActive: true}}))
            .toBe(REPLAY_USER_MODE_BASIC)
        expect(resolveJourneyReplayUserMode({settings: {}, replay: {userMode: REPLAY_USER_MODE_EXPERT}}))
            .toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('resolves journey settings over user and product settings', () => {
        const product = defaultSimpleReplaySettings()
        const resolved = resolveSimpleReplaySettings({
            product,
            user: {camera: {altitude: 900}},
            journey: {camera: {cameraAngle: 45}},
        })

        expect(resolved.camera.altitude).toBe(900)
        expect(resolved.camera.cameraAngle).toBe(45)
        expect(resolved.camera.altitudeMode).toBe('constant')
    })

    it.each(['constant', 'ground-offset'])('preserves the prepared Simple pitch and %s altitude mode', altitudeMode => {
        const camera = {altitude: 2630, pitch: -23, cameraAngle: -113, altitudeMode}
        expect(normalizeSimpleReplaySettings({camera}).camera).toMatchObject(camera)
        expect(resolveSimpleReplaySettings({user: {camera}}).camera).toMatchObject(camera)
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', simple: {camera}}}},
            stores: {main: {theJourney: {slug: 'prepared'}}, replay: {simplePreparationActive: false}},
        })
        try {
            expect(getJourneyReplaySettings().camera).toMatchObject(camera)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('keeps Simple Replay behind by default and preserves the camera debug setting', () => {
        const defaults = defaultSimpleReplaySettings()
        const normalized = normalizeSimpleReplaySettings({
            camera: {debug: true, positionMode: 'ahead'},
            marker: {mode: 'trace'},
            trace: {mode: 'full'},
        })

        expect(defaults.camera).toMatchObject({debug: false, cameraAngle: 180})
        expect(defaults.marker.mode).toBe('navigation')
        expect(defaults.trace.mode).toBe('progressive')
        expect(normalized.camera).toMatchObject({debug: true, cameraAngle: 0})
        expect(normalized.marker.mode).toBe('navigation')
        expect(normalized.trace.mode).toBe('progressive')
    })

    it.each([false, true])('forces Simple runtime diagnostics despite saved and prepared debug=false, preparation: %s', simplePreparationActive => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', simple: {camera: {debug: false}}}}},
            stores: {replay: {simplePreparationActive, camera: {debug: false}}},
            theJourney: {replay: {simple: {camera: {debug: false}}}},
        })
        try {
            expect(getJourneyReplaySettings().camera.debug).toBe(true)
            expect(currentJourneyReplayCameraSettings().debug).toBe(true)
            expect(lgs.theJourney.replay.simple.camera.debug).toBe(false)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('preserves the camera debug setting in both user modes', () => {
        expect(normalizeJourneyReplaySettings({
            userMode: REPLAY_USER_MODE_BASIC,
            camera: {debug: true},
        }).camera.debug).toBe(true)
        expect(normalizeJourneyReplaySettings({
            userMode: REPLAY_USER_MODE_EXPERT,
            camera: {debug: true},
        }).camera.debug).toBe(true)
    })

    it('resolves Expert settings when the runtime store still has its default Basic mode', () => {
        const previousLgs = globalThis.lgs
        globalThis.lgs = {
            settings: {ui: {replay: {camera: {altitude: 1300}}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_EXPERT, simplePreparationActive: false}},
            theJourney: {replay: {expert: {camera: {altitude: 2100}}}},
        }

        try {
            const settings = getJourneyReplaySettings()
            expect(settings.userMode).toBe(REPLAY_USER_MODE_EXPERT)
            expect(settings.camera.altitude).toBe(2100)
        } finally {
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
    })

    it('uses the selected journey for Expert camera settings and synchronization', () => {
        const previousLgs = globalThis.lgs
        const selectedJourney = {
            slug: 'selected-journey',
            replay: {expert: {camera: {altitude: 900, pitch: -60}}},
        }
        const previousJourney = {
            slug: 'previous-journey',
            replay: {expert: {camera: {altitude: 900, pitch: -12}}},
        }
        globalThis.lgs = {
            settings: {ui: {replay: {camera: {altitude: 900, pitch: -65}}}},
            stores: {
                main: {theJourney: selectedJourney},
                replay: {userMode: REPLAY_USER_MODE_EXPERT},
            },
            theJourney: previousJourney,
        }

        try {
            expect(getJourneyReplaySettings().camera.pitch).toBe(-60)
            syncJourneyExpertReplayCamera({altitude: 900, pitch: -35})
            expect(selectedJourney.replay.expert.camera.pitch).toBe(-35)
            expect(previousJourney.replay.expert.camera.pitch).toBe(-12)
        } finally {
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
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
        }).expert.camera.cameraAngle).toBe(180)
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

    it('uses and persists the edited Expert progression instead of an older journey value', () => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn()
        const journey = {
            replay: {
                expert: {
                    progression: {fill: {color: '#112233'}},
                    profileInfo: {color: '#ffffff'},
                },
            },
            persistToDatabase,
        }
        const progression = {
            ...defaultSimpleReplaySettings().presentation.progression,
            fill: {
                ...defaultSimpleReplaySettings().presentation.progression.fill,
                color: '#445566',
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_EXPERT}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, simplePreparationActive: false}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            expect(isJourneyReplayBasicMode()).toBe(false)
            syncJourneyExpertReplayProgression(progression)

            expect(journey.replay.expert.progression.fill.color).toBe('#445566')
            expect(globalThis.lgs.stores.replay.progression.fill.color).toBe('#445566')
            expect(getJourneyReplaySettings().progression.fill.color).toBe('#445566')
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
