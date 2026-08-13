/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero-route-fade.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

const routeFiles = [
    resolve('src/components/MainUI/WelcomeHeroRoute.jsx'),
    resolve('src/components/MainUI/WelcomeHeroRoute.worker.js'),
]

describe('welcome hero route edge fade', () => {
    it('fades the route line at both ends in every renderer', () => {
        routeFiles.forEach((routeFile) => {
            const source = readFileSync(routeFile, 'utf8')

            expect(source).toContain('const ROUTE_EDGE_FADE_LENGTH = 0.14')
            expect(source).toContain('float routeStartFade = smoothstep(0.0, ${ROUTE_EDGE_FADE_LENGTH}, routeProgress)')
            expect(source).toContain('float routeEndFade = smoothstep(0.0, ${ROUTE_EDGE_FADE_LENGTH}, 1.0 - routeProgress)')
            expect(source).toContain('float routeEdgeFade = min(routeStartFade, routeEndFade)')
            expect(source).not.toContain('ROUTE_HEAD_FADE_END')
        })
    })
})
