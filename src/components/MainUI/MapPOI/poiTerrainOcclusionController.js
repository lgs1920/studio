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
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIUtils} from '@Utils/cesium/POIUtils'
import {registerPOITerrainCapture} from '@Core/ui/POITerrainCapture'
import {isPOIAnchorOccludedByTerrain} from '@Core/ui/replay/ReplayPOITerrainVisibility'
import {JulianDate} from 'cesium'

/** Resolve a constant or time-varying Cesium visibility property. */
const getVisibilityValue = (property, time) => typeof property?.getValue === 'function'
    ? property.getValue(time)
    : property

/** Resolve every Cesium instance of a POI, including stale duplicates in other data sources. */
const getPOIEntityRecords = (poi, poiId, cachedContainers = []) => {
    const viewer = globalThis.lgs?.viewer
    const containers = [
        ...(poi ? [POIUtils.getEntityContainer(poi)] : []),
        ...cachedContainers,
        viewer?.entities,
    ]
    const dataSourceCount = Number(viewer?.dataSources?.length) || 0
    for (let index = 0; index < dataSourceCount; index += 1) {
        containers.push(viewer.dataSources.get(index)?.entities)
    }

    const seenContainers = new Set()
    const seenEntities = new Set()
    return containers.flatMap(container => {
        if (!container || seenContainers.has(container)) {
            return []
        }
        seenContainers.add(container)
        const entity = container.getById?.(poiId)
        if (!entity || seenEntities.has(entity)) {
            return []
        }
        seenEntities.add(entity)
        return [{container, entity}]
    })
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
    let visibilityRevision = 0

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

    /** Subscribe to visibility writes on every rendered entity instance of an occluded POI. */
    const observeEntityVisibility = (poiId, entities) => {
        let subscriptions = entitySubscriptions.get(poiId)
        if (!subscriptions) {
            subscriptions = new Map()
            entitySubscriptions.set(poiId, subscriptions)
        }

        const currentEntities = new Set(entities)
        for (const [entity, remove] of subscriptions) {
            if (currentEntities.has(entity)) {
                continue
            }
            remove?.()
            subscriptions.delete(entity)
        }
        currentEntities.forEach(entity => {
            if (subscriptions.has(entity)) {
                return
            }
            const remove = entity?.definitionChanged?.addEventListener?.(() => {
                if (!entitiesBeingUpdated.has(poiId)) {
                    requestCheck(poiId)
                }
            })
            subscriptions.set(entity, remove)
        })
    }

    /** Remove all visibility listeners owned by one POI mask. */
    const clearEntityVisibilityObservers = poiId => {
        const subscriptions = entitySubscriptions.get(poiId)
        subscriptions?.forEach(remove => remove?.())
        entitySubscriptions.delete(poiId)
    }

    /** Remember all collections so a removed POI can still be restored during cleanup. */
    const rememberEntityContainers = (poiId, records) => {
        let containers = occludedEntityContainers.get(poiId)
        if (!containers) {
            containers = new Set()
            occludedEntityContainers.set(poiId, containers)
        }
        records.forEach(({container}) => containers.add(container))
    }

    /** Update a billboard only when its effective visibility needs to change. */
    const setBillboardVisibility = (poiId, entity, visible, time) => {
        if (!entity?.billboard || getVisibilityValue(entity.billboard.show, time) === visible) {
            return false
        }

        entitiesBeingUpdated.add(poiId)
        try {
            entity.billboard.show = visible
            visibilityRevision += 1
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
            const records = getPOIEntityRecords(poi, poiId, occludedEntityContainers.get(poiId))
            records.forEach(({entity}) => {
                if (entity.billboard) {
                    changed = setBillboardVisibility(
                        poiId,
                        entity,
                        isPOIEffectivelyVisible(poi, entity),
                        time,
                    ) || changed
                }
            })
            clearEntityVisibilityObservers(poiId)
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
            const records = getPOIEntityRecords(poi, poiId, occludedEntityContainers.get(poiId))
                .filter(({entity}) => entity.billboard)
            if (records.length === 0) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                clearEntityVisibilityObservers(poiId)
                continue
            }
            rememberEntityContainers(poiId, records)
            observeEntityVisibility(poiId, records.map(({entity}) => entity))
            records.forEach(({entity}) => {
                if (isPOIEffectivelyVisible(poi, entity)) {
                    changed = setBillboardVisibility(poiId, entity, false, time) || changed
                }
            })
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
            const records = getPOIEntityRecords(poi, poiId, occludedEntityContainers.get(poiId))
                .filter(({entity}) => entity.billboard)
            if (records.length === 0) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                clearEntityVisibilityObservers(poiId)
                continue
            }

            const visibleRecords = records.filter(({entity}) => isPOIEffectivelyVisible(poi, entity))
            const hasVisibleBillboard = visibleRecords.some(({entity}) =>
                getVisibilityValue(entity.billboard.show, time) === true)
            if (!wasOccluded && !hasVisibleBillboard) {
                continue
            }

            const isOccluded = isPOIAnchorOccludedByTerrain(scene, camera, poi)
            if (isOccluded) {
                occludedPOIIds.add(poiId)
                rememberEntityContainers(poiId, records)
                observeEntityVisibility(poiId, records.map(({entity}) => entity))
                visibleRecords.forEach(({entity}) => {
                    changed = setBillboardVisibility(poiId, entity, false, time) || changed
                })
            }
            else if (wasOccluded) {
                occludedPOIIds.delete(poiId)
                occludedEntityContainers.delete(poiId)
                clearEntityVisibilityObservers(poiId)
                records.forEach(({entity}) => {
                    changed = setBillboardVisibility(
                        poiId,
                        entity,
                        isPOIEffectivelyVisible(poi, entity),
                        time,
                    ) || changed
                })
            }
        }

        if (changed) {
            POIUtils.requestRender(scene)
        }
    }

    // Capture must update entities before Viewer.render runs its visualizers, without camera-event throttling.
    const removeCapturePreparation = registerPOITerrainCapture(scene, () => {
        checkAllRequested = true
        updateOcclusion()
        enforceOcclusionMasks()
        return visibilityRevision
    })
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
            removeCapturePreparation()
            removePreRenderListener?.()
            removePostRenderListener?.()
            removeCameraListener?.()
            removeTerrainProviderListener?.()
            removeTerrainListener?.()
            const changed = restoreOccludedPOIs()
            entitySubscriptions.forEach(subscriptions => {
                subscriptions.forEach(remove => remove?.())
            })
            entitySubscriptions.clear()
            if (changed) {
                POIUtils.requestRender(scene)
            }
        },
    }
}
