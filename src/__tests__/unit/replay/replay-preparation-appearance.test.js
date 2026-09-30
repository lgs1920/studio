/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-appearance.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-30
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {Color, ConstantProperty, PolylineOutlineMaterialProperty} from 'cesium'
import {fadeJourneyForReplayPreparation} from '@Core/ui/replay/JourneyReplayPreparationAppearance'

describe('replay preparation appearance', () => {
    it('fades journey line materials to half opacity and restores their properties', () => {
        const color = new ConstantProperty(Color.RED)
        const outlineColor = new ConstantProperty(Color.WHITE)
        const material = new PolylineOutlineMaterialProperty({color, outlineColor})
        const dataSource = {entities: {values: [{polyline: {material}}]}}
        const viewer = {
            dataSources: {getByName: () => [dataSource]},
            scene: {requestRender: vi.fn()},
        }
        const journey = {tracks: new Map([['track-a', {slug: 'track-a'}]])}

        const restore = fadeJourneyForReplayPreparation(viewer, journey)
        expect(material.color.getValue().alpha).toBeCloseTo(0.3)
        expect(material.outlineColor.getValue().alpha).toBeCloseTo(0.3)
        expect(viewer.scene.requestRender).toHaveBeenCalledOnce()

        restore()
        expect(material.color).toBe(color)
        expect(material.outlineColor).toBe(outlineColor)
        expect(viewer.scene.requestRender).toHaveBeenCalledTimes(2)
    })
})
