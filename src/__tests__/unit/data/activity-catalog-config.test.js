/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: activity-catalog-config.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {parse} from 'yaml'

const settings = parse(readFileSync(new URL('../../../../public/settings.yaml', import.meta.url), 'utf8'))

describe('Journey activity settings', () => {
    it.each([
        ['running', 'person-running'],
        ['alpine-skiing', 'person-skiing'],
        ['cross-country-skiing', 'person-skiing-nordic'],
        ['open-water-swimming', 'person-swimming'],
    ])('configures the %s activity and its Font Awesome icon', (id, icon) => {
        expect(settings.journey.activity.types).toContainEqual(expect.objectContaining({id, icon}))
        expect(settings.ui.activities.list).toContainEqual(expect.objectContaining({id, icon}))
    })

    it('keeps the legacy UI activity catalog aligned with journey metric profiles', () => {
        expect(settings.ui.activities.list).toEqual(settings.journey.activity.types)
    })
})
