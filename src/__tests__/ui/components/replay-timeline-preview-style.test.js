/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-timeline-preview-style.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/components/MainUI/video/replay-timeline-preview.css'), 'utf8')

describe('Replay timeline preview styles', () => {
    it('scopes the read-only integration styles at the preview root', () => {
        const openBlocks = (styleSource.match(/{/g) ?? []).length
        const closedBlocks = (styleSource.match(/}/g) ?? []).length

        expect(openBlocks).toBe(closedBlocks)
        expect(styleSource).toContain('lgs1920-timeline {')
        expect(styleSource).toContain('--lgs-timeline-padding: 0;')
        expect(styleSource).toContain('--lgs-timeline-radius: 0;')
        expect(styleSource).toContain('--lgs-timeline-shadow: none;')
        expect(styleSource).toContain('--lgs-timeline-border-color: transparent;')
        expect(styleSource).toContain('--lgs-timeline-scale-offset: 0px;')
        expect(styleSource).toContain('lgs1920-timeline::part(top)')
        expect(styleSource).toContain('flex: 0 0 56px;')
        expect(styleSource).toContain('height: 56px;')
        expect(styleSource).toContain('lgs1920-timeline::part(header)')
        expect(styleSource).toContain('lgs1920-timeline::part(playback-controls)')
        expect(styleSource).toContain('lgs1920-timeline::part(controls)')
        expect(styleSource).toContain('display: none;')
        expect(styleSource).toContain('lgs1920-timeline::part(legend-ruler)')
        expect(styleSource).toContain('visibility: hidden;')
        expect(styleSource).toContain('lgs1920-timeline::part(layout)')
        expect(styleSource).toContain('border-radius: 0;')
        expect(styleSource).toContain('lgs1920-timeline::part(timeline-start-handle)')
        expect(styleSource).toContain('pointer-events: none;')
    })
})
