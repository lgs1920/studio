/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-crop-frustum.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-26
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {OrthographicOffCenterFrustum, PerspectiveFrustum} from 'cesium'
import {describe, expect, it} from 'vitest'

import {
    captureReplayCanvasCropProjection,
    captureReplayCropProjection,
    createReplayCropFrustum,
} from '@Core/ui/replay/ReplayCropFrustum'

describe('ReplayCropFrustum', () => {
    it('maps a non-centered perspective crop to an off-axis camera projection', () => {
        const sourceFrustum = new PerspectiveFrustum({
            fov:          Math.PI / 3,
            aspectRatio: 2,
            near:         1,
            far:          10000,
        })
        const projection = captureReplayCropProjection({
            camera: {frustum: sourceFrustum},
            sourceViewportDimensions: {width: 1000, height: 500},
            cropRect: {left: 100, top: 50, width: 400, height: 200},
        })

        expect(projection).toMatchObject({
            kind: 'perspective',
            crop: {left: 100, top: 50, width: 400, height: 200},
            viewport: {width: 1000, height: 500},
        })
        expect(projection.left).toBeLessThan(projection.right)
        expect(projection.bottom).toBeLessThan(projection.top)

        const cropFrustum = createReplayCropFrustum(projection)

        expect(cropFrustum).toBeInstanceOf(PerspectiveFrustum)
        expect(cropFrustum.aspectRatio).toBeCloseTo(2)
        expect(cropFrustum.xOffset).not.toBe(0)
        expect(cropFrustum.yOffset).not.toBe(0)
        expect(cropFrustum.replayCropProjectionKey).toBe(projection.key)
        expect(cropFrustum.projectionMatrix).toBeDefined()
    })

    it('maps an orthographic crop to the exact off-center 2D planes', () => {
        const sourceFrustum = new OrthographicOffCenterFrustum({
            left:   -500,
            right:  500,
            bottom: -250,
            top:    250,
            near:   1,
            far:    10000,
        })
        const projection = captureReplayCropProjection({
            camera: {frustum: sourceFrustum},
            sourceViewportDimensions: {width: 1000, height: 500},
            cropRect: {left: 100, top: 50, width: 400, height: 100},
        })

        expect(projection).toMatchObject({
            kind: 'orthographic',
            left:  -400,
            right: 0,
            top:   200,
            bottom: 100,
        })

        const cropFrustum = createReplayCropFrustum(projection)

        expect(cropFrustum).toBeInstanceOf(OrthographicOffCenterFrustum)
        expect(cropFrustum.left).toBe(-400)
        expect(cropFrustum.right).toBe(0)
        expect(cropFrustum.top).toBe(200)
        expect(cropFrustum.bottom).toBe(100)
        expect(cropFrustum.replayCropProjectionKey).toBe(projection.key)
    })

    it('clamps crops to the source viewport before deriving readiness identity', () => {
        const projection = captureReplayCropProjection({
            camera: {
                frustum: new PerspectiveFrustum({
                    fov:          Math.PI / 3,
                    aspectRatio: 1,
                    near:         1,
                    far:          1000,
                }),
            },
            sourceViewportDimensions: {width: 100, height: 100},
            cropRect: {left: 90, top: 90, width: 40, height: 40},
        })

        expect(projection.crop).toEqual({left: 90, top: 90, width: 10, height: 10})
        expect(projection.key).toBeTruthy()
    })

    it('keeps an offset crop projection identical across drawing-buffer DPR values', () => {
        const sourceFrustum = new PerspectiveFrustum({
            fov:          Math.PI / 3,
            aspectRatio:  1.5,
            near:         1,
            far:          10000,
        })
        const cssViewport = {width: 1200, height: 800}
        const cropRect = {left: 137, top: 91, width: 640, height: 360}
        const projections = [1, 1.5, 2].map(dpr => {
            const canvas = {
                width: Math.round(cssViewport.width * dpr),
                height: Math.round(cssViewport.height * dpr),
                getBoundingClientRect: () => cssViewport,
            }

            return captureReplayCanvasCropProjection({
                camera: {frustum: sourceFrustum},
                sourceCanvas: canvas,
                cropRect,
            })
        })

        projections.forEach(projection => {
            expect(projection).toMatchObject({
                viewport: cssViewport,
                crop: cropRect,
            })
        })
        expect(projections[1]).toEqual(projections[0])
        expect(projections[2]).toEqual(projections[0])
    })

    it('does not infer CSS viewport dimensions from an intrinsic drawing buffer', () => {
        const projection = captureReplayCanvasCropProjection({
            camera: {
                frustum: new PerspectiveFrustum({
                    fov:          Math.PI / 3,
                    aspectRatio:  1.5,
                    near:         1,
                    far:          10000,
                }),
            },
            sourceCanvas: {width: 2400, height: 1600},
            cropRect: {left: 137, top: 91, width: 640, height: 360},
        })

        expect(projection).toBeNull()
    })
})
