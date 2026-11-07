/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TemporaryPOIWarning.jsx
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
import { POI_TMP_TYPE } from '@Core/constants'
import { UI_ACTIONS, UI_ICONS } from '@Core/ui/metadata/uiActionCatalog'
import { WaButton, WaCallout, WaIcon } from '@awesome.me/webawesome/dist/react'
import { useSnapshot, proxy } from 'valtio'
import './TemporaryPOIWarning.css'

const EMPTY_POI_PROXY = proxy({})

/**
 * Explain temporary POI persistence and expose the shared Add action while editing.
 * @param {{poiId: string}} props - Temporary POI identifier.
 * @returns {import('react').ReactNode} Warning and Add action for unsaved POIs.
 */
export const TemporaryPOIWarning = ({poiId}) => {
    const $poi = lgs.stores.main.components.pois.list.get(poiId)
    const poi = useSnapshot($poi ?? EMPTY_POI_PROXY)

    /** Save the current temporary POI through the shared conversion operation. */
    const addTemporaryPOI = () => {
        void addPOIToLibrary(poiId, {openEditor: false})
    }

    if (!poi.id || poi.type !== POI_TMP_TYPE) {
        return null
    }

    return (
        <WaCallout variant="warning" appearance="filled-outlined" open>
            <WaIcon slot="icon" {...UI_ICONS.warning}/>
            <div className="temporary-poi-warning-content">
                <span>{"This POI is temporary and won't be saved. Add it to the library to save it."}</span>
                <WaButton
                    type="button"
                    size="s"
                    variant="brand"
                    appearance="outlined"
                    onClick={addTemporaryPOI}
                >
                    <WaIcon {...UI_ACTIONS.addPOIToLibraryFromEditor.icon}/>
                    {UI_ACTIONS.addPOIToLibraryFromEditor.label}
                </WaButton>
            </div>
        </WaCallout>
    )
}
