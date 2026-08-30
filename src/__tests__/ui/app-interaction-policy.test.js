import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const appStyle = readFileSync(resolve('src/assets/css/app.css'), 'utf8')

describe('global UI interaction policy', () => {
    it('disables text selection globally and restores it for editable fields', () => {
        expect(appStyle).toContain('& * {\n        user-select: none !important;')
        expect(appStyle).toContain('[contenteditable="plaintext-only"]')
        expect(appStyle).toContain('wa-number-input')
        expect(appStyle).toContain('user-select: text !important;')
    })

    it('covers text-bearing parts of form web components', () => {
        expect(appStyle).toContain(')::part(input)')
        expect(appStyle).toContain(')::part(display-input)')
    })
})
