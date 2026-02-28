/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
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

import { MapPOIListItem }                       from '@Components/MainUI/MapPOI/MapPOIListItem'
import { GLOBAL_PARENT, JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { faTriangleExclamation }                from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import { useEffect, useMemo }                   from 'react'
import { useSnapshot }                          from 'valtio'

const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filters and sorts POIs according to current UI settings and journey context.
 *
 * @param {boolean} onlyJourney           true when only journey-related POIs must be shown
 * @param {Object}  filterSettings        Current POI filter configuration from settings store
 * @param {Map<string, Object>} list      Snapshot of the POI list (pois.list)
 * @returns {Array<string>}               Array of POI IDs, filtered and sorted
 */
const filterAndSortPois = (onlyJourney, filterSettings = {}, list) => {
    const {
              journey      = false,
              global       = false,
              byName       = '',
              byCategories = [],
              exclude      = false,
              alphabetic = true,
          } = filterSettings

    const {theJourney} = lgs
    const manager = __.ui.poiManager

    console.log(list)
    if (onlyJourney && theJourney?.poisLoaded !== true) {
        return []
    }

    const ids = new Set()

    if (global && !onlyJourney) {
        const globalIndex = manager.index(GLOBAL_PARENT)
        globalIndex?.forEach(id => ids.add(id))
    }

    if (onlyJourney || journey) {
        const journeyIndex = manager.index(theJourney?.slug)
        journeyIndex?.forEach(id => ids.add(id))
    }

    const lowerName = byName.toLowerCase()
    const sorted = []

    for (const id of ids) {
        const poi = list.get(id)
        if (!poi?.title) {
            continue
        }

        if (lowerName && !poi.title.toLowerCase().includes(lowerName)) {
            continue
        }

        if (byCategories.length) {
            const inCategory = poi.category && byCategories.includes(poi.category)
            if (exclude ? inCategory : !inCategory) {
                continue
            }
            if (!poi.category && !exclude) {
                continue
            }
        }

        sorted.push({id, title: poi.title})
    }

    if (sorted.length > 1 && alphabetic !== undefined) {
        sorted.sort((a, b) =>
                        alphabetic
                        ? a.title.localeCompare(b.title)
                        : b.title.localeCompare(a.title)
        )
    }

    return sorted.map(({id}) => id)
}

/**
 * Handles all reactive logic (snapshots, filtering, sorting, bulk list synchronization).
 * Renders the MapPOIListItem components using the resulting filtered list.
 *
 * @component
 * @returns {JSX.Element}
 */
export const MapPOIFilteredList = () => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    // Using snapshots for reactivity
    const list = useSnapshot($pois.list)
    const settings = useSnapshot(lgs.settings.poi)
    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)

    const {filter: poiFilter} = settings
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    /**
     * Filtered & sorted POI IDs.
     * Dependencies optimized to avoid unnecessary re-calculations.
     */
    const filteredPois = useMemo(
        () => filterAndSortPois(onlyJourney, poiFilter, list),
        [
            onlyJourney,
            poiFilter.byName,
            poiFilter.journey,
            poiFilter.global,
            poiFilter.alphabetic,
            poiFilter.exclude,
            poiFilter.byCategories, // Valtio snapshots are proxy-wrapped, careful with object refs
            list,
        ]
    )

    /** * Sync filtered collections and bulk list with the current UI state.
     * Production note: Clears previous filtered sets before populating.
     */
    useEffect(() => {
        const $target = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        const $bulkList = $pois.bulkList

        // Batch updates to the proxy stores
        $target.clear()
        $bulkList.clear()

        filteredPois.forEach((id) => {
            const poi = $pois.list.get(id)
            if (poi) {
                $target.set(id, poi)
                $bulkList.set(id, false)
            }
        })
    }, [filteredPois, onlyJourney, $pois.filtered, $pois.bulkList, $pois.list])

    if (filteredPois.length > 0) {
        return filteredPois.map((id) => (
            <MapPOIListItem key={id} id={id}/>
        ))
    }

    return (
        <SlAlert variant="warning" open>
            <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
            {'There are no results matching your filter criteria.'}
        </SlAlert>
    )
}