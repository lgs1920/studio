import { describe, expect, it } from 'vitest'
import {
    buildPOITableHeader,
    htmlReportAssetPath,
    renderCreditsRows,
    renderHTMLLogo,
} from '@Utils/ExportAsReport/htmlReport'
import { STUDIO_URL } from '@Utils/ExportAsReport/constants'

describe('HTML report POI header', () => {
    it('does not render the altitude icon in the POI table header', () => {
        const header = buildPOITableHeader()

        expect(header).toContain('<th>Altitude</th>')
        expect(header).not.toContain('mountains')
    })

    it('resolves packaged report assets relative to the HTML document', () => {
        expect(htmlReportAssetPath('images/logo-horizontal.png')).toBe('./images/logo-horizontal.png')
    })

    it('links the logo to its packaged relative image path', () => {
        const logo = renderHTMLLogo('./images/logo-horizontal.png')

        expect(logo).toContain('href="./images/logo-horizontal.png"')
        expect(logo).toContain('src="./images/logo-horizontal.png"')
        expect(logo).not.toContain('https://www.lgs1920.fr')
    })

    it('rewrites the studio credit link to the packaged relative logo', () => {
        const credits = renderCreditsRows([
            {label: 'Application', text: 'LGS1920 Studio', url: STUDIO_URL},
        ], {studioLink: './images/logo-horizontal.png'})

        expect(credits).toContain('href="./images/logo-horizontal.png"')
        expect(credits).not.toContain('href="https://www.lgs1920.fr"')
    })
})
