/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-25
 * Last modified: 2025-05-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIBulkActionsMenu }      from '@Components/MainUI/MapPOI/MapPOIBulkActionsMenu'
import { MapPOIEditFilter }           from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import { ToggleStateIcon }            from '@Components/ToggleStateIcon'
import { faSquare, faSquareCheck }    from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlSwitch }        from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useState } from 'react'
import { useSnapshot }                from 'valtio'

export const MapPOIEditSettings = ({globals = true}) => {

    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)

    const [allSelected, setAllSelected] = useState(false)

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const changeAll = (state) => {
        store.bulkList.clear()
        store.filteredList.forEach((value, id) => {
            store.bulkList.set(id, state)
        })
    }


    /**
     * Check if the global selection i son(all on) or off (at least one off)
     */
    useEffect(() => {
        setAllSelected(Array.from(store.bulkList.values()).every((value) => value === true))
    }, [store.bulkList.values()])

    return (
        <>
            <div id="map-poi-edit-settings">
                <MapPOIEditFilter globals={globals}/>
                <div className="map-poi-edit-row">
                    <div className="map-poi-bulk-actions">
                        <ToggleStateIcon initial={allSelected} className={'map-poi-bulk-indicator'}
                                         icons={{true: faSquareCheck, false: faSquare}}
                                         id={'map-poi-bulk-action-global'}
                                         onChange={changeAll}
                        />
                        <MapPOIBulkActionsMenu/>
                    </div>
                    <SlSwitch size="small" align-right checked={lgs.settings.ui.poi.focusOnEdit}
                              onSlChange={
                                  (event) => {
                                      lgs.settings.ui.poi.focusOnEdit = switchValue(event)
                                  }
                              }>
                        {'Focus on POI'}
                    </SlSwitch>
                </div>
                <SlDivider/>
            </div>
        </>
    )
}