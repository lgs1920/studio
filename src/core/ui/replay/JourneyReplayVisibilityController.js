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
 * Last modified: 2026-11-08
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
import {getJourneyReplayHideOtherJourneys} from '@Core/ui/JourneyVisibility'
import {
    isGlobalPOI,
    isReplayPOIEndpoint,
    isReplayGlobalPOIEligibleForJourney,
    isReplayPOIPresentationActive,
    normalizeJourneyReplayPOISettings,
} from './JourneyReplayPOISettings'
import {
    currentJourneyReplayPoiBehavior, finiteNumber, replayStore,
} from './JourneyReplayRuntime'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {currentReplayJourney} from './ReplayUserModeConstants'
import {createReplayPOIEntityLookup} from './ReplayPOIEntityLookup'
import {replayRenderTargetFor} from './ReplayRenderTarget'
import {subscribe} from 'valtio'

const requestStopClipPOIMaskFrame = callback => {
    if (typeof globalThis.__?.requestAnimationFrame === 'function') {
        return globalThis.__.requestAnimationFrame(callback)
    }

    return globalThis.requestAnimationFrame?.(callback) ?? null
}

const cancelStopClipPOIMaskFrame = frame => {
    if (typeof globalThis.__?.cancelAnimationFrame === 'function') {
        globalThis.__.cancelAnimationFrame(frame)
        return
    }

    globalThis.cancelAnimationFrame?.(frame)
}

const observeStopClipPOIListChanges = state => {
    const poiLists = new Set([
        globalThis.lgs?.stores?.main?.components?.pois?.list,
        globalThis.__?.ui?.poiManager?.list,
    ].filter(Boolean))
    state.stopClipPOIListSubscriptions = Array.from(poiLists, poiList => subscribe(
        poiList,
        () => {
            state.stopClipPOIVisibilityCandidates = null
        },
        true,
    ))
}

/** Return the lookup cache owned by the current Replay session and viewer. */
export const disposeReplayPOIEntityLookup = mode => {
    const state = mode?.[JOURNEY_REPLAY_INTERNAL_STATE]
    if (!state?.replayPOIEntityLookup) {
        return false
    }

    state.replayPOIEntityLookup.dispose()
    state.replayPOIEntityLookup = null
    return true
}

const replayPOIEntityLookup = mode => {
    const state = mode?.[JOURNEY_REPLAY_INTERNAL_STATE]
    const viewer = replayRenderTargetFor(mode)?.viewer ?? globalThis.lgs?.viewer
    if (!state || !viewer) {
        state?.replayPOIEntityLookup?.dispose()
        if (state) {
            state.replayPOIEntityLookup = null
        }
        return null
    }

    let lookup = state.replayPOIEntityLookup
    if (lookup && (lookup.viewer !== viewer
        || lookup.scene !== viewer.scene
        || lookup.entities !== viewer.entities
        || lookup.dataSources !== viewer.dataSources)) {
        disposeReplayPOIEntityLookup(mode)
        lookup = null
    }
    if (!lookup) {
        lookup = createReplayPOIEntityLookup(viewer)
        state.replayPOIEntityLookup = lookup
    }
    return lookup
}

/**
 * Apply a temporary Replay filter to a journey's track render sources without
 * changing journey or track visibility settings.
 *
 * @param {object} journey - Journey whose track sources are updated.
 * @param {boolean} visible - Whether persisted-visible tracks should render.
 * @returns {void} No return value.
 */
const setJourneyReplayTraceVisibility = (mode, journey, visible) => {
    const tracks = journey?.tracks
    if (replayRenderTargetFor(mode)) {
        return
    }
    if (typeof tracks?.values !== 'function' || !globalThis.lgs?.viewer?.dataSources) {
        return
    }

    for (const track of tracks.values()) {
        if (!track?.slug) {
            continue
        }

        try {
            TrackUtils.updateTrackVisibility(
                journey,
                track,
                visible && journey.visible !== false && track.visible !== false,
            )
        }
        catch (error) {
            console.error(`[Replay visibility] Failed to update trace ${track.slug}.`, error)
        }
    }
}

