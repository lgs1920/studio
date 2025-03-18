/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-28
 * Last modified: 2025-02-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { POI_STARTER_TYPE }                                 from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faCrosshairsSimple, faFlag, faLocationDot, faPanorama, faTrashCan, faXmark,
}                                                           from '@fortawesome/pro-regular-svg-icons'
import { faEye, faMask }                                    from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { UIToast }                                          from '@Utils/UIToast'
import { snapshot, useSnapshot }                            from 'valtio'
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
export const MapPOIEditMenu = ({point}) => {

    const pois = lgs.mainProxy.components.pois
    const settings = useSnapshot(lgs.settings.ui.poi)

    const hide = async () => {
        pois.current = await __.ui.poiManager.hide(point.id)
    }
    const show = async () => {
        pois.current = await __.ui.poiManager.show(point.id)
    }

    const shrink = async () => {
        pois.current = await __.ui.poiManager.shrink(point.id)
    }

    const expand = async () => {
        pois.current = await __.ui.poiManager.expand(point.id)
    }

    const focus = async () => {
        const camera = snapshot(lgs.mainProxy.components.camera)
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.sceneManager.focus(lgs.mainProxy.components.pois.current, {
            heading:    camera.position.heading,
            pitch:      camera.position.pitch,
            roll:       camera.position.roll,
            range: camera.position.range,
            infinite:   true,
            rotate:     false,
            panoramic:  false,
            flyingTime: 0,    // no move, no time ! We're on target
        })
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
            pois.current = await __.ui.poiManager.stopAnimation(point.id)
        }
        __.ui.sceneManager.focus(lgs.mainProxy.components.pois.current, {
            heading:    camera.position.heading,
            pitch:      camera.position.pitch,
            roll:       camera.position.roll,
            range: camera.position.range,
            infinite: true,
            rpm: lgs.settings.ui.poi.rpm,
            rotations: 1,
            rotate:   true,
            panoramic:  false,
            flyingTime: 0,    // no move, no time ! We're on target
        })
        pois.current = await __.ui.poiManager.startAnimation(point.id)

    }

    const setAsStarter = async () => {

        const {former, starter} = await __.ui.poiManager.setStarter(point)

        if (starter) {
            UIToast.success({
                                caption: `${point.title}`,
                                text:    'Set as new starter POI.',
                            })

            pois.list.set(former.id, former)
            pois.list.set(starter.id, starter)
        }
        else {
            UIToast.warning({
                                caption: `${point.title}`,
                                text:    'Change failed.',
                            })
        }
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
        }
        __.ui.cameraManager.panoramic()
        //    pois.current = await __.ui.poiManager.startAnimation(snap.current.id)

    }

    const stopRotation = async () => {
        await __.ui.cameraManager.stopRotate()
        pois.current = await __.ui.poiManager.stopAnimation(point.id)
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

        __.ui.poiManager.remove(point.id, true)
            .then((result) => {
                if (result.success) {
                    pois.filteredList.delete(result.id)
                    pois.bulkList.delete(result.id)
                    pois.current = false
                }
            })
    }

    return (    
        <>
            {(point || point.type === POI_STARTER_TYPE) &&
                <SlDropdown className={'edit-poi-menu'}>
                    <SlButton slot="trigger" caret size="small">
                        <FontAwesomeIcon slot="prefix" icon={faLocationDot}/>&nbsp;{'Select an action'}
                    </SlButton>

                    <SlMenu>
                        {!settings.focusOnEdit &&
                            <SlMenuItem onClick={focus} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCrosshairsSimple)}/>
                                <span>Focus</span>
                            </SlMenuItem>
                        }
                        {point.type !== POI_STARTER_TYPE &&
                            <SlMenuItem onClick={setAsStarter} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFlag)}></SlIcon>
                                <span>Set as Starter</span>
                            </SlMenuItem>
                        }
                        {point.type !== POI_STARTER_TYPE &&
                            <SlMenuItem onClick={remove} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}></SlIcon>
                                <span>Remove</span>
                            </SlMenuItem>
                        }

                        {point.expanded && !point.showFlag && point.visible &&
                            <SlMenuItem onClick={shrink} small>
                                <FontAwesomeIcon slot="prefix" icon={point.icon}></FontAwesomeIcon>
                                <span>Reduce</span>
                            </SlMenuItem>
                        }

                        {!point.expanded && point.visible &&
                            <SlMenuItem onClick={expand} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                                <span>Expand</span>
                            </SlMenuItem>
                        }

                        {point.type !== POI_STARTER_TYPE && point.visible &&
                            <SlMenuItem onClick={hide} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                                <span>Hide</span>
                            </SlMenuItem>
                        }
                        {point.type !== POI_STARTER_TYPE && !point.visible &&
                            <SlMenuItem onClick={show} small>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEye)}></SlIcon>
                                <span>Show</span>
                            </SlMenuItem>
                        }
                        <sl-divider/>

                        {!point.animated &&
                            <>
                                <SlMenuItem onClick={rotationAround}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowRotateRight)}></SlIcon>
                                    <span>Rotate Around</span>
                                </SlMenuItem>
                                <SlMenuItem onClick={panoramic}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPanorama)}></SlIcon>
                                    <span>Panoramic</span>
                                </SlMenuItem>
                            </>
                        }
                        {(point.animated) &&
                            <SlMenuItem onClick={stopRotation} loading>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>
                                <span>Stop</span>
                            </SlMenuItem>
                        }
                    </SlMenu>
                </SlDropdown>
            }
        </>
    )
}