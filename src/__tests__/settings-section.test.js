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
})
