/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CURRENT_POI, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER,
    ROTATION_ICON,
}                                       from '@Core/constants'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'

import { UIToast }                                from '@Utils/UIToast'
import { WaDivider, WaIcon, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { proxy, useSnapshot } from 'valtio'

const EMPTY_POI_PROXY = proxy({})

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
    const rotateState = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)

    // If no target ID is provided, do not render the menu component.
    if (!thePOI) {
        return null
    }

    // POI Data Access
    const $targetPoi = $pois.list.get(thePOI)
    const currentPoi = useSnapshot($targetPoi ?? EMPTY_POI_PROXY)

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
            await __.ui.poiManager.stopRotationAndSync()
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
    const hidePOI = useCallback(async () => {
        await __.ui.poiManager.updatePOI(thePOI, {visible: false})
        hideMenu()
    }, [thePOI, hideMenu])

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
        await __.ui.poiManager.toggleRotationAroundPOI(thePOI)
        hideMenu()
    }, [hideMenu, thePOI])

    /** Starts a panoramic rotation of the camera. */
    const startPanoramic = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.poiManager.stopRotationAndSync()
        }
        const storedPanorama = {
            ...(currentPoi.panorama ?? {}),
            ...getOrbitSettings(currentPoi, 'panorama'),
        }
        const panorama = lgs.stores.ui.mainUI.panorama
        panorama.target = {
            ...currentPoi,
            element: CURRENT_POI,
            slug:    currentPoi.slug ?? currentPoi.id,
        }
        panorama.heading = lgs.stores.main.components.camera.position.heading ?? 0
        panorama.pitch = storedPanorama.pitch ?? -12
        panorama.heightOffset = storedPanorama.heightOffset ?? 1000
        setOrbitStoreSettings(panorama, storedPanorama)
        panorama.active = true
        hideMenu()
    }, [currentPoi, hideMenu])

    const stopPanoramic = useCallback(async () => {
        await __.ui.poiManager.stopRotationAndSync()
        hideMenu()
    }, [hideMenu])

    // --- Menu Rendering Logic ---

    // Ensure the menu element is initialized in the ContextMenu singleton on first mount/ref set.
    // This is crucial for the show/hide logic managed by the singleton.
    useEffect(() => {
        if ($pois.current !== thePOI) {
            $pois.current = thePOI
        }
    }, [thePOI, $pois])

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
    const isPOIRotating = useMemo(
        () => __.ui.poiManager.isPOIRotating(thePOI),
        [thePOI, rotateState.running, rotateState.target?.element, rotateState.target?.slug, rotateState.target?.id],
    )
    const panoramaState = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const isPOIPanoramic = panoramaState.active
        && panoramaState.target?.element === CURRENT_POI
        && (panoramaState.target?.slug ?? panoramaState.target?.id) === thePOI
    const canSaveAsStandard = currentPoi?.type === undefined
    const canSetAsStarter = currentPoi?.type !== POI_STARTER_TYPE && !canSaveAsStandard
    const canRemove = currentPoi?.type !== POI_STARTER_TYPE &&
        currentPoi?.type !== POI_FLAG_START &&
        currentPoi?.type !== POI_FLAG_STOP
    const canEdit = currentPoi?.type !== POI_TMP_TYPE
    const showRotationItem = isPOIRotating || isPOIPanoramic

    // Safety check: if the POI doesn't exist in the list (though targetPoiId should prevent this), return null.
    if (!currentPoi.id) {
        return null
    }

    return (
        <div
            ref={_menuRef}
            id="poi-context-menu"
            className="lgs-context-menu poi-on-map-menu lgs-card wa-theme-lgs1920-on-map"
            style={{'--lgs-on-map-ui-opacity': toolbars.opacity}}
            onContextMenu={(event) => event.preventDefault()} // Prevent native browser context menu
        >
            {!currentPoi.expanded && (
                <div className="context-menu-title-when-reduced">
                    {currentPoi.title ?? 'Point Of Interest'}
                    <WaDivider/>
                </div>
            )}

            <ul>
                {/* Save as standard POI */}
                {canSaveAsStandard && (
                    <li onClick={saveAsStandardPOI}>
                        <WaIcon name="location-dot" variant="regular"/>{'Add to library'}
                    </li>
                )}

                {/* Set as Starter */}
                {canSetAsStarter && (
                    <li onClick={setAsStarter}>
                        <WaIcon name="flag" variant="regular"/>{'Set as Starter'}
                    </li>
                )}

                {/* Remove POI */}
                {canRemove && (
                    <li onClick={removePOI}>
                        <WaIcon name="trash-can" variant="regular"/>{'Remove'}
                    </li>
                )}

                {/* Edit POI */}
                {canEdit && (
                    <li onClick={openEditDrawer}>
                        <WaIcon name="location-pen" variant="regular"/>{'Edit'}
                    </li>
                )}

                {/* Expand / Reduce */}
                <li onClick={toggleExpanded}>
                    <WaIcon name={currentPoi.expanded ? 'arrows-to-line' : 'arrows-from-line'}/>
                    {currentPoi.expanded ? 'Reduce' : 'Expand'}
                </li>

                {/* Hide POI */}
                <li onClick={hidePOI}>
                    <WaIcon name="mask" variant="solid"/>{'Hide'}
                </li>

                <WaDivider/>

                {/* Copy Coordinates */}
                <li onClick={copyCoordinates}>
                    <WaIcon name="copy" variant="regular"/>{'Copy Coords'}
                </li>

                {/* Rotation / Panoramic Options */}
                {showRotationItem ? (
                    <li onClick={isPOIPanoramic ? stopPanoramic : toggleRotation}>
                        <WaIcon name={ROTATION_ICON} animation="spin" variant="regular"/>
                        {isPOIPanoramic ? 'Stop Panorama' : 'Stop Rotation'}
                    </li>
                ) : (
                     <>
                         <li onClick={toggleRotation}>
                             <WaIcon name={ROTATION_ICON} variant="regular"/>{'Rotate Around'}
                         </li>
                         <li onClick={startPanoramic}>
                             <WaIcon name="panorama" variant="regular"/>{'Panoramic'}
                         </li>
                     </>
                 )}
            </ul>
        </div>
    )
}
