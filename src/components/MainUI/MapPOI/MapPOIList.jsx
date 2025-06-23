/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
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

import { memo, useEffect, useMemo, useRef } from 'react'
import { snapshot, useSnapshot }            from 'valtio'
import { MapPOIListItem }                   from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER }            from '@Core/constants'
import { faTriangleExclamation }            from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'

// Pre-calculated warning icon for alert messages
const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts Points of Interest (POIs) based on settings and journey context.
 *
 * This function performs comprehensive filtering including:
 * - Journey-specific filtering (only POIs belonging to current journey)
 * - Global vs journey POI filtering based on settings
 * - Name-based text filtering (case-insensitive)
 * - Category-based filtering with include/exclude options
 * - Alphabetical sorting (ascending or descending)
 * - Safe snapshot handling for Valtio proxies
 *
 * @param {Map<string, Object>} poisList - The map of POIs where key is POI ID and value is POI object
 * @param {boolean} onlyJourney - Whether to filter only journey-related POIs (excludes global POIs)
 * @param {Object} settings - The POI filter settings object
 * @param {Object} settings.filter - Filter configuration object
 * @param {boolean} settings.filter.journey - Include POIs from current journey
 * @param {boolean} settings.filter.global - Include global POIs (not journey-specific)
 * @param {string} [settings.filter.byName] - Optional name filter string (case-insensitive)
 * @param {string[]} [settings.filter.byCategories] - Optional array of category names to filter by
 * @param {boolean} settings.filter.exclude - When true, excludes specified categories; when false, includes only
 *     specified categories
 * @param {boolean} settings.filter.alphabetic - Sort order: true for A-Z, false for Z-A
 * @returns {Array<[string, Object]>} Array of [id, poi] tuples, filtered and sorted according to settings
 * @throws {Error} Logs warnings for invalid POI data but continues processing
 *
 * @example
 * // Filter POIs for journey context with name filter
 * const filteredPois = filterAndSortPois(
 *   poisMap,
 *   true,
 *   {
 *     filter: {
 *       journey: true,
 *       byName: 'restaurant',
 *       alphabetic: true
 *     }
 *   }
 * )
 */
const filterAndSortPois = (poisList, onlyJourney, settings) => {
    // Defensive validation: Ensure poisList is a Map or has entries method
    if (!(poisList instanceof Map) && !(typeof poisList?.entries === 'function')) {
        console.warn('poisList is not a valid Map or iterable:', poisList)
        return []
    }

    return Array.from(poisList.entries())
        .filter(([id, poi]) => {
            // Validate POI data structure and required fields
            if (!poi || typeof poi.title !== 'string') {
                console.warn(`Invalid POI data for id ${id}:`, poi)
                return false
            }

            // Apply journey-specific filtering logic
            if (onlyJourney) {
                // Exclude POIs without parent or not in current journey's POI list
                if (!poi.parent || !lgs.theJourney?.pois?.includes(id)) {
                    return false
                }
            }

            // Apply global vs journey filtering based on settings
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

            // Apply case-insensitive name filtering
            if (settings.filter.byName && !poi.title.toLowerCase().includes(settings.filter.byName.toLowerCase())) {
                return false
            }

            // Apply category-based filtering with include/exclude logic
            if (settings.filter.byCategories?.length > 0) {
                const inCategory = settings.filter.byCategories.includes(poi.category)
                return settings.filter.exclude ? !inCategory : inCategory
            }

            return true
        })
        .sort(([, a], [, b]) => {
            // Sort alphabetically based on settings preference
            return settings.filter.alphabetic
                   ? a.title.localeCompare(b.title)
                   : b.title.localeCompare(a.title)
        })
        .map(([id, poi]) => {
            try {
                // Safely handle Valtio proxy snapshots
                // Only snapshot if poi is a Valtio proxy (has toJSON method)
                const isProxy = poi && typeof poi === 'object' && 'toJSON' in poi
                return [id, isProxy ? snapshot(poi) : poi]
            }
            catch (error) {
                console.error(`Error snapshotting POI with id ${id}:`, error)
                return [id, poi] // Fallback to raw poi if snapshot fails
            }
        })
}

/**
 * A memoized React component for displaying a filterable and sortable list of Points of Interest (POIs).
 *
 * This component provides:
 * - Reactive filtering based on global POI settings
 * - Context-aware rendering (journey vs global POIs)
 * - Automatic list updates when POI data changes
 * - Bulk selection management
 * - Error handling with user-friendly messages
 * - Performance optimization through memoization
 *
 * The component integrates with the global LGS stores and automatically updates
 * when POI data, settings, or drawer state changes. It handles both journey-specific
 * POIs and global POIs based on the current application context.
 *
 * @component
 * @param {Object} props - Component properties
 * @param {string} props.context - The rendering context identifier used by child components
 *                                 to determine display behavior and interactions
 * @returns {JSX.Element} The rendered POI list component with filtering and sorting
 *
 * @example
 * // Render POI list in journey editor context
 * <MapPOIList context="journey-editor" />
 *
 * @example
 * // Render POI list in map browser context
 * <MapPOIList context="map-browser" />
 */
export const MapPOIList = memo(({context}) => {
    // Ref for DOM manipulation and UI initialization
    const poiList = useRef(null)

    // Reactive store subscriptions
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.main.drawers)

    // Memoized computation: determine if we're in journey-only mode
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    // Memoized computation: filter and sort POIs based on current settings
    const filteredPois = useMemo(
        () => filterAndSortPois(pois.list, onlyJourney, settings),
        [pois.list, onlyJourney, settings.filter.byName, settings.filter.byCategories, settings.filter.alphabetic, settings.filter.journey, settings.filter.global],
    )

    // Effect: Initialize UI components and update store state
    useEffect(() => {
        // Initialize Shoelace details group component for collapsible sections
        if (poiList.current) {
            __.ui.ui.initDetailsGroup(poiList.current)
        }

        // Clear any pending drawer actions
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }

        // Reset bulk selection state
        $pois.bulkList.clear()

        // Update appropriate filtered list based on context
        const targetList = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        targetList.clear()

        // Batch update operations for performance
        const bulkUpdates = new Map()
        filteredPois.forEach(([id, poi]) => {
            targetList.set(id, poi)
            bulkUpdates.set(id, false) // Initialize bulk selection as false
        })

        // Apply bulk updates to store
        Object.assign($pois.bulkList, bulkUpdates)
    }, [filteredPois, onlyJourney, $pois])

    // Memoized content: render POI items or empty state message
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

        // Render empty state with warning message
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
    )
})