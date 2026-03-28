/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditListActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-28
 * Last modified: 2026-03-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIBulkActionsMenu }               from '@Components/MainUI/MapPOI/MapPOIBulkActionsMenu'
import { MapPOIEditFilterButton }              from '@Components/MainUI/MapPOI/MapPOIEditFilterButton'
import { MapPOIEditFilterPopup }               from '@Components/MainUI/MapPOI/MapPOIEditFilterPopup'
import { PopupAnchor }                         from '@Components/PopupAnchor'
import { JOURNEY_EDITOR_DRAWER }               from '@Core/constants'
import { WaIcon, WaPopup, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                              from 'classnames'
import { memo, useCallback, useMemo, useRef }  from 'react'
import { useSnapshot }                         from 'valtio'

/**
 * MapPOIEditListActions component for POI edition.
 * Manages bulk actions, focus settings, and filter popup.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} [props.globals=true] - Context flag.
 * @returns {JSX.Element} The rendered settings component.
 */
export const MapPOIEditListActions = memo(({globals = true}) => {
    const $poi = lgs.settings.poi
    const poi = useSnapshot($poi)

    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers)

    /**
     * Checks if current view is restricted to journey editor.
     */
    const onlyJourney = useMemo(() => drawerOpen === JOURNEY_EDITOR_DRAWER, [drawerOpen])

    /**
     * Computes selection states for bulk actions and determines if bulk selection is enabled.
     * Bulk selection is only enabled if there are more than 1 item in the list.
     */
    const {isAnySelected, isAllSelected, canBulkSelect} = useMemo(() => {
        const list = onlyJourney ? pois.filtered.journey : pois.filtered.global
        const total = list.size

        // Disable bulk icon if there is 1 or 0 items
        if (total <= 1) {
            return {isAnySelected: false, isAllSelected: false, canBulkSelect: false}
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
            canBulkSelect: true,
        }
    }, [onlyJourney, pois.filtered, pois.bulkList])

    /**
     * Toggles selection for all items in the current filtered list.
     */
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
     * Determines which icon to show based on selection state.
     */
    const bulkIcon = useMemo(() => {
        if (isAllSelected) {
            return 'square-check'
        }
        if (isAnySelected) {
            return 'square-minus'
        }
        return 'square'
    }, [isAnySelected, isAllSelected])

    return (
        <>
            <div id="map-poi-edit-settings">
                <div className="map-poi-edit-row">
                    <div className="map-poi-bulk-actions">
                        {canBulkSelect &&
                            <>
                                <div
                                    className={classNames('map-poi-bulk-master-icon', {
                                        'is-partial': isAnySelected && !isAllSelected,
                                        'is-all':     isAllSelected,
                                    })}
                                    onClick={handleToggleAll}
                                >
                                    <WaIcon slot="start" name={bulkIcon} variant="regular"/>
                                </div>
                                <MapPOIBulkActionsMenu/>
                            </>
                        }
                    </div>

                    <WaSwitch
                        size="xsmall" label-at-start width-auto
                        checked={lgs.settings.ui.poi.focusOnEdit}
                        onChange={(e) => {
                            lgs.settings.ui.poi.focusOnEdit = e.target.checked
                        }}
                    >
                        {'Focus on POI'}
                    </WaSwitch>

                    <MapPOIEditFilterButton/>
                </div>

                <WaPopup
                    active={poi.filter.open}
                    anchor="map-poi-edit-popup-anchor"
                    placement="bottom"
                >
                    <MapPOIEditFilterPopup/>
                </WaPopup>
            </div>

            <PopupAnchor id="map-poi-edit-popup-anchor"/>
        </>
    )
})

MapPOIEditListActions.displayName = 'MapPOIEditListActions'