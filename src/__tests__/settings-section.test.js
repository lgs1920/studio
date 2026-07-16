/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: settings-section.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SETTINGS_STORE }                                  from '@Core/constants'
import { SettingsSection }                                 from '@Core/settings/SettingsSection'
import { Track }                                           from '@Core/Track'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const waitForSubscription = () => new Promise(resolve => globalThis.setTimeout(resolve, 0))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        DURATION: 5000,
        error:    vi.fn(),
        notify:   vi.fn(),
        success:  vi.fn(),
        warning:  vi.fn(),
    },
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_WARNING_TOAST:     'warning',
}))

describe('SettingsSection', () => {
    beforeEach(() => {
        vi.stubGlobal('lgs', {
            configuration: {
                ui: {
                    profile: {
                        liveData: false,
                    },
                },
                widgets: {
                    'journey-stats-widget': {
                        configuration: {
                            default: {
                                title: 'Journey Stats',
                            },
                            user: {},
                            elements: {},
                        },
                    },
                    'dynamic-stats-widget': {
                        configuration: {
                            default: {
                                title: 'Dynamic Stats',
                            },
                            user: {},
                            elements: {},
                        },
                    },
                },
                journey: {
                    activity: {
                        default: 'trek',
                        types: [
                            {
                                id:       'trek',
                                label:    'Trek',
                                icon:         'person-hiking',
                                minSegmentDuration: 2,
                                minSegmentDistance: 3,
                                maxAltitudeJump: 10,
                                altitudeSmoothingWindow: 3,
                                maxSpeed: 3,
                                maxPace: 0,
                                maxSpeedDelta: 0,
                                stopDuration: 60,
                            },
                        ],
                    },
                },
            },
            savedConfiguration: {
                ui: {
                    profile: {
                        liveData: false,
                    },
                },
                widgets: {
                    'journey-stats-widget': {
                        configuration: {
                            default: {
                                title: 'Journey Stats',
                            },
                            user: {},
                            elements: {},
                        },
                    },
                    'dynamic-stats-widget': {
                        configuration: {
                            default: {
                                title: 'Dynamic Stats',
                            },
                            user: {},
                            elements: {},
                        },
                    },
                },
                journey: {
                    activity: {
                        default: 'trek',
                        types:   [
                            {
                                id:             'trek',
                                label:          'Trek',
                                icon:           'person-hiking',
                                minSegmentDuration: 2,
                                minSegmentDistance: 3,
                                maxAltitudeJump: 10,
                                altitudeSmoothingWindow: 3,
                                maxSpeed:       3,
                                maxClimbRate:   1.5,
                                maxDescentRate: 2.5,
                                maxPace:        0,
                                maxSpeedDelta:  0,
                                stopDuration:   60,
                                stopSpeedLimit: 0.2,
                            },
                        ],
                    },
                },
            },
            db: {
                settings: {
                    get: vi.fn(async () => null),
                    put: vi.fn(async () => undefined),
                },
            },
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('persists nested journey activity threshold changes', async () => {
        const section = new SettingsSection('journey')
        await section.init()
        lgs.db.settings.put.mockClear()

        section.content.activity.types[0].maxSpeed = 4.25
        await waitForSubscription()

        expect(lgs.db.settings.put).toHaveBeenCalledWith(
            'journey',
            expect.objectContaining({
                activity: expect.objectContaining({
                    types: [
                        expect.objectContaining({
                            id:       'trek',
                            maxSpeed: 4.25,
                        }),
                    ],
                }),
            }),
            SETTINGS_STORE,
        )
    })

    it('keeps persisted journey activity thresholds on restart', async () => {
        lgs.db.settings.get.mockResolvedValue({
                                                  activity: {
                                                      default: 'trek',
                                                      types:   [
                                                          {
                                                              id:             'trek',
                                                              label:          'Trek',
                                                              icon:           'person-hiking',
                                                              maxSpeed:       4.25,
                                                              maxClimbRate:   1.5,
                                                              maxDescentRate: 2.5,
                                                              stopDuration:   60,
                                                              stopSpeedLimit: 0.2,
                                                          },
                                                      ],
                                                  },
                                              })

        const section = new SettingsSection('journey')
        await section.init()

        expect(section.content.activity.types[0].maxSpeed).toBe(4.25)
        expect(lgs.configuration.journey.activity.types[0].maxSpeed).toBe(4.25)
    })

    it('keeps user replay settings while adding new default keys', () => {
        const section = new SettingsSection('ui')
        const merged = section.update(
            {
                replay: {
                    duration:    240,
                    loop:        true,
                    progression: {
                        fill: {
                            color:   '#123456',
                            opacity: 0.4,
                            width:   7,
                        },
                    },
                },
            },
            {
                replay: {
                    duration:    60,
                    loop:        false,
                    progression: {
                        fill: {
                            color:   '#ff6a00',
                            opacity: 1,
                            width:   2,
                            profileMarker: 8,
                        },
                        border: {
                            profileMarker: 2,
                        },
                    },
                    profileInfo: {
                        color:         '#ffffff',
                        useTrackStyle: false,
                    },
                },
            },
        )

        expect(merged.replay.duration).toBe(240)
        expect(merged.replay.loop).toBe(true)
        expect(merged.replay.progression.fill.color).toBe('#123456')
        expect(merged.replay.progression.fill.opacity).toBe(0.4)
        expect(merged.replay.progression.fill.width).toBe(7)
        expect(merged.replay.progression.fill.profileMarker).toBeUndefined()
        expect(merged.replay.progression.border?.profileMarker).toBeUndefined()
        expect(merged.replay.profileInfo).toBeUndefined()
    })

    it('adds widget grid settings to existing UI settings', () => {
        const section = new SettingsSection('ui')
        const merged = section.update(
            {
                toolbars: {
                    opacity: 0.7,
                },
            },
            {
                toolbars: {
                    opacity: 0.9,
                },
                widgets: {
                    grid: {
                        enabled: false,
                        size:    30,
                        snap:    true,
                    },
                },
            },
        )

        expect(merged.widgets.grid).toEqual({
            enabled: false,
            size:    30,
            snap:    true,
        })
    })

    it('keeps replay excluded but still syncs its clips subtree', () => {
        const section = new SettingsSection('ui')
        const merged = section.update(
            {
                replay: {
                    camera: {
                        altitude: 900,
                    },
                    clips: {
                        catalog: {
                            'take-off': {
                                label: 'Custom take-off',
                            },
                        },
                    },
                },
            },
            {
                replay: {
                    camera: {
                        altitude: 1200,
                        pitch:    -65,
                    },
                    clips: {
                        catalog: {
                            'take-off': {
                                label: 'TakeOff',
                                slots: ['start'],
                            },
                            landing: {
                                label: 'Landing',
                                slots: ['stop'],
                            },
                        },
                    },
                },
            },
        )

        expect(merged.replay.camera.altitude).toBe(900)
        expect(merged.replay.camera.pitch).toBeUndefined()
        expect(merged.replay.clips.catalog['take-off'].label).toBe('TakeOff')
        expect(merged.replay.clips.catalog['take-off'].slots).toEqual(['start'])
        expect(merged.replay.clips.catalog.landing).toEqual({
            label: 'Landing',
            slots: ['stop'],
        })
    })

    it('adds missing excluded primitive defaults without overwriting existing user choices', () => {
        const section = new SettingsSection('layers')
        const merged = section.update(
            {
                base:    'custom-base',
                overlay: null,
                terrain: 'cesium-world',
            },
            {
                base:    'arcgis-normal',
                base3d:  null,
                tiles3d: null,
                overlay: null,
                terrain: 'cesium-world',
            },
        )

        expect(merged.base).toBe('custom-base')
        expect(merged.base3d).toBeNull()
        expect(merged.tiles3d).toBeNull()
    })

    it('persists profile UI settings changes', async () => {
        const section = new SettingsSection('ui')
        await section.init()
        lgs.db.settings.put.mockClear()

        section.content.profile.liveData = true
        await waitForSubscription()

        expect(lgs.db.settings.put).toHaveBeenCalledWith(
            'ui',
            expect.objectContaining({
                                        profile: expect.objectContaining({
                                                                             liveData: true,
                                                                         }),
                                    }),
            SETTINGS_STORE,
        )
    })

    it('hydrates and persists the full activity catalog when only partial values exist', async () => {
        const section = new SettingsSection('journey')
        await section.init()
        lgs.settings = {
            journey: section.content,
        }
        section.content.activity.types = [
            {
                id:       'trek',
                maxSpeed: 4.25,
            },
        ]
        await waitForSubscription()
        lgs.db.settings.put.mockClear()

        const catalog = Track.ensureActivityCatalogPersistence()
        await waitForSubscription()

        expect(catalog).toEqual({
                                    default: 'trek',
                                    types:   [
                                        expect.objectContaining({
                                                                    id:             'trek',
                                                                    label:          'Trek',
                                                                    icon:           'person-hiking',
                                                                    maxSpeed:       4.25,
                                                                    maxClimbRate:   1.5,
                                                                    maxDescentRate: 2.5,
                                                                    stopDuration:   60,
                                                                    stopSpeedLimit: 0.2,
                                                                }),
                                    ],
                                })
        expect(lgs.db.settings.put).toHaveBeenCalledWith(
            'journey',
            expect.objectContaining({
                                        activity: expect.objectContaining({
                                                                              default: 'trek',
                                                                              types:   [
                                                                                  expect.objectContaining({
                                                                                                              id:             'trek',
                                                                                                              label:          'Trek',
                                                                                                              icon:           'person-hiking',
                                                                                                              maxSpeed:       4.25,
                                                                                                              maxClimbRate:   1.5,
                                                                                                              maxDescentRate: 2.5,
                                                                                                              stopDuration:   60,
                                                                                                              stopSpeedLimit: 0.2,
                                                                                                          }),
                                                                              ],
                                                                          }),
                                    }),
            SETTINGS_STORE,
        )
    })

    it('adds new widget definitions from the template when widgets are persisted', async () => {
        lgs.db.settings.get.mockResolvedValue({
            'journey-stats-widget': {
                configuration: {
                    default: {
                        title: 'Persisted Journey Stats',
                    },
                    user: {},
                    elements: {},
                },
            },
        })

        const section = new SettingsSection('widgets')
        await section.init()

        expect(section.content['journey-stats-widget'].configuration.default.title).toBe('Persisted Journey Stats')
        expect(section.content['dynamic-stats-widget']).toBeDefined()
        expect(section.content['dynamic-stats-widget'].configuration.default.title).toBe('Dynamic Stats')
        expect(lgs.configuration.widgets['dynamic-stats-widget']).toBeDefined()
    })

    it('migrates legacy scalar widget text values into nested text content objects', () => {
        const section = new SettingsSection('widgets')
        const merged = section.update(
            {
                'text-widget': {
                    configuration: {
                        default: {
                            text: 'Legacy text value',
                        },
                    },
                },
            },
            {
                'text-widget': {
                    configuration: {
                        default: {
                            text: {
                                content: 'Enter text here',
                                color:   '#ffffff',
                                opacity: 1,
                            },
                        },
                    },
                },
            },
        )

        expect(merged['text-widget'].configuration.default.text).toEqual({
            content: 'Legacy text value',
            color:   '#ffffff',
            opacity: 1,
        })
    })
})
