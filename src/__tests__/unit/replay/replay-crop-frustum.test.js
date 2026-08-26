import {OrthographicOffCenterFrustum, PerspectiveFrustum} from 'cesium'
import {describe, expect, it} from 'vitest'

import {
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
})
