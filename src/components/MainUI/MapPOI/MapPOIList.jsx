/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-15
 * Last modified: 2025-06-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                   from 'valtio'
import { MapPOIListItem }                                from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER }                         from '@Core/constants'
import { faTriangleExclamation }                         from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                               from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                         from '@Utils/FA2SL'
import { UIToast }                                       from '@Utils/UIToast'

// Pre-calculated icon
const ICON_WARNING = FA2SL.set(faTriangleExclamation)

/**
 * A memoized React component for displaying a list of Points of Interest (POIs).
 * @returns {JSX.Element} The rendered POI list
 */
export const MapPOIList = memo(() => {
    const poiList = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const editor = useSnapshot(lgs.stores.journeyEditor)
    const drawers = useSnapshot(lgs.stores.main.drawers)

    // Memoized onlyJourney calculation
    const onlyJourney = useMemo(() => drawers.open === JOURNEY_EDITOR_DRAWER, [drawers.open])

    // Memoized journey reference
    const theJourney = useMemo(() => lgs.theJourney, [lgs.theJourney])

    // Memoized handleCopyCoordinates
    const handleCopyCoordinates = useCallback((poi) => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text: 'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [])

    // Initialize details group and clear bulkList
    useEffect(() => {
        __.ui.ui.initDetailsGroup(poiList.current)
        $pois.bulkList.clear()
        pois.list.forEach((_, id) => {
            $pois.bulkList.set(id, false)
        })
    }, [pois.list.size, $pois.bulkList])

    // Memoized filtered and sorted POIs
    const filteredPois = useMemo(() => {
        let poisToShow = Array.from(pois.list.entries())

        // Apply filter by journey and global
        if (onlyJourney) {
            poisToShow = poisToShow.filter(([id, poi]) => poi.parent && theJourney?.pois.includes(id))
        }
        else {
            poisToShow = poisToShow.filter(([id, poi]) => {
                let include = false
                if (settings.filter.journey && theJourney && theJourney.pois.includes(id)) {
                    include = true
                }
                else if (settings.filter.global && !poi.parent) {
                    include = true
                }
                return include
            })
        }

        // Apply filter byName
        poisToShow = poisToShow.filter(([, poi]) =>
                                           poi?.title?.toLowerCase().includes(settings.filter.byName.toLowerCase()),
        )

        // Alphabetic/reverse sorting
        poisToShow = poisToShow.sort(([, a], [, b]) => {
            if (settings.filter.alphabetic) {
                return a.title.localeCompare(b.title)
            }
            return b.title.localeCompare(a.title)
        })

        // Apply filter by category
        if (settings.filter.byCategories.length > 0) {
            poisToShow = poisToShow.filter(([, poi]) =>
                                               settings.filter.exclude
                                               ? !settings.filter.byCategories.includes(poi.category)
                                               : settings.filter.byCategories.includes(poi.category),
            )
        }

        return poisToShow
    }, [
                                     pois.list,
                                     onlyJourney,
                                     theJourney,
                                     settings.filter.journey,
                                     settings.filter.global,
                                     settings.filter.byName,
                                     settings.filter.alphabetic,
                                     settings.filter.byCategories,
                                     settings.filter.exclude,
                                 ])

    // Update filtered lists and bulkList
    useEffect(() => {
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }

        $pois.bulkList.clear()
        const targetList = onlyJourney ? $pois.filtered.journey : $pois.filtered.global
        targetList.clear()

        filteredPois.forEach(([id, poi]) => {
            targetList.set(id, poi)
            $pois.bulkList.set(id, false)
        })
    }, [filteredPois, onlyJourney, $pois.bulkList, $pois.filtered.journey, $pois.filtered.global, drawers.action])

    // Memoized list items and alert
    const content = useMemo(() => {
        const targetList = onlyJourney ? pois.filtered.journey : pois.filtered.global
        if (targetList.size > 0) {
            return Array.from(targetList.entries()).map(([id, poi]) => (
                <MapPOIListItem key={`edit-map-poi-${id}`} id={id} poi={poi}/>
            ))
        }
        return (
            <SlAlert variant="warning" open>
                <SlIcon slot="icon" library="fa" name={ICON_WARNING}/>
                There are no results matching your filter criteria.
            </SlAlert>
        )
    }, [onlyJourney, pois.filtered.global, pois.filtered.journey])

    return (
        <div id="edit-map-poi-list" ref={poiList}>
            {content}
        </div>
    )
})