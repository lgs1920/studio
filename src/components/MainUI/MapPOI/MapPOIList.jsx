/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-16
 * Last modified: 2025-06-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                      from 'valtio'
import { MapPOIListItem }                   from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER }            from '@Core/constants'
import { faTriangleExclamation }            from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'

// Pre-calculated icon
const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts POIs based on settings and journey context.
 * @param {Map} poisList - The map of POIs
 * @param {boolean} onlyJourney - Whether to filter only journey-related POIs
 * @param {Object} theJourney - The current journey object
 * @param {Object} settings - The POI filter settings
 * @returns {Array} The filtered and sorted array of POI entries
 */
const filterAndSortPois = (poisList, onlyJourney, theJourney, settings) => {
    return Array.from(poisList.entries())
        .filter(([id, poi]) => {
            // Validate POI data
            if (!poi || typeof poi.title !== 'string') {
                return false
            }

            // Apply journey and global filters
            if (onlyJourney) {
                return poi.parent && theJourney?.pois?.includes(id)
            }
            let include = false
            if (settings.filter.journey && theJourney?.pois?.includes(id)) {
                include = true
            }
            else if (settings.filter.global && !poi.parent) {
                include = true
            }
            if (!include) {
                return false
            }

            // Apply name filter
            if (!poi.title.toLowerCase().includes(settings.filter.byName.toLowerCase())) {
                return false
            }

            // Apply category filter
            if (settings.filter.byCategories.length > 0) {
                const inCategory = settings.filter.byCategories.includes(poi.category)
                return settings.filter.exclude ? !inCategory : inCategory
            }

            return true
        })
        .sort(([, a], [, b]) => {
            return settings.filter.alphabetic
                   ? a.title.localeCompare(b.title)
                   : b.title.localeCompare(a.title)
        })
}

/**
 * A memoized React component for displaying a list of Points of Interest (POIs).
 * @returns {JSX.Element} The rendered POI list
 */
export const MapPOIList = memo(({context}) => {
    const poiList = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.main.drawers)

    // Memoized onlyJourney calculation
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    // Memoized journey POIs for dependency stability
    const journeyPois = useMemo(() => lgs.theJourney?.pois || [], [lgs.theJourney])

    // Memoized categories for dependency stability
    const categoriesKey = useMemo(() => settings.categories.join(','), [settings.categories])

    // Memoized filtered and sorted POIs
    const filteredPois = useMemo(
        () => filterAndSortPois(pois.list, onlyJourney, {pois: journeyPois}, settings),
        [
            pois.list,
            onlyJourney,
            journeyPois,
            settings.filter.journey,
            settings.filter.global,
            settings.filter.byName,
            settings.filter.alphabetic,
            categoriesKey,
            settings.filter.exclude,
        ],
    )

    // Initialize and update lists
    useEffect(() => {
        // Initialize details group only once
        if (poiList.current) {
            __.ui.ui.initDetailsGroup(poiList.current)
        }

        // Clear and update lists
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }

        $pois.bulkList.clear()
        const targetList = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        targetList.clear()

        const bulkUpdates = new Map()
        filteredPois.forEach(([id, poi]) => {
            targetList.set(id, poi)
            bulkUpdates.set(id, false)
        })

        // Batch update bulkList
        Object.assign($pois.bulkList, bulkUpdates)
    }, [filteredPois, onlyJourney, $pois.bulkList, $pois.filtered.journey, $pois.filtered.global, drawers.action])

    // Memoized list items and alert
    const content = useMemo(() => {
        const targetList = onlyJourney ? pois.filtered.journey : pois.filtered.global
        if (targetList.size > 0) {
            return Array.from(targetList.entries()).map(([id, poi]) => (
                <MapPOIListItem key={`edit-map-poi-${id}`} id={id} poi={poi} context={context}/>
            ))
        }
        return (
            <SlAlert variant="warning" open>
                <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
                There are no results matching your filter criteria.
            </SlAlert>
        )
    }, [onlyJourney, pois.filtered.global, pois.filtered.journey])

    return (
        <div id="edit-map-poi-list" ref={poiList}>
            {content}
        </div>
    )
})