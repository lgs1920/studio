import { describe, expect, it } from 'vitest'
import { buildPOITableHeader } from '@Utils/ExportAsReport/htmlReport'

describe('HTML report POI header', () => {
    it('does not render the altitude icon in the POI table header', () => {
        const header = buildPOITableHeader()

        expect(header).toContain('<th>Altitude</th>')
        expect(header).not.toContain('mountains')
    })
})
