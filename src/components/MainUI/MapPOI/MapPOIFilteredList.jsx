/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-08
 * Last modified: 2026-05-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
 ******************************************************************************/

import { MapPOIListItem }        from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { WaCallout, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useMemo }          from 'react'
import { useSnapshot }           from 'valtio'

/**
 * Filter and sort logic that preserves hidden POIs for UI management
 * @param {boolean} onlyJourney
 * @param {object} filterSettings
 * @param {Map} list
 * @returns {string[]}
 */
const filterAndSortPois = (onlyJourney, filterSettings, list) => {
    const {
              journey      = false,
              global       = false,
              byName       = '',
              byCategories = [],
              exclude      = false,
              alphabetic = true,
          } = filterSettings
    const {theJourney} = lgs

    const ids = new Set()
    const journeySlug = theJourney?.slug ?? null

    for (const [id, poi] of list) {
        if (!poi?.id) {
            continue
        }
        const isGlobal = poi.parent == null
        let isJourney = false
        if (!isGlobal && journeySlug) {
            const journeyRef = lgs.getJourneyByTrackSlug(poi.parent)
            isJourney = journeyRef?.slug === journeySlug
        }
        if (!onlyJourney && global && isGlobal) {
            ids.add(id)
        }
        if ((onlyJourney || journey) && isJourney) {
            ids.add(id)
        }
    }

    const lowerName = byName.trim().toLowerCase()
    const sorted = []

    for (const id of ids) {
        const poi = list.get(id)
        if (!poi?.title || (lowerName && !poi.title.toLowerCase().includes(lowerName))) {
            continue
        }
        if (byCategories.length) {
            const inCategory = poi.category && byCategories.includes(poi.category)
            if (exclude ? inCategory : !inCategory) {
                continue
            }
        }
        sorted.push({id, title: poi.title})
    }

    if (sorted.length > 1) {
        sorted.sort((a, b) => alphabetic ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title))
    }

    return sorted.map(p => p.id)
}

export const MapPOIFilteredList = () => {
    const $pois = lgs.stores.main.components.pois
    const $settings = lgs.settings.poi
    const $drawers = lgs.stores.ui.drawers

    const pois = useSnapshot($pois)
    const settings = useSnapshot($settings)
    const drawers = useSnapshot($drawers)
    const {theJourney} = useSnapshot(lgs.mainProxy)

    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const filteredPois = useMemo(
        () => {
            void theJourney?.slug
            return filterAndSortPois(onlyJourney, settings.filter, pois.list)
        },
        [onlyJourney, theJourney?.slug, settings.filter, pois.list],
    )

    /**
     * Synchronize the store's filtered maps with the current UI results
     * This allows the bulk actions checkbox to know exactly which POIs are targeted
     */
    useEffect(() => {
        const targetMap = onlyJourney ? $pois.filtered.journey : $pois.filtered.global

        // Update the specific map
        targetMap.clear()
        filteredPois.forEach(id => {
            targetMap.set(id, true)
        })
    }, [filteredPois, onlyJourney, $pois.filtered, pois.list])

    useEffect(() => {
        console.log('filteredPois', filteredPois, theJourney?.slug)
    })
    /**
     * Automatic scroll to the currently selected POI
     */
    useEffect(() => {
        if (pois.current) {
            const element = document.getElementById(`edit-map-poi-${pois.current}`)
            if (element) {
                element.scrollIntoView({behavior: 'smooth', block: 'nearest'})
            }
        }
    }, [pois.current])

    if (filteredPois.length > 0) {
        return (
            <div className="lgs--details-list">
                {filteredPois.map((id) => (
                    <MapPOIListItem key={id} id={id} canSelect={filteredPois.length > 1}/>
                ))}
            </div>
        )
    }

    if (!settings.filter.active) {
        return
    }

    return (
        <WaCallout
            size="small"
            variant="danger"
            className="map-poi-filter-count-info"
        >
            <WaIcon slot="icon" size="small" name="warning"/>
            <span>{'No POIs match the current filter criteria.'}</span>
        </WaCallout>
    )
}

MapPOIFilteredList.displayName = 'MapPOIFilteredList'
