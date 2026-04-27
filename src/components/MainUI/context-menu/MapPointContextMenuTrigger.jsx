/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPointContextMenuTrigger.jsx
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

import { CURRENT_MAP_POINT }       from '@Core/constants'
import { MapTarget }               from '@Core/MapTarget'
import { Cartographic, Math as M } from 'cesium'
import { useCallback, useEffect }  from 'react'

const MAP_POINT_PRECISION = 6

const buildMapPointId = ({longitude, latitude}) => {
    return `${CURRENT_MAP_POINT}:${longitude.toFixed(MAP_POINT_PRECISION)}:${latitude.toFixed(MAP_POINT_PRECISION)}`
}

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

export const MapPointContextMenuTrigger = () => {
    const openContextMenu = useCallback(async (event) => {
        const position = event.position ?? event.endPosition
        const target = await pickMapPointTarget(position)

        if (!target || !position) {
            return
        }

        const $contextMenu = lgs.stores.ui.contextMenu
        $contextMenu.type = 'map-point'
        $contextMenu.targetId = target
        $contextMenu.position = {x: position.x, y: position.y}
        $contextMenu.visible = true
    }, [])

    useEffect(() => {
        __.canvasEvents.onRightClick(openContextMenu, {entity: false})
        __.canvasEvents.onLongTap(openContextMenu, {entity: false})

        return () => {
            __.canvasEvents.offRightClick(openContextMenu)
            __.canvasEvents.offLongTap(openContextMenu)
        }
    }, [openContextMenu])

    return null
}
