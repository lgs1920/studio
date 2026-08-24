import { describe, expect, it } from 'vitest'

import {
    STUDIO_LOGO_RATIO,
    STUDIO_LOGO_REPORT_PATH,
    STUDIO_LOGO_URL,
} from '@Utils/ExportAsReport/constants'
import { getPDFReportColors } from '@Utils/ExportAsReport/format'

describe('PDF report colors', () => {
    it('converts the HTML export theme to the matching RGB palette', () => {
        expect(getPDFReportColors({
            background:    '#101820',
            surface:       '#172331',
            headerSurface: '#24415d',
            text:          '#f4f7fb',
            muted:         '#a8b4c2',
            line:          '#49627b',
            brand:         '#ff9f1c',
            brandOn:       '#101820',
            link:          '#ffd166',
        })).toEqual({
            background: [16, 24, 32],
            surface:    [23, 35, 49],
            headerFill: [36, 65, 93],
            text:       [244, 247, 251],
            muted:      [244, 247, 251],
            line:       [73, 98, 123],
            brand:      [255, 159, 28],
            brandOn:    [16, 24, 32],
            link:       [255, 209, 102],
            trace:      [244, 247, 251],
            white:      [255, 255, 255],
        })
    })

    it('keeps the PDF fallback palette when no browser theme is available', () => {
        const colors = getPDFReportColors({})

        expect(colors.background).toEqual([255, 255, 255])
        expect(colors.text).toEqual([32, 32, 32])
        expect(colors.muted).toEqual([68, 68, 68])
        expect(colors.headerFill).toEqual([238, 238, 238])
    })

    it('uses the horizontal LGS1920 logo in reports', () => {
        expect(STUDIO_LOGO_URL).toBe('/assets/logo/logo-horizontal.png')
        expect(STUDIO_LOGO_RATIO).toBe(1220 / 485)
        expect(STUDIO_LOGO_REPORT_PATH).toBe('images/logo-horizontal.png')
    })

})
