/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UpdatePOIFunction.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Updates a point latitude through the POI manager.
 *
 * @param {Object} event - Latitude input event.
 * @returns {Promise<void>}
 */
const handleChangeLatitude = async event => {
    await __.ui.poiManager.updatePOI(point.id, {
        latitude: event.target.value * 1
    })
}
