/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditToggleFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-23
 * Last modified: 2025-06-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { faFilter, faFilterSlash }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIconButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                             from '@Utils/FA2SL'
import classNames                            from 'classnames'
import React                                 from 'react'
import { useSnapshot }                       from 'valtio/index'

export const MapPOIEditToggleFilter = ({slot, active}) => {

    const settings = useSnapshot(lgs.settings.poi)
    const {showPOIsFilter} = useSnapshot(lgs.stores.journeyEditor)
    const {list} = useSnapshot(lgs.stores.main.components.pois)
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.main)

    const handleFilter = () => {
        lgs.settings.poi.filter.open = !lgs.settings.poi.filter.open
    }
    const enoughPOIs = () => {
        return Array.from(list.values()).reduce((count, obj) => count + (obj.type !== undefined), 0) >= 1
    }

    return (
        <>
            {enoughPOIs() && (showPOIsFilter || drawerOpen === POIS_EDITOR_DRAWER) &&
                <div className="map-poi-edit-toggle-filter" slot={slot}>
                    <SlButton id="map-poi-edit-filter-trigger"
                              className={settings.filter.open ? 'map-poi-filter-open' : ''}
                              onClick={handleFilter} size="small">
                        <SlIconButton size="small"
                                      library="fa"
                                      name={FA2SL.set(settings.filter.open ? faFilterSlash : faFilter)}
                                      className={settings.filter.active ? 'map-poi-filter-active' : 'map-poi-filter-inactive'}
                        />
                        {settings.filter.open ? 'Hide' : 'Show'}&nbsp;{'Filters'}
                    </SlButton>
                </div>
            }
        </>
    )
}