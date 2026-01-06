/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER,
}                                                 from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faArrowsToLine, faCopy, faFlag, faLocationDot, faLocationPen, faPanorama,
    faTrashCan,
}                                                 from '@fortawesome/pro-regular-svg-icons'
import { faMask as faMaskSolid }                  from '@fortawesome/pro-solid-svg-icons'
import { SlDivider, SlIcon, SlSpinner }           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                  from '@Utils/FA2SL'
import { UIToast }                                from '@Utils/UIToast'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                            from 'valtio'

/**
 * @typedef {Object} MapPOIContextMenuProps
 * @property {React.RefObject<HTMLDivElement>} menuRef - Reference to the context menu DOM element.
 * @property {{id: string}|null} targetId - Object containing the identifier of the POI to display the menu for.
 */

/**
 * Global context menu for Points of Interest (POI) on the map.
 * This component registers itself with the ContextMenu singleton and reacts to the target POI state.
 * It is rendered conditionally based on the existence of a target POI ID passed via props.
 *
 * @component
 * @param {MapPOIContextMenuProps} props
 * @returns {JSX.Element|null}
 */
export const MapPOIContextMenu = (props) => {

    const _menuRef = props.menuRef
    const thePOI = props.targetId?.id
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    // If no target ID is provided, do not render the menu component.
    if (!thePOI) {
        return null
    }

    // Set the global POI current ID based on the target prop.
    $pois.current = thePOI

    // POI Data Access
    const $targetPoi = $pois.list.get(thePOI)
    const currentPoi = useSnapshot($targetPoi || {})

    const $contextMenu = lgs.stores.ui.contextMenu
    const contextMenu = useSnapshot($contextMenu)

    // Hide menu after any action (safe – only calls singleton)
    const hideMenu = useCallback(() => __.ui.contextMenu.hide(), [])

    /** Saves the temporary POI as a standard POI. */
    const saveAsStandardPOI = useCallback(() => {
        __.ui.poiManager.updatePOI(thePOI, {
            type: POI_STANDARD_TYPE,
            category: POI_STANDARD_TYPE,
        })
        hideMenu()
    }, [thePOI, hideMenu])

    /** Sets the current POI as the new Starter POI. */
    const setAsStarter = useCallback(async () => {
        const {starter} = await __.ui.poiManager.setStarter(currentPoi)
        UIToast[starter ? 'success' : 'warning']({
                                                     caption: currentPoi.title,
                                                     text: starter ? 'Set as new starter POI.' : 'Change failed.',
                                                 })
        hideMenu()
    }, [currentPoi, hideMenu])

    /** Removes the current POI from the map and stores. */
    const removePOI = useCallback(async () => {
        // Stop camera rotation if active before removal
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }

        const result = await __.ui.poiManager.remove({id: thePOI})
        if (result.success) {
            // Clean up global stores (safe Valtio mutations that don't cause re-render loop here)
            $pois.filtered.global.delete(result.id)
            $pois.filtered.journey.delete(result.id)
            $pois.bulkList.delete(result.id)
            $pois.current = false // Deselect the current POI
        }
        hideMenu()
    }, [thePOI, hideMenu, $pois])

    /** Opens the POI editor drawer for the current POI. */
    const openEditDrawer = useCallback(() => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: thePOI,
            tab: currentPoi?.parent ? 'pois' : null,
        })
        hideMenu()
    }, [thePOI, hideMenu])

    /** Toggles the expanded/reduced state of the POI. */
    const toggleExpanded = useCallback(() => {
        // Use currentPoi.expanded (reactive snapshot value)
        __.ui.poiManager.updatePOI(thePOI, {expanded: !currentPoi.expanded})
        hideMenu()
    }, [thePOI, currentPoi.expanded, hideMenu])

    /** Hides the current POI from the map. */
    const hidePOI = useCallback(() => {
        currentPoi.hide()
        hideMenu()
    }, [currentPoi, hideMenu])

    /** Copies the POI coordinates to the clipboard. */
    const copyCoordinates = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(currentPoi).then(() => {
            UIToast.success({
                                caption: currentPoi.title,
                                text: 'Coordinates copied to clipboard<br/>Format: latitude, longitude',
                            })
            hideMenu()
        })
    }, [currentPoi, hideMenu])

    /** Toggles camera rotation around the current POI. */
    const toggleRotation = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
            currentPoi.stopAnimation()
        }
        else {
            __.ui.sceneManager.focus(currentPoi, {
                target: currentPoi,
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

    /** Starts a panoramic rotation of the camera. */
    const startPanoramic = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.cameraManager.panoramic()
        hideMenu()
    }, [hideMenu])

    // --- Menu Rendering Logic ---

    // Ensure the menu element is initialized in the ContextMenu singleton on first mount/ref set.
    // This is crucial for the show/hide logic managed by the singleton.
    useEffect(() => {
        if (_menuRef.current) {
            __.ui.contextMenu.initialize(_menuRef.current)
        }
    }, [])

    // Show / hide based on global context state controlled by MapPOIContent
    useEffect(() => {
        // The menu must be visible in the store, we must have a current POI, and a position set.
        if (!contextMenu.visible || !currentPoi.id || contextMenu.position == null) {
            __.ui.contextMenu.hide()
            return
        }

        // This command physically positions and displays the menu on the screen.
        __.ui.contextMenu.showAt(contextMenu.position)
    }, [contextMenu.visible, currentPoi.id, contextMenu.position])


    // Pre-computed flags (using currentPoi snapshot data) to avoid inline logic in JSX
    const isRotating = __.ui.cameraManager.isRotating()
    const canSaveAsStandard = currentPoi?.type === undefined
    const canSetAsStarter = currentPoi?.type !== POI_STARTER_TYPE && !canSaveAsStandard
    const canRemove = currentPoi?.type !== POI_STARTER_TYPE &&
        currentPoi?.type !== POI_FLAG_START &&
        currentPoi?.type !== POI_FLAG_STOP
    const canEdit = currentPoi?.type !== POI_TMP_TYPE
    const showRotationItem = currentPoi?.animated || isRotating

    // Safety check: if the POI doesn't exist in the list (though targetPoiId should prevent this), return null.
    if (!currentPoi.id) {
        return null
    }

    return (
        <div
            ref={_menuRef}
            id="poi-context-menu"
            className="lgs-context-menu poi-on-map-menu lgs-card on-map"
            onContextMenu={(event) => event.preventDefault()} // Prevent native browser context menu
        >
            {!currentPoi.expanded && (
                <div className="context-menu-title-when-reduced">
                    {currentPoi.title ?? 'Point Of Interest'}
                    <SlDivider/>
                </div>
            )}

            <ul>
                {/* Save as standard POI */}
                {canSaveAsStandard && (
                    <li onClick={saveAsStandardPOI}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationDot)}/>
                        <span>{'Add to library'}</span>
                    </li>
                )}

                {/* Set as Starter */}
                {canSetAsStarter && (
                    <li onClick={setAsStarter}>
                        <SlIcon library="fa" name={FA2SL.set(faFlag)}/>
                        <span>Set as Starter</span>
                    </li>
                )}

                {/* Remove POI */}
                {canRemove && (
                    <li onClick={removePOI}>
                        <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        <span>Remove</span>
                    </li>
                )}

                {/* Edit POI */}
                {canEdit && (
                    <li onClick={openEditDrawer}>
                        <SlIcon library="fa" name={FA2SL.set(faLocationPen)}/>
                        <span>Edit</span>
                    </li>
                )}

                {/* Expand / Reduce */}
                <li onClick={toggleExpanded}>
                    <SlIcon library="fa"
                            name={FA2SL.set(currentPoi.expanded ? faArrowsToLine : faArrowsFromLine)}/>
                    <span>{currentPoi.expanded ? 'Reduce' : 'Expand'}</span>
                </li>

                {/* Hide POI */}
                <li onClick={hidePOI}>
                    <SlIcon library="fa" name={FA2SL.set(faMaskSolid)}/>
                    <span>Hide</span>
                </li>

                <SlDivider/>

                {/* Copy Coordinates */}
                <li onClick={copyCoordinates}>
                    <SlIcon library="fa" name={FA2SL.set(faCopy)}/>
                    <span>Copy Coords</span>
                </li>

                {/* Rotation / Panoramic Options */}
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
