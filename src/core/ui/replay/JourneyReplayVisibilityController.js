/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayVisibilityController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-07-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Journey, POI and replay visibility behavior.
 */

import {JulianDate} from 'cesium'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {normalizeJourneyReplayPOISettings} from './JourneyReplayPOISettings'
import {
    currentJourneyReplayPoiBehavior, finiteNumber, replayStore,
} from './JourneyReplayRuntime'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'

export const hideOtherJourneysVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const currentJourneySlug = globalThis.lgs?.theJourney?.slug ?? null
        const journeys = globalThis.lgs?.journeys
        if (!journeys?.values) {
            return
        }

        for (const journey of journeys.values()) {
            if (!journey || journey.slug === currentJourneySlug) {
                continue
            }

            if (!state.hiddenJourneyVisibility.has(journey.slug)) {
                state.hiddenJourneyVisibility.set(journey.slug, journey.visible !== false)
            }

            // Other journeys keep their original persisted state in the
            // visibility map and are restored when replay ends.
            journey.visible = false
            journey.updateVisibility?.(false)
        }

        globalThis.lgs?.scene?.requestRender?.()
    }

export const hideCurrentJourneyVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return
        }

        // Keep the persisted visibility untouched. The replay trace replaces
        // the original polylines only at the Cesium rendering layer.
        journey.updateVisibility?.(false)
        call.preserveCurrentJourneyPOIVisibility(journey)
        globalThis.lgs?.scene?.requestRender?.()
    }

export const persistCurrentJourneyVisibility =  (mode, journey) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (typeof journey?.persistToDatabase !== 'function') {
            return
        }

        void Promise.resolve(journey.persistToDatabase())
    }

export const restoreCurrentJourneyVisibility = (mode, {restorePOIs = true} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return
        }

        const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey ?? null
        state.hiddenJourneyVisibility.delete(journey.slug)
        journey.visible = true
        if (editorJourney) {
            editorJourney.visible = true
        }
        call.persistCurrentJourneyVisibility(journey)
        journey.updateVisibility?.(true)
        call.restoreCurrentJourneyPolylineVisibility()
        if (!restorePOIs) {
            call.applyJourneyReplayPOIVisibility()
        }
        if (restorePOIs) {
            call.restoreJourneyReplayPOIVisibility()
        }
        if (restorePOIs && globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        globalThis.lgs?.scene?.requestRender?.()
    }

export const poiEntities =  (mode, poi) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!poi?.id || !globalThis.lgs?.viewer) {
            return []
        }

        const entities = []
        const addEntity = entity => {
            if (entity && !entities.includes(entity)) {
                entities.push(entity)
            }
        }

        addEntity(POIUtils.getEntityContainer(poi)?.getById?.(poi.id))
        addEntity(globalThis.lgs.viewer.entities?.getById?.(poi.id))

        const dataSources = globalThis.lgs.viewer.dataSources
        const length = Number(dataSources?.length) || 0
        for (let index = 0; index < length; index++) {
            addEntity(dataSources.get(index)?.entities?.getById?.(poi.id))
        }

        return entities
    }

export const setPOIEntityVisibility = (mode, poi, visible) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        call.poiEntities(poi).forEach(entity => {
            const effectiveVisibility = POIUtils.setPOIVisibility(poi, visible)
            entity.show = effectiveVisibility
            if (entity.billboard) {
                entity.billboard.show = effectiveVisibility
            }
        })
    }

export const resolveJourneyReplayPOI =  (mode, entry) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const poiId = entry?.poi?.id
        if (!poiId) {
            return null
        }

        return globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            ?? entry.poi
    }

export const replayPOICandidates = (mode, nearbyPois = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const candidates = new Map()
        const addPOI = poi => {
            if (poi?.id && !candidates.has(poi.id)) {
                candidates.set(poi.id, poi)
            }
        }
        const addList = list => {
            if (!list?.values) {
                return
            }

            for (const poi of list.values()) {
                addPOI(poi)
            }
        }
        const store = replayStore()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []

        runtimeNearbyPois.forEach(entry => addPOI(call.resolveJourneyReplayPOI(entry)))
        addList(globalThis.lgs?.stores?.main?.components?.pois?.list)
        addList(globalThis.__?.ui?.poiManager?.list)
        return Array.from(candidates.values())
    }

