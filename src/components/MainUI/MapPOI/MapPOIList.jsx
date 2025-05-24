/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIList.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-24
 * Last modified: 2025-05-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/


import { FontAwesomeIcon }                                        from '@Components/FontAwesomeIcon'
import { MapPOIEditContent }                                      from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon }                                        from '@Components/ToggleStateIcon'
import { POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER }     from '@Core/constants'
import { faMask, faSquare, faSquareCheck, faTriangleExclamation } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlDetails, SlIcon }                             from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                  from '@Utils/FA2SL'
import { UIToast }                                                from '@Utils/UIToast'
import classNames                                                 from 'classnames'
import { Fragment, memo, useEffect, useRef }                      from 'react'
import { snapshot, useSnapshot }                                  from 'valtio/index'

export const MapPOIList = memo(() => {

    const poiList = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const editor = useSnapshot(lgs.stores.journeyEditor)

    const prefix = 'edit-map-poi-'
    const bulkPrefix = 'bulk-map-poi-'
    const drawers = useSnapshot(lgs.mainProxy.drawers)
    const poiSetting = useSnapshot(lgs.settings.ui.poi)
    const theJourney = useRef(lgs.theJourney)

    const _poi = useRef(pois.list.get(pois.current))

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
        if (editor.journey) {
            theJourney.current = lgs.theJourney

            // Clear action once built
            if (drawers.action) {
                lgs.mainProxy.drawers.action = null
            }

            let poisToShow = Array.from(pois.list)

            // Apply filter by journey and global
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


            $pois.filteredList.clear()
            $pois.bulkList.clear()
            poisToShow.forEach(([key, value]) => {
                $pois.filteredList.set(key, value)
                $pois.bulkList.set(key, false)
            })
        }
              }, [
                  pois.list.size, pois.current,
                  settings?.filter.byName, settings?.filter.alphabetic,
                  settings?.filter.exclude, settings?.filter.byCategories,
                  settings?.filter.journey, settings?.filter.global,
                  // _poi.current?.title, _poi.current?.category,
                  // _poi.current?.color, _poi.current?.bgColor,
                  // _poi.current?.expanded,
                  editor.journey?.slug,
              ],
    )


    const handleBulkList = (state, event) => {
        const id = event.target.id.split(bulkPrefix).pop()
        $pois.bulkList.set(id, state)
    }

    const selectPOI = async (event) => {
        if (window.isOK(event)) {
            const id = event.target.id.split(prefix).pop()
            let current = $pois.list.get(id)
            let forceFocus = false
            // We define the current if there is not
            if ($pois.current === false) {
                $pois.current = id
                forceFocus = true
            }
            // If defined and it is not the same, or we are in force mode, we focus on it
            if ((pois.current !== id) || forceFocus) {
                // Stop animation before changing
                current.animated = false
                if (drawers.open === POIS_EDITOR_DRAWER) {
                    current = $pois.filteredList.get(id)
                }

                if (poiSetting.focusOnEdit && drawers.open === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
                    const camera = snapshot(lgs.mainProxy.components.camera)
                    if (__.ui.cameraManager.isRotating()) {
                        await __.ui.cameraManager.stopRotate()
                        current.stopAnimation()
                    }
                    __.ui.sceneManager.focus(current, {
                        target: current,
                        heading:    camera.position.heading,
                        pitch:      camera.position.pitch,
                        roll:       camera.position.roll,
                        range:      5000,
                        infinite:   false,
                        rpm:    lgs.settings.ui.poi.rpm,
                        rotations:  1,
                        rotate:     lgs.settings.ui.poi.rotate,
                        panoramic:  false,
                        flyingTime: 0,    // no move, no time ! We're on target
                    })
                    if (lgs.settings.ui.poi.rotate) {
                        current.startAnimation()
                    }
                }
            }


            // We force it in the view
            const item = document.getElementById(`${prefix}${id}`)
            item.scrollIntoView({behavior: 'smooth', block: 'start'})
            item.focus()
        }
    }


    return (
        <div id={'edit-map-poi-list'} ref={poiList}>
            {pois.filteredList.size > 0 &&
                Array.from(pois.filteredList.entries()).map(([id, poi]) => (
                    <Fragment key={`${prefix}${id}`}>
                        {poi.type !== POI_TMP_TYPE &&
                            <div className="edit-map-poi-item-wrapper">
                                <ToggleStateIcon initial={pois.bulkList.get(id)} className={'map-poi-bulk-indicator'}
                                                 icons={{true: faSquareCheck, false: faSquare}}
                                                 onChange={handleBulkList}
                                                 id={`${bulkPrefix}${id}`}
                                />
                                <SlDetails className={classNames(
                                    `edit-map-poi-item`,
                                    pois.list.get(id).visible ? undefined : 'map-poi-hidden',
                                    pois.list.get(id).type === POI_STARTER_TYPE ? 'map-poi-starter' : undefined,
                                )}
                                           id={`${prefix}${id}`}
                                           onSlAfterShow={selectPOI}
                                           open={pois.current === id /*&& drawers.action !== null*/}
                                           small
                                           style={{'--map-poi-bg-header': __.ui.ui.hexToRGBA(poi.bgColor ?? lgs.colors.poiDefaultBackground, 'rgba', 0.2)}}>
                                    <div slot="summary">
                                    <span>
                                        <FontAwesomeIcon
                                            icon={pois.list.get(id).visible ? pois.list.get(id).icon : faMask} style={{
                                            '--fa-primary-color':   pois.list.get(id).color,
                                            '--fa-secondary-color': pois.list.get(id).bgColor,
                                            '--fa-primary-opacity':   1,
                                            '--fa-secondary-opacity': 1,
                                        }}/>

                                        {pois.list.get(id).title}
                                       </span>
                                        <span>
                        </span>
                                    </div>
                                    <MapPOIEditContent poi={pois.list.get(id)}/>
                                </SlDetails>
                            </div>
                        }
                    </Fragment>
                ))
            }

            {pois.filteredList.size === 0 &&
                <SlAlert variant="warning" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                    {'There are no results matching your filter criteria.'}
                </SlAlert>
            }


        </div>
    )
})

