/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: compass-widget-bounds.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-03
 * Last modified: 2026-08-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'

import { resolveCompassWidgetDimensions } from '@Components/MainUI/compass/CompassWidgetBounds'

describe('compass widget bounds', () => {
    it('preserves persisted dimensions until a resize is requested', () => {
        const config = {dimensions: {width: 180, height: 140}}

        expect(resolveCompassWidgetDimensions({
            config,
            styledWidth: 50,
            styledHeight: 50,
            fallbackWidth: 50,
            fallbackHeight: 50,
        })).toEqual({width: 180, height: 140})

        expect(resolveCompassWidgetDimensions({
            config,
            forceResize: true,
            styledWidth: 50,
            styledHeight: 50,
            fallbackWidth: 50,
            fallbackHeight: 50,
        })).toEqual({width: 50, height: 50})
    })
})
