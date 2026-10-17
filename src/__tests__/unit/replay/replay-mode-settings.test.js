/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-mode-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-17
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    getBasicReplaySettings,
    migrateLegacyBasicReplaySettings,
    writeBasicReplaySettings,
} from '@Core/ui/replay/ReplayModeSettings'
import {describe, expect, it} from 'vitest'

describe('Basic Replay settings migration', () => {
    it('reads the Basic key before falling back to the legacy `simple` key', () => {
        const legacySettings = {duration: 15}
        const basicSettings = {duration: 30}

        expect(getBasicReplaySettings({simple: legacySettings})).toBe(legacySettings)
        expect(getBasicReplaySettings({basic: basicSettings, simple: legacySettings})).toBe(basicSettings)
        expect(getBasicReplaySettings({basic: null, simple: legacySettings})).toBeNull()
    })

    it('writes only the Basic key and preserves unrelated replay settings', () => {
        const existingSettings = {
            camera: {pitch: -60},
            simple: {duration: 15},
        }
        const settings = writeBasicReplaySettings(existingSettings, {duration: 30})

        expect(settings).toBe(existingSettings)
        expect(settings).toEqual({
            camera: {pitch: -60},
            basic: {duration: 30},
        })
    })

    it('migrates the legacy key, preferring Basic when both keys exist', () => {
        const legacySettings = {duration: 15}
        const basicSettings = {duration: 30}
        const legacyMigration = migrateLegacyBasicReplaySettings({simple: legacySettings})
        const mixedMigration = migrateLegacyBasicReplaySettings({basic: basicSettings, simple: legacySettings})

        expect(legacyMigration).toEqual({settings: {basic: legacySettings}, migrated: true})
        expect(mixedMigration).toEqual({settings: {basic: basicSettings}, migrated: true})
        expect(migrateLegacyBasicReplaySettings({basic: basicSettings})).toEqual({
            settings: {basic: basicSettings},
            migrated: false,
        })
    })
})
