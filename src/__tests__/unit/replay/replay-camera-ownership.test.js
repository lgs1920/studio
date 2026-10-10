/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-ownership.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {acquireReplayCameraOwnership, isCameraOwnedByReplay, releaseReplayCameraOwnership, replayOwnedCameraFor} from '@Core/ui/replay/ReplayCameraOwnership'

describe('Replay camera ownership', () => {
    it('retains the original map view across repeated and superseding Replay starts', () => {
        const camera = {}
        const first = {}
        const second = {}
        const mapView = {destination: {height: 2400}, orientation: {pitch: -0.3}}
        expect(acquireReplayCameraOwnership(first, camera, mapView)).toBe(mapView)
        expect(acquireReplayCameraOwnership(first, camera, {destination: {height: 900}})).toBe(mapView)
        expect(acquireReplayCameraOwnership(second, camera, {destination: {height: 600}})).toBe(mapView)
        expect(replayOwnedCameraFor(first)).toBeNull()
        releaseReplayCameraOwnership(first)
        expect(isCameraOwnedByReplay(camera)).toBe(true)
        releaseReplayCameraOwnership(second)
        expect(isCameraOwnedByReplay(camera)).toBe(false)
    })

    it('leaves the main viewer independent of an isolated export camera', () => {
        const main = {}
        const isolated = {}
        const owner = {}
        acquireReplayCameraOwnership(owner, isolated, {})
        expect(isCameraOwnedByReplay(main)).toBe(false)
        expect(isCameraOwnedByReplay(isolated)).toBe(true)
        releaseReplayCameraOwnership(owner)
    })
})
