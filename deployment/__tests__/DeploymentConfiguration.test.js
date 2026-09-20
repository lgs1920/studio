/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DeploymentConfiguration.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import fs from 'node:fs'
import {parse} from 'yaml'
import {describe, expect, test} from 'vitest'

const configuration = parse(fs.readFileSync(new URL('../deploy.yml', import.meta.url), 'utf8'))

describe('deployment configuration', () => {
    test('keeps one definition for each platform and retains nightly settings', () => {
        expect(Object.keys(configuration.backend).sort())
            .toEqual(['nightly', 'production', 'staging', 'test'])
        expect(configuration.backend.nightly.pm2.config).toBe('backend-nightly.config.js')
        expect(configuration.studio.nightly.domain).toBe('nightly.lgs1920.fr')
        expect(configuration.site.nightly.domain).toBe('lgs1920.fr')
        expect(configuration.remote.nightly.host).toBe('p5077.phpnet.org')
    })
})
