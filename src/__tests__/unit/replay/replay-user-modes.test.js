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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    defaultSimpleReplaySettings,
    flushJourneyReplayCameraPersistence,
    hasExpertReplayConfiguration,
    initializeExpertReplayFromSimple,
    normalizeSimpleReplaySettings,
    normalizeReplayUserMode,
    resolveSimpleReplaySettings,
    syncJourneyExpertReplayCamera,
    syncJourneyExpertReplayProgression,
    syncJourneySimpleReplayCamera,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
} from '@Core/ui/replay/ReplayUserModes'
import {isJourneyReplayBasicMode, resolveJourneyReplayUserMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {
    DEFAULT_REPLAY_CAMERA,
    getJourneyReplaySettings,
    normalizeJourneyReplaySettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {describe, expect, it, vi} from 'vitest'
import {currentJourneyReplayCameraSettings} from '@Core/ui/replay/JourneyReplayRuntime'
import {readFileSync} from 'node:fs'
import {parse as parseYaml} from 'yaml'

const replayYamlDefaults = parseYaml(readFileSync(new URL('../../../../public/replay.yaml', import.meta.url), 'utf8')).replay

describe('Replay user modes', () => {
    it('defaults to Basic and normalizes unknown modes', () => {
        expect(normalizeReplayUserMode()).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode('unknown')).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode(REPLAY_USER_MODE_EXPERT)).toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('keeps Simple camera policies when product YAML has not loaded yet', () => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, simplePreparationActive: false}},
        })

        try {
            const defaults = defaultSimpleReplaySettings()
            expect(defaults.camera).toMatchObject({canDrift: false, canRoll: false})
            expect(defaults.marker.mode).toBe('navigation')
            expect(defaults.trace.mode).toBe('progressive')
        }
        finally {
            vi.unstubAllGlobals()
        }
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

        expect(resolved.camera.altitude).toBe(DEFAULT_REPLAY_CAMERA.altitude)
        expect(resolved.camera.cameraAngle).toBe(45)
        expect(resolved.camera.altitudeMode).toBe('constant')
    })

    it.each(['constant', 'ground-offset'])('resolves the prepared Simple pitch and %s altitude from its Journey', altitudeMode => {
        const camera = {altitude: 2630, pitch: -23, cameraAngle: -113, altitudeMode}
        expect(normalizeSimpleReplaySettings({camera}).camera).toMatchObject(camera)
        expect(resolveSimpleReplaySettings({user: {camera}}).camera).toMatchObject({
            altitude: DEFAULT_REPLAY_CAMERA.altitude,
            pitch: DEFAULT_REPLAY_CAMERA.pitch,
            cameraAngle: 0,
        })
        const journey = {slug: 'prepared', replay: {simple: {camera}}}
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', simple: {camera: {altitude: 480, pitch: -5, cameraAngle: 45}}}}},
            stores: {main: {theJourney: journey}, replay: {simplePreparationActive: false}},
        })
        try {
            expect(getJourneyReplaySettings().camera).toMatchObject(camera)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('reads Simple Replay presentation defaults from YAML and keeps them separate from Expert persistence', () => {
        const previousLgs = globalThis.lgs
        const journey = {
            replay: {
                simple: {
                    presentation: {
                        progression: {
                            fill: {color: '#008000', width: 7},
                            border: {color: '#0000ff', width: 3},
                        },
                    },
                },
                expert: {
                    progression: {
                        fill: {color: '#008000', width: 7},
                        border: {color: '#0000ff', width: 3},
                    },
                },
            },
        }
        globalThis.lgs = {
            savedConfiguration: {ui: {replay: replayYamlDefaults}},
            settings: {
                ui: {
                    replay: {
                        userMode: REPLAY_USER_MODE_BASIC,
                        simple: {
                            presentation: {
                                progression: {
                                    fill: {color: '#008000', width: 7},
                                    border: {color: '#0000ff', width: 3},
                                },
                            },
                        },
                    },
                },
            },
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, simplePreparationActive: false}},
        }

        try {
            const defaults = defaultSimpleReplaySettings()
            const yamlProgression = replayYamlDefaults.simple.presentation.progression
            const normalized = normalizeSimpleReplaySettings({
                camera: {debug: true, positionMode: 'ahead'},
                marker: {mode: 'trace'},
                trace: {mode: 'full'},
                presentation: {
                    progression: {
                        fill: {color: '#008000', width: 7},
                        border: {color: '#0000ff', width: 3},
                    },
                },
            })

            expect(defaults.camera).toMatchObject({debug: false, cameraAngle: 0})
            expect(defaults.camera).not.toHaveProperty('altitude')
            expect(defaults.camera).not.toHaveProperty('pitch')
            expect(defaults.marker.mode).toBe('navigation')
            expect(defaults.trace.mode).toBe('progressive')
            expect(defaults.presentation.progression).toMatchObject(yamlProgression)
            expect(normalized.camera).toMatchObject({debug: false, cameraAngle: 0})
            expect(normalized.marker.mode).toBe('trace')
            expect(normalized.trace.mode).toBe('full')
            expect(normalized.presentation.progression).toMatchObject(yamlProgression)

            expect(getJourneyReplaySettings({journey}).progression).toMatchObject(yamlProgression)

            globalThis.lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_EXPERT
            globalThis.lgs.stores.replay.userMode = REPLAY_USER_MODE_EXPERT
            expect(getJourneyReplaySettings({journey}).progression).toMatchObject({
                fill: {color: '#008000', width: 7},
                border: {color: '#0000ff', width: 3},
            })
        } finally {
            if (previousLgs === undefined) {
                delete globalThis.lgs
            } else {
                globalThis.lgs = previousLgs
            }
        }
    })

    it.each([false, true])('disables Simple runtime diagnostics when persisted settings enable them, preparation: %s', simplePreparationActive => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', simple: {camera: {debug: true}}}}},
            stores: {replay: {simplePreparationActive, camera: {debug: true}}},
            theJourney: {replay: {simple: {camera: {debug: true}}}},
        })
        try {
            expect(getJourneyReplaySettings().camera.debug).toBe(false)
            expect(currentJourneyReplayCameraSettings().debug).toBe(false)
            expect(lgs.theJourney.replay.simple.camera.debug).toBe(true)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('gives Simple a smooth camera response while keeping Expert Ease adjustable', () => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            stores:   {replay: {simplePreparationActive: false}},
            theJourney: {
                replay: {
                    simple: {camera: {hysteresis: {easing: 0.12}}},
                    expert: {camera: {hysteresis: {easing: 0.12}}},
                },
            },
        })
        try {
            expect(currentJourneyReplayCameraSettings().hysteresis.easing).toBe(0.3)

            lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_EXPERT
            expect(currentJourneyReplayCameraSettings().hysteresis.easing).toBe(0.12)
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
            settings: {ui: {replay: {camera: {altitude: 1300, pitch: -20, cameraAngle: 80}}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_EXPERT, simplePreparationActive: false}},
            theJourney: {replay: {expert: {camera: {altitude: 2100}}}},
        }

        try {
            const settings = getJourneyReplaySettings()
            expect(settings.userMode).toBe(REPLAY_USER_MODE_EXPERT)
            expect(settings.camera).toMatchObject({altitude: 2100, pitch: DEFAULT_REPLAY_CAMERA.pitch, cameraAngle: 0})
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
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
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
        expect(initialized.expert.camera).not.toHaveProperty('altitude')
        expect(initialized.expert.camera).not.toHaveProperty('pitch')
        expect(initialized.expert.camera.cameraAngle).toBe(0)
        expect(initializeExpertReplayFromSimple({replay: {start: [], stop: []}}, {
            camera: {positionMode: 'system'},
        }).expert.camera.cameraAngle).toBe(0)
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

    it.each([REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT])('flushes pending %s camera persistence before recording', async userMode => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn(async () => {})
        const camera = {altitude: 2630, pitch: -23, cameraAngle: -113}
        const journey = userMode === REPLAY_USER_MODE_BASIC
            ? {replay: {simple: {camera: {...camera}}}, persistToDatabase}
            : {replay: {expert: {camera: {...camera}}}, persistToDatabase}
        const replaySettings = {
            userMode,
            camera: {...camera},
            simple: userMode === REPLAY_USER_MODE_BASIC ? {camera: {...camera}} : null,
        }
        globalThis.lgs = {
            settings: {ui: {replay: replaySettings}},
            stores: {replay: {userMode, simplePreparationActive: userMode === REPLAY_USER_MODE_BASIC}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            if (userMode === REPLAY_USER_MODE_BASIC) {
                syncJourneySimpleReplayCamera(camera, journey)
            }
            else {
                syncJourneyExpertReplayCamera(camera, journey)
            }

            await expect(flushJourneyReplayCameraPersistence(journey)).resolves.toBe(true)
            expect(persistToDatabase).toHaveBeenCalledOnce()
            vi.advanceTimersByTime(250)
            expect(persistToDatabase).toHaveBeenCalledOnce()
        }
        finally {
            vi.useRealTimers()
            if (previousLgs === undefined) {
                delete globalThis.lgs
            }
            else {
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
