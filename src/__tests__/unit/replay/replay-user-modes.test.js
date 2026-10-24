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
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    defaultBasicReplaySettings,
    flushJourneyReplayCameraPersistence,
    flushJourneyReplayStartPositionPersistence,
    hasExpertReplayConfiguration,
    initializeExpertReplayFromBasic,
    normalizeBasicReplaySettings,
    normalizeReplayUserMode,
    journeyReplayStartPosition,
    resolveBasicReplaySettings,
    syncJourneyExpertReplayCamera,
    syncJourneyExpertReplayProgression,
    syncJourneyBasicReplayCamera,
    syncJourneyBasicReplayEndFocus,
    syncJourneyBasicReplaySampleCount,
    syncJourneyReplayStartPosition,
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
    it('persists the departure screen position separately on each Journey and Replay mode', async () => {
        const persistSimple = vi.fn()
        const persistExpert = vi.fn()
        const basicJourney = {slug: 'basic-journey', replay: {}, persistToDatabase: persistSimple}
        const expertJourney = {slug: 'expert-journey', replay: {}, persistToDatabase: persistExpert}

        expect(syncJourneyReplayStartPosition({x: 0.72, y: 0.34}, basicJourney, REPLAY_USER_MODE_BASIC))
            .toEqual({x: 0.72, y: 0.34})
        expect(syncJourneyReplayStartPosition({x: 0.28, y: 0.66}, expertJourney, REPLAY_USER_MODE_EXPERT))
            .toEqual({x: 0.28, y: 0.66})

        expect(journeyReplayStartPosition(basicJourney, REPLAY_USER_MODE_BASIC)).toEqual({x: 0.72, y: 0.34})
        expect(journeyReplayStartPosition(expertJourney, REPLAY_USER_MODE_EXPERT)).toEqual({x: 0.28, y: 0.66})
        await expect(flushJourneyReplayStartPositionPersistence(basicJourney)).resolves.toBe(true)
        await expect(flushJourneyReplayStartPositionPersistence(expertJourney)).resolves.toBe(true)
        expect(persistSimple).toHaveBeenCalledOnce()
        expect(persistExpert).toHaveBeenCalledOnce()
    })

    it('moves legacy Journey settings to the Basic key when persisting a Basic edit', async () => {
        const persistToDatabase = vi.fn(async () => undefined)
        const journey = {
            slug: 'legacy-journey',
            replay: {
                simple: {
                    duration: 30,
                    startPosition: {x: 0.25, y: 0.75},
                    camera: {cameraAngle: 45},
                },
            },
            persistToDatabase,
        }

        expect(journeyReplayStartPosition(journey, REPLAY_USER_MODE_BASIC)).toEqual({x: 0.25, y: 0.75})
        syncJourneyReplayStartPosition({x: 0.6, y: 0.4}, journey, REPLAY_USER_MODE_BASIC)

        expect(journey.replay.basic).toEqual({
            duration: 30,
            startPosition: {x: 0.6, y: 0.4},
            camera: {cameraAngle: 45},
        })
        expect(journey.replay).not.toHaveProperty('simple')
        await expect(flushJourneyReplayStartPositionPersistence(journey)).resolves.toBe(true)
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('defaults to Basic and normalizes unknown modes', () => {
        expect(normalizeReplayUserMode()).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode('unknown')).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode(REPLAY_USER_MODE_EXPERT)).toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('keeps Basic camera policies when product YAML has not loaded yet', () => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, basicPreparationActive: false}},
        })

        try {
            const defaults = defaultBasicReplaySettings()
            expect(defaults.camera).toMatchObject({canDrift: false, canRoll: false})
            expect(defaults.marker.mode).toBe('navigation')
            expect(defaults.trace.mode).toBe('progressive')
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('keeps active Basic preparation authoritative over the saved Expert mode', () => {
        const settings = {userMode: REPLAY_USER_MODE_EXPERT}
        const replay = {userMode: REPLAY_USER_MODE_BASIC, basicPreparationActive: false}

        expect(resolveJourneyReplayUserMode({settings, replay})).toBe(REPLAY_USER_MODE_EXPERT)
        expect(isJourneyReplayBasicMode({settings, replay})).toBe(false)
        expect(resolveJourneyReplayUserMode({settings, replay: {...replay, basicPreparationActive: true}}))
            .toBe(REPLAY_USER_MODE_BASIC)
        expect(resolveJourneyReplayUserMode({settings: {}, replay: {userMode: REPLAY_USER_MODE_EXPERT}}))
            .toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('resolves compact appearance overrides without scaling product widths repeatedly or changing Expert style', () => {
        vi.stubGlobal('lgs', {
            savedConfiguration: {ui: {replay: replayYamlDefaults}},
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC, basic: {
                presentation: {sizeScale: 1.5, fillColor: '#008000'},
            }}}},
            stores: {replay: {basicPreparationActive: true}},
            theJourney: {replay: {
                basic: {presentation: {sizeScale: 2.3, borderColor: '#0000ff'}},
                expert: {progression: {fill: {color: '#ffffff', width: 7}, border: {width: 3}}},
            }},
        })
        try {
            const resolved = resolveBasicReplaySettings({
                user: globalThis.lgs.settings.ui.replay.basic,
                journey: globalThis.lgs.theJourney.replay.basic,
            })
            expect(resolved.presentation).toMatchObject({sizeScale: 2.3, fillColor: '#008000', borderColor: '#0000ff'})
            const normalized = normalizeBasicReplaySettings(resolved)
            expect(normalized.presentation.progression.fill.width).toBe(replayYamlDefaults.basic.presentation.progression.fill.width)
            expect(getJourneyReplaySettings().progression).toMatchObject({
                sizeScale: 2.3, fill: {color: '#008000', width: 4}, border: {color: '#0000ff', width: 2},
            })
            expect(normalizeBasicReplaySettings({presentation: {sizeScale: 99}}).presentation.sizeScale).toBe(1)
            expect(normalizeBasicReplaySettings({presentation: null}).presentation.sizeScale).toBe(1)
            globalThis.lgs.stores.replay.basicPreparationActive = false
            globalThis.lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_EXPERT
            expect(getJourneyReplaySettings().progression.fill).toMatchObject({color: '#ffffff', width: 7})
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('keeps legacy Basic borders enabled and resolves the thin trace with an independent marker scale', () => {
        const legacy = normalizeBasicReplaySettings({presentation: {sizeScale: 1.5, borderColor: '#123456'}})
        expect(legacy.presentation).toMatchObject({
            sizeScale: 1.5,
            markerSizeScale: 1.5,
            borderEnabled: true,
            borderColor: '#123456',
            progression: {border: {opacity: 1}},
        })

        const thin = normalizeBasicReplaySettings({presentation: {
            sizeScale: 0.65,
            markerSizeScale: 1,
            borderEnabled: false,
            borderColor: '#654321',
        }})
        expect(thin.presentation).toMatchObject({
            sizeScale: 0.65,
            markerSizeScale: 1,
            borderEnabled: false,
            borderColor: '#654321',
            progression: {
                sizeScale: 0.65,
                markerSizeScale: 1,
                border: {color: '#654321', opacity: 0},
            },
        })
    })

    it('resolves journey settings over user and product settings', () => {
        const product = defaultBasicReplaySettings()
        const resolved = resolveBasicReplaySettings({
            product,
            user: {camera: {altitude: 900}},
            journey: {camera: {cameraAngle: 45}},
        })

        expect(resolved.camera.altitude).toBe(DEFAULT_REPLAY_CAMERA.altitude)
        expect(resolved.camera.cameraAngle).toBe(45)
        expect(resolved.camera.altitudeMode).toBe('constant')
    })

    it('uses Basic sampling by default and persists a Journey override above the global preference', async () => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn(async () => undefined)
        const journey = {
            slug: 'sampling-journey',
            replay: {},
            persistToDatabase,
        }
        vi.stubGlobal('lgs', {
            savedConfiguration: {ui: {replay: replayYamlDefaults}},
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC, basic: {sampleCount: 4096}}}},
            stores: {main: {theJourney: journey}, replay: {basicPreparationActive: true}},
        })
        vi.useFakeTimers()

        try {
            expect(defaultBasicReplaySettings().sampleCount).toBe(1024)
            expect(normalizeBasicReplaySettings({sampleCount: 999}).sampleCount).toBe(1024)
            expect(resolveBasicReplaySettings({
                user: {sampleCount: 4096},
                journey: {sampleCount: 1024},
            }).sampleCount).toBe(1024)

            expect(syncJourneyBasicReplaySampleCount(1024, journey)).toBe(1024)
            expect(journey.replay.basic.sampleCount).toBe(1024)
            expect(getJourneyReplaySettings({journey}).sampleCount).toBe(1024)
            vi.advanceTimersByTime(250)
            await Promise.resolve()
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

    it('defaults Basic end focus to 3 seconds, normalizes its range, and persists Journey overrides', async () => {
        const previousLgs = globalThis.lgs
        const persistToDatabase = vi.fn(async () => undefined)
        const journey = {slug: 'focus-journey', replay: {}, persistToDatabase}
        vi.stubGlobal('lgs', {
            savedConfiguration: {ui: {replay: replayYamlDefaults}},
            settings: {ui: {replay: {basic: {endFocus: {enabled: false, duration: 4}}}}},
            stores: {main: {theJourney: journey}, replay: {basicPreparationActive: true}},
        })
        vi.useFakeTimers()

        try {
            expect(defaultBasicReplaySettings().endFocus).toEqual({enabled: true, duration: 3})
            expect(normalizeBasicReplaySettings({endFocus: {enabled: false, duration: 9}}).endFocus)
                .toEqual({enabled: false, duration: 5})
            expect(resolveBasicReplaySettings({
                user: {endFocus: {enabled: true, duration: 2}},
                journey: {endFocus: {enabled: false}},
            }).endFocus).toEqual({enabled: false, duration: 2})

            expect(syncJourneyBasicReplayEndFocus({enabled: true, duration: 5}, journey))
                .toEqual({enabled: true, duration: 5})
            expect(journey.replay.basic.endFocus).toEqual({enabled: true, duration: 5})
            expect(getJourneyReplaySettings({journey}).basic.endFocus).toEqual({enabled: true, duration: 5})
            vi.advanceTimersByTime(250)
            await Promise.resolve()
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

    it('keeps Basic Replay in Navigation mode and enables zone diagnostics', () => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            stores: {replay: {basicPreparationActive: false}},
        })
        const journey = {replay: {basic: {marker: {mode: 'navigation'}}}}

        try {
            expect(getJourneyReplaySettings({journey}).marker.mode).toBe('navigation')
            expect(getJourneyReplaySettings({journey}).camera.debug).toBe(true)
            expect(currentJourneyReplayCameraSettings({journey}).debug).toBe(true)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it.each(['constant', 'ground-offset'])('resolves the prepared Basic pitch and %s altitude from its Journey', altitudeMode => {
        const camera = {altitude: 2630, pitch: -23, cameraAngle: -113, altitudeMode}
        expect(normalizeBasicReplaySettings({camera}).camera).toMatchObject(camera)
        expect(resolveBasicReplaySettings({user: {camera}}).camera).toMatchObject({
            altitude: DEFAULT_REPLAY_CAMERA.altitude,
            pitch: DEFAULT_REPLAY_CAMERA.pitch,
            cameraAngle: 0,
        })
        const journey = {slug: 'prepared', replay: {basic: {camera}}}
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', basic: {camera: {altitude: 480, pitch: -5, cameraAngle: 45}}}}},
            stores: {main: {theJourney: journey}, replay: {basicPreparationActive: false}},
        })
        try {
            expect(getJourneyReplaySettings().camera).toMatchObject(camera)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('reads Basic Replay presentation defaults from YAML and keeps them separate from Expert persistence', () => {
        const previousLgs = globalThis.lgs
        const journey = {
            replay: {
                basic: {
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
                        basic: {
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
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, basicPreparationActive: false}},
        }

        try {
            const defaults = defaultBasicReplaySettings()
            const yamlProgression = replayYamlDefaults.basic.presentation.progression
            const normalized = normalizeBasicReplaySettings({
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
            expect(normalized.presentation.progression).toMatchObject({
                ...yamlProgression,
                fill: {...yamlProgression.fill, color: '#008000'},
                border: {...yamlProgression.border, color: '#0000ff'},
            })

            expect(getJourneyReplaySettings({journey}).progression).toMatchObject({
                ...yamlProgression,
                fill: {...yamlProgression.fill, color: '#008000'},
                border: {...yamlProgression.border, color: '#0000ff'},
            })

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

    it.each([false, true])('enables Basic runtime diagnostics without changing persisted settings, preparation: %s', basicPreparationActive => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: 'basic', basic: {camera: {debug: true}}}}},
            stores: {replay: {basicPreparationActive, camera: {debug: true}}},
            theJourney: {replay: {basic: {camera: {debug: true}}}},
        })
        try {
            expect(getJourneyReplaySettings().camera.debug).toBe(true)
            expect(currentJourneyReplayCameraSettings().debug).toBe(true)
            expect(lgs.theJourney.replay.basic.camera.debug).toBe(true)
        }
        finally {
            vi.unstubAllGlobals()
        }
    })

    it('gives Basic a smooth camera response while keeping Expert Ease adjustable', () => {
        vi.stubGlobal('lgs', {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_BASIC}}},
            stores:   {replay: {basicPreparationActive: false}},
            theJourney: {
                replay: {
                    basic: {camera: {hysteresis: {easing: 0.12}}},
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
            stores: {replay: {userMode: REPLAY_USER_MODE_EXPERT, basicPreparationActive: false}},
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

    it('defaults Basic Replay to 15 seconds and accepts only the supported durations', () => {
        expect(defaultBasicReplaySettings().duration).toBe(15)
        expect(defaultBasicReplaySettings().dryRun).toBe(false)
        expect(normalizeBasicReplaySettings({duration: 10}).duration).toBe(10)
        expect(normalizeBasicReplaySettings({duration: 20}).duration).toBe(20)
        expect(normalizeBasicReplaySettings({duration: 25}).duration).toBe(15)

        const resolved = resolveBasicReplaySettings({
            user: {duration: 10},
            journey: {duration: 30},
        })
        expect(resolved.duration).toBe(30)
    })

    it('persists Dry run as a user Basic Replay preference and ignores Journey values', () => {
        const savedUserSettings = {dryRun: true}
        const restoredUserSettings = normalizeBasicReplaySettings(savedUserSettings)

        expect(restoredUserSettings.dryRun).toBe(true)
        expect(resolveBasicReplaySettings({
            user: restoredUserSettings,
            journey: {dryRun: false},
        }).dryRun).toBe(true)
        expect(resolveBasicReplaySettings({
            user: {dryRun: false},
            journey: {dryRun: true},
        }).dryRun).toBe(false)
    })

    it('initializes Expert once and preserves it on mode switches', () => {
        const basicSettings = defaultBasicReplaySettings()
        const journey = {replay: {start: [], stop: []}}
        const initialized = initializeExpertReplayFromBasic(journey, basicSettings)
        const existing = {replay: {expert: {camera: {altitude: 500}}}}

        expect(hasExpertReplayConfiguration(journey)).toBe(false)
        expect(initialized.expert.camera).not.toHaveProperty('altitude')
        expect(initialized.expert.camera).not.toHaveProperty('pitch')
        expect(initialized.expert.camera.cameraAngle).toBe(0)
        expect(initializeExpertReplayFromBasic({replay: {start: [], stop: []}}, {
            camera: {positionMode: 'system'},
        }).expert.camera.cameraAngle).toBe(0)
        expect(initializeExpertReplayFromBasic(existing, basicSettings)).toBe(existing.replay)
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
            ? {replay: {basic: {camera: {...camera}}}, persistToDatabase}
            : {replay: {expert: {camera: {...camera}}}, persistToDatabase}
        const replaySettings = {
            userMode,
            camera: {...camera},
            basic: userMode === REPLAY_USER_MODE_BASIC ? {camera: {...camera}} : null,
        }
        globalThis.lgs = {
            settings: {ui: {replay: replaySettings}},
            stores: {replay: {userMode, basicPreparationActive: userMode === REPLAY_USER_MODE_BASIC}},
            theJourney: journey,
        }
        vi.useFakeTimers()

        try {
            if (userMode === REPLAY_USER_MODE_BASIC) {
                syncJourneyBasicReplayCamera(camera, journey)
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
            ...defaultBasicReplaySettings().presentation.progression,
            fill: {
                ...defaultBasicReplaySettings().presentation.progression.fill,
                color: '#445566',
            },
        }
        globalThis.lgs = {
            settings: {ui: {replay: {userMode: REPLAY_USER_MODE_EXPERT}}},
            stores: {replay: {userMode: REPLAY_USER_MODE_BASIC, basicPreparationActive: false}},
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

    it('does not synchronize Expert camera edits while Basic Replay is active', () => {
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
