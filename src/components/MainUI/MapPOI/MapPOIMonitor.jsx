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
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOICluster } from '@Components/MainUI/MapPOI/MapPOICluster'
import { openPOIEditor } from '@Components/MainUI/MapPOI/openPOIEditor'
import {
    clearPOIHoverPreview, clearPOIHoverTitlePreview, getActivePOIHoverPreviewId,
    isPointerNearPOIHoverPreview, showPOIHoverPreview, showPOIHoverTitlePreview,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import {poiCaptureSurfaceStore} from '@Components/MainUI/MapPOI/poiCaptureSurfaceStore'
import {getReplayPOISelectorSnapshot} from '@Components/MainUI/MapPOI/replayPOISelectorStore'
import {resolveReplayPOIPresentation} from '@Core/ui/replay/JourneyReplayPOISettings'
import { useCallback, useEffect } from 'react'
import { subscribe, useSnapshot } from 'valtio'

const DISABLE_POI_SHIFT_HOVER_FOR_DIAGNOSTIC = true

/** Monitor POI interaction, capture lifecycle, and the map POI collection. */
export const MapPOIMonitor = () => {
    const $pois = lgs.stores.main.components.pois
    const poiList = useSnapshot($pois.list)
    const poiIds = Array.from(poiList.keys())

    /** Read and select one current POI from the canonical store. */
    const getPOI = useCallback(poiId => {
        return $pois.list.get(poiId)
    }, [$pois])

    /** Toggle the expanded card state for a picked POI billboard. */
    const handlePOIClick = useCallback((event, entity) => {
        const poiId = entity ?? event?.entityId
        const poi = getPOI(poiId)
        if (!poi?.id) {
            return
        }

        void Promise.resolve(__.ui.poiManager.updatePOI(
            poi.id,
            {expanded: !poi.expanded},
            {skipLocationUpdate: true},
        )).catch(error => {
            console.error(`[POI] Unable to toggle expanded state for ${poi.id}:`, error)
        })
    }, [getPOI])

    /** Open the POI editor for a double-click or double-tap. */
    const handleEditor = useCallback(async (event, entity) => {
        const poiId = entity ?? event?.entityId
        if (!getPOI(poiId)) {
            return
        }
        __.ui.contextMenu.hide()
        await openPOIEditor(poiId)
    }, [getPOI])

    /** Show the POI context menu at the current Cesium pointer position. */
    const openContextMenu = useCallback((event, entity) => {
        const poi = getPOI(entity ?? event?.entityId)
        const position = event?.position ?? event?.endPosition
        if (!poi || !position) {
            return
        }

        const contextMenu = lgs.stores.ui.contextMenu
        contextMenu.type = 'poi'
        contextMenu.visible = true
        contextMenu.position = {x: position.x, y: position.y}
        contextMenu.targetId = poi
    }, [getPOI])

    /** Show a transient title for a visible compact billboard. */
    const handlePOIHover = useCallback((event, entity) => {
        const poi = $pois.list.get(entity ?? event?.entityId)
        if (!poi || poi.tooClose === true) {
            return
        }
        const presentation = resolveReplayPOIPresentation(poi, {
            animatedPOI: getReplayPOISelectorSnapshot('animated', poi.id),
        })
        if (presentation.visible) {
            showPOIHoverTitlePreview(poi)
        }
    }, [$pois])

    /** Clear the transient POI title when the pointer leaves its billboard. */
    const handlePOIHoverEnd = useCallback((event, entity) => {
        clearPOIHoverTitlePreview(entity ?? event?.entityId)
    }, [])

    /** Show the diagnostic Shift preview while the pointer is over a compact POI. */
    const handlePOIShiftHover = useCallback((event, entity) => {
        const poi = $pois.list.get(entity ?? event?.entityId)
        if (poi && !poi.expanded) {
            showPOIHoverPreview(poi)
        }
    }, [$pois])

    /** Clear the diagnostic Shift preview after the pointer leaves its POI. */
    const handlePOIShiftHoverEnd = useCallback((event, entity) => {
        const poiId = entity ?? event?.entityId
        const position = event?.endPosition ?? event?.position
        const canvasRect = lgs.viewer?.canvas?.getBoundingClientRect()
        if (poiId && position && canvasRect) {
            const nearPOI = isPointerNearPOIHoverPreview(
                poiId,
                canvasRect.left + position.x,
                canvasRect.top + position.y,
            )
            if (nearPOI !== false) {
                return
            }
        }
        clearPOIHoverPreview(poiId)
    }, [])

    /** Clear the diagnostic Shift preview after the Shift key is released. */
    const handlePOIShiftUp = useCallback(() => {
        clearPOIHoverPreview()
    }, [])

    useEffect(() => {
        /** Bind persistent Cesium interactions independently from capture DOM lifecycle. */
        const addPOIEventListeners = poiId => {
            __.canvasEvents.onClick(handlePOIClick, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.onTap(handlePOIClick, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.onDoubleClick(handleEditor, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.onDoubleTap(handleEditor, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.onRightClick(openContextMenu, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.onLongTap(openContextMenu, {entity: poiId, preventLowerPriority: true})
            __.canvasEvents.on('MOUSE_ENTER', handlePOIHover, {entity: poiId})
            __.canvasEvents.on('MOUSE_LEAVE', handlePOIHoverEnd, {entity: poiId})
            if (!DISABLE_POI_SHIFT_HOVER_FOR_DIAGNOSTIC) {
                /** Preserve the legacy per-POI key-down closure without enabling Shift-hover by default. */
                const handlePOIShiftDown = () => handlePOIShiftHover(null, poiId)
                __.canvasEvents.on('SHIFT#MOUSE_ENTER', handlePOIShiftHover, {entity: poiId})
                __.canvasEvents.on('SHIFT#MOUSE_LEAVE', handlePOIShiftHoverEnd, {entity: poiId})
                __.canvasEvents.onKeyDown(handlePOIShiftDown, {entity: poiId, keys: ['shift']})
                __.canvasEvents.onKeyUp(handlePOIShiftUp, {entity: false, keys: ['shift']})
            }
        }
        /** Remove interactions and pending capture ownership when a POI leaves the collection. */
        const removePOIEventListeners = poiId => {
            __.canvasEvents.removeAllListenersByEntity(poiId)
            __.canvasEvents.offKeyUp(handlePOIShiftUp)
            clearPOIHoverTitlePreview(poiId)
            poiCaptureSurfaceStore.cancel(poiId)
        }

        for (const poiId of $pois.list.keys()) {
            addPOIEventListeners(poiId)
        }
        const removeSubscription = subscribe($pois.list, operations => {
            operations.forEach(([operation, , value, previousValue]) => {
                if (operation === 'set' && previousValue === undefined) {
                    addPOIEventListeners(value.id)
                }
                else if (operation === 'delete') {
                    removePOIEventListeners(previousValue.id)
                }
            })
        })

        return () => {
            removeSubscription()
            for (const poiId of $pois.list.keys()) {
                removePOIEventListeners(poiId)
            }
        }
    }, [$pois, handleEditor, handlePOIClick, handlePOIHover, handlePOIHoverEnd, handlePOIShiftHover,
        handlePOIShiftHoverEnd, handlePOIShiftUp, openContextMenu])

    useEffect(() => {
        const canvas = lgs.viewer?.canvas
        /** Clear the hidden Shift preview before map picking handles a click or drag. */
        const clearActivePreview = () => clearPOIHoverPreview()
        /** Clear all hover state when the pointer leaves the viewer or the window loses focus. */
        const clearHoverState = () => {
            clearActivePreview()
            clearPOIHoverTitlePreview()
        }
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
                clearActivePreview()
            }
        }

        document.addEventListener('pointerdown', clearActivePreview, true)
        document.addEventListener('pointermove', clearPreviewOutsidePOI, true)
        document.addEventListener('keyup', clearPreviewOnShiftUp, true)
        canvas?.addEventListener('pointerleave', clearHoverState)
        window.addEventListener('blur', clearHoverState)

        return () => {
            document.removeEventListener('pointerdown', clearActivePreview, true)
            document.removeEventListener('pointermove', clearPreviewOutsidePOI, true)
            document.removeEventListener('keyup', clearPreviewOnShiftUp, true)
            canvas?.removeEventListener('pointerleave', clearHoverState)
            window.removeEventListener('blur', clearHoverState)
            clearHoverState()
        }
    }, [])

    return (
        <>
            <div id="map-poi-list">
                {poiIds.map(poiId => (
                    <MapPOIContent key={poiId} poi={poiId} managedCaptureSurface/>
                ))}
            </div>
            <MapPOICluster/>
        </>
    )
}
