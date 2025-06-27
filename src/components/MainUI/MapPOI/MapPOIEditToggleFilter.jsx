/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditToggleFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-27
 * Last modified: 2025-06-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { faFilter, faFilterSlash }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIconButton }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                             from '@Utils/FA2SL'
import React, { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                       from 'valtio/index'

// Pre-calculate icon names to avoid repeated calculations
const ICON_FILTER = FA2SL.set(faFilter)
const ICON_FILTER_SLASH = FA2SL.set(faFilterSlash)

export const MapPOIEditToggleFilter = memo(({slot, active}) => {
    const settings = useSnapshot(lgs.settings.poi)
    const {showPOIsFilter} = useSnapshot(lgs.stores.journeyEditor)
    const {list} = useSnapshot(lgs.stores.main.components.pois)
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.main)

    // Memoize the filter toggle handler
    const handleFilter = useCallback(() => {
        lgs.settings.poi.filter.open = !lgs.settings.poi.filter.open
    }, [])

    // Memoize the POI count calculation
    const enoughPOIs = useMemo(() => {
        return Array.from(list.values()).reduce((count, obj) => count + (obj.type !== undefined ? 1 : 0), 0) >= 1
    }, [list])

    // Memoize visibility condition
    const shouldShow = useMemo(() => {
        return enoughPOIs && (showPOIsFilter || drawerOpen === POIS_EDITOR_DRAWER)
    }, [enoughPOIs, showPOIsFilter, drawerOpen])

    // Memoize button class name
    const buttonClassName = useMemo(() => {
        return settings.filter.open ? 'map-poi-filter-open' : ''
    }, [settings.filter.open])

    // Memoize icon button class name
    const iconButtonClassName = useMemo(() => {
        return settings.filter.active ? 'map-poi-filter-active' : 'map-poi-filter-inactive'
    }, [settings.filter.active])

    // Memoize icon name
    const iconName = useMemo(() => {
        return settings.filter.open ? ICON_FILTER_SLASH : ICON_FILTER
    }, [settings.filter.open])

    // Memoize button text
    const buttonText = useMemo(() => {
        return `${settings.filter.open ? 'Hide' : 'Show'} Filters`
    }, [settings.filter.open])

    if (!shouldShow) {
        return null
    }

    return (
        <div className="map-poi-edit-toggle-filter" slot={slot}>
            <SlButton
                id="map-poi-edit-filter-trigger"
                className={buttonClassName}
                onClick={handleFilter}
                size="small"
            >
                <SlIconButton
                    size="small"
                    library="fa"
                    name={iconName}
                    className={iconButtonClassName}
                />
                {buttonText}
            </SlButton>
        </div>
    )
})

MapPOIEditToggleFilter.displayName = 'MapPOIEditToggleFilter'