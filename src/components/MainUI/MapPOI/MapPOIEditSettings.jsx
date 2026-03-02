/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-02
 * Last modified: 2026-03-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditSettings.jsx
 ******************************************************************************/

import { MapPOIBulkActionsMenu }      from '@Components/MainUI/MapPOI/MapPOIBulkActionsMenu'
import { JOURNEY_EDITOR_DRAWER }      from '@Core/constants'
import { SlDivider, SlSwitch }        from '@shoelace-style/shoelace/dist/react'
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome'
import {
    faSquareCheck,
    faSquareMinus,
    faSquare,
}                                     from '@fortawesome/pro-duotone-svg-icons'
import classNames                     from 'classnames'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                from 'valtio'

export const MapPOIEditSettings = memo(({globals = true}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers)

    const onlyJourney = useMemo(() => drawerOpen === JOURNEY_EDITOR_DRAWER, [drawerOpen])

    const {isAnySelected, isAllSelected, targetList} = useMemo(() => {
        const list = onlyJourney ? pois.filtered.journey : pois.filtered.global
        const total = list.size

        if (total === 0) {
            return {isAnySelected: false, isAllSelected: false, targetList: list}
        }

        let count = 0
        list.forEach((_, id) => {
            if (pois.bulkList.has(id)) {
                count++
            }
        })

        return {
            isAnySelected: count > 0,
            isAllSelected: count === total,
            targetList:    list,
        }
    }, [onlyJourney, pois.filtered, pois.bulkList])

    const handleToggleAll = useCallback(() => {
        const list = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        if (isAnySelected) {
            list.forEach((_, id) => $pois.bulkList.delete(id))
        }
        else {
            list.forEach((_, id) => $pois.bulkList.set(id, true))
        }
    }, [isAnySelected, onlyJourney, $pois])

    /**
     * Determine which icon to show
     */
    const bulkIcon = useMemo(() => {
        if (isAllSelected) {
            return faSquareCheck
        }
        if (isAnySelected) {
            return faSquareMinus
        }
        return faSquare
    }, [isAnySelected, isAllSelected])

    return (
        <div id="map-poi-edit-settings">
            <div className="map-poi-edit-row">
                <div className="map-poi-bulk-actions">
                    <div
                        className={classNames('map-poi-bulk-master-icon', {
                            'is-partial': isAnySelected && !isAllSelected,
                            'is-all':     isAllSelected,
                        })}
                        onClick={handleToggleAll}
                    >
                        <FontAwesomeIcon icon={bulkIcon}/>
                    </div>
                    <MapPOIBulkActionsMenu/>
                </div>
                <SlSwitch
                    size="x-small"
                    checked={lgs.settings.ui.poi.focusOnEdit}
                    onSlChange={(e) => {
                        lgs.settings.ui.poi.focusOnEdit = e.target.checked
                    }}
                >
                    {'Focus on POI'}
                </SlSwitch>
            </div>
            <SlDivider/>
        </div>
    )
})

MapPOIEditSettings.displayName = 'MapPOIEditSettings'