/**
 * Hide only other journeys' rendered traces during Replay.
 *
 * @param {object} mode - Replay session mode.
 * @returns {void} No return value.
 */
export const hideOtherJourneysVisibility = (mode) => {
    const state = mode?.[JOURNEY_REPLAY_INTERNAL_STATE]
    const journeys = globalThis.lgs?.journeys
    if (!state?.hiddenJourneyVisibility || typeof journeys?.values !== 'function') {
        return
    }

    const currentJourneySlug = currentReplayJourney()?.slug ?? null
    if (!currentJourneySlug) {
        return
    }

    for (const journey of journeys.values()) {
        if (!journey?.slug || journey.slug === currentJourneySlug) {
            continue
        }

        state.hiddenJourneyVisibility.set(journey.slug, true)
        if (!replayRenderTargetFor(mode)) {
            setJourneyReplayTraceVisibility(mode, journey, false)
            TrackUtils.updatePOIsVisibility(journey, false)
        }
    }

    globalThis.lgs?.scene?.requestRender?.()
}

export const hideCurrentJourneyVisibility = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (replayRenderTargetFor(mode)) {
            return
        }

        const journey = currentReplayJourney()
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

        if (replayRenderTargetFor(mode)) {
            return
        }

        const journey = currentReplayJourney()
        if (!journey) {
            return
        }

        const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey ?? null
        state.hiddenJourneyVisibility.delete(journey.slug)
        journey.visible = true
        if (editorJourney?.slug === journey.slug) {
            editorJourney.visible = true
        }
        call.persistCurrentJourneyVisibility(journey)
        journey.updateVisibility?.(true)
        call.restoreCurrentJourneyPolylineVisibility()
        if (!restorePOIs) {
            if (isReplayPOIPresentationActive()
                || replayStore()?.poiPresentationPreparationActive === true) {
                call.applyJourneyReplayPOIVisibility()
            }
            else {
                call.restoreJourneyReplayPOIVisibility()
            }
        }
        if (restorePOIs && globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        if (restorePOIs) {
            // Apply the saved per-POI state last so journey-wide visibility
            // updates cannot show POIs that were hidden before Replay.
            call.restoreJourneyReplayPOIVisibility()
        }
        globalThis.lgs?.scene?.requestRender?.()
    }

export const poiEntities = (mode, poi) => {
    if (!poi?.id) {
        return []
    }
    return replayPOIEntityLookup(mode)?.get(poi) ?? []
}

