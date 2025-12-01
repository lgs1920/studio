/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-01
 * Last modified: 2025-12-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    POI_FLAG_START,
    POI_FLAG_STOP,
    POI_STANDARD_TYPE,
    POI_STARTER_TYPE,
    POI_TMP_TYPE,
    POIS_EDITOR_DRAWER,
} from '@Core/constants'
import {
    faArrowRotateRight,
    faArrowsFromLine,
    faArrowsToLine,
    faCopy,
    faFlag,
    faLocationDot,
    faLocationPen,
    faMask,
    faPanorama,
    faTrashCan,
} from '@fortawesome/pro-regular-svg-icons'
import { faMask as faMaskSolid } from '@fortawesome/pro-solid-svg-icons'
import { SlDivider, SlIcon, SlSpinner } from '@shoelace-style/shoelace/dist/react'
import { FA2SL } from '@Utils/FA2SL'
import { UIToast } from '@Utils/UIToast'
import React, { useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Global context menu for Points of Interest (POI) on the map.
 * Renders once, registers in singleton, and reacts to current POI state.
 * Uses the global ContextMenu singleton for positioning and visibility.
 */
export const MapPOIContextMenu = () => {
    const _menuRef = useRef(null)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const currentPoi = pois.list.get(pois.current)

    // Register menu element in singleton once
    useEffect(() => {
        if (_menuRef.current) {
            __.ui.contextMenu.initialize(_menuRef.current)
        }
    }, [])

    // Show/hide menu based on visibility state and current POI
    useEffect(() => {
        if (!pois.context.visible || !currentPoi) {
            __.ui.contextMenu.hide()
            return
        }

        // Use stored context position or fallback to POI position
        const {x, y} = pois.context.position || {}
        const fallbackRect = currentPoi.element?.getBoundingClientRect() || {left: 0, top: 0}

        __.ui.contextMenu.showAt({
                                     x: x ?? fallbackRect.left ?? 0,
                                     y: y ?? fallbackRect.top ?? 0,
                                 })
    }, [pois.context.visible, pois.current, currentPoi, pois.context.position?.x, pois.context.position?.y])

    // Actions
    const saveAsStandardPOI = () => {
        __.ui.poiManager.updatePOI(pois.current, {
            type: POI_STANDARD_TYPE,
            category: POI_STANDARD_TYPE,
        })
        __.ui.contextMenu.hide()
    }

    const setAsStarter = async () => {
        const {starter} = await __.ui.poiManager.setStarter(currentPoi)
        UIToast[starter ? 'success' : 'warning']({
                                                     caption: currentPoi.title,
                                                     text:    starter ? 'Set as new starter POI.' : 'Change failed.',
                                                 })
        __.ui.contextMenu.hide()
    }

    const removePOI = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }

        const result = await __.ui.poiManager.remove({id: pois.current})
        if (result.success) {
            $pois.filtered.global.delete(result.id)
            $pois.filtered.journey.delete(result.id)
            $pois.bulkList.delete(result.id)
            $pois.current = false
        }
        __.ui.contextMenu.hide()
    }

    const openEditDrawer = () => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: pois.current,
            tab: 'pois',
        })
        __.ui.contextMenu.hide()
    }

    const toggleExpanded = () => {
        __.ui.poiManager.updatePOI(pois.current, {
            expanded: !currentPoi.expanded,
        }).then(() => __.ui.contextMenu.hide())
    }

    const hidePOI = () => {
        currentPoi.hide()
        __.ui.contextMenu.hide()
    }

    const copyCoordinates = () => {
        __.ui.poiManager.copyCoordinatesToClipboard(currentPoi).then(() => {
            UIToast.success({
                                caption: currentPoi.title,
                                text:    'Coordinates copied to clipboard<br/>Format: latitude, longitude',
                            })
            __.ui.contextMenu.hide()
        })
    }

    const toggleRotation = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            currentPoi.stopAnimation()
        }
        else {
            __.ui.sceneManager.focus(currentPoi, {
                target:     currentPoi,
                heading:    lgs.mainProxy.components.camera.position.heading,
                pitch:      lgs.mainProxy.components.camera.position.pitch,
                roll:       lgs.mainProxy.components.camera.position.roll,
                range:      lgs.mainProxy.components.camera.position.range,
                infinite:   true,
                rotate:     true,
                rpm:        lgs.settings.ui.poi.rpm,
                panoramic:  false,
                flyingTime: 0,
            })
            currentPoi.startAnimation()
        }
        __.ui.contextMenu.hide()
    }

    const startPanoramic = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.cameraManager.panoramic()
        __.ui.contextMenu.hide()
    }

    if (!currentPoi) {
        return null
    }

    return (
        <div
            ref={_menuRef}
            className="lgs-context-menu poi-on-map-menu lgs-card on-map"
            onContextMenu={(e) => e.preventDefault()}
        >
            {!currentPoi.expanded && (
                <div className="context-menu-title-when-reduced">
                    {currentPoi.title ?? 'Point Of Interest'}
                    <SlDivider/>
                </div>
            )}

            <ul>
                {currentPoi.type === undefined && (
                    <li onClick={saveAsStandardPOI}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationDot)}/>
                        <span>Save as POI</span>
                    </li>
                )}

                {currentPoi.type !== POI_STARTER_TYPE && (
                    <li onClick={setAsStarter}>
                        <SlIcon library="fa" name={FA2SL.set(faFlag)}/>
                        <span>Set as Starter</span>
                    </li>
                )}

                {currentPoi.type !== POI_STARTER_TYPE &&
                    currentPoi.type !== POI_FLAG_START &&
                    currentPoi.type !== POI_FLAG_STOP && (
                        <li onClick={removePOI}>
                            <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                            <span>Remove</span>
                        </li>
                    )}

                {currentPoi.type !== POI_TMP_TYPE && (
                    <li onClick={openEditDrawer}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationPen)}/>
                        <span>Edit</span>
                    </li>
                )}

                {currentPoi.expanded ? (
                    <li onClick={toggleExpanded}>
                        <SlIcon library="fa" name={FA2SL.set(faArrowsToLine)}/>
                        <span>Reduce</span>
                    </li>
                ) : (
                     <li onClick={toggleExpanded}>
                         <SlIcon library="fa" name={FA2SL.set(faArrowsFromLine)}/>
                         <span>Expand</span>
                     </li>
                 )}

                <li onClick={hidePOI}>
                    <SlIcon library="fa" name={FA2SL.set(faMaskSolid)}/>
                    <span>Hide</span>
                </li>

                <SlDivider/>

                <li onClick={copyCoordinates}>
                    <SlIcon library="fa" name={FA2SL.set(faCopy)}/>
                    <span>Copy Coords</span>
                </li>

                {!currentPoi.animated && !__.ui.cameraManager.isRotating() ? (
                    <>
                        <li onClick={toggleRotation}>
                            <SlIcon library="fa" name={FA2SL.set(faArrowRotateRight)}/>
                            <span>Rotate Around</span>
                        </li>
                        <li onClick={startPanoramic}>
                            <SlIcon library="fa" name={FA2SL.set(faPanorama)}/>
                            <span>Panoramic</span>
                        </li>
                    </>
                ) : (
                     <li onClick={toggleRotation}>
                         <SlSpinner/>
                         <span>Stop Rotation</span>
                     </li>
                 )}
            </ul>
        </div>
    )
}