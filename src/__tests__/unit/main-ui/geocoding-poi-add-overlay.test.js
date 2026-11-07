/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: geocoding-poi-add-overlay.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    $geocodingPOIAddOverlay, disposeGeocodingPOIAddOverlay, hideGeocodingPOIAddOverlay,
    showGeocodingPOIAddOverlay, startGeocodingPOIAddOverlayTimer,
} from '@Core/stores/geocodingPOIAddOverlay'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
    disposeGeocodingPOIAddOverlay()
    vi.useRealTimers()
})

describe('geocoding temporary POI Add overlay state', () => {
    it('hides the overlay after 10000 ms without affecting the marker identity', () => {
        vi.useFakeTimers()

        expect(showGeocodingPOIAddOverlay('temporary-a')).toBe(true)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-a')

        vi.advanceTimersByTime(7000)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-a')
        expect(startGeocodingPOIAddOverlayTimer('temporary-a')).toBe(true)

        vi.advanceTimersByTime(9999)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-a')

        vi.advanceTimersByTime(1)
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
    })

    it('replaces an active overlay timer when a newer POI is focused', () => {
        vi.useFakeTimers()
        showGeocodingPOIAddOverlay('temporary-a')
        startGeocodingPOIAddOverlayTimer('temporary-a')
        vi.advanceTimersByTime(4000)

        showGeocodingPOIAddOverlay('temporary-b')
        startGeocodingPOIAddOverlayTimer('temporary-b')
        vi.advanceTimersByTime(2000)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-b')

        vi.advanceTimersByTime(7999)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-b')

        vi.advanceTimersByTime(1)
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
    })

    it('only hides the overlay when the requesting POI owns it', () => {
        showGeocodingPOIAddOverlay('temporary-b')

        expect(hideGeocodingPOIAddOverlay('temporary-a')).toBe(false)
        expect($geocodingPOIAddOverlay.poiId).toBe('temporary-b')
        expect(hideGeocodingPOIAddOverlay('temporary-b')).toBe(true)
        expect($geocodingPOIAddOverlay.poiId).toBeNull()
    })
})
