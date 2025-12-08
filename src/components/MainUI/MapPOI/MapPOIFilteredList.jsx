/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-08
 * Last modified: 2025-12-08
 *
 *
 * Copyright © 2025 LGS1920
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
              alphabetic   = true,
          } = filterSettings

    const {theJourney} = lgs
    const manager = __.ui.poiManager

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
                        : b.title.localeCompare(a.title),
        )
    }

    return sorted.map(({id}) => id)
}

/**
 * Handles all reactive logic (snapshots, filtering, sorting, bulk list synchronization).
 * Renders the MapPOIListItem components using the resulting filtered list.
 * This component is NOT memoized and will re-render whenever necessary.
 *
 * @component
 * @returns {JSX.Element}
 */
export const MapPOIFilteredList = () => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const list = useSnapshot($pois.list)
    const settings = useSnapshot(lgs.settings.poi)
    const drawers = useSnapshot(lgs.stores.ui.drawers)

    const {filter: poiFilter} = settings
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const poiKeysHash = useMemo(() => {
        return Array.from(pois.list.keys()).join(',')
    }, [pois.list])

    /** Filtered & sorted POI IDs. */
    const filteredPois = useMemo(
        () => filterAndSortPois(onlyJourney, poiFilter, list),
        [
            onlyJourney,
            poiFilter.byName,
            poiFilter.journey,
            poiFilter.global,
            poiFilter.alphabetic,
            poiFilter.exclude,
            JSON.stringify(poiFilter.byCategories),
            poiKeysHash,
            list,
        ],
    )

    /** Keep Valtio filtered collections & bulk selection in sync with current list */
    useEffect(() => {
        const target = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        const $bulkList = $pois.bulkList

        $bulkList.clear()
        target.clear()
        filteredPois.forEach((id) => {
            const poi = list.get(id)
            target.set(id, poi)
            $bulkList.set(id, false)
        })
    }, [
                  filteredPois,
                  onlyJourney,
                  $pois.filtered.journey,
                  $pois.filtered.global,
                  $pois.bulkList,
                  list,
              ])
    if (filteredPois.length) {
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