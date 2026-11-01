/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICluster.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-14
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {getActivePOIOverlayId, subscribeToActivePOIOverlay} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import {MapPOI} from '../../cesium/MapPOI'
import {useSyncExternalStore} from 'react'
import './style.css'

/** Render only the POI that currently needs a projected hover overlay. */
export const MapPOICluster = () => {
    const activePOIId = useSyncExternalStore(
        subscribeToActivePOIOverlay,
        getActivePOIOverlayId,
        () => null,
    )

    return (
        <div id="poi-list">
            {activePOIId && <MapPOI key={activePOIId} point={activePOIId}/>}
        </div>
    )
}
