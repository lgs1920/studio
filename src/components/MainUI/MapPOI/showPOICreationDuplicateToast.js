/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: showPOICreationDuplicateToast.js
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

import { POICreationToastContent } from '@Components/MainUI/MapPOI/POICreationToastContent'
import { openPOIEditor } from '@Components/MainUI/MapPOI/openPOIEditor'
import { SECOND } from '@Core/constants'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { UIToast } from '@Utils/UIToast'
import { createElement } from 'react'

/**
 * Show the shared nearby-POI warning and provide an action to edit the existing POI.
 * @param {Object|null} nearbyPOI - Existing nearby POI, when it could be resolved.
 * @param {{beforeEdit?: () => void}} [options] - Optional action to run before opening the POI editor.
 * @returns {void} Displays the standard POI creation warning.
 */
export const showPOICreationDuplicateToast = (nearbyPOI, {beforeEdit} = {}) => {
    const text = nearbyPOI
        ? createElement(POICreationToastContent, {
            poi: nearbyPOI,
            canEdit: true,
            action: UI_ACTIONS.editNearbyPOI,
            message: 'A POI is already near this location.',
            inlineAction: true,
            onEdit: () => {
                beforeEdit?.()
                void openPOIEditor(nearbyPOI.id)
            },
        })
        : 'This location is too close to an existing POI.'

    UIToast.warning({
        caption: 'POI not created.',
        text,
    }, 8 * SECOND)
}
