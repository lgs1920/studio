/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startup-cta-readiness.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-22
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const lgs1920Source = readFileSync('src/components/LGS1920.jsx', 'utf8')

describe('startup CTA readiness', () => {
    it('does not block Enter Studio while a webapp update check is only pending', () => {
        const appReadyDefinition = lgs1920Source.match(/const appReady =[\s\S]*?const revealApp/u)?.[0] ?? ''

        expect(appReadyDefinition).toContain('!appUpdate.isAutomaticUpdateInProgress')
        expect(appReadyDefinition).not.toContain('isUpdateCheckPending')
    })
})
