/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-20
 * Last modified: 2025-06-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useEffect, useMemo, useRef } from 'react'
import { snapshot, useSnapshot }            from 'valtio'
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
 * @param {Object} settings - The POI filter settings
 * @returns {Array} The filtered and sorted array of POI entries
 */
const filterAndSortPois = (poisList, onlyJourney, settings) => {
    // Defensive check: Ensure poisList is a Map or iterable
    if (!(poisList instanceof Map) && !(typeof poisList?.entries === 'function')) {
        console.warn('poisList is not a valid Map or iterable:', poisList)
        return []
    }

    return Array.from(poisList.entries())
        .filter(([id, poi]) => {
            // Validate POI data
            if (!poi || typeof poi.title !== 'string') {
                console.warn(`Invalid POI data for id ${id}:`, poi)
                return false
            }

            // Apply journey and global filters
            if (onlyJourney) {
                return poi.parent && lgs.theJourney?.pois?.includes(id)
            }

            let include = false
            if (settings.filter.journey && lgs.theJourney?.pois?.includes(id)) {
                include = true
            }
            else if (settings.filter.global && !poi.parent) {
                include = true
            }
            if (!include) {
                return false
            }

            // Apply name filter
            if (settings.filter.byName && !poi.title.toLowerCase().includes(settings.filter.byName.toLowerCase())) {
                return false
            }

            // Apply category filter
            if (settings.filter.byCategories?.length > 0) {
                const inCategory = settings.filter.byCategories.includes(poi.category)
                return settings.filter.exclude ? !inCategory : inCategory
            }

            return true
        })
        .sort(([, a], [, b]) => {
            return settings.filter.alphabetic
                   ? a.title.localeCompare(b.title)
                   : b.title.localeCompare(a.title);
        })
        .map(([id, poi]) => {
            try {
                // Only snapshot if poi is a Valtio proxy
                const isProxy = poi && typeof poi === 'object' && 'toJSON' in poi
                return [id, isProxy ? snapshot(poi) : poi]
            }
            catch (error) {
                console.error(`Error snapshotting POI with id ${id}:`, error)
                return [id, poi] // Fallback to raw poi if snapshot fails
            }
        });
};

/**
 * A memoized React component for displaying a list of Points of Interest (POIs).
 * @param {Object} props - Component props
 * @param {string} props.context - The context for rendering POIs
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

    // Memoized filtered and sorted POIs
    const filteredPois = useMemo(
        () => filterAndSortPois(pois.list, onlyJourney, settings),
        [pois.list, onlyJourney, settings.filter.byName, settings.filter.byCategories, settings.filter.alphabetic, settings.filter.journey, settings.filter.global],
    );

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
        });

        // Batch update bulkList
        Object.assign($pois.bulkList, bulkUpdates)
    }, [filteredPois, onlyJourney, $pois]);

    // Memoized list items and alert
    const content = useMemo(() => {
        if (filteredPois.length > 0) {
            return filteredPois.map(([id, poiData]) => (
                <MapPOIListItem
                    key={id}
                    id={id}
                    poi={poiData}
                    context={context}
                />
            ))
        }

        return (
            <SlAlert variant="warning" open>
                <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
                There are no results matching your filter criteria.
            </SlAlert>
        );
    }, [filteredPois, context]);

    return (
        <div id="edit-map-poi-list" ref={poiList}>
            {content}
        </div>
    );
});