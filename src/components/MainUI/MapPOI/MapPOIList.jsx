/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-06
 * Last modified: 2025-12-06
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

const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts POIs according to current UI settings and journey context.
 *
 * @param {boolean} onlyJourney           true when only journey-related POIs must be shown
 * @param {Object}  filterSettings        Current POI filter configuration from settings store
 * @returns {Array<[string, Object]>}     Array of [poiId, poiObject] tuples, filtered and sorted
 */
const filterAndSortPois = (onlyJourney, filterSettings = {}) => {
    const {
              journey    = false,
              global     = false,
              byName       = '',
              byCategories = [],
              exclude    = false,
              alphabetic   = true,
          } = filterSettings

    const {theJourney} = lgs
    const manager = __.ui.poiManager

    // early exit if journey POIs are required but not yet loaded
    if (onlyJourney && theJourney?.poisLoaded !== true) {
        return []
    }

    const ids = new Set()

    // add global POIs when allowed and not in journey-only mode
    if (global && !onlyJourney) {
        const globalIndex = manager.index(GLOBAL_PARENT)
        globalIndex?.forEach(id => ids.add(id))
    }

    // add journey POIs when requested or in journey-only mode
    if (onlyJourney || journey) {
        const journeyIndex = manager.index(theJourney?.slug)
        journeyIndex?.forEach(id => ids.add(id))
    }

    const lowerName = byName.toLowerCase()
    const sorted = []

    for (const id of ids) {
        const poi = manager.list.get(id)
        if (!poi?.title) {
            continue
        }

        // name filter
        if (lowerName && !poi.title.toLowerCase().includes(lowerName)) {
            continue
        }

        // category filter (include/exclude logic)
        if (byCategories.length) {
            const inCategory = poi.category && byCategories.includes(poi.category)
            if (exclude ? inCategory : !inCategory) {
                continue
            }
            if (!poi.category && !exclude) {
                continue
            }
        }

        sorted.push([id, poi])
    }

    // alphabetic sort (ascending or descending)
    if (sorted.length > 1 && alphabetic !== undefined) {
        sorted.sort(([, a], [, b]) =>
                        alphabetic
                        ? a.title.localeCompare(b.title)
                        : b.title.localeCompare(a.title)
        )
    }


    return sorted.map(([id]) => id)

}

/**
 * Renders a performant, filter-aware list of POI items.
 * Handles journey-only mode, bulk selection reset and filtered collections updates.
 *
 * @component
 * @param {Object} props
 * @returns {JSX.Element}
 */
export const MapPOIList = memo(() => {
    /** Reference to the root container – used for Shoelace details-group initialisation */
    const _poiList = useRef(null)
    // reactive snapshots
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.ui.drawers)

    // true when the journey editor drawer is open → display only journey POIs
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const {filter: poiFilter} = settings

    /** Filtered & sorted POI entries – recomputed only when truly needed */
    const filteredPois = useMemo(
        () => filterAndSortPois(onlyJourney, poiFilter),
        [
            onlyJourney,
            lgs.theJourney?.poisLoaded,
            poiFilter.byName,
            poiFilter.journey,
            poiFilter.global,
            poiFilter.alphabetic,
            poiFilter.exclude,
            JSON.stringify(poiFilter.byCategories),   // arrays are not comparable natively
        ],
    )
    console.log(filteredPois)

    /** Initialise Shoelace details-group and clear any pending drawer action */
    useEffect(() => {
        if (_poiList.current) {
            __.ui.ui.initDetailsGroup(_poiList.current)
        }
        if (drawers.action) {
            lgs.stores.ui.drawers.action = null
        }

    }, [])

    /** Keep Valtio filtered collections & bulk selection in sync with current list */
    useEffect(() => {
        $pois.bulkList.clear()
        const bulkUpdates = new Map()

        const target = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        target.clear()

        filteredPois.forEach(([id, poi]) => {
            target.set(id, poi)
            bulkUpdates.set(id, false)
        })

        Object.assign($pois.bulkList, bulkUpdates)
    }, [filteredPois, onlyJourney, $pois.filtered.journey, $pois.filtered.global, $pois.bulkList])

    /** Render POI items or empty-state warning */
    const content = useMemo(() => {
        if (filteredPois.length) {
            return filteredPois.map((id) => (
                <MapPOIListItem key={id} id={id}/>
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
        <div id="edit-map-poi-list" ref={_poiList}>
            {content}
        </div>
    )
})

MapPOIList.displayName = 'MapPOIList'