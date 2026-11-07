/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: addPOIToLibrary.js
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

import { openPOIEditor } from '@Components/MainUI/MapPOI/openPOIEditor'
import { showPOICreationDuplicateToast } from '@Components/MainUI/MapPOI/showPOICreationDuplicateToast'
import { hideGeocodingPOIAddOverlay } from '@Core/stores/geocodingPOIAddOverlay'
import { SECOND } from '@Core/constants'
import { UIToast } from '@Utils/UIToast'

const pendingLibraryAdds = new Map()

/**
 * Convert a temporary POI into a saved POI and coordinate its shared UI feedback.
 * @param {string|Object} poiOrId - Temporary POI identifier or POI object.
 * @param {{openEditor?: boolean}} [options] - Whether to open the existing POI editor after saving.
 * @returns {Promise<Object>} The POI manager conversion result.
 */
export const addPOIToLibrary = async (poiOrId, {openEditor = true} = {}) => {
    const poiId = typeof poiOrId === 'string' ? poiOrId : poiOrId?.id
    if (!poiId) {
        return {status: 'missing'}
    }

    hideGeocodingPOIAddOverlay(poiId)

    const pendingAdd = pendingLibraryAdds.get(poiId)
    if (pendingAdd) {
        return pendingAdd
    }

    const operation = (async () => {
        let result
        try {
            result = await __.ui.poiManager.addTemporaryPOIToLibrary(poiId)
        }
        catch (error) {
            console.error(`[POI] Unable to save temporary POI ${poiId}:`, error)
            UIToast.error({
                caption: 'POI not saved.',
                text: 'The POI could not be saved to your library. It remains temporary on the map; try Add again.',
            })
            return {status: 'failed', error}
        }

        if (result.status === 'duplicate') {
            showPOICreationDuplicateToast(result.nearbyPOI)
            return result
        }

        if (result.status !== 'added') {
            return result
        }

        UIToast.success({
            caption: 'POI added to library.',
            text: result.poi.title || 'The POI is saved in your library.',
        }, 8 * SECOND)

        if (openEditor) {
            try {
                await openPOIEditor(result.poi.id)
            }
            catch (error) {
                console.error(`[POI] Unable to open the editor for ${poiId}:`, error)
            }
        }

        return result
    })()

    pendingLibraryAdds.set(poiId, operation)
    try {
        return await operation
    }
    finally {
        if (pendingLibraryAdds.get(poiId) === operation) {
            pendingLibraryAdds.delete(poiId)
        }
    }
}