export const setPOIEntityVisibility = (mode, poi, visible, {
    allowReplayAnimation = false,
    allowReplayPreparation = false,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const effectiveVisibility = POIUtils.setPOIVisibility(poi, visible, {
            allowReplayAnimation,
            allowReplayPreparation,
        })
        call.poiEntities(poi).forEach(entity => {
            const entityVisibilityMatches = isVisibleProperty(mode, entity.show) === effectiveVisibility
            const billboardVisibilityMatches = !entity.billboard
                || isVisibleProperty(mode, entity.billboard.show) === effectiveVisibility
            if (entityVisibilityMatches && billboardVisibilityMatches) {
                return
            }

            if (!entityVisibilityMatches) {
                entity.show = effectiveVisibility
            }
            if (entity.billboard && !billboardVisibilityMatches) {
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

export const replayPOICandidates = (mode, nearbyPois = null, nearbyPOIIds = null) => {
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

        runtimeNearbyPois.forEach(entry => {
            const poi = call.resolveJourneyReplayPOI(entry)
            addPOI(poi)
            if (poi?.id && nearbyPOIIds instanceof Set) {
                nearbyPOIIds.add(poi.id)
            }
        })
        const storePOIList = globalThis.lgs?.stores?.main?.components?.pois?.list
        const managerPOIList = globalThis.__?.ui?.poiManager?.list
        addList(storePOIList)
        if (managerPOIList !== storePOIList) {
            addList(managerPOIList)
        }
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

export const applyJourneyReplayPOIVisibility = (
    mode,
    nearbyPois = null,
    cachedCandidates = null,
    cachedNearbyPOIIds = null,
) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const store = replayStore()
        const behavior = currentJourneyReplayPoiBehavior()
        const {poiVisibilityMode, basicMode} = behavior
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []
        const nearbyPOIIds = cachedNearbyPOIIds ?? new Set()
        const candidates = Array.isArray(cachedCandidates)
            ? cachedCandidates
            : call.replayPOICandidates(runtimeNearbyPois, nearbyPOIIds)
        if (state.stopClipPOIMaskActive === true) {
            state.stopClipPOINearbyPois = runtimeNearbyPois
            state.stopClipPOIVisibilityCandidates = candidates
            state.stopClipNearbyPOIIds = nearbyPOIIds
        }
        for (const candidatePOI of candidates) {
            const poi = call.resolveJourneyReplayPOI({poi: candidatePOI})
            if (!poi?.id) {
                continue
            }

            const settings = normalizeJourneyReplayPOISettings(poi.replay)
            const isEndpoint = isReplayPOIEndpoint(poi)
            const visibilityMode = isEndpoint && !basicMode ? 'user' : poiVisibilityMode
            const animationActive = state.replayPoiTriggered.has(poi.id)
            const replayPresentationActive = isReplayPOIPresentationActive(store)
            const ineligibleGlobalPOI = replayPresentationActive
                && isGlobalPOI(poi)
                && !isReplayGlobalPOIEligibleForJourney(poi, store)
            const shouldApplyVisibility = animationActive
                || ineligibleGlobalPOI
                || nearbyPOIIds.has(poi.id)
                || state.replayPOIVisibilityState.has(poi.id)
                || visibilityMode !== 'user'
                || settings.visible === false
                || poi.visible === false
            if (!shouldApplyVisibility) {
                continue
            }

            const visibleBeforePlayback = state.replayPOIVisibilityState.get(poi.id)?.visible
                ?? call.isPOIVisibleBeforePlayback(poi)
            const visibleByUser = visibleBeforePlayback && settings.visible !== false
            const visibleDuringPlayback = !ineligibleGlobalPOI && (
                animationActive
                || (visibilityMode === 'yes' && (basicMode || !isEndpoint))
                || (poi.visible !== false
                && (visibilityMode === 'yes'
                    || (visibilityMode === 'user' && visibleByUser))
                )
            )

            if ((ineligibleGlobalPOI || visibilityMode !== 'user' || settings.visible === false)
                && !state.replayPOIVisibilityState.has(poi.id)) {
                state.replayPOIVisibilityState.set(poi.id, {
                    visible: visibleBeforePlayback,
                })
            }

            call.setPOIEntityVisibility(
                poi,
                visibleDuringPlayback,
                {
                    allowReplayAnimation: animationActive,
                    allowReplayPreparation: state.replayPOIPreparationActive === true
                        || replayStore()?.poiPresentationPreparationActive === true,
                },
            )
        }
    }

/**
 * Apply the Basic Replay visibility policy while capturing user POI state.
 * @param {object} mode - Replay session mode.
 * @returns {Promise<void>} Completion of requested POI collapses.
 */
export const applyJourneyReplayPOIPreparationVisibility = mode => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const {poiVisibilityMode} = currentJourneyReplayPoiBehavior()
    const candidates = call.replayPOICandidates?.() ?? []
    const collapsePromises = []
    state.replayPOIPreparationActive = true
    const store = replayStore()
    if (store) {
        store.poiPresentationPreparationActive = true
    }

    for (const poi of candidates) {
        if (!poi?.id) {
            continue
        }

        if (!state.replayPOIVisibilityState.has(poi.id)) {
            state.replayPOIVisibilityState.set(poi.id, {
                visible: call.isPOIVisibleBeforePlayback?.(poi) ?? poi.visible !== false,
            })
        }

        const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
        const originalVisibility = state.replayPOIVisibilityState.get(poi.id)?.visible === true
        const visible = poiVisibilityMode === 'yes'
            || (poiVisibilityMode === 'user' && originalVisibility && poi.visible !== false && poiSettings.visible)
        call.setPOIEntityVisibility(poi, visible, {allowReplayPreparation: true})

        if (poiVisibilityMode !== 'no') {
            if (!state.replayPoiExpandedState.has(poi.id)) {
                state.replayPoiExpandedState.set(poi.id, poi.expanded === true)
            }
            if (poi.expanded === true) {
                collapsePromises.push(call.updatePOIExpandedState(poi.id, false))
            }
        }
    }

    globalThis.lgs?.scene?.requestRender?.()
    return Promise.all(collapsePromises).then(() => undefined)
}

/** Reapply current policy to cached candidates after another POI writer changes visibility. */
export const enforceStopClipPOIVisibility = mode => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const candidates = state.stopClipPOIVisibilityCandidates
    const nearbyPOIIds = state.stopClipNearbyPOIIds
    if (state.stopClipPOIMaskActive !== true || !(nearbyPOIIds instanceof Set)) {
        return
    }

    const currentNearbyPois = replayStore()?.nearbyPois
    const nearbyPois = Array.isArray(currentNearbyPois)
        ? currentNearbyPois
        : state.stopClipPOINearbyPois
    const needsFullCandidatePass = nearbyPois !== state.stopClipPOINearbyPois || !Array.isArray(candidates)
    call.applyJourneyReplayPOIVisibility(
        nearbyPois,
        needsFullCandidatePass ? null : candidates,
        needsFullCandidatePass ? null : nearbyPOIIds,
    )
}

/**
 * Reapply the Replay hide-all filter after animated POI state has been restored.
 *
 * @param {object} mode - Replay session mode.
 * @returns {boolean} Whether the hide-all filter was reapplied.
 */
export const reapplyHideAllPOIVisibilityAfterAnimations = mode => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const replay = replayStore()
    if (!state.replayPOIAnimationOccurred
        || !currentJourneyReplayPoiBehavior().hideAllPoisDuringJourneyReplay
        || !(replay?.active || replay?.playing || replay?.paused || replay?.clipSequenceActive)) {
        return false
    }

    call.applyJourneyReplayPOIVisibility()
    globalThis.lgs?.scene?.requestRender?.()
    return true
}

/**
 * Restore saved POI visibility, retaining the baseline while Replay still masks the scene.
 * @param {object} mode - Replay session mode.
 * @returns {void}
 */
export const restoreJourneyReplayPOIVisibility = mode => {
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

    // Record starts its export mask before cleaning up the preceding preparation.
    // Only consume the baseline once visibility can return to the normal map.
    if (!isReplayPOIPresentationActive()) {
        state.replayPOIVisibilityState.clear()
    }
    globalThis.lgs?.scene?.requestRender?.()
}

/**
 * Hide every visible POI while Replay camera preparation is in progress.
 *
 * @param {object} mode - Replay session mode.
 * @returns {void}
 */
export const hideJourneyReplayPOIsForPreparation = mode => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const candidates = call.replayPOICandidates?.() ?? []
    if (typeof call.setPOIEntityVisibility !== 'function') {
        return
    }
    for (const poi of candidates) {
        if (!poi?.id) {
            continue
        }
        if (!state.replayPOIVisibilityState.has(poi.id)) {
            state.replayPOIVisibilityState.set(poi.id, {
                visible: call.isPOIVisibleBeforePlayback?.(poi) ?? poi.visible !== false,
            })
        }
        call.setPOIEntityVisibility(poi, false)
    }
    globalThis.lgs?.scene?.requestRender?.()
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

        if (state.stopClipPOIMaskActive === true) {
            return
        }

        state.stopClipPOIMaskActive = true
        observeStopClipPOIListChanges(state)
        call.applyJourneyReplayPOIVisibility()
        const tick = () => {
            state.stopClipPOIMaskFrame = null
            if (state.stopClipPOIMaskActive !== true) {
                return
            }

            call.enforceStopClipPOIVisibility()
            state.stopClipPOIMaskFrame = requestStopClipPOIMaskFrame(tick)
        }

        state.stopClipPOIMaskFrame = requestStopClipPOIMaskFrame(tick)
    }

export const stopStopClipPOIMaskLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const frame = state.stopClipPOIMaskFrame
    if (frame !== null && frame !== undefined) {
        cancelStopClipPOIMaskFrame(frame)
    }

    state.stopClipPOIMaskFrame = null
    state.stopClipPOIMaskActive = false
    state.stopClipPOINearbyPois = null
    state.stopClipPOIVisibilityCandidates = null
    state.stopClipNearbyPOIIds = null
    state.stopClipPOIListSubscriptions?.forEach(unsubscribe => unsubscribe())
    state.stopClipPOIListSubscriptions = null
    }

