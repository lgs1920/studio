/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocationDisplayedToastContent.jsx
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

import { addPOIToLibrary } from '@Components/MainUI/MapPOI/addPOIToLibrary'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { WaButton, WaIcon } from '@awesome.me/webawesome/dist/react'
import './LocationDisplayedToastContent.css'

/**
 * Explain that a displayed location is temporary and provide its save action.
 * @param {{poiId: string}} props - Identifier of the temporary location marker.
 * @returns {import('react').ReactNode} Toast copy and the shared Add action.
 */
export const LocationDisplayedToastContent = ({poiId}) => {
    /** Save this location through the shared temporary POI conversion operation. */
    const addLocationToLibrary = () => {
        void addPOIToLibrary(poiId)
    }

    return (
        <div className="location-displayed-toast-content">
            <div className="location-displayed-toast-message">
                This location is not saved as a POI. Select Add to save it in your POI library.
            </div>
            <WaButton
                className="toast-action-button location-displayed-toast-button"
                type="button"
                appearance="filled"
                size="s"
                variant="brand"
                onClick={addLocationToLibrary}
            >
                <WaIcon slot="start" size="s" {...UI_ACTIONS.addPOIToLibrary.icon}/>
                {UI_ACTIONS.addPOIToLibrary.label}
            </WaButton>
        </div>
    )
}
