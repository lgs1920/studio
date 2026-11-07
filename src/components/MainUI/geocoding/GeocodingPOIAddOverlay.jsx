/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingPOIAddOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapOverlaySurface } from '@Components/MainUI/MapOverlaySurface'
import { addPOIToLibrary } from '@Components/MainUI/MapPOI/addPOIToLibrary'
import {
    $geocodingPOIAddOverlay, disposeGeocodingPOIAddOverlay, hideGeocodingPOIAddOverlay,
    startGeocodingPOIAddOverlayTimer,
} from '@Core/stores/geocodingPOIAddOverlay'
import { POI_TMP_TYPE } from '@Core/constants'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { WaButton, WaIcon } from '@awesome.me/webawesome/dist/react'
import { Cartesian2, Cartesian3 } from 'cesium'
import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import './GeocodingPOIAddOverlay.css'

/**
 * Project a POI position into coordinates relative to the Cesium viewer container.
 * @param {object} viewer - Active Cesium viewer.
 * @param {object} poi - POI with geographic coordinates and optional altitude.
 * @returns {{x: number, y: number}|null} Projected position or null when unavailable.
 */
const projectPOIPosition = (viewer, poi) => {
    const canvas = viewer?.canvas
    const container = viewer?.container
    const scene = viewer?.scene
    if (!canvas || !container || !scene || !Number.isFinite(Number(poi?.longitude))
        || !Number.isFinite(Number(poi?.latitude))) {
        return null
    }

    const height = Number.isFinite(Number(poi.simulatedHeight))
        ? Number(poi.simulatedHeight)
        : Number.isFinite(Number(poi.height)) ? Number(poi.height) : 0
    const worldPosition = Cartesian3.fromDegrees(Number(poi.longitude), Number(poi.latitude), height)
    const projected = scene.cartesianToCanvasCoordinates?.(worldPosition, new Cartesian2())
    if (!Number.isFinite(projected?.x) || !Number.isFinite(projected?.y)) {
        return null
    }

    const canvasRect = canvas.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0 || canvasRect.width <= 0 || canvasRect.height <= 0) {
        return null
    }

    return {
        x: canvasRect.left - containerRect.left + projected.x * canvasRect.width / canvas.clientWidth,
        y: canvasRect.top - containerRect.top + projected.y * canvasRect.height / canvas.clientHeight,
    }
}

/**
 * Keep the Add button inside the viewer while placing it below the projected POI.
 * @param {{x: number, y: number}} anchor - Projected POI position.
 * @param {{width: number, height: number}} viewport - Map viewport size.
 * @param {{width: number, height: number}} button - Rendered button size.
 * @returns {{x: number, y: number}} Clamped button anchor.
 */
const clampOverlayAnchor = (anchor, viewport, button) => {
    const margin = 8
    const overlayGap = 8
    const halfWidth = Math.min(button.width / 2, Math.max(0, viewport.width / 2 - margin))
    const x = Math.max(margin + halfWidth, Math.min(anchor.x, viewport.width - margin - halfWidth))
    const maximumY = Math.max(margin, viewport.height - button.height - margin - overlayGap)
    const y = Math.max(margin, Math.min(anchor.y, maximumY))
    return {x, y}
}

/** Render the timed POI Add button in a portal anchored to the Cesium map. */
export const GeocodingPOIAddOverlay = () => {
    const overlay = useSnapshot($geocodingPOIAddOverlay)
    const pois = useSnapshot(lgs.stores.main.components.pois.list)
    const poi = overlay.poiId ? pois.get(overlay.poiId) : null
    const _positioner = useRef(null)
    const [anchor, setAnchor] = useState(null)
    const [viewportRevision, setViewportRevision] = useState(0)
    const viewer = lgs.viewer
    const container = viewer?.container
    const canvas = viewer?.canvas

    useEffect(() => () => disposeGeocodingPOIAddOverlay(), [])

    const activeAnchor = anchor?.poiId === overlay.poiId ? anchor : null

    useEffect(() => {
        if (overlay.poiId && activeAnchor) {
            startGeocodingPOIAddOverlayTimer(overlay.poiId)
        }
    }, [activeAnchor, overlay.poiId])

    useLayoutEffect(() => {
        if (!overlay.poiId || !poi?.id || poi.type !== POI_TMP_TYPE || !viewer || !container || !canvas) {
            return undefined
        }

        /** Recalculate and clamp the active POI's projected screen position. */
        const refreshProjection = () => {
            const projected = projectPOIPosition(viewer, poi)
            if (!projected) {
                setAnchor(null)
                return
            }

            const containerRect = container.getBoundingClientRect()
            const buttonRect = _positioner.current?.getBoundingClientRect?.()
            const nextAnchor = clampOverlayAnchor(projected, {
                width: containerRect.width,
                height: containerRect.height,
            }, {
                width: buttonRect?.width ?? 100,
                height: buttonRect?.height ?? 40,
            })
            setAnchor(current => current?.poiId === overlay.poiId
                && current?.x === nextAnchor.x && current?.y === nextAnchor.y
                ? current
                : {poiId: overlay.poiId, ...nextAnchor})
        }

        refreshProjection()
        const removePostRender = viewer.scene.postRender.addEventListener(refreshProjection)
        const removeCameraChanged = viewer.camera.changed.addEventListener(refreshProjection)
        /** Refresh the overlay position when the map viewport changes size. */
        const handleResize = () => {
            setViewportRevision(revision => revision + 1)
            refreshProjection()
        }
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize)
        resizeObserver?.observe(container)
        window.addEventListener('resize', handleResize)

        return () => {
            removePostRender?.()
            removeCameraChanged?.()
            resizeObserver?.disconnect()
            window.removeEventListener('resize', handleResize)
        }
    }, [canvas, container, overlay.poiId, poi?.id, poi?.latitude, poi?.longitude, poi?.height,
        poi?.simulatedHeight, poi?.type, poi, viewer, viewportRevision])

    useEffect(() => {
        if (overlay.poiId && (!poi?.id || poi.type !== POI_TMP_TYPE)) {
            hideGeocodingPOIAddOverlay(overlay.poiId)
        }
    }, [overlay.poiId, poi?.id, poi?.type])

    if (!overlay.poiId || !poi?.id || poi.type !== POI_TMP_TYPE || !container) {
        return null
    }

    return createPortal(
        <div className="geocoding-poi-add-overlay-root" aria-live="polite">
            <div
                className="geocoding-poi-add-overlay-positioner"
                ref={_positioner}
                style={{
                    left: `${activeAnchor?.x ?? 0}px`,
                    top: `${activeAnchor?.y ?? 0}px`,
                    visibility: activeAnchor ? 'visible' : 'hidden',
                }}
            >
                <MapOverlaySurface className="geocoding-poi-add-overlay-surface">
                    <WaButton
                        type="button"
                        variant="brand"
                        appearance="accent"
                        size="s"
                        aria-label={UI_ACTIONS.addPOIToLibrary.label}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={event => {
                            event.stopPropagation()
                            void addPOIToLibrary(overlay.poiId)
                        }}
                    >
                        <WaIcon {...UI_ACTIONS.addPOIToLibrary.icon}/>
                        {UI_ACTIONS.addPOIToLibrary.label}
                    </WaButton>
                </MapOverlaySurface>
            </div>
        </div>,
        container,
    )
}
