/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-01
 * Last modified: 2026-03-01
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
import { faTriangleExclamation } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'
import { useEffect, useMemo }    from 'react'
import { useSnapshot }           from 'valtio'

const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * Filter and sort logic that preserves hidden POIs for UI management
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

    if (onlyJourney && theJourney?.poisLoaded !== true) {
        return []
    }

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

    const lowerName = byName.toLowerCase()
    const sorted = []

    for (const id of ids) {
        const poi = list.get(id)
        // Hidden POIs are NOT filtered out to allow reactivation via the "Show" button
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

    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const filteredPois = useMemo(
        () => filterAndSortPois(onlyJourney, settings.filter, pois.list),
        [onlyJourney, settings.filter, pois.list],
    )

    /**
     * Automatic scroll to the currently selected POI
     */
    useEffect(() => {
        if (pois.current) {
            const element = document.querySelector(`[data-poi-id="${pois.current}"]`)
            if (element) {
                element.scrollIntoView({behavior: 'smooth', block: 'nearest'})
            }
        }
    }, [pois.current])

    if (filteredPois.length > 0) {
        return (
            <>
                {filteredPois.map((id) => (
                    <MapPOIListItem key={id} id={id}/>
                ))}
            </>
        )
    }

    return (
        <SlAlert variant="warning" open>
            <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
            {'There are no results matching your filter criteria.'}
        </SlAlert>
    )
}