/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiTerrainOcclusionController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIUtils} from '@Utils/cesium/POIUtils'
import {Cartesian2, Cartesian3, Cartographic, JulianDate} from 'cesium'

const TERRAIN_FOCUS_DEPTH_TOLERANCE_METERS = 2

/** Resolve a constant or time-varying Cesium visibility property. */
const getVisibilityValue = (property, time) => typeof property?.getValue === 'function'
    ? property.getValue(time)
    : property

/** Read a POI's terrain-clamped focus position without sampling terrain asynchronously. */
const getPOIFocusPosition = (scene, poi) => {
    if (!Number.isFinite(poi?.longitude) || !Number.isFinite(poi?.latitude)) {
        return null
    }

    const cartographic = Cartographic.fromDegrees(poi.longitude, poi.latitude)
    const height = scene.globe.getHeight(cartographic)
        ?? (Number.isFinite(poi.simulatedHeight) ? poi.simulatedHeight : null)
        ?? (Number.isFinite(poi.height) ? poi.height : 0)

    return Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, height)
}

/** Return whether the terrain hit is closer to the camera than the POI focus. */
const isPOIFocusOccluded = (scene, camera, poi) => {
    const focusPosition = getPOIFocusPosition(scene, poi)
    const canvasPosition = focusPosition
        ? scene.cartesianToCanvasCoordinates(focusPosition, new Cartesian2())
        : null
    const canvas = scene.canvas
    const width = Number(canvas?.clientWidth) || Number(canvas?.width)
    const height = Number(canvas?.clientHeight) || Number(canvas?.height)
    if (!canvasPosition || !Number.isFinite(width) || !Number.isFinite(height)
        || canvasPosition.x < 0 || canvasPosition.x > width
        || canvasPosition.y < 0 || canvasPosition.y > height) {
        return false
    }

    const pickRay = camera.getPickRay(canvasPosition)
    if (!pickRay) {
        return false
    }

    let terrainPosition = null
    try {
        terrainPosition = scene.globe.pick(pickRay, scene)
    }
    catch {
        return false
    }
    if (!terrainPosition) {
        return false
    }

    const cameraPosition = camera.positionWC ?? camera.position
    if (!cameraPosition) {
        return false
    }

    return Cartesian3.distance(cameraPosition, terrainPosition) + TERRAIN_FOCUS_DEPTH_TOLERANCE_METERS
        < Cartesian3.distance(cameraPosition, focusPosition)
}

