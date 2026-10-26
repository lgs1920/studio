/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIMonitor.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-05-09
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import { POIS_EDITOR_DRAWER } from '@Core/constants'
import {
    clearPOIHoverPreview, getActivePOIHoverPreviewId, isPointerNearPOIHoverPreview,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import { useSnapshot }        from 'valtio'
import { useEffect, useRef }  from 'react'
import { updatedDiff }        from 'deep-object-diff'

/**
 * Checks if an object is empty by verifying it has no own properties
 * @param {Object} obj - Object to check
 * @returns {boolean} True if the object has no own properties, false otherwise
 */
const isEmpty = obj => Object.keys(obj).length === 0

/**
 * React component that watches a Valtio proxy Map for MapPOI additions, removals,
 * or attribute changes, triggering draw, remove, or redraw actions
 * @returns {null} Returns null as the component has no UI
 */
export const MapPOIMonitor = () => {
    // Get reactive snapshot of the POI list from Valtio store
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const currentList = useSnapshot($pois.list)
    // Store previous POI list state for comparison
    const _previousList = useRef(new Map())
    let current = null
    const _menuMonitor = useRef(null)

    useEffect(() => {
        const canvas = lgs.viewer?.canvas
        /** Clear the transient preview before map picking handles a click or drag. */
        const clearPreview = () => clearPOIHoverPreview()
        /** Keep the preview over its original screen anchor after hiding its Cesium billboard. */
        const clearPreviewOutsidePOI = event => {
            const poiId = getActivePOIHoverPreviewId()
            if (!poiId) {
                return
            }

            const nearPOI = isPointerNearPOIHoverPreview(poiId, event.clientX, event.clientY)
            if (nearPOI === false) {
                clearPOIHoverPreview(poiId)
            }
        }
        /** Clear the transient preview when Shift is released outside the focused canvas. */
        const clearPreviewOnShiftUp = event => {
            if (event.key.toLowerCase() === 'shift') {
                clearPreview()
            }
        }

        document.addEventListener('pointerdown', clearPreview, true)
        document.addEventListener('pointermove', clearPreviewOutsidePOI, true)
        document.addEventListener('keyup', clearPreviewOnShiftUp, true)
        canvas?.addEventListener('pointerleave', clearPreview)
        window.addEventListener('blur', clearPreview)

        return () => {
            document.removeEventListener('pointerdown', clearPreview, true)
            document.removeEventListener('pointermove', clearPreviewOutsidePOI, true)
            document.removeEventListener('keyup', clearPreviewOnShiftUp, true)
            canvas?.removeEventListener('pointerleave', clearPreview)
            window.removeEventListener('blur', clearPreview)
            clearPreview()
        }
    }, [])

    /**
     * Get POI by id and set current poi.
     *
     * @param id
     * @return {*}
     */
    const getPOI = (id) => {
        const current = currentList.get(id)
        $pois.current = id
        return current
    }

    /**
     * Toggle editor Handler
     *
     * For the same poi, it toggles the editor pane.
     *
     * When the editor is open on a poi  and the user double click on another one,
     * the editor stays open but focuses on th new poi data.
     *
     * @param event
     * @param entity
     */
    const handleEditor = (event, entity) => {
        if (__.ui.drawerManager.drawers.open && entity !== current) {
            __.ui.drawerManager.close()
        }
        getPOI(entity)
        __.ui.drawerManager.toggle(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: entity,
            tab:    'pois',
        })
        current = entity
    }

    /**
     * Show context menu for the selected poi.
     *
     * @param event
     * @param entity
     */
    const handleContextMenu = (event, entity) => {
        const poi = getPOI(entity)
        const isCameraBusy = __.ui.cameraManager.isRotating() || lgs.stores.ui.mainUI.panorama.active
        if (poi && !isCameraBusy
            || (isCameraBusy
                &&
                (pois.current === false || pois.current.id === poi.id)
            )) {
            __.app.hooksContextMenu(event)
            $pois.context.visible = true
        }
    }

    /**
     * Adds event listeners for a MapPOI
     * @param {MapPOI} poi - MapPOI instance to add listeners for
     */
    const addPOIEventListeners = poi => {
        // Toggles POI size on click
        __.canvasEvents.onClick(poi.toggleExpand, {entity: poi.id})
        __.canvasEvents.onTap(poi.toggleExpand, {entity: poi.id})

        // Open editor on Double Click/double tap
        __.canvasEvents.onDoubleClick(handleEditor, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onDoubleTap(handleEditor, {entity: poi.id, preventLowerPriority: true})

        // Open contextual menu on Right Click/long tap
        __.canvasEvents.onRightClick(handleContextMenu, {entity: poi.id, preventLowerPriority: true})
        __.canvasEvents.onLongTap(handleContextMenu, {entity: poi.id, preventLowerPriority: true})

        // __.canvasEvents.onKeyDown(
        //     (event, entityId, options, userData) => {
        //         if (event.altKey) { // Exclure Shift, même si Ctrl+Alt sont requis
        //             console.log('Alt+S (no Shift):', {entityId, userData})
        //         }
        //     },
        //     {modifiers: ['alt'], keys: ['s'], entity: poi.id},
        //     {action: 'save'},
        // )
    }

    /**
     * Removes event listeners for a MapPOI
     * @param {MapPOI} poi - MapPOI instance to remove listeners for
     */
    const removePOIEventListeners = poi => {
        __.canvasEvents.removeAllListenersByEntity(poi.id)
    }

    return (
        <div id="map-poi-list">
            {Array.from(currentList, ([id, poi]) => (
                <MapPOIContent key={id} poi={poi.id}/>
            ))}
        </div>
    )
}
