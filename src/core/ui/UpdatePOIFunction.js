/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UpdatePOIFunction.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

    // Ancien code
const handleChangeLatitude = async event => {
    point = Object.assign($pois.list.get(point.id), {
        latitude: event.target.value * 1,
    })
    $pois.list.set(point.id, point)
    await __.ui.poiManager.persistToDatabase(point)
}

// Nouveau code simplifié
const handleChangeLatitude = async event => {
    await __.ui.poiManager.updatePOI(point.id, {
        latitude: event.target.value * 1
    })
}