export const preserveCurrentJourneyPOIVisibility =  (mode, journey) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (replayRenderTargetFor(mode)) {
            return
        }

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

        if (replayRenderTargetFor(mode)) {
            return
        }

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

/**
 * Restore other journeys unless the active Replay preference keeps them hidden.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} [options] - Visibility restoration options.
 * @param {boolean} [options.respectReplaySetting=true] - Whether Replay's hide preference takes precedence.
 * @returns {void}
 */
export const restoreOtherJourneysVisibility = (mode, {respectReplaySetting = true} = {}) => {
    const state = mode?.[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode?.[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!state?.hiddenJourneyVisibility) {
        return
    }

    if (replayRenderTargetFor(mode)) {
        state.hiddenJourneyVisibility.clear()
        return
    }

    if (respectReplaySetting && getJourneyReplayHideOtherJourneys()) {
        call?.hideOtherJourneysVisibility?.()
        return
    }

    if (state.hiddenJourneyVisibility.size === 0) {
        return
    }

    const currentJourneySlug = currentReplayJourney()?.slug ?? null
    for (const slug of state.hiddenJourneyVisibility.keys()) {
        if (slug === currentJourneySlug) {
            state.hiddenJourneyVisibility.delete(slug)
            continue
        }

        const journey = globalThis.lgs?.journeys?.get?.(slug)
        if (!journey) {
            continue
        }

        setJourneyReplayTraceVisibility(mode, journey, true)
        TrackUtils.updatePOIsVisibility(journey, journey.visible !== false && journey.POIsVisible !== false)
    }

    state.hiddenJourneyVisibility.clear()
    globalThis.lgs?.scene?.requestRender?.()
}

/**
 * Set Replay's other-journey trace filter and apply it to an active session.
 *
 * @param {object} mode - Replay session mode.
 * @param {boolean} enabled - Whether other journey traces should be hidden.
 * @returns {boolean} The normalized setting value.
 */
export const setHideOtherJourneys = (mode, enabled = true) => {
    const state = mode?.[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode?.[JOURNEY_REPLAY_INTERNAL_CALL]

    const nextEnabled = enabled === true
    const replaySettings = globalThis.lgs?.settings?.ui?.replay
    if (replaySettings) {
        replaySettings.hideOtherJourneys = nextEnabled
    }

    const store = replayStore()
    if (store) {
        store.hideOtherJourneys = nextEnabled
    }

    const controller = state?.controller
    if (nextEnabled) {
        if (controller?.running || controller?.playing || controller?.paused) {
            call?.hideOtherJourneysVisibility?.()
        }
    }
    else {
        call?.restoreOtherJourneysVisibility?.()
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
