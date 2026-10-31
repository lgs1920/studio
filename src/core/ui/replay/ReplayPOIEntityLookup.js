/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPOIEntityLookup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-31
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POIUtils} from '@Utils/cesium/POIUtils'
import {poiPerformance} from '@Core/ui/POIPerformance'

const MAX_LOOKUP_ENTRIES = 2048

/** Create a session-owned POI entity lookup invalidated by Cesium collection events. */
export const createReplayPOIEntityLookup = viewer => {
    const entries = new Map()
    const staticEventRemovers = []
    const entityCollectionRemovers = new Map()
    const dataSources = viewer?.dataSources
    let disposed = false

    /** Remove one lookup result after an entity collection mutation. */
    const invalidateEntity = entity => {
        if (entity?.id && entries.delete(entity.id)) {
            poiPerformance.record('replay.entityLookupInvalidated')
        }
    }

    /** Invalidate POIs whose entity identity was added or removed. */
    const onCollectionChanged = (collection, added = [], removed = []) => {
        const affected = [...added, ...removed]
        if (affected.length === 0) {
            poiPerformance.record('replay.entityLookupInvalidated', entries.size)
            entries.clear()
            return
        }
        affected.forEach(invalidateEntity)
    }

    /** Subscribe to a Cesium entity collection once for this Replay session. */
    const observeEntityCollection = collection => {
        if (!collection?.collectionChanged || entityCollectionRemovers.has(collection)) {
            return
        }
        const remove = collection.collectionChanged.addEventListener(onCollectionChanged)
        if (typeof remove === 'function') {
            entityCollectionRemovers.set(collection, remove)
        }
    }

    /** Remove listeners for entity collections no longer owned by the viewer. */
    const syncEntityCollections = () => {
        const currentCollections = new Set([viewer?.entities])
        const sourceCount = Number(dataSources?.length) || 0
        for (let index = 0; index < sourceCount; index += 1) {
            currentCollections.add(dataSources.get(index)?.entities)
        }

        for (const [collection, remove] of entityCollectionRemovers) {
            if (currentCollections.has(collection)) {
                continue
            }
            remove()
            entityCollectionRemovers.delete(collection)
        }
        currentCollections.forEach(observeEntityCollection)
    }

    /** Clear cached entity lists when the viewer's data source set changes. */
    const onDataSourcesChanged = () => {
        poiPerformance.record('replay.entityLookupInvalidated', entries.size)
        entries.clear()
        syncEntityCollections()
    }

    /** Subscribe to the collection events that invalidate lookup ownership. */
    const observeEvent = (event, listener) => {
        const remove = event?.addEventListener?.(listener)
        if (typeof remove === 'function') {
            staticEventRemovers.push(remove)
        }
    }

    syncEntityCollections()
    observeEvent(dataSources?.dataSourceAdded, onDataSourcesChanged)
    observeEvent(dataSources?.dataSourceRemoved, onDataSourcesChanged)
    observeEvent(dataSources?.dataSourceMoved, onDataSourcesChanged)

    /** Return all currently rendered entity instances for a POI. */
    const get = poi => {
        if (disposed || !poi?.id || !viewer) {
            return []
        }

        const owningContainer = POIUtils.getEntityContainer(poi)
        const cached = entries.get(poi.id)
        if (cached && cached.parent === poi.parent && cached.owningContainer === owningContainer) {
            entries.delete(poi.id)
            entries.set(poi.id, cached)
            poiPerformance.record('replay.entityLookupCacheHit')
            return cached.entities
        }
        if (cached) {
            entries.delete(poi.id)
            poiPerformance.record('replay.entityLookupInvalidated')
        }

        poiPerformance.record('replay.entityLookup')
        const entities = []
        const seen = new Set()
        const collections = [owningContainer, viewer.entities]
        const sourceCount = Number(dataSources?.length) || 0
        for (let index = 0; index < sourceCount; index += 1) {
            collections.push(dataSources.get(index)?.entities)
        }
        poiPerformance.record('replay.entityContainersScanned', collections.length)

        collections.forEach(collection => {
            observeEntityCollection(collection)
            const entity = collection?.getById?.(poi.id)
            if (entity && !seen.has(entity)) {
                seen.add(entity)
                entities.push(entity)
            }
        })
        poiPerformance.record('replay.entitiesLocated', entities.length)

        entries.set(poi.id, {parent: poi.parent, owningContainer, entities})
        while (entries.size > MAX_LOOKUP_ENTRIES) {
            entries.delete(entries.keys().next().value)
        }
        return entities
    }

    /** Release all Cesium event listeners and cached entity references. */
    const dispose = () => {
        if (disposed) {
            return
        }
        disposed = true
        staticEventRemovers.splice(0).forEach(remove => remove())
        entityCollectionRemovers.forEach(remove => remove())
        entityCollectionRemovers.clear()
        entries.clear()
    }

    return {viewer, scene: viewer?.scene, entities: viewer?.entities, dataSources, get, dispose}
}
