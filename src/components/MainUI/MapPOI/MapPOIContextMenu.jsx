/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-03
 * Last modified: 2025-12-03
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
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Global context menu for Points of Interest (POI) on the map.
 * Renders once, registers itself in the ContextMenu singleton and reacts to the current POI state.
 */
export const MapPOIContextMenu = () => {
    const _menuRef = useRef(null)

    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const currentPoi = pois.list.get(pois.current)

    // Register the menu element in the global singleton once
    useEffect(() => {
        if (_menuRef.current) {
            __.ui.contextMenu.initialize(_menuRef.current)
        }
    }, [])

    // Show / hide based on visibility and current POI – no state update during render
    useEffect(() => {
        if (!pois.context.visible || !currentPoi || pois.context.position == null) {
            __.ui.contextMenu.hide()
            return
        }

        __.ui.contextMenu.showAt(pois.context.position)
    }, [pois.context.visible, pois.current, pois.context.position])

    // Hide menu after any action (safe – only calls singleton)
    const hideMenu = useCallback(() => __.ui.contextMenu.hide(), [])

    // POI actions – all updates go through managers (no direct Valtio mutation in render)
    const saveAsStandardPOI = useCallback(() => {
        __.ui.poiManager.updatePOI(pois.current, {
            type: POI_STANDARD_TYPE,
            category: POI_STANDARD_TYPE,
        })
        hideMenu()
    }, [pois.current, hideMenu])

    const setAsStarter = useCallback(async () => {
        const {starter} = await __.ui.poiManager.setStarter(currentPoi)
        UIToast[starter ? 'success' : 'warning']({
                                                     caption: currentPoi.title,
                                                     text: starter ? 'Set as new starter POI.' : 'Change failed.',
                                                 })
        hideMenu()
    }, [currentPoi, hideMenu])

    const removePOI = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        const result = await __.ui.poiManager.remove({id: pois.current})
        if (result.success) {
            // These deletions are safe – they only mutate Valtio stores that are not causing re-render of this
            // component
            $pois.filtered.global.delete(result.id)
            $pois.filtered.journey.delete(result.id)
            $pois.bulkList.delete(result.id)
            $pois.current = false
        }
        hideMenu()
    }, [pois.current, hideMenu])

    const openEditDrawer = useCallback(() => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: pois.current,
            tab: 'pois',
        })
        hideMenu()
    }, [pois.current, hideMenu])

    const toggleExpanded = useCallback(() => {
        __.ui.poiManager.updatePOI(pois.current, {expanded: !currentPoi.expanded})
        hideMenu()
    }, [pois.current, currentPoi?.expanded, hideMenu])

    const hidePOI = useCallback(() => {
        currentPoi.hide()
        hideMenu()
    }, [currentPoi, hideMenu])

    const copyCoordinates = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(currentPoi).then(() => {
            UIToast.success({
                                caption: currentPoi.title,
                                text: 'Coordinates copied to clipboard<br/>Format: latitude, longitude',
                            })
            hideMenu()
        })
    }, [currentPoi, hideMenu])

    const toggleRotation = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            currentPoi.stopAnimation()
        }
        else {
            __.ui.sceneManager.focus(currentPoi, {
                target:    currentPoi,
                heading:   lgs.mainProxy.components.camera.position.heading,
                pitch:     lgs.mainProxy.components.camera.position.pitch,
                roll:      lgs.mainProxy.components.camera.position.roll,
                range:     lgs.mainProxy.components.camera.position.range,
                infinite:  true,
                rotate:    true,
                rpm:       lgs.settings.ui.poi.rpm,
                panoramic: false,
                flyingTime: 0,
            })
            currentPoi.startAnimation()
        }
        hideMenu()
    }, [currentPoi, hideMenu])

    const startPanoramic = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.cameraManager.panoramic()
        hideMenu()
    }, [hideMenu])

    // Pre-computed flags to avoid inline logic in JSX
    const isRotating = __.ui.cameraManager.isRotating()
    const canSaveAsStandard = currentPoi?.type === undefined
    const canSetAsStarter = currentPoi?.type !== POI_STARTER_TYPE
    const canRemove = currentPoi?.type !== POI_STARTER_TYPE &&
        currentPoi?.type !== POI_FLAG_START &&
        currentPoi?.type !== POI_FLAG_STOP
    const canEdit = currentPoi?.type !== POI_TMP_TYPE
    const showRotationItem = currentPoi?.animated || isRotating

    if (!currentPoi) {
        return null
    }

    return (
        <div
            ref={_menuRef}
            id="poi-context-menu"
            className="lgs-context-menu poi-on-map-menu lgs-card on-map"
            onContextMenu={(event) => event.preventDefault()}
        >
            {!currentPoi.expanded && (
                <div className="context-menu-title-when-reduced">
                    {currentPoi.title ?? 'Point Of Interest'}
                    <SlDivider/>
                </div>
            )}

            <ul>
                {canSaveAsStandard && (
                    <li onClick={saveAsStandardPOI}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationDot)}/>
                        <span>Save as POI</span>
                    </li>
                )}

                {canSetAsStarter && (
                    <li onClick={setAsStarter}>
                        <SlIcon library="fa" name={FA2SL.set(faFlag)}/>
                        <span>Set as Starter</span>
                    </li>
                )}

                {canRemove && (
                    <li onClick={removePOI}>
                        <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        <span>Remove</span>
                    </li>
                )}

                {canEdit && (
                    <li onClick={openEditDrawer}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationPen)}/>
                        <span>Edit</span>
                    </li>
                )}

                <li onClick={toggleExpanded}>
                    <SlIcon library="fa" name={FA2SL.set(currentPoi.expanded ? faArrowsToLine : faArrowsFromLine)}/>
                    <span>{currentPoi.expanded ? 'Reduce' : 'Expand'}</span>
                </li>

                <li onClick={hidePOI}>
                    <SlIcon library="fa" name={FA2SL.set(faMaskSolid)}/>
                    <span>Hide</span>
                </li>

                <SlDivider/>

                <li onClick={copyCoordinates}>
                    <SlIcon library="fa" name={FA2SL.set(faCopy)}/>
                    <span>Copy Coords</span>
                </li>

                {showRotationItem ? (
                    <li onClick={toggleRotation}>
                        <SlSpinner/>
                        <span>Stop Rotation</span>
                    </li>
                ) : (
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
                 )}
            </ul>
        </div>
    )
}