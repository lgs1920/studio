/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-22
 * Last modified: 2025-06-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import {
    LGS_CONTEXT_MENU_HOOK, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE,
    POIS_EDITOR_DRAWER,
    SECOND,
} from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faArrowsToLine, faCopy, faFlag, faLocationDot, faLocationPen, faPanorama,
    faTrashCan,
}                          from '@fortawesome/pro-regular-svg-icons'
import {
    faMask,
}                          from '@fortawesome/pro-solid-svg-icons'
import {
    SlDivider, SlIcon, SlPopup,
}                          from '@shoelace-style/shoelace/dist/react'
import {
    FA2SL,
}                          from '@Utils/FA2SL'
import {
    UIToast,
}                          from '@Utils/UIToast'
import React, {
    useEffect, useRef,
}                          from 'react'
import Timeout             from 'smart-timeout'
import {
    snapshot, useSnapshot,
}                          from 'valtio'
import './style.css'

/**
 * Represents the context menu for interacting with Points of Interest (POI) on the map.
 *
 * This component provides a menu that appears when interacting with a POI on the map.
 * It includes various actions for managing POIs, including rotation, panoramic view,
 * copying coordinates, and removing a POI, among others.
 *
 * The component relies on the state of the application's POI data and uses the provided
 * UI functionalities to handle interactions with the POI and the map view.
 */
