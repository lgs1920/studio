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
import {
    poiCaptureSurfaceStore, useActivePOICaptureSurfaces,
} from '@Components/MainUI/MapPOI/poiCaptureSurfaceStore'
import {createPOITerrainOcclusionController} from '@Components/MainUI/MapPOI/poiTerrainOcclusionController'
import {getPOICanvasRenderPriority} from '@Components/MainUI/MapPOI/poiCanvasRenderPriority'
import {getReplayPOISelectorSnapshot} from '@Components/MainUI/MapPOI/replayPOISelectorStore'
import {
    isReplayPOIPresentationActive, resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {MapPOI} from '@Core/MapPOI'
import {
    normalizePOIDisplaySettings, POI_DISPLAY_DEFAULT_BORDER_RADIUS, shouldDisplayPOIField,
} from '@Core/POIDisplaySettings'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {useCallback, useEffect} from 'react'
import {subscribe, useSnapshot} from 'valtio'
import {subscribeKey} from 'valtio/utils'

const DISABLE_POI_SHIFT_HOVER_FOR_DIAGNOSTIC = true

/** Create a stable key for the fields that determine a POI's geographic position. */
const getPOIPositionSignature = poi => JSON.stringify([
    poi?.parent,
    poi?.longitude,
    poi?.latitude,
    poi?.height,
    poi?.simulatedHeight,
])

/** Return the visibility inputs that can make an existing terrain mask stale. */
const getPOIVisibilitySignature = poi => JSON.stringify([
    poi?.parent,
    poi?.visible,
    poi?.tooClose,
])

/** Return the model fields that affect a POI's captured image. */
const getPOIVisualSignature = poi => {
    const expanded = poi?.expanded === true
    const display = normalizePOIDisplaySettings(poi?.display)
    const replayActive = isReplayPOIPresentationActive()
    const displayCoordinates = expanded && shouldDisplayPOIField('coordinates', display, replayActive)
    const displayAltitude = expanded && shouldDisplayPOIField('altitude', display, replayActive)
    const displayTitleAltitude = expanded && shouldDisplayPOIField('titleAltitude', display, replayActive)
    const displayCategory = expanded && shouldDisplayPOIField('category', display, replayActive)
    const displayLocation = expanded && shouldDisplayPOIField('location', display, replayActive)
    const displayDateTime = expanded && shouldDisplayPOIField('dateTime', display, replayActive)
    const iconName = MapPOI.categoryIcon(poi?.category)
    const visualDisplay = expanded ? {
        ...display,
        borderRadius: display.borderRadius ?? POI_DISPLAY_DEFAULT_BORDER_RADIUS,
    } : null

    return JSON.stringify([
        poi?.type,
        expanded,
        poi?.title,
        displayCategory ? poi?.category : null,
        iconName,
        poi?.visible,
        poi?.tooClose,
        poi?.color,
        poi?.bgColor,
        poi?.borderColor ?? poi?.color ?? lgs.colors.poiDefault,
        poi?.background,
        visualDisplay,
        displayLocation ? poi?.location : null,
        displayAltitude ? poi?.height : null,
        displayTitleAltitude ? [poi?.height, poi?.simulatedHeight] : null,
        displayCoordinates ? [poi?.longitude, poi?.latitude] : null,
        displayDateTime ? [poi?.time, poi?.timeZone, poi?.longitude, poi?.latitude] : null,
        poi?.replay?.visible,
        expanded && replayActive ? poi?.replay : null,
    ])
}

/** Return a deduplicated POI ID set from Replay's nearby or animated collection. */
const getReplayPOIIds = (values, field) => new Set((Array.isArray(values) ? values : [])
    .map(value => field === 'nearby' ? value?.poi?.id : value)
    .filter(Boolean))

/** Compare two POI ID sets without allocating another collection. */
const arePOIIdSetsEqual = (first, second) => first.size === second.size
    && Array.from(first).every(poiId => second.has(poiId))

/** Keep Replay's established full POI capture tree while map startup uses bounded surfaces. */
const ReplayPOIContentList = ({poiList}) => {
    const poiListSnapshot = useSnapshot(poiList)

    return Array.from(poiListSnapshot.keys()).map(poiId => (
        <MapPOIContent key={poiId} poi={poiId}/>
    ))
}

/** Monitor POI interaction, capture lifecycle, and the map POI collection. */
export const MapPOIMonitor = () => {
    const $pois = lgs.stores.main.components.pois
    const replay = useSnapshot(lgs.stores.replay)
    const replayPresentationActive = isReplayPOIPresentationActive(replay)
    const activeCapturePOIs = useActivePOICaptureSurfaces()

    /** Queue one rich capture with a camera-aware score evaluated at promotion time. */
    const requestPOICapture = useCallback((poiId, {priority = false} = {}) => {
        if (isReplayPOIPresentationActive(lgs.stores.replay)) {
            poiCaptureSurfaceStore.cancel(poiId)
            return
        }

        const poi = $pois.list.get(poiId)
        const presentation = resolveReplayPOIPresentation(poi, {
            animatedPOI: getReplayPOISelectorSnapshot('animated', poiId),
        })
        if (!POIUtils.isPOIVisibleOnMap(poi, presentation.visible)) {
            poiCaptureSurfaceStore.cancel(poiId)
            return
        }

        const editorPriority = $pois.current === poiId
            || globalThis.lgs?.theJourneyEditorProxy?.poi === poiId
        const capturePriority = priority || editorPriority
        poiCaptureSurfaceStore.request(poiId, {
            priority: capturePriority,
            allowOverflow: capturePriority,
            getPriority: () => getPOICanvasRenderPriority(poiId),
            isEligible: () => !isReplayPOIPresentationActive(lgs.stores.replay)
                && POIUtils.isPOIVisibleOnMap($pois.list.get(poiId)),
        })
    }, [$pois])

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

    /** Open the POI editor when a picked Cesium entity belongs to a POI. */
    const handleEditor = useCallback((event, entity) => {
        const poiId = entity ?? event?.entityId
        if (!getPOI(poiId)) {
            return false
        }
        __.ui.contextMenu.hide()
        void Promise.resolve(openPOIEditor(poiId)).catch(error => {
            console.error(`[POI] Unable to open the editor for ${poiId}:`, error)
        })
        return true
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
            poiSubscriptions.get(poiId)?.()
            poiSubscriptions.delete(poiId)
            poiCaptureSurfaceStore.cancel(poiId)
            poiTerrainOcclusionController.requestCheck(poiId)
        }

        /** Observe POI model changes without mounting a React content tree for every item. */
        const observePOI = poiId => {
            const poi = $pois.list.get(poiId)
            if (!poi || poiSubscriptions.has(poiId)
                || isReplayPOIPresentationActive(lgs.stores.replay)) {
                return
            }

            const state = {
                positionSignature: getPOIPositionSignature(poi),
                visibilitySignature: getPOIVisibilitySignature(poi),
                visualSignature: getPOIVisualSignature(poi),
                expanded: poi.expanded === true,
            }
            requestPOICapture(poiId)
            poiTerrainOcclusionController.requestCheck(poiId)
            const unsubscribe = subscribe(poi, () => {
                const currentPOI = $pois.list.get(poiId)
                if (!currentPOI) {
                    return
                }

                let terrainFocusChanged = false
                const nextPositionSignature = getPOIPositionSignature(currentPOI)
                if (state.positionSignature !== nextPositionSignature) {
                    state.positionSignature = nextPositionSignature
                    POIUtils.updatePosition(currentPOI)
                    terrainFocusChanged = true
                }
                const nextVisibilitySignature = getPOIVisibilitySignature(currentPOI)
                if (state.visibilitySignature !== nextVisibilitySignature) {
                    state.visibilitySignature = nextVisibilitySignature
                    terrainFocusChanged = true
                }
                if (terrainFocusChanged) {
                    poiTerrainOcclusionController.requestCheck(poiId)
                }

                const visualSignature = getPOIVisualSignature(currentPOI)
                const visualChanged = state.visualSignature !== visualSignature
                state.visualSignature = visualSignature
                if (!visualChanged) {
                    return
                }

                const expanded = currentPOI.expanded === true
                const expandedChanged = state.expanded !== expanded
                state.expanded = expanded
                const replayActive = isReplayPOIPresentationActive(lgs.stores.replay)
                requestPOICapture(poiId, {
                    priority: expandedChanged || (replayActive
                        && getReplayPOISelectorSnapshot('animated', poiId)),
                })
            }, true)
            poiSubscriptions.set(poiId, unsubscribe)
        }

        const poiSubscriptions = new Map()
        const poiTerrainOcclusionController = createPOITerrainOcclusionController({
            scene: lgs.viewer?.scene ?? lgs.scene,
            poiList: $pois.list,
            isReplayActive: () => isReplayPOIPresentationActive(lgs.stores.replay),
        })

        for (const poiId of $pois.list.keys()) {
            addPOIEventListeners(poiId)
            observePOI(poiId)
        }
        const removeSubscription = subscribe($pois.list, operations => {
            operations.forEach(([operation, , value, previousValue]) => {
                if (operation === 'set' && previousValue === undefined) {
                    addPOIEventListeners(value.id)
                    observePOI(value.id)
                }
                else if (operation === 'delete') {
                    removePOIEventListeners(previousValue.id)
                }
            })
        })

        // Resolve double-clicks against the current POI store so global POIs remain editable across list updates.
        __.canvasEvents.onDoubleClick(handleEditor, {
            entity: [],
            priority: 1,
            preventLowerPriority: 'handled',
        })

        /** Rebuild only POIs whose Replay-dependent image content changed. */
        const replayStore = lgs.stores.replay
        let previousReplayActive = isReplayPOIPresentationActive(replayStore)
        let previousAnimatedIds = getReplayPOIIds(replayStore?.animatedPOIIds, 'animated')
        let previousNearbyIds = getReplayPOIIds(replayStore?.nearbyPois, 'nearby')
        let previousAnimatedSource = replayStore?.animatedPOIIds
        let previousNearbySource = replayStore?.nearbyPois
        const updateReplayPresentation = () => {
            const replayActive = isReplayPOIPresentationActive(replayStore)
            const nextAnimatedSource = replayStore?.animatedPOIIds
            const nextNearbySource = replayStore?.nearbyPois
            const nextAnimatedIds = nextAnimatedSource === previousAnimatedSource
                ? previousAnimatedIds
                : getReplayPOIIds(nextAnimatedSource, 'animated')
            const nextNearbyIds = nextNearbySource === previousNearbySource
                ? previousNearbyIds
                : getReplayPOIIds(nextNearbySource, 'nearby')
            const replayModeChanged = replayActive !== previousReplayActive
            const animatedMembershipChanged = !arePOIIdSetsEqual(previousAnimatedIds, nextAnimatedIds)
            const nearbyMembershipChanged = !arePOIIdSetsEqual(previousNearbyIds, nextNearbyIds)

            if (replayModeChanged) {
                poiTerrainOcclusionController.requestCheck()
                if (replayActive) {
                    poiSubscriptions.forEach(unsubscribe => unsubscribe())
                    poiSubscriptions.clear()
                }
                else {
                    for (const poiId of $pois.list.keys()) {
                        observePOI(poiId)
                    }
                }
            }
            if (animatedMembershipChanged) {
                for (const poiId of new Set([...previousAnimatedIds, ...nextAnimatedIds])) {
                    if (previousAnimatedIds.has(poiId) !== nextAnimatedIds.has(poiId)) {
                        requestPOICapture(poiId, {priority: replayActive})
                    }
                }
            }
            if (nearbyMembershipChanged) {
                for (const poiId of new Set([...previousNearbyIds, ...nextNearbyIds])) {
                    if (previousNearbyIds.has(poiId) !== nextNearbyIds.has(poiId)) {
                        requestPOICapture(poiId, {priority: replayActive})
                    }
                }
            }

            previousReplayActive = replayActive
            previousAnimatedIds = nextAnimatedIds
            previousNearbyIds = nextNearbyIds
            previousAnimatedSource = nextAnimatedSource
            previousNearbySource = nextNearbySource
        }
        const replaySubscriptions = replayStore
            ? ['active', 'playing', 'paused', 'clipSequenceActive', 'animatedPOIIds', 'nearbyPois']
                .map(field => subscribeKey(replayStore, field, updateReplayPresentation, true))
            : []
        let replayRuntime = replayStore?.deferredExportPlan?.runtime
        let removeReplayRuntimeSubscription = replayRuntime
            ? subscribeKey(replayRuntime, 'status', updateReplayPresentation, true)
            : null
        const removeDeferredExportSubscription = replayStore
            ? subscribeKey(replayStore, 'deferredExportPlan', () => {
                removeReplayRuntimeSubscription?.()
                replayRuntime = replayStore?.deferredExportPlan?.runtime
                removeReplayRuntimeSubscription = replayRuntime
                    ? subscribeKey(replayRuntime, 'status', updateReplayPresentation, true)
                    : null
                updateReplayPresentation()
            }, true)
            : () => {}

        /** Refresh captures when shared display inputs change outside a POI model. */
        const requestAllCaptures = () => {
            for (const poiId of $pois.list.keys()) {
                requestPOICapture(poiId)
            }
        }
        const removeUnitSubscription = subscribe(lgs.settings.unitSystem, requestAllCaptures, true)
        const removeCoordinateSubscription = subscribe(lgs.settings.coordinateSystem, requestAllCaptures, true)
        const themeObserver = typeof MutationObserver === 'function'
            ? new MutationObserver(requestAllCaptures)
            : null
        themeObserver?.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-season-theme', 'data-on-map-theme'],
        })
        themeObserver?.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-season-theme', 'data-on-map-theme'],
        })
        window.addEventListener('resize', requestAllCaptures)
        document.fonts?.addEventListener?.('loadingdone', requestAllCaptures)

        return () => {
            poiTerrainOcclusionController.dispose()
            removeSubscription()
            __.canvasEvents.offDoubleClick?.(handleEditor)
            replaySubscriptions.forEach(remove => remove())
            removeReplayRuntimeSubscription?.()
            removeDeferredExportSubscription()
            removeUnitSubscription()
            removeCoordinateSubscription()
            themeObserver?.disconnect()
            window.removeEventListener('resize', requestAllCaptures)
            document.fonts?.removeEventListener?.('loadingdone', requestAllCaptures)
            for (const poiId of $pois.list.keys()) {
                removePOIEventListeners(poiId)
            }
        }
    }, [$pois, handleEditor, handlePOIClick, handlePOIHover, handlePOIHoverEnd, handlePOIShiftHover,
        handlePOIShiftHoverEnd, handlePOIShiftUp, openContextMenu, requestPOICapture])

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
                {replayPresentationActive
                    ? <ReplayPOIContentList poiList={$pois.list}/>
                    : activeCapturePOIs.map(poiId => (
                        <MapPOIContent key={poiId} poi={poiId} managedCaptureSurface/>
                    ))}
            </div>
            <MapPOICluster/>
        </>
    )
}
