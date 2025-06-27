/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
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

import { MapPOIListItem }                       from '@Components/MainUI/MapPOI/MapPOIListItem'
import { GLOBAL_PARENT, JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { faTriangleExclamation }                from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'

// Pre-calculated warning icon for alert messages
const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts a list of Points of Interest (POIs) based on provided settings and journey context.
 *
 * @param {boolean} [onlyJourney=false] - If true, only includes POIs associated with the current journey.
 * @param {Object} [settings={ filter: { journey: true, global: true, byName: '', byCategories: [], exclude: false,
 *     alphabetic: true } }] - Configuration object for filtering and sorting POIs.
 * @returns {Array<[string, Object]>} Filtered and sorted array of [id, poi] entries.
 */
const filterAndSortPois = (onlyJourney = false, settings) => {
    // Destructure filtering parameters from the settings object
    const {
              journey    = false,
              global     = false,
              byName,
              byCategories,
              exclude    = false,
              alphabetic = true,
          } = settings?.filter ?? {}

    const {theJourney} = lgs
    const manager = __.ui.poiManager

    // If 'onlyJourney' is true but journey POIs haven't been loaded yet,
    // return early to avoid processing with incomplete data.
    if (onlyJourney && !(theJourney?.poisLoaded === true)) {
        return []
    }

    // Build the initial list of POI IDs based on filter toggles
    const ids = []
    if (global && !onlyJourney) {
        ids.push(...manager.index(GLOBAL_PARENT))
    }
    if (onlyJourney || journey) {
        ids.push(...manager.index(theJourney.slug))
    }

    // Normalize search string for case-insensitive comparisons
    const lowerName = byName?.toLowerCase()

    const result = []

    for (const id of ids) {
        const poi = manager.list.get(id)
        if (!poi || typeof poi.title !== 'string') {
            continue
        }

        // Filter by POI title if a search term is provided
        if (lowerName && !poi.title.toLowerCase().includes(lowerName)) {
            continue
        }

        // Category filter block
        if (byCategories?.length) {
            const inCategory = poi.category && byCategories.includes(poi.category)

            if (exclude ? inCategory : !inCategory) {
                continue
            }

            // Include or exclude uncategorized POIs depending on exclusion logic
            if (!poi.category && !exclude) {
                continue
            }
        }

        result.push([id, poi])
    }

    // Sort alphabetically or in reverse order by title
    if (result.length > 1 && alphabetic !== undefined) {
        result.sort(([, a], [, b]) =>
                        alphabetic
                        ? a.title.localeCompare(b.title)
                        : b.title.localeCompare(a.title),
        )
    }

    return result
}
/**
 * A memoized React component for displaying a filterable and sortable list of Points of Interest (POIs).
 *
 * @component
 * @param {Object} props - Component properties
 * @param {string} props.context - The rendering context identifier used by child components
 * @returns {JSX.Element} The rendered POI list component with filtering and sorting
 */
export const MapPOIList = memo(() => {

    // Ref for DOM manipulation
    const poiList = useRef(null)

    // Reactive store subscriptions
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.main.drawers)

    // Memoized computation: determine if we're in journey-only mode
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const filter = useMemo(() => settings.filter, [
        settings.filter.byName,
        settings.filter.byCategories,
        settings.filter.alphabetic,
        settings.filter.journey,
        settings.filter.global,
        settings.filter.exclude,
    ])

    // Memoized computation: filter and sort POIs
    const filteredPois = useMemo(() => {
        return filterAndSortPois(onlyJourney, settings)
    }, [onlyJourney, lgs.theJourney?.poisLoaded, filter])

    useEffect(() => {
        // Initialize Shoelace details group
        if (poiList.current) {
            __.ui.ui.initDetailsGroup(poiList.current)
        }

        // Clear drawer action
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }
    }, [])

    // Effect: Initialize UI and update store state
    useEffect(() => {
        // Reset bulk selection
        $pois.bulkList.clear()
        const bulkUpdates = new Map()
        if (onlyJourney) {
            //   $pois.filtered.journey.clear()
            filteredPois.forEach(([id, poi]) => {
                $pois.filtered.journey.set(id, poi)
                bulkUpdates.set(id, false)
            })
        }
        else {
            //  $pois.filtered.global.clear()
            filteredPois.forEach(([id, poi]) => {
                $pois.filtered.global.set(id, poi)
                bulkUpdates.set(id, false)
            })
        }

        Object.assign($pois.bulkList, bulkUpdates)
    }, [filteredPois, $pois.bulkList, $pois.filtered.journey, $pois.filtered.global])

    // Memoized content: render POI items or empty state
    const content = useMemo(() => {
        if (filteredPois.length > 0) {
            return filteredPois.map(([id, poiData]) => (
                <MapPOIListItem
                    key={id}
                    id={id}
                />
            ))
        }

        return (
            <SlAlert variant="warning" open>
                <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
                There are no results matching your filter criteria.
            </SlAlert>
        )
    }, [filteredPois])

    return (
        <div id="edit-map-poi-list" ref={poiList}>
            {content}
        </div>
    )
})