export const MapPOIContextMenu = () => {

    const anchor = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    let _current = pois.list.get(pois.current)

    /**
     * Hides the menu in the application by resuming the context timer and updating visibility settings.
     */
    const hideMenu = () => {
        Timeout.clear(pois.context.timer)
        $pois.context.visible = false
    }

    const saveAsPOI = () => {
        _current = __.ui.poiManager.updatePOI(pois.current, {
            type: POI_STANDARD_TYPE,
            category: POI_STANDARD_TYPE,
        })
        hideMenu()
    }

    const hide = () => {
        _current.hide()
        hideMenu()
    }

    const shrink = () => {
        __.ui.poiManager.updatePOI(pois.current, {
            expanded: false,
        }).then(() => hideMenu())
    }

    const expand = () => {
        __.ui.poiManager.updatePOI(pois.current, {
            expanded: true,
        }).then(() => hideMenu())
    }

    /**
     * Handles the rotation behavior of the camera based on the current state.
     * If the camera is currently rotating, it stops the rotation. Otherwise, it focuses
     * on the specified point of interest (POI).
     *
     * Postconditions:
     * - Camera rotation is stopped if it was active.
     * - The context menu is hidden.
     */
    const rotationAround = async () => {
        _current = pois.list.get(pois.current)
        const camera = snapshot(lgs.mainProxy.components.camera)

        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            _current.stopAnimation().id
        }
        else {
            __.ui.sceneManager.focus(_current, {
                target: _current,
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:  camera.position.range,
                infinite:   true,
                rotate:     true,
                rpm:    lgs.settings.ui.poi.rpm,
                panoramic:  false,
                flyingTime: 0,    // no move, no time ! We're on target
            })
        }
        hideMenu()
        _current = _current.startAnimation()
    }

    const stopRotation = async () => {
        hideMenu()

        await __.ui.cameraManager.stopRotate()
        __.ui.poiManager.updatePOI(pois.current, {
            animated: false,
        }).then(() => hideMenu())

        _current = _current.stopAnimation()
    }

    const setAsStarter = async () => {
        const {former, starter} = await __.ui.poiManager.setStarter(_current)
        if (starter) {
            UIToast.success({
                                caption: `${current.title}`,
                                text:    'Set as new starter POI.',
                            })
        }
        else {
            UIToast.warning({
                                caption: `${current.title}`,
                                text:    'Change failed.',
                            })
        }
        hideMenu()
    }

    /**
     * Toggles panoramic mode for the camera manager. Stops camera rotation if it is currently rotating,
     * then activates the panoramic view. Also hides the menu upon activation.
     *
     * Postconditions:
     * - The context menu is hidden.
     */
    const panoramic = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            //__.ui.poiManager.stopAnimation(pois.current.id)
        }
        __.ui.cameraManager.panoramic()
        hideMenu()
    }

    /**
     * Copies the coordinates (latitude,longitude of the currently selected point of interest (POI) to the clipboard.
     *
     * Postconditions:
     * - The context menu is hidden.
     */
    const copy = () => {
        __.ui.poiManager.copyCoordinatesToClipboard(_current)
            .then(() => {
                UIToast.success({
                                    caption: `${_current.title}`,
                                    text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                                })
            })
            .then(() => hideMenu())
    }

    /**
     * Removes the current Point of Interest (POI) and associated UI elements.
     *
     * Postconditions:
     * - Camera rotation is stopped if it was active.
     * - The context menu is hidden.
     */
    const remove = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }

        __.ui.poiManager.remove({id: pois.current})
            .then((result) => {
                hideMenu()
                if (result.success) {
                    $pois.filtered.global.delete(result.id)
                    $pois.filtered.journey.delete(result.id)
                    $pois.bulkList.delete(result.id)
                    $pois.current = false
                }
            })
    }

    /**
     * We open the POI Edit drawer and the current POI settings
     */
    const openEdit = () => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: pois.current,
            tab:    'pois',
        })
        hideMenu()
    }

    useEffect(() => {
                  Timeout.set(
                      pois.context.timer,
                      hideMenu,
                      SECOND,
                  )
                  return () => {
                      Timeout.clear(pois.context.timer)
                  }
              }
        , [pois.context.visible, _current])

    return (
        <>
            {pois.current && _current &&
                <SlPopup placement="right-start"
                         hover-bridge flip
                         ref={anchor}
                         anchor={LGS_CONTEXT_MENU_HOOK}
                         active={pois.context.visible}
                >
                    <div className="lgs-context-menu poi-on-map-menu lgs-card on-map"
                         onPointerLeave={() => {
                             Timeout.restart(pois.context.timer)
                         }}
                         onPointerEnter={() => {
                             Timeout.pause(pois.context.timer)
                         }}
                    >
                        {!_current.expanded &&
                            <>
                                <div className="context-menu-title-when-reduced">
                                    {_current.title ?? 'Point Of Interest'}
                                    <SlDivider/>
                                </div>

                            </>
                        }
                        <ul>


                            {_current.type === undefined &&
                                <li onClick={saveAsPOI}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDot)}></SlIcon>
                                    <span>{'Save as POI'}</span>
                                </li>
                            }
                            {_current.type !== POI_STARTER_TYPE &&
                                <li onClick={setAsStarter}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFlag)}></SlIcon>
                                    <span>{'Set as Starter'}</span>
                                </li>
                            }
                            {_current.type !== POI_STARTER_TYPE &&
                                _current.type !== POI_FLAG_START &&
                                _current.type !== POI_FLAG_STOP &&
                                <li onClick={remove}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}></SlIcon>
                                    <span>{'Remove'}</span>
                                </li>
                            }

                            {_current.type !== POI_TMP_TYPE &&
                                <li onClick={openEdit}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationPen)}></SlIcon>
                                    <span>{'Edit'}</span>
                                </li>
                            }

                            {_current.expanded &&
                                <li onClick={shrink}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsToLine)}></SlIcon>
                                    <span>{'Reduce'}</span>
                                </li>
                            }

                            {!_current.expanded &&
                                <li onClick={expand}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                                    <span>{'Expand'}</span>
                                </li>
                            }

                            {_current.type !== POI_STARTER_TYPE &&
                                <li onClick={hide}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                                    <span>{'Hide'}</span>
                                </li>
                            }
                            <SlDivider/>
                            <li onClick={copy}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCopy)}></SlIcon>
                                <span>{'Copy Coords'}</span>
                            </li>
                            {!_current.animated && !__.ui.cameraManager.isRotating() &&
                                <>
                                    <li onClick={rotationAround}>
                                        <SlIcon slot="prefix" library="fa"
                                                name={FA2SL.set(faArrowRotateRight)}></SlIcon>
                                        <span>{'Rotate Around'}</span>
                                    </li>
                                    <li onClick={panoramic}>
                                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPanorama)}></SlIcon>
                                        <span>{'Panoramic'}</span>
                                    </li>
                                </>
                            }
                            {(_current.animated || __.ui.cameraManager.isRotating()) &&
                                <li onClick={stopRotation}>
                                    <FontAwesomeIcon icon={faArrowRotateRight} className="fa-spin"/>
                                    <span>{'Stop'}</span>
                                </li>
                            }
                        </ul>
                    </div>
                </SlPopup>
            }
        </>
    )
}