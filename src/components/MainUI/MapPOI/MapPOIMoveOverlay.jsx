/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIMoveOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    calculatePOIMovePinAnchor,
    clampPOIMovePoint,
    measurePOIMoveMarkerGeometry,
    placePOIMoveOverlay,
} from '@Components/MainUI/MapPOI/poiMoveGeometry'
import { $poiMove, getPOIMoveSession, startPOIMove, subscribeToPOIMove } from '@Components/MainUI/MapPOI/poiMoveStore'
import { stylePOIDuotoneIcon } from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { POI_TMP_TYPE } from '@Core/constants'
import { isCesiumInputBlocked } from '@Core/events/CesiumInputGate'
import { POIUtils } from '@Utils/cesium/POIUtils'
import { ELEVATION_UNITS, UnitUtils } from '@Utils/UnitUtils'
import { UIToast } from '@Utils/UIToast'
import { WaButton } from '@awesome.me/webawesome/dist/react'
import { Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Property, JulianDate } from 'cesium'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

const MOVE_OVERLAY_GAP = 8
const DEFAULT_MARKER_GEOMETRY = {
    anchorOffset: {x: 0, y: 0},
    markerBounds: {left: -19, top: -19, right: 19, bottom: 19},
}

/**
 * Read the current entity position for the active move session.
 *
 * @param {object} viewer - Cesium viewer.
 * @param {object} entity - Cesium POI entity.
 * @returns {object|null} World position or null when unavailable.
 */
const currentEntityPosition = (viewer, entity) => Property.getValueOrUndefined(
    entity?.position,
    viewer?.clock?.currentTime ?? JulianDate.now(),
)

/**
 * Convert a world position to map-viewport pixels.
 *
 * @param {object} viewer - Cesium viewer.
 * @param {object} worldPosition - Cesium Cartesian position.
 * @returns {{x: number, y: number}|null} Position relative to the viewer container.
 */
const projectWorldPosition = (viewer, worldPosition) => {
    const canvas = viewer?.canvas
    const container = viewer?.container
    const projected = viewer?.scene?.cartesianToCanvasCoordinates?.(worldPosition, new Cartesian2())
    if (!canvas || !container || !Number.isFinite(projected?.x) || !Number.isFinite(projected?.y)) {
        return null
    }

    const canvasRect = canvas.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0 || canvasRect.width <= 0 || canvasRect.height <= 0) {
        return null
    }

    // Cesium projects into canvas CSS pixels, while canvas.width and canvas.height describe the drawing buffer.
    return {
        x: canvasRect.left - containerRect.left + projected.x * canvasRect.width / canvas.clientWidth,
        y: canvasRect.top - containerRect.top + projected.y * canvasRect.height / canvas.clientHeight,
    }
}

/**
 * Convert a pointer location into a terrain position and geographic coordinates.
 *
 * @param {object} viewer - Cesium viewer.
 * @param {number} clientX - Pointer x coordinate in browser pixels.
 * @param {number} clientY - Pointer y coordinate in browser pixels.
 * @returns {{longitude: number, latitude: number, height: number}|null} Picked terrain location.
 */
const pickTerrainLocation = (viewer, clientX, clientY) => {
    const canvas = viewer?.canvas
    const canvasRect = canvas?.getBoundingClientRect()
    const scene = viewer?.scene
    const camera = viewer?.camera
    if (!canvas || !canvasRect || !scene || !camera || canvas.clientWidth <= 0 || canvas.clientHeight <= 0
        || canvasRect.width <= 0 || canvasRect.height <= 0) {
        return null
    }

    // Camera picking and scene depth picking consume Cesium window coordinates in canvas CSS pixels.
    const position = new Cartesian2(
        (clientX - canvasRect.left) * canvas.clientWidth / canvasRect.width,
        (clientY - canvasRect.top) * canvas.clientHeight / canvasRect.height,
    )
    const ray = camera.getPickRay?.(position)
    let worldPosition = ray ? scene.globe?.pick?.(ray, scene) : null

    if (!worldPosition && scene.pickPositionSupported === true) {
        try {
            worldPosition = scene.pickPosition(position)
        }
        catch {
            worldPosition = null
        }
    }

    if (!worldPosition) {
        return null
    }

    const cartographic = Cartographic.fromCartesian(worldPosition)
    const longitude = CesiumMath.toDegrees(cartographic.longitude)
    const latitude = CesiumMath.toDegrees(cartographic.latitude)
    const height = Number.isFinite(cartographic.height) ? cartographic.height : 0

    return Number.isFinite(longitude) && Number.isFinite(latitude)
        ? {longitude, latitude, height}
        : null
}

