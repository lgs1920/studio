/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-10
 * Last modified: 2025-06-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/


import { MapPOIListItem }                            from '@Components/MainUI/MapPOI/MapPOIListItem'
import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { faTriangleExclamation }                     from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon }                           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                     from '@Utils/FA2SL'
import { UIToast }                                   from '@Utils/UIToast'
import { Fragment, memo, useEffect, useRef }         from 'react'
import { useSnapshot }                               from 'valtio/index'
import { proxyMap }                                  from 'valtio/utils'

export const MapPOIList = memo(() => {

    const poiList = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const editor = useSnapshot(lgs.stores.journeyEditor)

    const prefix = 'edit-map-poi-'
    const bulkPrefix = 'bulk-map-poi-'
    const poiSetting = useSnapshot(lgs.settings.ui.poi)
    const theJourney = useRef(lgs.theJourney)

    let theList = new proxyMap()

    const _poi = useRef(pois.list.get(pois.current))

    const drawers = useSnapshot(lgs.stores.main.drawers)
    const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER


    const handleCopyCoordinates = (poi) => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }


    useEffect(() => {
        __.ui.ui.initDetailsGroup(poiList.current)
        $pois.list.forEach((poi, id) => {
            $pois.bulkList.set(id, false)
        })
    }, [pois.list.size])

    useEffect(() => {

        theJourney.current = lgs.theJourney

        // Clear action once built
        if (drawers.action) {
            lgs.mainProxy.drawers.action = null
        }

        let poisToShow = Array.from(pois.list)

        // Apply filter by journey and global
        if (onlyJourney) {
            poisToShow = poisToShow.filter(([id, poi]) => poi.parent && theJourney.current?.pois.includes(id))
        }
        else {
            poisToShow = poisToShow.filter(([id, poi]) => {
                let include = false
                if (settings.filter.journey && theJourney.current && theJourney.current.pois.includes(id)) {
                    include = true
                }
                else if (settings.filter.global && !poi.parent) {
                    include = true
                }
                return include
            })
        }


        // Apply filter byName
        poisToShow = Array.from(poisToShow)
            .filter(entry => entry[1]?.title?.toLowerCase().includes(settings.filter.byName.toLowerCase()))

        // Alphabetic/reverse sorting
        poisToShow = poisToShow.sort((a, b) => {
            if (settings.filter.alphabetic) {
                return a[1].title.localeCompare(b[1].title)
            }
            else {
                return b[1].title.localeCompare(a[1].title)
            }
        })

        // Apply Filter by category
        if (settings.filter.byCategories.length > 0) {
            if (settings.filter.exclude) { // We exclude the items in the list
                poisToShow = poisToShow.filter(([id, objet]) => !(settings.filter.byCategories.includes(objet.category)))
            }
            else {
                poisToShow = poisToShow.filter(([id, objet]) => settings.filter.byCategories.includes(objet.category))
            }
        }

        $pois.bulkList.clear()
        theList.clear()
        if (!onlyJourney) {
            $pois.filtered.global.clear()
            poisToShow.forEach(([key, value]) => {
                $pois.filtered.global.set(key, value)
                $pois.bulkList.set(key, false)
            })
        }
        else {
            $pois.filtered.journey.clear()
            poisToShow.forEach(([key, value]) => {
                $pois.filtered.journey.set(key, value)
                $pois.bulkList.set(key, false)
            })
        }

              }, [
                  pois.current, pois.size,
                  settings?.filter.byName, settings?.filter.alphabetic,
                  settings?.filter.exclude, settings?.filter.byCategories,
                  settings?.filter.journey, settings?.filter.global,
                  editor.journey?.slug,
                  Array.from(pois.list, ([, poi]) => poi.type).join(','),
              ],
    )


    return (
        <div id={'edit-map-poi-list'} ref={poiList}>
            {!onlyJourney &&
                <>
                    {pois.filtered.global.size > 0 &&
                        Array.from(pois.filtered.global.entries()).map(([id, poi]) => (
                            <MapPOIListItem key={`${prefix}${id}`} id={id} poi={poi}/>
                        ))
                    }
                    {pois.filtered.global.size === 0 &&
                        <SlAlert variant="warning" open>
                            <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                            {'There are no results matching your filter criteria.'}
                        </SlAlert>
                    }
                </>
            }
            {onlyJourney &&
                <>
                    {pois.filtered.journey.size > 0 &&
                        Array.from(pois.filtered.journey.entries()).map(([id, poi]) => (
                            <MapPOIListItem key={`${prefix}${id}`} id={id} poi={poi}/>
                        ))
                    }
                    {pois.filtered.journey.size === 0 &&
                        <SlAlert variant="warning" open>
                            <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                            {'There are no results matching your filter criteria.'}
                        </SlAlert>
                    }
                </>
            }


        </div>
    )
})

