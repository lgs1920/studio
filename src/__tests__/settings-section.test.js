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

describe('SettingsSection', () => {
    beforeEach(() => {
        vi.stubGlobal('lgs', {
            configuration: {
                ui: {
                    profile: {
                        liveData: false,
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
                                maxSpeed: 3,
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
                journey: {
                    activity: {
                        default: 'trek',
                        types:   [
                            {
                                id:             'trek',
                                label:          'Trek',
                                icon:           'person-hiking',
                                maxSpeed:       3,
                                maxClimbRate:   1.5,
                                maxDescentRate: 2.5,
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

    it('keeps user flythrough settings while adding new default keys', () => {
        const section = new SettingsSection('ui')
        const merged = section.update(
            {
                flythrough: {
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
                flythrough: {
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

        expect(merged.flythrough.duration).toBe(240)
        expect(merged.flythrough.loop).toBe(true)
        expect(merged.flythrough.progression.fill.color).toBe('#123456')
        expect(merged.flythrough.progression.fill.opacity).toBe(0.4)
        expect(merged.flythrough.progression.fill.width).toBe(7)
        expect(merged.flythrough.progression.fill.profileMarker).toBeUndefined()
        expect(merged.flythrough.progression.border?.profileMarker).toBeUndefined()
        expect(merged.flythrough.profileInfo).toBeUndefined()
    })

    it('keeps flythrough excluded but still syncs its effects subtree', () => {
        const section = new SettingsSection('ui')
        const merged = section.update(
            {
                flythrough: {
                    camera: {
                        altitude: 900,
                    },
                    effects: {
                        catalog: {
                            launch: {
                                label: 'Custom launch',
                            },
                        },
                    },
                },
            },
            {
                flythrough: {
                    camera: {
                        altitude: 1200,
                        pitch:    -65,
                    },
                    effects: {
                        catalog: {
                            launch: {
                                label: 'Launch',
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

        expect(merged.flythrough.camera.altitude).toBe(900)
        expect(merged.flythrough.camera.pitch).toBeUndefined()
        expect(merged.flythrough.effects.catalog.launch.label).toBe('Launch')
        expect(merged.flythrough.effects.catalog.launch.slots).toEqual(['start'])
        expect(merged.flythrough.effects.catalog.landing).toEqual({
            label: 'Landing',
            slots: ['stop'],
        })
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
})
