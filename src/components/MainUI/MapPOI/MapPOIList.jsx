/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-07
 * Last modified: 2025-12-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIFilteredList } from './MapPOIFilteredList'
import { useEffect, useRef }  from 'react'
import { memo }               from 'react'

/**
 * Renders the top-level container for the POI list.
 * This component is kept simple and static to prevent unnecessary re-renders
 * when only POI content (title, color) changes.
 * It delegates all filtering and rendering logic to MapPOIFilteredList.
 *
 * @component
 * @returns {JSX.Element}
 */
export const MapPOIList = memo(() => {
    /** Reference to the root container – used for Shoelace details-group initialisation */
    const _poiList = useRef(null)

    /** Initialise Shoelace details-group and clear any pending drawer action */
    useEffect(() => {
        if (_poiList.current) {
            __.ui.ui.initDetailsGroup(_poiList.current)
        }
        if (lgs.stores.ui.drawers.action) {
            lgs.stores.ui.drawers.action = null
        }
    }, [])

    return (
        <div id="edit-map-poi-list" ref={_poiList}>
            <MapPOIFilteredList/>
        </div>
    )
})

MapPOIList.displayName = 'MapPOIList'