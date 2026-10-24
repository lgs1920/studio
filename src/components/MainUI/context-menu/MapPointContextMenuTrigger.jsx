/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPointContextMenuTrigger.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_MAP_POINT }       from '@Core/constants'
import { MapTarget }               from '@Core/MapTarget'
import { Cartographic, Math as M } from 'cesium'
import { useCallback, useEffect, useRef } from 'react'
import { subscribeKey } from 'valtio/utils'

const MAP_POINT_PRECISION = 6

/** Build a stable identifier from the picked geographic coordinates. */
const buildMapPointId = ({longitude, latitude}) => {
    return `${CURRENT_MAP_POINT}:${longitude.toFixed(MAP_POINT_PRECISION)}:${latitude.toFixed(MAP_POINT_PRECISION)}`
}

/** Resolve the entity identifier underneath the current screen position. */
const pickedEntityId = position => {
    const picked = position ? lgs.scene?.pick?.(position) ?? lgs.viewer?.scene?.pick?.(position) : null
    const id = picked?.id
    if (!id) {
        return null
    }

    return typeof id === 'string' ? id : (id.id ?? null)
}

/** Open the context menu for an existing POI without sampling the terrain. */
const openPOIContextMenu = (position, poiId) => {
    const poi = poiId ? lgs.stores.main.components.pois.list.get(poiId) : null
    if (!poi) {
        return false
    }

    const $contextMenu = lgs.stores.ui.contextMenu
    $contextMenu.type = 'poi'
    $contextMenu.targetId = poi
    $contextMenu.position = {x: position.x, y: position.y}
    $contextMenu.visible = true
    return true
}

/** Pick the clicked location and refine its altitude without changing its coordinates. */
const pickMapPointTarget = async (position) => {
    if (!position) {
        return null
    }

    const pickRay = lgs.camera?.getPickRay?.(position)
    let cartesian = pickRay ? lgs.scene?.globe?.pick?.(pickRay, lgs.scene) : null

    if (!cartesian) {
        cartesian = lgs.viewer?.camera?.pickEllipsoid?.(position, lgs.viewer.scene.globe.ellipsoid)
    }

    if (!cartesian) {
        return null
    }

    const cartographic = Cartographic.fromCartesian(cartesian)
    if (!cartographic) {
        return null
    }

    const longitude = M.toDegrees(cartographic.longitude)
    const latitude = M.toDegrees(cartographic.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    let simulatedHeight = __.ui.sceneManager.noRelief() ? 0 : cartographic.height

    if (!__.ui.sceneManager.noRelief()) {
        try {
            const terrainHeight = await __.ui.poiManager.getHeightFromTerrain({
                                                                                  coordinates: {longitude, latitude},
                                                                              })
            if (Number.isFinite(terrainHeight)) {
                simulatedHeight = terrainHeight
            }
        }
        catch {
            // Fallback to the picked cartographic height if sampling fails.
        }
    }

    const target = new MapTarget(CURRENT_MAP_POINT, {
        id:     buildMapPointId({longitude, latitude}),
        height: simulatedHeight,
        latitude,
        longitude,
    })

    target.simulatedHeight = simulatedHeight
    target.title = 'Map point'
    return target
}

/** Register map context actions and reject obsolete asynchronous terrain results. */
export const MapPointContextMenuTrigger = () => {
    const _requestVersion = useRef(0)

    /** Cancel pending picks when a newer interaction supersedes their location. */
    const invalidatePendingRequest = useCallback(() => {
        _requestVersion.current += 1
    }, [])

    /** Publish only the latest pick while its menu and view are still current. */
    const openContextMenu = useCallback(async (event) => {
        const requestVersion = ++_requestVersion.current
        const eventPosition = event.position ?? event.endPosition
        if (!eventPosition) {
            return
        }

        // Cesium can reuse the event's Cartesian2 while terrain sampling is pending.
        const position = {x: eventPosition.x, y: eventPosition.y}
        if (openPOIContextMenu(position, pickedEntityId(position))) {
            return
        }

        const $contextMenu = lgs.stores.ui.contextMenu
        const target = await pickMapPointTarget(position)

        if (!target
            || requestVersion !== _requestVersion.current
            || $contextMenu !== lgs.stores.ui.contextMenu) {
            return
        }

        $contextMenu.type = 'map-point'
        $contextMenu.targetId = target
        $contextMenu.position = {x: position.x, y: position.y}
        $contextMenu.visible = true
    }, [])

    useEffect(() => {
        const canvasEvents = __.canvasEvents
        const removeMoveStart = lgs.camera?.moveStart?.addEventListener(invalidatePendingRequest)

        // Other entity menus bypass this callback. Nested POI edits do not replace the active menu.
        const menuUnsubscribers = ['type', 'targetId', 'position', 'visible'].map(key =>
            subscribeKey(lgs.stores.ui.contextMenu, key, invalidatePendingRequest, true))

        /** Treat Escape as dismissal even before the delayed menu has appeared. */
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                invalidatePendingRequest()
            }
        }

        canvasEvents.onRightClick(openContextMenu, {entity: false})
        canvasEvents.onLongTap(openContextMenu, {entity: false})
        document.addEventListener('pointerdown', invalidatePendingRequest, true)
        document.addEventListener('wheel', invalidatePendingRequest, {capture: true, passive: true})
        document.addEventListener('keydown', handleKeyDown, true)

        return () => {
            invalidatePendingRequest()
            canvasEvents.offRightClick(openContextMenu)
            canvasEvents.offLongTap(openContextMenu)
            document.removeEventListener('pointerdown', invalidatePendingRequest, true)
            document.removeEventListener('wheel', invalidatePendingRequest, true)
            document.removeEventListener('keydown', handleKeyDown, true)
            menuUnsubscribers.forEach(unsubscribe => unsubscribe())
            removeMoveStart?.()
        }
    }, [invalidatePendingRequest, openContextMenu])

    return null
}
