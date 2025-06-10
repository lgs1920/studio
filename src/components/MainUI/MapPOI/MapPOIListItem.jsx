/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
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


import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import {
    MapPOIEditContent,
} from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { ToggleStateIcon } from '@Components/ToggleStateIcon'
import { JOURNEY_EDITOR_DRAWER, POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import {
    faMask, faSquare, faSquareCheck,
} from '@fortawesome/pro-regular-svg-icons'
import {
    SlDetails,
} from '@shoelace-style/shoelace/dist/react'
import { UIToast } from '@Utils/UIToast'
import classNames from 'classnames'
import { memo, useRef } from 'react'
import { snapshot, useSnapshot } from 'valtio/index'
import { proxyMap } from 'valtio/utils'

export const MapPOIListItem = memo(({id, poi}) => {

    const poiList = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.poi)
    const editor = useSnapshot(lgs.stores.journeyEditor)


    const prefix = 'edit-map-poi-'
    const bulkPrefix = 'bulk-map-poi-'
    const drawers = useSnapshot(lgs.mainProxy.drawers)
    const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER
    const poiSetting = useSnapshot(lgs.settings.ui.poi)
    const theJourney = useRef(lgs.theJourney)

    const _poi = useRef(pois.list.get(pois.current))

    const handleBulkList = (state, event) => {
        const id = event.target.id.split(bulkPrefix).pop()
        $pois.bulkList.set(id, state)
    }

    const handleCopyCoordinates = (poi) => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
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
                    current = $pois.filtered.global.get(id)
                }
                else {
                    current = $pois.filtered.journey.get(id)
                }


                if (poiSetting.focusOnEdit && drawers.open === POIS_EDITOR_DRAWER && __.ui.drawerManager.over) {
                    const camera = snapshot(lgs.mainProxy.components.camera)
                    if (__.ui.cameraManager.isRotating()) {
                        await __.ui.cameraManager.stopRotate()
                        current.stopAnimation()
                    }
                    __.ui.sceneManager.focus(current, {
                        target:     current,
                        heading:    camera.position.heading,
                        pitch:      camera.position.pitch,
                        roll:       camera.position.roll,
                        range:      5000,
                        infinite:   false,
                        rpm:        lgs.settings.ui.poi.rpm,
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

        <>
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
                                            '--fa-primary-color':     pois.list.get(id).color,
                                            '--fa-secondary-color':   pois.list.get(id).bgColor,
                                            '--fa-primary-opacity':   1,
                                            '--fa-secondary-opacity': 1,
                                        }}/>

                                        {pois.list.get(id).title}
                                       </span>
                            <span></span>
                        </div>
                        <MapPOIEditContent poi={pois.list.get(id)}/>
                    </SlDetails>
                </div>
            }
        </>

    )
})

