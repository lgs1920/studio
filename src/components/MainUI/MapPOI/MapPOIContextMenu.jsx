import { POI_STANDARD_TYPE, STARTER_TYPE } from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faCopy, faFlag, faLocationDot, faLocationDotSlash, faLocationPen, faPanorama,
}                                          from '@fortawesome/pro-regular-svg-icons'
import { faMask }                          from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlPopup }                 from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                           from '@Utils/FA2SL'
import { UIToast }                         from '@Utils/UIToast'
import React, { useRef }                   from 'react'
import Timeout                             from 'smart-timeout'
import { snapshot, useSnapshot }           from 'valtio'
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
    const snap = useSnapshot(lgs.mainProxy.components.pois)

    /**
     * Hides the menu in the application by resuming the context timer and updating visibility settings.
     */
    const hideMenu = () => {
        Timeout.resume(lgs.mainProxy.components.pois.context.timer)
        lgs.mainProxy.components.pois.context.visible = false
        lgs.mainProxy.components.pois.current = false
    }

    const saveAsPOI = () => {
        Object.assign(__.ui.poiManager.list.get(snap.current.id), {
            type: POI_STANDARD_TYPE,
        })
        hideMenu()
    }

    const mask = () => {
        __.ui.poiManager.list.get(snap.current.id).visible = false
    }

    const shrink = () => {
        __.ui.poiManager.list.get(snap.current.id).expanded = false
        hideMenu()
    }

    const expand = () => {
        __.ui.poiManager.list.get(snap.current.id).expanded = true
        hideMenu()
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
    const rotationAround = () => {

        const camera = snapshot(lgs.mainProxy.components.camera)
        if (__.ui.cameraManager.isRotating()) {
            __.ui.cameraManager.stopRotate()
        }
        else {
            __.ui.sceneManager.focus(lgs.mainProxy.components.pois.current, {
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:      5000,
                infinite:   true,
                rotate:     true,
                panoramic:  false,
                flyingTime: 0,    // no move, no time ! We're on target
            })
        }
        hideMenu()
    }

    const setAsStarter = () => {
        const poi = __.ui.poiManager.setStarter(snap.current)
        if (poi) {
            UIToast.success({
                                caption: `${snap.current.title}`,
                                text:    'Set as new starter POI.',
                            })
            hideMenu()
        }
        else {
            UIToast.warning({
                                caption: `${snap.current.title}`,
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
    const panoramic = () => {
        if (__.ui.cameraManager.isRotating()) {
            __.ui.cameraManager.stopRotate()
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
        __.ui.poiManager.copyCoordinatesToClipboard(snap.current).then(() => {
            UIToast.success({
                                caption: `${snap.current.title}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
            hideMenu()
        })
    }

    /**
     * Removes the current Point of Interest (POI) and associated UI elements.
     *
     * Postconditions:
     * - Camera rotation is stopped if it was active.
     * - The context menu is hidden.
     */
    const remove = () => {
        if (__.ui.cameraManager.isRotating()) {
            __.ui.cameraManager.stopRotate()
        }

        __.ui.poiManager.remove(snap.current.id)
        hideMenu()
    }

    return (
        <>
            {snap.current &&
                <SlPopup placement="right-start"
                         hover-bridge flip
                         ref={anchor}
                         anchor={snap.current.id}
                         active={snap.context.visible}
                >
                    <div className="lgs-context-menu poi-on-map-menu lgs-card on-map"
                         onPointerLeave={() => Timeout.restart(lgs.mainProxy.components.pois.context.timer)}
                         onPointerEnter={() => Timeout.pause(lgs.mainProxy.components.pois.context.timer)}
                    >
                        <ul>
                            {snap.current.type === undefined &&
                                <li onClick={saveAsPOI}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDot)}></SlIcon>
                                    <span>Save as POI</span>
                                </li>
                            }
                            {snap.current.type !== STARTER_TYPE &&
                                <li onClick={setAsStarter}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFlag)}></SlIcon>
                                    <span>Set as Starter</span>
                                </li>
                            }
                            {snap.current.type !== STARTER_TYPE &&
                                <li onClick={remove}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDotSlash)}></SlIcon>
                                    <span>Remove</span>
                                </li>
                            }

                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationPen)}></SlIcon>
                                <span>Edit</span>
                            </li>

                            {snap.current.expanded && !snap.current.showFlag &&
                                <li onClick={shrink}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(snap.current.icon)}></SlIcon>
                                    <span>Reduce</span>
                                </li>
                            }

                            {!snap.current.expanded &&
                                <li onClick={expand}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                                    <span>Expand</span>
                                </li>
                            }

                            {snap.current.type !== STARTER_TYPE &&
                                <li onClick={mask}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                                    <span>Hide</span>
                                </li>
                            }
                            <sl-divider/>
                            <li onClick={copy}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCopy)}></SlIcon>
                                <span>Copy Coords</span>
                            </li>
                            <li onClick={rotationAround}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowRotateRight)}></SlIcon>
                                <span>Rotate Around</span>
                            </li>
                            <li onClick={panoramic}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPanorama)}></SlIcon>
                                <span>Panoramic</span>
                            </li>
                        </ul>
                    </div>
                </SlPopup>
            }
        </>
    )
}