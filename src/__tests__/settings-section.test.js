/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: settings-section.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SETTINGS_STORE } from '@Core/constants'
import { SettingsSection } from '@Core/settings/SettingsSection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const waitForSubscription = () => new Promise(resolve => globalThis.setTimeout(resolve, 0))

describe('SettingsSection', () => {
    beforeEach(() => {
        vi.stubGlobal('lgs', {
            configuration: {
                journey: {
                    activity: {
                        types: [
                            {
                                id:       'trek',
                                label:    'Trek',
                                maxSpeed: 3,
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
        expect(merged.flythrough.progression.fill.profileMarker).toBe(8)
        expect(merged.flythrough.progression.border.profileMarker).toBe(2)
        expect(merged.flythrough.profileInfo.color).toBe('#ffffff')
        expect(merged.flythrough.profileInfo.useTrackStyle).toBe(false)
    })
})