export const isVisibleProperty =  (mode, value) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (typeof value?.getValue === 'function') {
            return value.getValue(JulianDate.now()) !== false
        }

        return value !== false
    }

export const isPOIVisibleBeforePlayback =  (mode, poi) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (poi?.visible === false) {
            return false
        }

        const entities = call.poiEntities(poi)
        if (entities.length === 0) {
            return true
        }

        return entities.some(entity => call.isVisibleProperty(entity?.show)
            && (!entity?.billboard || call.isVisibleProperty(entity.billboard.show)))
    }

export const applyJourneyReplayPOIVisibility = (mode, nearbyPois = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const store = replayStore()
        const {hideAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []
        const nearbyPOIIds = new Set(
            runtimeNearbyPois
                .map(entry => call.resolveJourneyReplayPOI(entry)?.id)
                .filter(Boolean),
        )

        for (const poi of call.replayPOICandidates(runtimeNearbyPois)) {
            if (!poi?.id) {
                continue
            }

            const settings = normalizeJourneyReplayPOISettings(poi.replay)
            const shouldApplyVisibility = nearbyPOIIds.has(poi.id)
                || hideAllPoisDuringJourneyReplay
                || settings.visible === false
                || poi.visible === false
            if (!shouldApplyVisibility) {
                continue
            }

            const visibleBeforePlayback = state.replayPOIVisibilityState.get(poi.id)?.visible
                ?? call.isPOIVisibleBeforePlayback(poi)
            const visibleDuringPlayback = visibleBeforePlayback
                && poi.visible !== false
                && !hideAllPoisDuringJourneyReplay
                && settings.visible !== false

            if ((hideAllPoisDuringJourneyReplay || settings.visible === false) && !state.replayPOIVisibilityState.has(poi.id)) {
                state.replayPOIVisibilityState.set(poi.id, {
                    visible: visibleBeforePlayback,
                })
            }

            call.setPOIEntityVisibility(poi, visibleDuringPlayback)
        }
    }

export const restoreJourneyReplayPOIVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        for (const [poiId, poiState] of state.replayPOIVisibilityState.entries()) {
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            if (!poi?.id) {
                continue
            }

            call.setPOIEntityVisibility(poi, poiState?.visible === true && poi.visible !== false)
        }

        state.replayPOIVisibilityState.clear()
    }

export const hideGloballyHiddenPOIs = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        for (const poi of call.replayPOICandidates()) {
            if (poi?.id && poi.visible === false) {
                call.setPOIEntityVisibility(poi, false)
            }
        }
    }

export const startStopClipPOIMaskLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.stopClipPOIMaskFrame !== null) {
            return
        }

        call.applyJourneyReplayPOIVisibility()
        const tick = () => {
            state.stopClipPOIMaskFrame = null
            call.applyJourneyReplayPOIVisibility()
            state.stopClipPOIMaskFrame = globalThis.__?.requestAnimationFrame?.(tick)
                ?? globalThis.requestAnimationFrame?.(tick)
                ?? null
        }

        state.stopClipPOIMaskFrame = globalThis.__?.requestAnimationFrame?.(tick)
            ?? globalThis.requestAnimationFrame?.(tick)
            ?? null
    }

export const stopStopClipPOIMaskLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.stopClipPOIMaskFrame === null) {
            return
        }

        globalThis.__?.cancelAnimationFrame?.(state.stopClipPOIMaskFrame)
        globalThis.cancelAnimationFrame?.(state.stopClipPOIMaskFrame)
        state.stopClipPOIMaskFrame = null
    }

