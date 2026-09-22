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
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'
import {
    getWelcomeRoutePoiScale,
    WELCOME_ROUTE_CAMERA_DISTANCE,
    WELCOME_ROUTE_POI_MIN_SCALE,
} from '@Components/MainUI/welcomeHeroRouteProjection'

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

    it('keeps POIs on curve samples and moves them with composited transforms', () => {
        const fallbackSource = readFileSync(routeFiles[0], 'utf8')
        const workerSource = readFileSync(routeFiles[1], 'utf8')

        expect(fallbackSource).toContain('routeCurve.getPointAt(point)')
        expect(fallbackSource).toContain('routeState.routeCurve.getPointAt(progress, routeState.marker.position)')
        expect(workerSource).toContain('poiPositions: POI_PROGRESS.map(progress => curve.getPointAt(progress))')
        expect(workerSource).toContain("self.postMessage({type: 'poi-positions', positions})")
        expect(workerSource).toContain('route.curve.getPointAt(progress, route.marker.position)')
        expect(workerSource).not.toContain("type: 'poi-position'")
        expect(fallbackSource).toContain('getWelcomeRoutePoiScale(camera.position.z - worldPosition.z)')
        expect(workerSource).toContain('getWelcomeRoutePoiScale(camera.position.z - projectedPoiPosition.z)')
        expect(styleSource).toContain('--welcome-hero-poi-scale: 1;')
        expect(styleSource).toContain('translate3d(-50%, -100%, 0) scale(var(--welcome-hero-poi-scale));')
        expect(styleSource).toContain('will-change: transform;')
        expect(styleSource).not.toContain(".welcome-hero-poi[data-route-poi-index='0'] {\n    left:")
    })

    it('shrinks route POIs only after they move behind the scene center', () => {
        expect(getWelcomeRoutePoiScale(WELCOME_ROUTE_CAMERA_DISTANCE * 0.75)).toBe(1)
        expect(getWelcomeRoutePoiScale(WELCOME_ROUTE_CAMERA_DISTANCE)).toBe(1)
        expect(getWelcomeRoutePoiScale(WELCOME_ROUTE_CAMERA_DISTANCE * 1.25)).toBeCloseTo(0.8)
        expect(getWelcomeRoutePoiScale(WELCOME_ROUTE_CAMERA_DISTANCE * 2)).toBe(WELCOME_ROUTE_POI_MIN_SCALE)
    })
})
