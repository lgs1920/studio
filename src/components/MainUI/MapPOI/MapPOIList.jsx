/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-24
 * Last modified: 2025-06-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIListItem }                   from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER }            from '@Core/constants'
import { faTriangleExclamation }            from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { memo, useEffect, useMemo, useRef } from 'react'
import { snapshot, useSnapshot }            from 'valtio'

// Pre-calculated warning icon for alert messages
const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts a list of Points of Interest (POIs) based on provided settings and journey context.
 *
 * @param {Map<string, Object>|Iterable<[string, Object]>} poisList - A Map or iterable of [id, poi] entries.
 * @param {boolean} [onlyJourney=false] - If true, only includes POIs associated with the current journey.
 * @param {Object} [settings={ filter: { journey: true, global: true, byName: '', byCategories: [], exclude: false,
 *     alphabetic: true } }] - Configuration object for filtering and sorting POIs.
 * @returns {Array<[string, Object]>} Filtered and sorted array of [id, poi] entries.
 */
const filterAndSortPois = (poisList, onlyJourney = false, settings = {
    filter: {
        journey:      true,
        global:       true,
        byName:       '',
        byCategories: [],
        exclude:      false,
        alphabetic:   true,
    },
}) => {
    const {filter: {journey, global, byName, byCategories, exclude, alphabetic}} = settings
    const {theJourney} = lgs

    // Return empty array if journey not loaded and onlyJourney is true
    if (onlyJourney && !theJourney?.poisLoaded) {
        return []
    }

    const result = []
    for (const [id, poi] of (poisList?.entries?.() || [])) {
        // Skip invalid POIs
        if (!poi || typeof poi.title !== 'string') {
            continue
        }

        // Journey filter: only include POIs with parent matching journey
        if (onlyJourney && (!poi.parent || !poi.parent.includes(theJourney?.slug))) {
            continue
        }

        // Journey/global filter
        if (!(journey && Array.isArray(theJourney?.pois) && theJourney.pois.includes(id) || global && !poi.parent)) {
            continue
        }

        // Name filter
        if (byName && !poi.title.toLowerCase().includes(byName.toLowerCase())) {
            continue
        }

        // Category filter
        if (byCategories?.length) {
            if (!poi.category) {
                if (exclude) {
                    result.push([id, poi])
                }
                continue
            }
            const inCategory = byCategories.includes(poi.category)
            if (exclude ? inCategory : !inCategory) {
                continue
            }
        }

        result.push([id, poi])
    }

    return result.sort(([, a], [, b]) => {
        return alphabetic ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    })
}
/**
 * A memoized React component for displaying a filterable and sortable list of Points of Interest (POIs).
 *
 * @component
 * @param {Object} props - Component properties
 * @param {string} props.context - The rendering context identifier used by child components
 * @returns {JSX.Element} The rendered POI list component with filtering and sorting
 */
export const MapPOIList = memo(({context}) => {
    // Ref for DOM manipulation
    const poiList = useRef(null)

    // Reactive store subscriptions
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.main.drawers)

    // Memoized computation: determine if we're in journey-only mode
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    // Memoized computation: filter and sort POIs
    const filteredPois = useMemo(() => {
        return filterAndSortPois(pois.list, onlyJourney, settings)
    }, [
                                     onlyJourney, lgs.theJourney?.poisLoaded,
                                     lgs.theJourney?.slug,
                                     settings.filter.byName,
                                     settings.filter.byCategories,
                                     settings.filter.alphabetic,
                                     settings.filter.journey,
                                     settings.filter.global,
                                     settings.filter.exclude,
                                 ])

    // Effect: Initialize UI and update store state
    useEffect(() => {
        // Initialize Shoelace details group
        if (poiList.current) {
            __.ui.ui.initDetailsGroup(poiList.current)
        }

        // Clear drawer action
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }

        // Reset bulk selection
        $pois.bulkList.clear()

        // Update filtered list in store
        const targetList = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        targetList.clear()
        const bulkUpdates = new Map()
        filteredPois.forEach(([id, poi]) => {
            targetList.set(id, poi)
            bulkUpdates.set(id, false)
        })
        Object.assign($pois.bulkList, bulkUpdates)
    }, [lgs.theJourney?.slug, filteredPois, onlyJourney, $pois.bulkList, $pois.filtered.journey, $pois.filtered.global, drawers.action])

    // Memoized content: render POI items or empty state
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
        )
    }, [filteredPois, context])

    return (
        <div id="edit-map-poi-list" ref={poiList}>
            {content}
        </div>
    );
});