/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-26
 * Last modified: 2025-02-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faCopy, faFlag, faLocationDot, faLocationPen, faPanorama, faTrashCan, faXmark,
}                                                                                from '@fortawesome/pro-regular-svg-icons'
import { faMask }                                                                from '@fortawesome/pro-solid-svg-icons'
import {
    SlIcon, SlPopup,
}                                                                                from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                 from '@Utils/FA2SL'
import { UIToast }                                                               from '@Utils/UIToast'
import React, { useRef }                                                         from 'react'
import Timeout                                                                   from 'smart-timeout'
import { snapshot, useSnapshot }                                                 from 'valtio'
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
    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)

    /**
     * Hides the menu in the application by resuming the context timer and updating visibility settings.
     */
    const hideMenu = () => {
        Timeout.resume(store.context.timer)
        store.context.visible = false
    }

    const saveAsPOI = () => {
        Object.assign(__.ui.poiManager.list.get(pois.current.id), {
            type: POI_STANDARD_TYPE,
            color: lgs.settings.ui.poi.defaultColor,
        })
        __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(pois.current.id))
            .then(() => hideMenu())
    }

    const hide = () => {
        __.ui.poiManager.hide(pois.current.id)
            .then(() => hideMenu())
    }

    const shrink = () => {
        __.ui.poiManager.shrink(pois.current.id)
            .then(() => hideMenu())
    }

    const expand = () => {
        __.ui.poiManager.expand(pois.current.id)
            .then(() => hideMenu())
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

        const camera = snapshot(lgs.mainProxy.components.camera)
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            store.current = __.ui.poiManager.stopAnimation(pois.current.id)
        }
        else {
            __.ui.sceneManager.focus(store.current, {
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:      5000,
                infinite:   true,
                rotate:     true,
                rpm: lgs.settings.ui.poi.rpm,
                panoramic:  false,
                flyingTime: 0,    // no move, no time ! We're on target
            })
        }
        hideMenu()
        store.current = __.ui.poiManager.startAnimation(pois.current.id)
    }

    const stopRotation = async () => {
        await __.ui.cameraManager.stopRotate()
        store.current = __.ui.poiManager.stopAnimation(pois.current.id)
        hideMenu()
    }

    const setAsStarter = async () => {
        const {former, starter} = await __.ui.poiManager.setStarter(pois.current)
        if (starter) {
            UIToast.success({
                                caption: `${pois.current.title}`,
                                text:    'Set as new starter POI.',
                            })
        }
        else {
            UIToast.warning({
                                caption: `${pois.current.title}`,
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
            store.current = __.ui.poiManager.stopAnimation(pois.current.id)
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
        __.ui.poiManager.copyCoordinatesToClipboard(pois.current)
            .then(() => {
                UIToast.success({
                                    caption: `${pois.current.title}`,
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
        __.ui.poiManager.remove(pois.current.id, true)
            .then(() => hideMenu())

        store.current = false

    }

    /**
     * We open the POI Edit drawer and the current POI settings
     */
    const openEdit = () => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, 'edit-current')
        hideMenu()
    }

    return (
        <>
            {pois.current &&
                <SlPopup placement="right-start"
                         hover-bridge flip
                         ref={anchor}
                         anchor={pois.current.id}
                         active={pois.context.visible}
                >
                    <div className="lgs-context-menu poi-on-map-menu lgs-card on-map"
                         onPointerLeave={() => Timeout.restart(lgs.mainProxy.components.pois.context.timer)}
                         onPointerEnter={() => Timeout.pause(lgs.mainProxy.components.pois.context.timer)}
                    >
                        <ul>
                            {pois.current.type === undefined &&
                                <li onClick={saveAsPOI}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDot)}></SlIcon>
                                    <span>Save as POI</span>
                                </li>
                            }
                            {pois.current.type !== POI_STARTER_TYPE &&
                                <li onClick={setAsStarter}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFlag)}></SlIcon>
                                    <span>Set as Starter</span>
                                </li>
                            }
                            {pois.current.type !== POI_STARTER_TYPE &&
                                <li onClick={remove}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}></SlIcon>
                                    <span>Remove</span>
                                </li>
                            }

                            {pois.current.type !== POI_TMP_TYPE &&
                            <li onClick={openEdit}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationPen)}></SlIcon>
                                <span>Edit</span>
                            </li>
                            }

                            {pois.current.expanded && !pois.current.showFlag &&
                                <li onClick={shrink}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(pois.current.icon)}></SlIcon>
                                    <span>Reduce</span>
                                </li>
                            }

                            {!pois.current.expanded &&
                                <li onClick={expand}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                                    <span>Expand</span>
                                </li>
                            }

                            {pois.current.type !== POI_STARTER_TYPE &&
                                <li onClick={hide}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                                    <span>Hide</span>
                                </li>
                            }
                            <sl-divider/>
                            <li onClick={copy}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCopy)}></SlIcon>
                                <span>Copy Coords</span>
                            </li>
                            {!pois.current.animated && !__.ui.cameraManager.isRotating() &&
                                <>
                                    <li onClick={rotationAround}>
                                        <SlIcon slot="prefix" library="fa"
                                                name={FA2SL.set(faArrowRotateRight)}></SlIcon>
                                        <span>Rotate Around</span>
                                    </li>
                                    <li onClick={panoramic}>
                                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPanorama)}></SlIcon>
                                        <span>Panoramic</span>
                                    </li>
                                </>
                            }
                            {(pois.current.animated || __.ui.cameraManager.isRotating()) &&
                                <li onClick={stopRotation}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>
                                    <span>Stop</span>
                                </li>
                            }
                        </ul>
                    </div>
                </SlPopup>
            }
        </>
    )
}