export const preserveCurrentJourneyPOIVisibility =  (mode, journey) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!globalThis.lgs?.viewer?.dataSources) {
            return
        }

        const sources = TrackUtils.getDataSourcesByName(journey.slug)
        if (!Array.isArray(sources) || sources.length === 0) {
            return
        }

        state.hiddenCurrentJourneyPolylines.clear()

        for (const source of sources) {
            if (!source) {
                continue
            }

            source.show = true

            for (const entity of source.entities?.values ?? []) {
                if (!entity?.id) {
                    continue
                }

                const poi = globalThis.__?.ui?.poiManager?.get?.(entity.id)
                if (poi?.id && entity.billboard) {
                    entity.show = poi.visible !== false
                    continue
                }

                if (!entity.polyline) {
                    continue
                }

                const previousVisibility = typeof entity.polyline.show?.getValue === 'function'
                    ? entity.polyline.show.getValue(JulianDate.now())
                    : entity.polyline.show

                state.hiddenCurrentJourneyPolylines.set(entity.id, {
                    sourceName: source.name ?? journey.slug,
                    visible:    previousVisibility !== false,
                })
                TrackUtils.setPolylineVisibility(entity, false)
            }
        }
    }

export const restoreCurrentJourneyPolylineVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]

        if (state.hiddenCurrentJourneyPolylines.size === 0) {
            return
        }

        if (!globalThis.lgs?.viewer?.dataSources) {
            state.hiddenCurrentJourneyPolylines.clear()
            return
        }

        for (const [entityId, visibility] of state.hiddenCurrentJourneyPolylines.entries()) {
            const namedSource = visibility?.sourceName
                ? TrackUtils.getDataSourcesByName(visibility.sourceName, true)?.[0]
                : null
            const source = namedSource ?? TrackUtils.getDataSourceNameByEntityId(entityId)
            const entity = source?.entities?.getById?.(entityId)
            if (!entity) {
                continue
            }

            TrackUtils.setPolylineVisibility(entity, visibility?.visible !== false)
        }

        state.hiddenCurrentJourneyPolylines.clear()
    }

export const setJourneyReplayOrbitAllowed = (mode, allowed = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const store = replayStore()
        if (store) {
            store.orbitAllowed = allowed === true
        }
    }

export const restoreOtherJourneysVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.hiddenJourneyVisibility.size === 0) {
            return
        }

        const currentJourneySlug = globalThis.lgs?.theJourney?.slug ?? null
        for (const [slug, visible] of state.hiddenJourneyVisibility.entries()) {
            if (slug === currentJourneySlug) {
                state.hiddenJourneyVisibility.delete(slug)
                continue
            }

            const journey = globalThis.lgs?.journeys?.get?.(slug)
            if (!journey) {
                continue
            }

            journey.visible = visible
            journey.updateVisibility?.(visible)
        }

        state.hiddenJourneyVisibility.clear()
        globalThis.lgs?.scene?.requestRender?.()
    }

export const setHideOtherJourneys = (mode, enabled = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.hideOtherJourneys = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.hideOtherJourneys = nextEnabled
        }

        if (nextEnabled) {
            if (state.controller.running || state.controller.playing || state.controller.paused) {
                call.hideOtherJourneysVisibility()
            }
        }
        else {
            call.restoreOtherJourneysVisibility()
        }

        return nextEnabled
    }

export const setHideAllPoisDuringJourneyReplay = (mode, enabled = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.hideAllPoisDuringJourneyReplay = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.hideAllPoisDuringJourneyReplay = nextEnabled
        }

        if (state.controller.running || state.controller.playing || state.controller.paused) {
            if (nextEnabled) {
                call.applyJourneyReplayPOIVisibility()
            }
            else {
                call.restoreJourneyReplayPOIVisibility()
                call.applyJourneyReplayPOIVisibility()
            }
        }

        return nextEnabled
    }

export const setAnimateAllPoisDuringJourneyReplay = (mode, enabled = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.animateAllPoisDuringJourneyReplay = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.animateAllPoisDuringJourneyReplay = nextEnabled
        }

        return nextEnabled
    }
