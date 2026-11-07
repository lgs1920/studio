/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: geocodingPOIAddOverlay.js
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

import {proxy} from 'valtio'

const ADD_OVERLAY_DURATION_MS = 10_000

/** Reactive state for the single active temporary POI Add overlay. */
export const $geocodingPOIAddOverlay = proxy({poiId: null})

let addOverlayTimer = null
let addOverlayGeneration = 0

/**
 * Show an Add overlay for one POI and replace any prior overlay timer.
 * @param {string} poiId - Temporary POI identifier.
 * @returns {boolean} Whether the overlay was activated.
 */
export const showGeocodingPOIAddOverlay = (poiId) => {
    if (!poiId) {
        return false
    }

    clearTimeout(addOverlayTimer)
    addOverlayGeneration += 1
    $geocodingPOIAddOverlay.poiId = String(poiId)
    addOverlayTimer = null

    return true
}

/**
 * Start the ten-second timeout once the matching overlay is visible.
 * @param {string} poiId - Temporary POI identifier whose button is visible.
 * @returns {boolean} Whether a timeout was started.
 */
export const startGeocodingPOIAddOverlayTimer = (poiId) => {
    const activePOIId = String(poiId ?? '')
    if (!activePOIId || $geocodingPOIAddOverlay.poiId !== activePOIId || addOverlayTimer) {
        return false
    }

    const generation = addOverlayGeneration
    addOverlayTimer = setTimeout(() => {
        if (generation !== addOverlayGeneration) {
            return
        }

        addOverlayTimer = null
        $geocodingPOIAddOverlay.poiId = null
    }, ADD_OVERLAY_DURATION_MS)

    return true
}

/**
 * Hide the active Add overlay and cancel its timer.
 * @param {string|null} [poiId=null] - Optional POI identifier that must own the active overlay.
 * @returns {boolean} Whether the active overlay was hidden.
 */
export const hideGeocodingPOIAddOverlay = (poiId = null) => {
    if (poiId && $geocodingPOIAddOverlay.poiId !== String(poiId)) {
        return false
    }

    addOverlayGeneration += 1
    clearTimeout(addOverlayTimer)
    addOverlayTimer = null
    $geocodingPOIAddOverlay.poiId = null
    return true
}

/** Clear the active overlay timer when its owning application surface unmounts. */
export const disposeGeocodingPOIAddOverlay = () => {
    hideGeocodingPOIAddOverlay()
}