/**
 * Render the active POI move marker and its live map-coordinate overlay.
 *
 * @returns {import('react').ReactNode|null} Portal into the Cesium viewer container.
 */
export const MapPOIMoveOverlay = () => {
    const session = useSyncExternalStore(subscribeToPOIMove, getPOIMoveSession, getPOIMoveSession)
    const $pois = lgs.stores.main.components.pois
    const poiListSnapshot = useSnapshot($pois.list)
    const poi = session?.poiId ? poiListSnapshot.get(session.poiId) ?? {} : {}
    const coordinateSettings = useSnapshot(lgs.settings.coordinateSystem)
    const unitSettings = useSnapshot(lgs.settings.unitSystem)
    const _marker = useRef(null)
    const _markerContent = useRef(null)
    const _details = useRef(null)
    const _entity = useRef(null)
    const _entityState = useRef(null)
    const _drag = useRef(null)
    const _pointerHandlers = useRef(null)
    const _suppressClick = useRef(false)
    const [anchor, setAnchor] = useState(null)
    const [candidate, setCandidate] = useState(null)
    const [overlayPoint, setOverlayPoint] = useState(null)
    const [dragging, setDragging] = useState(false)
    const [markerGeometry, setMarkerGeometry] = useState(DEFAULT_MARKER_GEOMETRY)
    const [viewportRevision, setViewportRevision] = useState(0)

    const viewer = lgs.viewer
    const container = viewer?.container
    const canvas = viewer?.canvas
    const viewportRect = canvas?.getBoundingClientRect?.()
    const containerRect = container?.getBoundingClientRect?.()
    const viewportLeft = viewportRect && containerRect ? viewportRect.left - containerRect.left : null
    const viewportTop = viewportRect && containerRect ? viewportRect.top - containerRect.top : null
    const viewportWidth = viewportRect?.width ?? null
    const viewportHeight = viewportRect?.height ?? null
    const viewport = useMemo(() => viewportLeft !== null && viewportTop !== null ? {
        left: viewportLeft,
        top: viewportTop,
        width: viewportWidth,
        height: viewportHeight,
        revision: viewportRevision,
    } : null, [viewportLeft, viewportTop, viewportWidth, viewportHeight, viewportRevision])
    const viewportBounds = useMemo(() => viewport ? {
        left: 0,
        top: 0,
        right: viewport.width,
        bottom: viewport.height,
    } : null, [viewport])
    const _viewport = useRef(viewport)
    const hasAnchor = Boolean(anchor)

    useLayoutEffect(() => {
        _viewport.current = viewport
    }, [viewport])

    /** Restore the Cesium entity's exact pre-move visibility. */
    const restoreEntityVisibility = useCallback(() => {
        const entity = _entity.current
        const previous = _entityState.current
        if (!entity || !previous) {
            return
        }

        entity.show = previous.show
        if (entity.billboard) {
            entity.billboard.show = previous.billboardShow
        }
        viewer?.scene?.requestRender?.()
        _entity.current = null
        _entityState.current = null
    }, [viewer])

    /** Release the active pointer only after clearing ownership to ignore capture-loss callbacks. */
    const clearDrag = useCallback(() => {
        const drag = _drag.current
        _drag.current = null
        setDragging(false)
        if (drag?.captureElement?.hasPointerCapture?.(drag.pointerId)) {
            drag.captureElement.releasePointerCapture(drag.pointerId)
        }
    }, [])

    /** Cancel the move without changing any POI data. */
    const cancelMove = useCallback(() => {
        clearDrag()
        $poiMove.session = null
    }, [clearDrag])

    /** Convert a container-relative world projection into map-viewport pixels. */
    const toViewportPoint = useCallback(point => {
        const activeViewport = _viewport.current
        return activeViewport
            ? {x: point.x - activeViewport.left, y: point.y - activeViewport.top}
            : point
    }, [])

    /** Clamp the geographic anchor to the map while keeping the visible POI card inside it. */
    const clampAnchor = useCallback(point => {
        const activeViewport = _viewport.current
        if (!activeViewport) {
            return point
        }

        const localPoint = toViewportPoint(point)
        const bounds = {left: 0, top: 0, right: activeViewport.width, bottom: activeViewport.height}

        return clampPOIMovePoint(localPoint, bounds, markerGeometry.markerBounds)
    }, [markerGeometry.markerBounds, toViewportPoint])

    /** Update the live anchor and terrain candidate from a pointer event. */
    const updateFromPointer = useCallback((event, drag) => {
        const containerRect = container?.getBoundingClientRect?.()
        if (!containerRect) {
            return null
        }
        const nextAnchor = clampAnchor({
            x: event.clientX - drag.offsetX - containerRect.left,
            y: event.clientY - drag.offsetY - containerRect.top,
        })
        const activeViewport = _viewport.current
        if (!activeViewport) {
            return null
        }
        const clientX = containerRect.left + (activeViewport?.left ?? 0) + nextAnchor.x
        const clientY = containerRect.top + (activeViewport?.top ?? 0) + nextAnchor.y
        const terrain = pickTerrainLocation(viewer, clientX, clientY)
        setAnchor(nextAnchor)
        setCandidate(terrain)
        return terrain
    }, [clampAnchor, container, viewer])

    /** Save the final terrain point and close the move session. */
    const commitMove = useCallback(async location => {
        if (!session?.poiId || !location) {
            cancelMove()
            return
        }

        const updates = {
            longitude: location.longitude,
            latitude: location.latitude,
            height: location.height,
            simulatedHeight: location.height,
        }
        let updatedPOI
        try {
            updatedPOI = await __.ui.poiManager.updatePOI(session.poiId, updates, {immediate: true})
            if (!updatedPOI) {
                cancelMove()
                return
            }
        }
        catch (error) {
            console.error('[POI move] Unable to save the new position:', error)
            const original = session.original
            try {
                await __.ui.poiManager.updatePOI(session.poiId, {
                    longitude: original.longitude,
                    latitude: original.latitude,
                    height: original.height,
                    simulatedHeight: original.simulatedHeight,
                }, {skipPersist: true, skipLocationUpdate: true})
            }
            catch (rollbackError) {
                console.error('[POI move] Unable to restore the original position:', rollbackError)
            }
            const entity = _entity.current
            if (entity) {
                entity.position = Cartesian3.fromDegrees(
                    original.longitude,
                    original.latitude,
                    original.simulatedHeight ?? original.height ?? 0,
                )
            }
            UIToast.error({caption: 'Move POI', text: 'Could not save the new POI position.'})
            cancelMove()
            return
        }
        const entity = _entity.current
        if (entity) {
            entity.position = Cartesian3.fromDegrees(location.longitude, location.latitude, location.height)
        }
        try {
            POIUtils.toggleVisibility(updatedPOI)
        }
        catch (error) {
            console.error('[POI move] Unable to restore POI visibility:', error)
            restoreEntityVisibility()
        }
        _entity.current = null
        _entityState.current = null
        clearDrag()
        $poiMove.session = null
    }, [cancelMove, clearDrag, restoreEntityVisibility, session])

    useLayoutEffect(() => {
        const markerContent = _markerContent.current
        if (!session?.poiId || !hasAnchor || !markerContent) {
            return undefined
        }

        const source = Array.from(document.querySelectorAll('[data-poi-canvas-source]'))
            .find(element => element.dataset.poiCanvasSource === session.poiId)
        if (!source) {
            return undefined
        }

        const clone = source.cloneNode(true)
        clone.removeAttribute('data-poi-canvas-source')
        clone.classList.add('poi-move-preview')
        markerContent.replaceChildren(clone)

        clone.querySelectorAll('wa-icon').forEach(icon => {
            void stylePOIDuotoneIcon(icon)
                .catch(error => console.error('Error styling cloned POI icon:', error))
        })

        return () => {
            if (clone.parentElement === markerContent) {
                markerContent.removeChild(clone)
            }
        }
    }, [hasAnchor, poi.id, session])

    /** Begin dragging the marker with its geographic anchor beneath the pointer. */
    const handlePointerDown = useCallback(event => {
        if (_drag.current || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        const activeViewport = _viewport.current
        const containerRect = container?.getBoundingClientRect?.()
        if (!anchor || !activeViewport || !containerRect) {
            return
        }

        const drag = {
            pointerId: event.pointerId,
            offsetX: 0,
            offsetY: 0,
            captureElement: event.currentTarget,
        }
        _drag.current = drag
        setDragging(true)
        updateFromPointer(event, drag)
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }, [anchor, container, updateFromPointer])

    /** Track the pointer while the marker owns the pointer capture. */
    const handlePointerMove = useCallback(event => {
        const drag = _drag.current
        if (!drag || drag.pointerId !== event.pointerId) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        if (drag.moved !== undefined && event.buttons === 0) {
            cancelMove()
            return
        }
        if (drag.moved === false && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) {
            drag.moved = true
        }
        if (drag.moved !== false) {
            updateFromPointer(event, drag)
        }
    }, [cancelMove, updateFromPointer])

    /** Commit a valid terrain pick when the pointer is released. */
    const handlePointerUp = useCallback(event => {
        const drag = _drag.current
        if (!drag || drag.pointerId !== event.pointerId) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        const moved = drag.moved !== false
            || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3
        if (!moved) {
            cancelMove()
            return
        }
        const location = updateFromPointer(event, drag)
        clearDrag()
        void commitMove(location)
    }, [cancelMove, clearDrag, commitMove, updateFromPointer])

    /** Cancel a drag when the browser interrupts pointer capture. */
    const handlePointerCancel = useCallback(event => {
        if (!_drag.current || _drag.current.pointerId !== event.pointerId) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        cancelMove()
    }, [cancelMove])

    useLayoutEffect(() => {
        _pointerHandlers.current = {handlePointerMove, handlePointerUp, handlePointerCancel, cancelMove}
    }, [cancelMove, handlePointerCancel, handlePointerMove, handlePointerUp])

    useEffect(() => {
        if (!canvas) {
            return undefined
        }

        /** Own Shift-drag from the original canvas press, before Cesium can begin camera navigation. */
        const startCanvasDrag = event => {
            if (!_drag.current) {
                _suppressClick.current = false
            }
            if (_drag.current || getPOIMoveSession() || event.button !== 0 || event.isPrimary === false
                || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || isCesiumInputBlocked()) {
                return
            }
            const rect = canvas.getBoundingClientRect()
            if (!rect.width || !rect.height) {
                return
            }
            const picked = viewer.scene.pick(new Cartesian2(
                (event.clientX - rect.left) * canvas.clientWidth / rect.width,
                (event.clientY - rect.top) * canvas.clientHeight / rect.height,
            ))
            const poiId = typeof picked?.id === 'string' ? picked.id : picked?.id?.id
            const currentPOI = $pois.list.get(poiId)
            const drag = {
                pointerId: event.pointerId,
                offsetX: 0,
                offsetY: 0,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
                captureElement: canvas,
            }
            _drag.current = drag
            if (!startPOIMove(currentPOI)) {
                _drag.current = null
                return
            }
            event.preventDefault()
            event.stopImmediatePropagation()
            _suppressClick.current = true
            setDragging(true)
            canvas.setPointerCapture?.(event.pointerId)
        }

        /** Route only the owned pointer to the overlay, even before it appears beneath the pointer. */
        const routePointer = event => {
            if (!_drag.current || _drag.current.pointerId !== event.pointerId) {
                return
            }
            const handler = event.type === 'pointermove' ? 'handlePointerMove'
                : event.type === 'pointerup' ? 'handlePointerUp' : 'handlePointerCancel'
            _pointerHandlers.current[handler](event)
        }

        /** Consume the browser click following a move so it cannot toggle the source POI. */
        const suppressMoveClick = event => {
            if (_suppressClick.current) {
                _suppressClick.current = false
                event.preventDefault()
                event.stopImmediatePropagation()
            }
        }
        /** Cancel an interrupted gesture when the browser loses focus. */
        const cancelOnBlur = () => {
            if (_drag.current) {
                _pointerHandlers.current.cancelMove()
            }
        }
        const pointerEvents = ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
        canvas.addEventListener('pointerdown', startCanvasDrag, true)
        canvas.addEventListener('click', suppressMoveClick, true)
        window.addEventListener('blur', cancelOnBlur)
        pointerEvents.forEach(type => window.addEventListener(type, routePointer, true))
        return () => {
            canvas.removeEventListener('pointerdown', startCanvasDrag, true)
            canvas.removeEventListener('click', suppressMoveClick, true)
            window.removeEventListener('blur', cancelOnBlur)
            pointerEvents.forEach(type => window.removeEventListener(type, routePointer, true))
            if (_drag.current) {
                _pointerHandlers.current.cancelMove()
            }
        }
    }, [canvas, $pois, viewer])

    useLayoutEffect(() => {
        if (!session?.poiId) {
            restoreEntityVisibility()
            return undefined
        }

        const currentPOI = $pois.list.get(session.poiId)
        if (!currentPOI || currentPOI.type === POI_TMP_TYPE || !viewer || !container || !canvas) {
            $poiMove.session = null
            return undefined
        }

        const entityContainer = POIUtils.getEntityContainer(currentPOI)
        const entity = entityContainer?.getById(session.poiId)
        const worldPosition = currentEntityPosition(viewer, entity)
        const initialAnchor = worldPosition ? projectWorldPosition(viewer, worldPosition) : null
        if (!entity || !initialAnchor || !_viewport.current) {
            $poiMove.session = null
            return undefined
        }

        _entity.current = entity
        _entityState.current = {
            show: entity.show,
            billboardShow: entity.billboard?.show,
        }
        entity.show = false
        if (entity.billboard) {
            entity.billboard.show = false
        }
        viewer.scene?.requestRender?.()
        // Preserve the real projected location on entry. Clamping here would move the pin away from its POI.
        setAnchor(toViewportPoint(initialAnchor))
        setCandidate({
            longitude: session.original.longitude,
            latitude: session.original.latitude,
            height: session.original.simulatedHeight ?? session.original.height ?? 0,
        })

        /** Reproject the stationary POI after map camera or viewport changes. */
        const refreshProjection = () => {
            if (_drag.current) {
                return
            }
            const position = currentEntityPosition(viewer, entity)
            const projected = position ? projectWorldPosition(viewer, position) : null
            if (projected) {
                setAnchor(toViewportPoint(projected))
            }
        }
        const removePostRender = viewer.scene?.postRender?.addEventListener?.(refreshProjection)
        /** Recompute viewport bounds after the viewer or browser resizes. */
        const handleResize = () => {
            setViewportRevision(revision => revision + 1)
        }
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize)
        resizeObserver?.observe(container)
        window.addEventListener('resize', handleResize)

        return () => {
            removePostRender?.()
            resizeObserver?.disconnect()
            window.removeEventListener('resize', handleResize)
            restoreEntityVisibility()
        }
    }, [canvas, container, poi.id, restoreEntityVisibility, session, $pois, toViewportPoint, viewer])

    useLayoutEffect(() => {
        if (!session?.poiId || !hasAnchor || !_marker.current) {
            return undefined
        }

        /** Anchor compact POIs at the rotated pin base and expanded POIs at their geographic connector. */
        const measureMarker = () => {
            const marker = _marker.current
            const preview = marker?.querySelector('.poi-icon-wrapper.poi-move-preview')
            const card = preview?.querySelector('.poi-card-inner')
            const geographicAnchor = preview?.querySelector('.poi-geographic-anchor')
            const hostRect = marker?.getBoundingClientRect?.()
            const previewRect = preview?.getBoundingClientRect?.()
            const cardRect = card?.getBoundingClientRect?.()
            const isCompact = preview?.classList.contains('poi-shrinked')
            const markerRect = isCompact ? cardRect : previewRect
            if (!hostRect?.width || !hostRect?.height || !markerRect?.width || !markerRect?.height
                || !cardRect?.width || !cardRect?.height) {
                return
            }
            let geographicAnchorRect = geographicAnchor?.getBoundingClientRect?.()
            if (isCompact) {
                // Rounded corners leave transparent pixels below the visible tip inside the rotated DOM bounds.
                const cardStyle = getComputedStyle(card)
                const radiusValue = parseFloat(cardStyle.borderBottomRightRadius) || 0
                const cornerRadius = cardStyle.borderBottomRightRadius.includes('%')
                    ? (parseFloat(cardStyle.width) || 0) * radiusValue / 100
                    : radiusValue
                const tip = calculatePOIMovePinAnchor(cardRect, cornerRadius)
                geographicAnchorRect = {left: tip.x, top: tip.y}
            }
            const nextGeometry = measurePOIMoveMarkerGeometry(hostRect, markerRect, cardRect, geographicAnchorRect)
            setMarkerGeometry(current => {
                const isUnchanged = current.anchorOffset.x === nextGeometry.anchorOffset.x
                    && current.anchorOffset.y === nextGeometry.anchorOffset.y
                    && current.markerBounds.left === nextGeometry.markerBounds.left
                    && current.markerBounds.top === nextGeometry.markerBounds.top
                    && current.markerBounds.right === nextGeometry.markerBounds.right
                    && current.markerBounds.bottom === nextGeometry.markerBounds.bottom
                return isUnchanged ? current : nextGeometry
            })
        }
        measureMarker()
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureMarker)
        const marker = _marker.current
        const preview = marker?.querySelector('.poi-icon-wrapper.poi-move-preview')
        const card = preview?.querySelector('.poi-card-inner')
        if (preview) {
            resizeObserver?.observe(preview)
        }
        if (card) {
            resizeObserver?.observe(card)
        }
        return () => resizeObserver?.disconnect()
    }, [hasAnchor, session?.poiId, viewportRevision])

    useLayoutEffect(() => {
        const entity = _entity.current
        if (!session?.poiId || !entity || !viewportBounds) {
            return
        }

        if (_drag.current) {
            setAnchor(current => current
                ? clampPOIMovePoint(current, viewportBounds, markerGeometry.markerBounds)
                : current)
            return
        }

        const position = currentEntityPosition(viewer, entity)
        const projected = position ? projectWorldPosition(viewer, position) : null
        if (projected) {
            setAnchor(toViewportPoint(projected))
        }
    }, [markerGeometry.markerBounds, session?.poiId, toViewportPoint, viewer, viewport, viewportBounds])

    useEffect(() => {
        if (!session?.poiId) {
            return undefined
        }

        /** Cancel the move before any unrelated global shortcut runs. */
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                cancelMove()
            }
        }
        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [cancelMove, session?.poiId])

    useEffect(() => {
        if (!dragging) {
            return undefined
        }

        document.body.classList.add('poi-move-hiding-system-cursor')
        return () => document.body.classList.remove('poi-move-hiding-system-cursor')
    }, [dragging])

    useLayoutEffect(() => {
        if (!anchor || !viewportBounds || !_details.current) {
            return
        }

        const detailsRect = _details.current.getBoundingClientRect()
        const overlaySize = {
            width: detailsRect.width || Math.min(260, viewport?.width ?? 260),
            height: detailsRect.height || 24,
        }
        const position = placePOIMoveOverlay(
            anchor,
            viewportBounds,
            markerGeometry.markerBounds,
            overlaySize,
            MOVE_OVERLAY_GAP,
        )
        setOverlayPoint(position)
    }, [anchor, candidate, markerGeometry.markerBounds, viewport, viewportBounds, unitSettings.current, coordinateSettings.current])

    if (!session || !poi.id || poi.type === POI_TMP_TYPE || !container || !viewport) {
        return null
    }

    const coordinateSystem = coordinateSettings.current
    const unitSystem = unitSettings.current
    const elevationUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]
    const latitudeLabel = candidate ? __.convert(candidate.latitude).to(coordinateSystem) : ''
    const longitudeLabel = candidate ? __.convert(candidate.longitude).to(coordinateSystem) : ''
    const elevationLabel = candidate
        ? `${Math.round(UnitUtils.convert(candidate.height).to(elevationUnit))} ${elevationUnit}`
        : ''
    const displayedPoint = anchor

    return createPortal(
        <div
            className="poi-move-overlay-root"
            style={{
                left: `${viewport.left}px`,
                top: `${viewport.top}px`,
                width: `${viewport.width}px`,
                height: `${viewport.height}px`,
            }}
        >
            {anchor && (
                <WaButton
                    ref={_marker}
                    className="poi-move-marker"
                    appearance="plain"
                    aria-label={`Move ${poi.title ?? 'POI'}`}
                    aria-pressed={dragging}
                    style={{
                        left: `${displayedPoint.x - markerGeometry.anchorOffset.x}px`,
                        top: `${displayedPoint.y - markerGeometry.anchorOffset.y}px`,
                        '--lgs-poi-background-color': poi.noBackground ? 'transparent' : poi.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color': poi.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color': poi.color ?? lgs.colors.poiDefault,
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onLostPointerCapture={handlePointerCancel}
                >
                    <div className="poi-move-marker-content" ref={_markerContent}/>
                </WaButton>
            )}
            {candidate && anchor && (
                <div
                    className="poi-move-details"
                    ref={_details}
                    style={{
                        left: `${overlayPoint?.x ?? 0}px`,
                        top: `${overlayPoint?.y ?? 0}px`,
                        visibility: overlayPoint ? 'visible' : 'hidden',
                    }}
                    aria-live="polite"
                >
                    <span>{latitudeLabel}</span>
                    <span>{longitudeLabel}</span>
                    <span>{elevationLabel}</span>
                </div>
            )}
        </div>,
        container,
    )
}
