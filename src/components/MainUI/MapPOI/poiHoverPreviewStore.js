/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiHoverPreviewStore.js
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

import { POIUtils } from '@Utils/cesium/POIUtils'

let activePOIId = null
let activePOIPosition = null
const listenersByPOI = new Map()

/** Notify only the POI components whose preview state changed. */
const notify = (...poiIds) => {
    new Set(poiIds.filter(Boolean)).forEach(poiId => {
        listenersByPOI.get(poiId)?.forEach(listener => listener())
    })
}

/** Get the ID of the POI currently shown as an expanded DOM preview. */
export const getPOIHoverPreview = poiId => activePOIId === poiId

/** Get the owner of the single active hover preview, if any. */
export const getActivePOIHoverPreviewId = () => activePOIId

/** Subscribe to changes in the active expanded POI preview. */
export const subscribeToPOIHoverPreview = (poiId, listener) => {
    if (!poiId) {
        return () => {}
    }

    const listeners = listenersByPOI.get(poiId) ?? new Set()
    listeners.add(listener)
    listenersByPOI.set(poiId, listeners)
    return () => {
        listeners.delete(listener)
        if (!listeners.size) {
            listenersByPOI.delete(poiId)
        }
    }
}

/** Keep the screen anchor current without triggering a React render. */
export const setPOIHoverPreviewPosition = (poiId, x, y) => {
    if (activePOIId === poiId) {
        activePOIPosition = {x, y}
    }
}

/** Check whether a pointer event remains close to the hidden billboard anchor. */
export const isPointerNearPOIHoverPreview = (poiId, x, y, radius = 30) => {
    if (activePOIId !== poiId) {
        return false
    }
    if (!activePOIPosition) {
        return null
    }

    return Math.hypot(x - activePOIPosition.x, y - activePOIPosition.y) <= radius
}

/** Check whether a POI currently owns the expanded DOM preview. */
export const isPOIHoverPreviewActive = poiId => activePOIId === poiId

/** Resolve the Cesium entity for the currently stored POI. */
const getPOIEntity = poi => POIUtils.getEntityContainer(poi)?.getById(poi?.id) ?? null

/** Restore a POI entity according to its current application and Replay visibility. */
const restorePOIEntity = poi => {
    const entity = getPOIEntity(poi)
    if (!entity) {
        return
    }

    const visible = POIUtils.setPOIVisibility(poi, poi.visible !== false)
    entity.show = visible
    if (entity.billboard) {
        entity.billboard.show = visible
    }
}

/**
 * Show a collapsed, visible POI as a DOM preview and hide its Cesium billboard.
 *
 * @param {object} poi - POI represented by the picked Cesium entity.
 * @returns {boolean} Whether the POI became the active preview.
 */
export const showPOIHoverPreview = poi => {
    if (!poi?.id || poi.expanded === true || POIUtils.setPOIVisibility(poi, true) !== true) {
        return false
    }

    if (activePOIId === poi.id) {
        return true
    }

    clearPOIHoverPreview()

    const entity = getPOIEntity(poi)
    if (!entity) {
        return false
    }

    entity.show = false
    if (entity.billboard) {
        entity.billboard.show = false
    }

    activePOIId = poi.id
    activePOIPosition = null
    notify(activePOIId)
    globalThis.lgs?.scene?.requestRender?.()
    return true
}

/**
 * Remove the DOM preview and restore the Cesium entity when its POI remains available.
 *
 * @param {string|null} [poiId] - Optional POI ID that must own the preview.
 * @returns {boolean} Whether an active preview was cleared.
 */
export const clearPOIHoverPreview = (poiId = null) => {
    if (!activePOIId || (poiId && activePOIId !== poiId)) {
        return false
    }

    const previousPOIId = activePOIId
    activePOIId = null
    activePOIPosition = null
    const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get(previousPOIId)
    if (poi) {
        restorePOIEntity(poi)
    }

    notify(previousPOIId)
    globalThis.lgs?.scene?.requestRender?.()
    return true
}
