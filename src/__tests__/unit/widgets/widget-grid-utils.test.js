/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-grid-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    buildCenteredGridLines,
    getWidgetGridSettings,
    normalizeWidgetGridSize,
} from '@Core/ui/widget-manager/widgetGridUtils'

describe('widget grid utils', () => {
    it('normalizes invalid grid sizes to the default', () => {
        expect(normalizeWidgetGridSize('bad')).toBe(30)
        expect(normalizeWidgetGridSize(0)).toBe(10)
        expect(normalizeWidgetGridSize(13)).toBe(15)
        expect(normalizeWidgetGridSize(24.7)).toBe(25)
        expect(normalizeWidgetGridSize(104)).toBe(100)
    })

    it('resolves persisted grid settings', () => {
        expect(getWidgetGridSettings({enabled: true, size: '45', snap: 1})).toEqual({
            enabled: true,
            size:    45,
            snap:    true,
        })

        expect(getWidgetGridSettings({enabled: false, size: 30})).toEqual({
            enabled: false,
            size:    30,
            snap:    true,
        })
    })

    it('builds grid lines centered in the rect', () => {
        const rect = {left: 10, top: 20, right: 110, bottom: 80, width: 100, height: 60}
        const lines = buildCenteredGridLines(rect, 30)

        expect(lines.verticalGuidelines).toEqual([30, 60, 90])
        expect(lines.horizontalGuidelines).toEqual([20, 50, 80])
    })
})
