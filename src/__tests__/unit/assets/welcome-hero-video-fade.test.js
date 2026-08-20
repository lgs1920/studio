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
    it('crossfades from the image to the first video and keeps the later crossfade', () => {
        expect(styleSource).toContain('.welcome-hero-video {\n    position: absolute;')
        expect(styleSource).toContain('    transition: opacity 900ms ease;\n    opacity: 0;')
        expect(styleSource).toContain('#welcome-hero.welcome-hero-video-transitioning .welcome-hero-video {\n    transition: opacity 2.3s ease;')
    })

    it('does not apply the removed green overlay to the welcome hero', () => {
        expect(styleSource).not.toContain('rgba(20, 35, 28, 0.18)')
        expect(styleSource).toContain('linear-gradient(90deg, rgba(0, 0, 0, 0.48)')
    })
})
