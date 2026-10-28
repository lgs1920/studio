/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIFilteredList.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-20
 * Last modified: 2026-10-28
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
import { filterAndSortPOIs }    from '@Components/MainUI/MapPOI/filterAndSortPOIs'
import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { useProxyValue }         from '@Utils/ValtioUtils'
import { WaCallout, WaIcon } from '@awesome.me/webawesome/dist/react'
import { useEffect, useMemo }   from 'react'
import { useSnapshot }           from 'valtio'

export const MapPOIFilteredList = () => {
    const $pois = lgs.stores.main.components.pois
    const $settings = lgs.settings.poi
    const $drawers = lgs.stores.ui.drawers

    const pois = useSnapshot($pois)
    const settings = useSnapshot($settings)
    const drawers = useSnapshot($drawers)
    const journeySlug = useProxyValue(lgs.mainProxy, main => main.theJourney?.slug ?? null, null)

    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    const filteredPois = useMemo(
        () => {
            void journeySlug
            return filterAndSortPOIs({
                onlyJourney,
                filterSettings: settings.filter,
                list: pois.list,
                journeySlug,
                getJourneyByTrackSlug: lgs.getJourneyByTrackSlug,
            })
        },
        [onlyJourney, journeySlug, settings.filter, pois.list],
    )

    /**
     * ynchronize the store's filtered maps with the current UI results
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
            size="s"
            variant="danger"
            className="map-poi-filter-count-info"
        >
            <WaIcon slot="icon" size="s" name="warning"/>
            <span>{'No POIs match the current filter criteria.'}</span>
        </WaCallout>
    )
}

MapPOIFilteredList.displayName = 'MapPOIFilteredList'
