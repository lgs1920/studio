/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero-route-fade.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-13
 * Last modified: 2026-08-20
 *
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
const styleSource = readFileSync(resolve('src/components/MainUI/style.css'), 'utf8')

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

    it('keeps Studio neon width and motion aligned with the public site renderer', () => {
        routeFiles.forEach((routeFile) => {
            const source = readFileSync(routeFile, 'utf8')

            expect(source).toContain('const ROUTE_DURATION = 13_000')
            expect(source).toContain('const NEON_OUTER_RADIUS = 0.09')
            expect(source).toContain('const NEON_MIDDLE_RADIUS = 0.046')
            expect(source).toContain('const NEON_CORE_RADIUS = 0.018')
            expect(source).toContain('const ROUTE_SHAPE_STRETCH = 0.16')
            expect(source).toContain('const ROUTE_SHAPE_SQUEEZE = 0.09')
            expect(source).toContain('const ROUTE_SHAPE_CYCLE = 5_800')
            expect(source).toContain('1.55 + Math.sin(timestamp * 0.008) * 0.1')
        })

        expect(styleSource).toContain('.welcome-hero-route-canvas {\n    display: block;\n    opacity: .86;')
        expect(styleSource).toContain('@media (max-width: 720px) {\n    .welcome-hero-route-canvas {\n        opacity: .86;')
        expect(styleSource).toContain(".welcome-hero-route[data-render-mode='fallback'] .welcome-hero-poi")
        expect(styleSource).not.toContain(".welcome-hero-route:not([data-render-mode='worker']) .welcome-hero-poi")
        expect(styleSource.match(/filter: sepia\(0\.2\) saturate\(0\.8\)/g)).toHaveLength(2)
    })
})
