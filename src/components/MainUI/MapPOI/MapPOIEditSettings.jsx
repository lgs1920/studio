/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIEditToggleFilter } from '@Components/MainUI/MapPOI/MapPOIEditToggleFilter'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                     from 'valtio'
import { MapPOIBulkActionsMenu }                           from '@Components/MainUI/MapPOI/MapPOIBulkActionsMenu'
import { MapPOIEditFilter }                                from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import { ToggleStateIcon }                                 from '@Components/ToggleStateIcon'
import { JOURNEY_EDITOR_DRAWER }                           from '@Core/constants'
import { faSquare, faSquareCheck }                         from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlSwitch }                             from '@shoelace-style/shoelace/dist/react'

/**
 * Pre-defined icons to avoid repeated references
 */
const ICONS = {
    true: faSquareCheck,
    false: faSquare,
}

/**
 * A memoized React component for editing POI settings, including bulk actions and filters.
 * @param {Object} props - Component props
 * @param {boolean} [props.globals=true] - Whether to show global POI settings
 * @returns {JSX.Element} The rendered settings component
 */
export const MapPOIEditSettings = memo(({globals = true}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)

    /**
     * Check if we are currently in the journey editor context
     */
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const [allSelected, setAllSelected] = useState(false)

    /**
     * Toggles all POIs in the current list (journey or global)
     */
    const changeAll = useCallback(
        (state) => {
            $pois.bulkList.clear()
            const targetList = onlyJourney ? $pois.filtered.journey : $pois.filtered.global

            if (targetList.size === 0) {
                return
            }

            targetList.forEach(poi => {
                $pois.bulkList.set(poi.id, state)
            })
        },
        [onlyJourney, $pois.bulkList, $pois.filtered.journey, $pois.filtered.global]
    )

    /**
     * Updates the focus on edit setting
     */
    const handleFocusOnEdit = useCallback(
        (event) => {
            lgs.settings.ui.poi.focusOnEdit = event.target.checked ?? false
        },
        [],
    )

    /**
     * Sync the allSelected state with the bulkList content
     */
    useEffect(() => {
        if (pois.bulkList.size === 0) {
            setAllSelected(false)
            return
        }

        const values = Array.from(pois.bulkList.values())
        setAllSelected(values.every(v => v === true))
    }, [pois.bulkList])

    return (
        <div id="map-poi-edit-settings">
            <div className="map-poi-edit-row">
                <div className="map-poi-bulk-actions">
                    <ToggleStateIcon
                        initial={allSelected}
                        className="map-poi-bulk-indicator"
                        icons={ICONS}
                        id="map-poi-bulk-action-global"
                        onChange={changeAll}
                    />
                    <MapPOIBulkActionsMenu/>
                </div>
                <SlSwitch
                    size="x-small"
                    align-right
                    checked={lgs.settings.ui.poi.focusOnEdit}
                    onSlChange={handleFocusOnEdit}
                >
                    {'Focus on POI'}
                </SlSwitch>
            </div>

            <SlDivider/>
        </div>
    )
})