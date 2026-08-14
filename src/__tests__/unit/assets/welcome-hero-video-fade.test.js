/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero-video-fade.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const styleSource = readFileSync(resolve('src/components/MainUI/style.css'), 'utf8')

describe('welcome hero video transitions', () => {
    it('does not fade in the first video but keeps the crossfade for later videos', () => {
        expect(styleSource).toContain('.welcome-hero-video {\n    position: absolute;')
        expect(styleSource).toContain('    transition: none;\n    opacity: 0;')
        expect(styleSource).toContain('#welcome-hero.welcome-hero-video-transitioning .welcome-hero-video {\n    transition: opacity 2.3s ease;')
    })
})
