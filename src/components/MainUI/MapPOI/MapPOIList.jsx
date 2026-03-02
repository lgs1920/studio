/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-01
 * Last modified: 2026-03-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: MapPOIList.jsx
 ******************************************************************************/
import { MapPOIFilteredList } from './MapPOIFilteredList'
import { useEffect, useRef, memo } from 'react'

export const MapPOIList = memo(() => {
    const _poiList = useRef(null)

    useEffect(() => {
        if (_poiList.current) {
            __.ui.ui.initDetailsGroup(_poiList.current)
        }
        const $ui = lgs.stores.ui
        if ($ui.drawers.action) {
            $ui.drawers.action = null
        }
    }, [])

    return (
        <div id="edit-map-poi-list" ref={_poiList} className="lgs-scrollbars">
            <MapPOIFilteredList/>
        </div>
    )
})

MapPOIList.displayName = 'MapPOIList'