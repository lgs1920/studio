/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-28
 * Last modified: 2026-03-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: MapPOIList.jsx
 ******************************************************************************/
import { MapPOIFilteredList } from './MapPOIFilteredList'
import { useEffect, memo } from 'react'

export const MapPOIList = memo(() => {
    useEffect(() => {
        const $ui = lgs.stores.ui
        if ($ui.drawers.action) {
            $ui.drawers.action = null
        }
    }, [])

    return (
        <div id="edit-map-poi-list">
            <MapPOIFilteredList/>
        </div>
    )
})

MapPOIList.displayName = 'MapPOIList'
