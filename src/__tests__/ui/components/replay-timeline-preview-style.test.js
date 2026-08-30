import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/components/MainUI/video/replay-timeline-preview.css'), 'utf8')

describe('Replay timeline preview styles', () => {
    it('keeps the cursor selectors scoped at the preview root', () => {
        const cursorSelectorIndex = styleSource.indexOf('\n.replay-timeline-preview .timeline-editor-cursor-top')
        const sourceBeforeCursor = styleSource.slice(0, cursorSelectorIndex)
        const openBlocks = (sourceBeforeCursor.match(/{/g) ?? []).length
        const closedBlocks = (sourceBeforeCursor.match(/}/g) ?? []).length

        expect(cursorSelectorIndex).toBeGreaterThan(-1)
        expect(openBlocks).toBe(closedBlocks)
        expect(styleSource).toContain('width: 12px !important;')
        expect(styleSource).toContain('height: 20px !important;')
        expect(styleSource).toContain('max-width: none !important;')
        expect(styleSource).toContain('grip-vertical')
        expect(styleSource).toContain('.replay-timeline-preview .timeline-editor-cursor::after')
        expect(styleSource).toContain('var(--wa-color-brand-on-loud')
        expect(styleSource).toContain('-webkit-mask: url(')
        expect(styleSource).toContain('overflow-y: hidden !important;')
        expect(styleSource).toContain('replay-timeline-preview__surface--vertical-scroll')
    })
})