/** Keep POI focus occlusion transient and evaluate it only after relevant scene changes. */
export const createPOITerrainOcclusionController = ({scene, poiList, isReplayActive}) => {
    const camera = scene?.camera
    const occludedPOIIds = new Set()
    const occludedEntityContainers = new Map()
    const requestedPOIIds = new Set()
    const entitySubscriptions = new Map()
    const entitiesBeingUpdated = new Set()
    let checkAllRequested = true
    let disposed = false

    /** Resolve visibility from Replay's runtime entity state or the persisted map state. */
    const isPOIEffectivelyVisible = (poi, entity) => entity?.show === true
        && (isReplayActive?.() || poi?.visible !== false)

    /** Request an individual focus check or a full pass after scene changes. */
    const requestCheck = poiId => {
        if (disposed) {
            return
        }
        if (poiId) {
            if (!checkAllRequested) {
                requestedPOIIds.add(poiId)
            }
        }
        else {
            checkAllRequested = true
            requestedPOIIds.clear()
        }
        POIUtils.requestRender(scene)
    }

    /** Subscribe to effective POI visibility writes made outside this controller. */
    const observeEntityVisibility = (poiId, entity) => {
        const subscription = entitySubscriptions.get(poiId)
        if (subscription?.entity === entity) {
            return
        }

        subscription?.remove?.()
        const remove = entity?.definitionChanged?.addEventListener?.(() => {
            if (!entitiesBeingUpdated.has(poiId)) {
                requestCheck(poiId)
            }
        })
        entitySubscriptions.set(poiId, {entity, remove})
    }

    /** Update a billboard only when its effective visibility needs to change. */
    const setBillboardVisibility = (poiId, entity, visible, time) => {
        if (!entity?.billboard || getVisibilityValue(entity.billboard.show, time) === visible) {
            return false
        }

        entitiesBeingUpdated.add(poiId)
        try {
            entity.billboard.show = visible
        }
        finally {
            entitiesBeingUpdated.delete(poiId)
        }
        return true
    }

    /** Remove occlusion masks while preserving the POI's current effective visibility. */
    const restoreOccludedPOIs = () => {
        if (occludedPOIIds.size === 0) {
            return false
        }

        const time = JulianDate.now()
        let changed = false
        for (const poiId of occludedPOIIds) {
            const poi = poiList.get(poiId)
            const currentContainer = poi ? POIUtils.getEntityContainer(poi) : null
            const cachedContainer = occludedEntityContainers.get(poiId)
            const entity = currentContainer?.getById(poiId) ?? cachedContainer?.getById(poiId)
            if (entity?.billboard) {
                changed = setBillboardVisibility(poiId, entity, isPOIEffectivelyVisible(poi, entity), time) || changed
            }
            entitySubscriptions.get(poiId)?.remove?.()
            entitySubscriptions.delete(poiId)
        }
        occludedPOIIds.clear()
        occludedEntityContainers.clear()
        return changed
    }

    /** Reapply existing terrain masks after other POI visibility writers run. */
    const enforceOcclusionMasks = () => {
        if (disposed) {
            return
        }
        if (scene.globe?.show === false) {
            const changed = restoreOccludedPOIs()
            checkAllRequested = true
            if (changed) {
                POIUtils.requestRender(scene)
            }
            return
        }

        const time = JulianDate.now()
        let changed = false
        for (const poiId of occludedPOIIds) {
            const poi = poiList.get(poiId)
            let container = occludedEntityContainers.get(poiId)
            let entity = container?.getById(poiId)
            if (!entity && poi) {
                container = POIUtils.getEntityContainer(poi)
                entity = container?.getById(poiId)
                if (entity) {
                    occludedEntityContainers.set(poiId, container)
                }
            }
            if (!entity?.billboard) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                entitySubscriptions.get(poiId)?.remove?.()
                entitySubscriptions.delete(poiId)
                continue
            }
            if (entity.show !== true) {
                continue
            }
            observeEntityVisibility(poiId, entity)
            changed = setBillboardVisibility(poiId, entity, false, time) || changed
        }
        if (changed) {
            POIUtils.requestRender(scene)
        }
    }

    /** Recompute focus visibility once after a camera, terrain, or POI update. */
    const updateOcclusion = () => {
        if (disposed || (!checkAllRequested && requestedPOIIds.size === 0)) {
            return
        }
        if (scene.globe?.show === false) {
            restoreOccludedPOIs()
            checkAllRequested = true
            return
        }

        const candidatePOIIds = checkAllRequested
            ? Array.from(poiList.keys())
            : Array.from(requestedPOIIds)
        checkAllRequested = false
        requestedPOIIds.clear()
        const time = JulianDate.now()
        let changed = false
        for (const poiId of candidatePOIIds) {
            const poi = poiList.get(poiId)
            const wasOccluded = occludedPOIIds.has(poiId)
            const container = poi ? POIUtils.getEntityContainer(poi) : null
            const entity = container?.getById(poiId)
            if (!entity?.billboard) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                entitySubscriptions.get(poiId)?.remove?.()
                entitySubscriptions.delete(poiId)
                continue
            }

            if (!isPOIEffectivelyVisible(poi, entity)) {
                if (wasOccluded) {
                    observeEntityVisibility(poiId, entity)
                }
                continue
            }
            if (!wasOccluded && getVisibilityValue(entity.billboard.show, time) !== true) {
                continue
            }

            const isOccluded = isPOIFocusOccluded(scene, camera, poi)
            if (isOccluded) {
                occludedPOIIds.add(poiId)
                occludedEntityContainers.set(poiId, container)
                observeEntityVisibility(poiId, entity)
                changed = setBillboardVisibility(poiId, entity, false, time) || changed
            }
            else if (wasOccluded) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                entitySubscriptions.get(poiId)?.remove?.()
                entitySubscriptions.delete(poiId)
                changed = setBillboardVisibility(poiId, entity, isPOIEffectivelyVisible(poi, entity), time) || changed
            }
        }

        if (changed) {
            POIUtils.requestRender(scene)
        }
    }

    const removePreRenderListener = scene?.preRender?.addEventListener(enforceOcclusionMasks)
    const removePostRenderListener = scene?.postRender?.addEventListener(updateOcclusion)
    // Cesium events provide change metadata; discard it so every event requests a full visibility pass.
    const removeCameraListener = camera?.changed?.addEventListener(() => requestCheck())
    const removeTerrainProviderListener = scene?.globe?.terrainProviderChanged?.addEventListener(() => requestCheck())
    const removeTerrainListener = scene?.globe?.tileLoadProgressEvent?.addEventListener(tilesRemaining => {
        if (tilesRemaining === 0) {
            requestCheck()
        }
    })
    POIUtils.requestRender(scene)

    return {
        /** Schedule one focus check for a POI, or all POIs after a scene change. */
        requestCheck,
        /** Release scene listeners and restore every POI that was temporarily hidden. */
        dispose: () => {
            if (disposed) {
                return
            }
            disposed = true
            removePreRenderListener?.()
            removePostRenderListener?.()
            removeCameraListener?.()
            removeTerrainProviderListener?.()
            removeTerrainListener?.()
            const changed = restoreOccludedPOIs()
            entitySubscriptions.forEach(subscription => subscription.remove?.())
            entitySubscriptions.clear()
            if (changed) {
                POIUtils.requestRender(scene)
            }
        },
    }
}
