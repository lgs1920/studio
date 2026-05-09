/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditFilterButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo }  from 'react'
import { useSnapshot }                 from 'valtio/index'

// Pre-calculate icon names to avoid repeated calculations
const ICON_FILTER = 'filter'
const ICON_FILTER_SLASH = 'filter-slash'

export const MapPOIEditFilterButton = memo(() => {
    const $poi = lgs.settings.poi
    const poi = useSnapshot(lgs.settings.poi)
    const {showPOIsFilter} = useSnapshot(lgs.stores.journeyEditor)
    const {list} = useSnapshot(lgs.stores.main.components.pois)
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)

    // Memoize the filter toggle handler
    const handleFilter = useCallback((event) => {
        event.preventDefault()
        $poi.filter.open = !$poi.filter.open
    }, [$poi])

    // Memoize the POI count calculation
    const enoughPOIs = useMemo(() => {
        return Array.from(list.values()).reduce((count, obj) => count + (obj.type !== undefined ? 1 : 0), 0) >= 1
    }, [list])

    // Memoize visibility condition
    const shouldShow = useMemo(() => {
        return enoughPOIs && (showPOIsFilter || drawerOpen === POIS_EDITOR_DRAWER || drawerOpen === JOURNEY_EDITOR_DRAWER)
    }, [enoughPOIs, showPOIsFilter, drawerOpen])

    // Memoize button class name
    const buttonClassName = useMemo(() => {
        return poi.filter.open ? 'map-poi-filter-open' : ''
    }, [poi.filter.open])


    // Memoize icon name
    const iconName = useMemo(() => {
        return poi.filter.open ? ICON_FILTER_SLASH : ICON_FILTER
    }, [poi.filter.open])

    if (!shouldShow) {
        return null
    }

    return (
        <>
            <div className="map-poi-edit-toggle-filter">
                <WaTooltip for="lgs--map-poi-edit-filter-button">
                    {`${poi.filter.open ? 'Hide Filters' : 'Show Filters'}${poi.filter.active ? ': Filter is active' : ''}`}
                </WaTooltip>
                <WaButton
                    id="lgs--map-poi-edit-filter-button"
                    className={buttonClassName}
                    onClick={handleFilter}
                    size="small"
                    appearance={poi.filter.active ? 'filled' : 'plain'}
                    variant={poi.filter.active ? 'danger' : 'brand'}>
                    <WaIcon size="small" name={iconName} variant="regular"/>
                </WaButton>
            </div>
        </>
    )
})

MapPOIEditFilterButton.displayName = 'MapPOIEditFilterButton'
