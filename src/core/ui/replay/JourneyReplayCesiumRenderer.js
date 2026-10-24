/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCesiumRenderer.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {MAX_RENDER_POINTS} from '@Utils/cesium/trackRenderSmoothing'
import {createPolylineEndCapImage, getPolylineEndCapRotation} from '@Utils/cesium/TrackEndCapUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {normalizeReplaySampleCount} from './ReplayModeSettings'
import {
    ArcType, CallbackProperty, Cartesian3, Cartographic, Color, CustomDataSource, HeightReference,
    ColorMaterialProperty, HorizontalOrigin, PolylineGlowMaterialProperty, VerticalOrigin,
} from 'cesium'
import {
    getJourneyReplaySettings, normalizeJourneyReplayProgressionStyle, normalizeJourneyReplayTrace, REPLAY_EFFECT_NEON,
    REPLAY_EFFECT_NONE, REPLAY_MIN_TRACE_WIDTH, REPLAY_TRACE_MODE_FULL,
} from './JourneyReplayProgressionStyle'
import {isJourneyReplayBasicMode} from './ReplayUserModeConstants'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'

export const REPLAY_DATA_SOURCE_PREFIX = 'replay'

const DEFAULT_COLOR = '#ff6a00'
const DEFAULT_BORDER = '#FFFFFF'

const CURSOR_MIN_RADIUS_METERS = 0.1
const PROGRESS_Z_INDEX_REMAINING_FILL = 39
const PROGRESS_Z_INDEX_BORDER = 40
const PROGRESS_Z_INDEX_FILL = 41
const REMAINING_KEY_PREFIX = 'remaining:'
const PATH_GEOMETRY_UPDATE_INTERVAL = 120
const DYNAMIC_POLYLINE_PROGRESS_STEP = 0.002
const DYNAMIC_POLYLINE_PROGRESS_STEP_PLAYING = 0.00025
const GROUND_POLYLINE_GRANULARITY_METERS = 8
const REPLAY_EFFECT_GLOW_POWER = 0.18
const REPLAY_EFFECT_NEON_POWER = 0.28
const REPLAY_EFFECT_GLOW_SPREAD_METERS = 6
const REPLAY_EFFECT_NEON_SPREAD_METERS = 10
const REPLAY_EFFECT_GLOW_BRIGHTNESS = 0.2
const REPLAY_EFFECT_NEON_BRIGHTNESS = 0.35
const REPLAY_EFFECT_GLOW_ALPHA = 0.55
const REPLAY_EFFECT_NEON_ALPHA = 0.42
const REPLAY_EFFECT_GLOW_FILL_SPREAD_METERS = 2
const REPLAY_EFFECT_NEON_FILL_SPREAD_METERS = 3
const REPLAY_EFFECT_GLOW_FILL_ALPHA = 0.55
const REPLAY_EFFECT_NEON_FILL_ALPHA = 0.45
const REPLAY_EFFECT_EDGE_BLEND = 0.75
const cssColor = (value, fallback) => {
    if (value instanceof Color) {
        return value
    }

    if (typeof value === 'string') {
        return Color.fromCssColorString(value) ?? fallback
    }

    if (value && typeof value.toCssColorString === 'function') {
        return Color.fromCssColorString(value.toCssColorString()) ?? fallback
    }

    return fallback
}

const brightenEffectColor = (color, mode) => {
    const brightness = mode === REPLAY_EFFECT_NEON
        ? REPLAY_EFFECT_NEON_BRIGHTNESS
        : REPLAY_EFFECT_GLOW_BRIGHTNESS

    return color.brighten(brightness, new Color()).withAlpha(color.alpha)
}

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const isUsableCartesian3 = value => Boolean(value)
    && [value.x, value.y, value.z].every(component => Number.isFinite(component))

export class JourneyReplayCesiumRenderer {
    #source = null
    #cursor = null
    #cursorBorder = null
    #cursorEffectOuter = null
    #cursorEffectInner = null
    #cursorEffectCore = null
    #cursorEffectsEnabled = false
    #cursorTraceFallbackPosition = null
    #cursorTracePositionProperty = null
    #lineEntities = new Map()
    #lineCapEntities = new Map()
    #sampler = null
    #journeySlug = null
    #options = {}
    #sample = null
    #lastPathGeometryUpdate = 0
    #lastPathGeometryDistance = null
    #lastTraceStyleKey = null
    #sourceRaised = false
    #sourceAddPending = false
    #maskedTrackSources = new Map()
    #traceGuide = null
    #traceGuideSamples = null
    #smoothedGroundPositionCache = null
    #providedTraceGuide = null
    #providedTraceGuideSource = null
    #completedTracePositionsFactory = null
    #dynamicTraceFrames = new Map()
    #traceHidden = false
    #traceVisible = true
    #renderTarget = null
    #maxRenderPoints = MAX_RENDER_POINTS

    constructor(options = {}) {
        this.#options = options
        this.#renderTarget = options.renderTarget ?? null
    }

    /**
     * Move future replay geometry writes to an explicit Cesium target.
     *
     * Existing geometry is cleared from its current collection before the
     * target changes so one renderer never owns entities in two scenes.
     *
     * @param {Object|null} target - Viewer, scene, and canvas render target.
     * @returns {JourneyReplayCesiumRenderer} This renderer.
     */
    setRenderTarget = (target = null) => {
        if (target === this.#renderTarget) {
            return this
        }

        this.clear()
        this.#renderTarget = target
        return this
    }

    #viewer = () => this.#renderTarget?.viewer ?? globalThis.lgs?.viewer ?? null

    #scene = () => this.#renderTarget?.scene ?? globalThis.lgs?.scene ?? this.#viewer()?.scene ?? null

    #requestRender = () => this.#scene()?.requestRender?.()

    /** Install a playback guide whose normalized positions remain stable until the next show call. */
    show = ({sampler, options = {}} = {}) => {
        this.#sampler = sampler ?? this.#sampler
        this.#options = {...this.#options, ...options}
        this.#providedTraceGuide = null
        this.#providedTraceGuideSource = null
        this.#traceGuide = null
        this.#traceGuideSamples = null
        this.#smoothedGroundPositionCache = null
        this.#invalidateDynamicTraceFrames()
        this.#journeySlug = this.#sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#traceVisible = true
        this.#traceHidden = false
        this.#maxRenderPoints = this.#style().maxRenderPoints
        this.#ensureSource()
        if (this.#source) {
            this.#source.show = false
        }
        this.#raiseSourceToTop()
        this.#maskOriginalTrackSources()
        return this
    }

    /**
     * Synchronize the replay trace and cursor to one logical sample.
     *
     * @param {object} options - Render inputs and visibility controls.
     * @param {object} options.sample - Current journey sample.
     * @param {object} options.sampler - Journey path sampler.
     * @param {boolean} options.allowPlaybackGeometryUpdate - Allow cadence-based updates during playback.
     * @returns {void}
     */
    update = ({
                  sample,
                  sampler = this.#sampler,
                  forceGeometry = false,
                  allowPlaybackGeometryUpdate = false,
                  freezeDynamic = false,
                  syncCursorToTrace = false,
                  hideCursor = false,
                  hideTrace = null,
                  showTrace = null,
                  hideRemainingTrace = false,
                  staticCompletedTrace = false,
                  completedTraceMode = staticCompletedTrace ? 'static' : 'dynamic',
              } = {}) => {
        if (!sample || !sampler) {
            return
        }

        if (sampler !== this.#sampler) {
            this.#traceGuide = null
            this.#traceGuideSamples = null
            this.#smoothedGroundPositionCache = null
        }
        this.#sampler = sampler
        this.#journeySlug = sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#sample = sample
        const requestedTraceVisibility = hideTrace === true
            ? false
            : (typeof showTrace === 'boolean' ? showTrace : null)
        if (requestedTraceVisibility === false) {
            this.#traceVisible = false
            this.#removeTraceGeometry()
            this.#requestRender()
            return
        }
        if (requestedTraceVisibility !== true && !this.#traceVisible) {
            this.#removeTraceGeometry()
            this.#requestRender()
            return
        }
        if (requestedTraceVisibility === true) {
            this.#traceVisible = true
        }
        this.#ensureSource()
        const stopCompletedTrace = staticCompletedTrace || completedTraceMode === 'stop-dynamic'
        if (stopCompletedTrace) {
            replayVideoTraceDebug('renderer.update.stop.begin', {
                progress: sample.progress,
                forceGeometry,
                freezeDynamic,
                hideCursor,
                hideRemainingTrace,
                samplerSamples: sampler?.samples?.length ?? null,
                source: this.#source?.name ?? null,
                sourceShow: this.#source?.show ?? null,
                sourceAddPending: this.#sourceAddPending,
            })
        }
        const wasTraceHidden = this.#traceHidden
        const style = this.#style()
        this.#maxRenderPoints = style.maxRenderPoints
        const traceStyleKey = this.#traceStyleKey(style)
        const styleChanged = traceStyleKey !== this.#lastTraceStyleKey
        this.#lastTraceStyleKey = traceStyleKey
        const shouldUpdateGeometry = forceGeometry
            || styleChanged
            || (!hideTrace && wasTraceHidden)
            || (!freezeDynamic && this.#shouldUpdatePathGeometry(sample, {
                allowPlaybackGeometryUpdate,
            }))
        if (shouldUpdateGeometry) {
            this.#updateCompletedLines(sample, {staticGeometry: completedTraceMode === 'static'})
            this.#updateRemainingLines(sample, {hideRemainingTrace})
        } else if (hideRemainingTrace) {
            this.#hideRemainingLines()
        }
        if (freezeDynamic && !staticCompletedTrace) {
            this.#freezeDynamicLines()
        }
        this.#updateCursor(sample, {syncToTrace: syncCursorToTrace === true})
        if (hideTrace === true) {
            this.setTraceVisibility(false)
        } else if (hideTrace === false) {
            this.setTraceVisibility(showTrace !== false)
        } else if (typeof showTrace === 'boolean') {
            this.setTraceVisibility(showTrace)
        } else if (!this.#traceVisible) {
            this.#removeTraceGeometry()
        }
        this.#applyTraceVisibility({hideCursor})
        if (stopCompletedTrace) {
            replayVideoTraceDebug('renderer.update.stop.end', {
                progress: sample.progress,
                shouldUpdateGeometry,
                completedTraceMode,
                entities: this.#traceEntitySummary(),
            })
        }
        this.#requestRender()
    }

    #traceEntitySummary = () => {
        const summary = {
            records: this.#lineEntities.size,
            sourceValues: this.#source?.entities?.values?.length ?? null,
            completed: 0,
            completedVisible: 0,
            remaining: 0,
            remainingVisible: 0,
            dynamic: 0,
        }

        this.#lineEntities.forEach((record, key) => {
            const visible = record?.entity?.show !== false && record?.show !== false
            if (record?.geometryKey === 'dynamic') {
                summary.dynamic += 1
            }
            if (key.startsWith(REMAINING_KEY_PREFIX)) {
                summary.remaining += 1
                if (visible) {
                    summary.remainingVisible += 1
                }
                return
            }

            summary.completed += 1
            if (visible) {
                summary.completedVisible += 1
            }
        })

        return summary
    }

    /** Release scene geometry and cached guides when the Replay renderer is cleared. */
    clear = () => {
        const source = this.#source

        this.#restoreOriginalTrackSources()
        this.#removeTraceGeometry(source)

        this.#cursor = null
        this.#cursorBorder = null
        this.#cursorEffectOuter = null
        this.#cursorEffectInner = null
        this.#cursorEffectCore = null
        this.#cursorEffectsEnabled = false
        this.#lineEntities.clear()
        this.#sampler = null
        this.#sample = null
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#lastTraceStyleKey = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        this.#traceGuide = null
        this.#traceGuideSamples = null
        this.#smoothedGroundPositionCache = null
        this.#providedTraceGuide = null
        this.#providedTraceGuideSource = null
        this.#invalidateDynamicTraceFrames()
        this.#completedTracePositionsFactory = null
        this.#traceHidden = false
        this.#traceVisible = true
        this.#requestRender()
    }

    setTraceVisibility = (visible = true) => {
        this.#traceVisible = visible === true
        if (!this.#traceVisible) {
            this.#removeTraceGeometry()
        }
        this.#applyTraceVisibility()
        this.#requestRender()
        return this.#traceVisible
    }

    hideCursor = () => {
        this.#setCursorVisibility(false)
        this.#requestRender()
    }

    #setCursorVisibility = (visible) => {
        if (this.#cursor) {
            this.#cursor.show = visible
        }
        if (this.#cursorBorder) {
            this.#cursorBorder.show = false
        }
        if (this.#cursorEffectOuter) {
            this.#cursorEffectOuter.show = visible && this.#cursorEffectsEnabled
        }
        if (this.#cursorEffectInner) {
            this.#cursorEffectInner.show = visible && this.#cursorEffectsEnabled
        }
        if (this.#cursorEffectCore) {
            this.#cursorEffectCore.show = visible && this.#cursorEffectsEnabled
        }
    }

    #hasVisibleTraceEntity = () => Array.from(this.#lineEntities.values())
        .some(record => Boolean(record?.entity?.polyline) && record.entity.show !== false)

    #syncCursorVisibilityWithTrace = ({hideCursor = false} = {}) => {
        this.#setCursorVisibility(!hideCursor && this.#hasVisibleTraceEntity())
    }

    #applyTraceVisibility = ({hideCursor = false} = {}) => {
        if (!this.#traceVisible) {
            this.#hideLineEntities(() => true)
        }
        if (this.#source) {
            this.#source.show = this.#traceVisible
        }
        this.#traceHidden = !this.#traceVisible
        this.#syncCursorVisibilityWithTrace({hideCursor: hideCursor || !this.#traceVisible})
    }

    #removeTraceGeometry = (source = this.#source) => {
        if (source) {
            try {
                source.entities.removeAll()
                source.show = false
            } catch {
                // The source may already have been removed by Cesium during scene cleanup.
            }
        }

        this.#removeSource(source)
        this.#cursor = null
        this.#cursorBorder = null
        this.#cursorEffectOuter = null
        this.#cursorEffectInner = null
        this.#cursorEffectCore = null
        this.#cursorEffectsEnabled = false
        this.#lineEntities.clear()
        this.#lineCapEntities.clear()
        this.#invalidateDynamicTraceFrames()
        this.#completedTracePositionsFactory = null
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#lastTraceStyleKey = null
        this.#sourceRaised = false
        this.#traceHidden = true
    }

    #resetSourceEntities = () => {
        this.#cursor = null
        this.#cursorBorder = null
        this.#cursorEffectOuter = null
        this.#cursorEffectInner = null
        this.#cursorEffectCore = null
        this.#cursorEffectsEnabled = false
        this.#lineEntities.clear()
        this.#lineCapEntities.clear()
        this.#invalidateDynamicTraceFrames()
        this.#completedTracePositionsFactory = null
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        this.#traceGuide = null
        this.#traceGuideSamples = null
        this.#smoothedGroundPositionCache = null
        this.#traceHidden = false
    }

    #dataSources = () => this.#viewer()?.dataSources ?? null

    #sourceInCollection = (source = this.#source) => {
        const dataSources = this.#dataSources()
        return Boolean(source && dataSources?.contains?.(source))
    }

    #removeSource = (source = this.#source) => {
        const dataSources = this.#dataSources()

        if (source && dataSources?.contains?.(source)) {
            try {
                dataSources.remove?.(source, true)
            } catch {
                // The source may already have been removed by Cesium during scene cleanup.
            }
        }

        if (this.#source === source) {
            this.#source = null
        }
        this.#sourceAddPending = false
    }

    #ensureSource = () => {
        const name = `${REPLAY_DATA_SOURCE_PREFIX}#${this.#journeySlug ?? 'current'}`
        if (this.#source && this.#source.name !== name) {
            this.#restoreOriginalTrackSources()
            this.#removeTraceGeometry(this.#source)
        }

        if (this.#source && (this.#sourceInCollection() || this.#sourceAddPending)) {
            return this.#source
        }

        if (this.#source && !this.#sourceInCollection()) {
            this.#source = null
            this.#resetSourceEntities()
        }

        const dataSources = this.#dataSources()
        if (!dataSources) {
            return null
        }

        const existing = dataSources.getByName?.(name)?.[0]
        const changedSource = Boolean(existing && existing !== this.#source)
        this.#source = existing ?? new CustomDataSource(name)
        this.#sourceAddPending = false
        if (changedSource) {
            this.#source.entities.removeAll()
            this.#resetSourceEntities()
        }

        if (!existing) {
            this.#sourceAddPending = true
            const source = this.#source
            dataSources.add(source).then(addedSource => {
                if (this.#source !== addedSource) {
                    if (dataSources.contains?.(addedSource)) {
                        dataSources.remove?.(addedSource, true)
                    }
                    return
                }
                if (dataSources.contains?.(addedSource)) {
                    dataSources.raiseToTop(addedSource)
                    this.#sourceRaised = true
                }
                this.#sourceAddPending = false
                this.#requestRender()
            }).catch(() => {
                if (this.#source === source) {
                    this.#sourceAddPending = false
                }
            })
        }
        return this.#source
    }

    #raiseSourceToTop = () => {
        if (!this.#source || this.#sourceRaised || this.#sourceAddPending) {
            return
        }

        const dataSources = this.#dataSources()
        if (!dataSources?.contains?.(this.#source)) {
            return
        }

        dataSources.raiseToTop?.(this.#source)
        this.#sourceRaised = true
    }

    /**
     * Apply the interactive time and distance thresholds to path geometry updates.
     *
     * @param {object} sample - Current journey sample.
     * @param {object} options - Playback update policy.
     * @param {boolean} options.allowPlaybackGeometryUpdate - Whether dry run may update while playing.
     * @returns {boolean} Whether path geometry should be rebuilt.
     */
    #shouldUpdatePathGeometry = (sample, {allowPlaybackGeometryUpdate = false} = {}) => {
        if (globalThis.lgs?.stores?.replay?.playing && allowPlaybackGeometryUpdate !== true) {
            return false
        }

        const now = globalThis.performance?.now?.() ?? Date.now()
        const distance = finiteNumber(sample.distanceFromStart) ?? 0
        const previousDistance = this.#lastPathGeometryDistance
        const distanceDelta = previousDistance === null ? Infinity : Math.abs(distance - previousDistance)
        const minDistanceDelta = Math.max(25, (this.#sampler?.totalDistance ?? 0) / 600)

        if (
            this.#lastPathGeometryUpdate === 0
            || now - this.#lastPathGeometryUpdate >= PATH_GEOMETRY_UPDATE_INTERVAL
            || distanceDelta >= minDistanceDelta
        ) {
            this.#lastPathGeometryUpdate = now
            this.#lastPathGeometryDistance = distance
            return true
        }

        return false
    }

    #traceStyleKey = (style = this.#style()) => {
        return [
            style.traceMode,
            style.effectMode,
            style.fillColor?.toCssColorString?.(),
            style.fillWidth,
            style.effectFillOpacity,
            style.borderColor?.toCssColorString?.(),
            style.borderWidth,
            style.effectBorderOpacity,
            style.remainingColor?.toCssColorString?.(),
            style.remainingUseDefinedTrackStyle,
            style.maxRenderPoints,
        ].join('|')
    }

    #hideLineEntities = predicate => {
        Array.from(this.#lineEntities.entries()).forEach(([key, record]) => {
            if (predicate(key, record)) {
                record.entity.show = false
                record.show = false
                this.#hidePolylineEndCaps(key)
            }
        })
    }

    /**
     * Hide both caps for a polyline when its line layer is inactive.
     *
     * @param {string} key - Stable key of the associated trace polyline.
     * @returns {void}
     */
    #hidePolylineEndCaps = key => {
        for (const end of ['start', 'end']) {
            const cap = this.#lineCapEntities.get(`${key}#cap:${end}`)
            if (cap) {
                cap.entity.show = false
                cap.show = false
            }
        }
    }

    #hideRemainingLines = () => {
        this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX))
    }

    #coordinateParts = (coordinate) => {
        const longitude = finiteNumber(Array.isArray(coordinate) ? coordinate[0] : coordinate?.longitude)
        const latitude = finiteNumber(Array.isArray(coordinate) ? coordinate[1] : coordinate?.latitude)
        if (longitude === null || latitude === null) {
            return null
        }

        return {
            longitude,
            latitude,
            altitude: finiteNumber(Array.isArray(coordinate) ? coordinate[2] : coordinate?.altitude ?? coordinate?.height) ?? 0,
        }
    }

    #groundPositionFromCoordinate = (coordinate) => {
        const point = this.#coordinateParts(coordinate)
        if (!point) {
            return null
        }

        return Cartesian3.fromDegrees(point.longitude, point.latitude, 0)
    }

    #terrainSurfacePositions = positions => (positions ?? [])
        .map(position => {
            if (!position) {
                return null
            }

            const cartographic = Cartographic.fromCartesian(position)
            if (!cartographic) {
                return position
            }

            const globe = this.#scene()?.globe ?? null
            const terrainHeight = finiteNumber(globe?.getHeight?.(cartographic))
            const height = terrainHeight ?? finiteNumber(cartographic.height) ?? 0
            return Cartesian3.fromRadians(
                cartographic.longitude,
                cartographic.latitude,
                height,
            )
        })
        .filter(Boolean)

    /**
     * Convert logical route coordinates into ground-clamped Cartesian positions.
     *
     * @param {Array<Array<number>>} coordinates - Logical segment coordinates.
     * @returns {Array<Cartesian3>} Cartesian positions used for rendered Replay lines.
     */
    #groundPositionsFromCoordinates = coordinates => coordinates
        .map(coordinate => this.#groundPositionFromCoordinate(coordinate))
        .filter(Boolean)

    #trackSource = trackSlug => this.#viewer()?.dataSources?.getByName?.(trackSlug)?.[0] ?? null

    #maskOriginalTrackSources = () => {
        const selectedTrackSlugs = new Set(this.#sampler?.segments?.map(segment => segment.trackSlug) ?? [])

        selectedTrackSlugs.forEach(trackSlug => {
            const source = this.#trackSource(trackSlug)
            if (!source) {
                return
            }

            if (!this.#maskedTrackSources.has(trackSlug)) {
                this.#maskedTrackSources.set(trackSlug, {
                    source,
                    show: source.show,
                })
            }

            source.show = false
        })
    }

    #restoreOriginalTrackSources = () => {
        this.#maskedTrackSources.forEach(entry => {
            entry.source.show = entry.show
        })
        this.#maskedTrackSources.clear()
    }

    #smoothedGroundPositions = () => {
        if (this.#smoothedGroundPositionCache === null) {
            this.#smoothedGroundPositionCache = this.#smoothedGuideEntries().map(entry => entry.position)
        }

        return this.#smoothedGroundPositionCache
    }

    #rawTraceGuideEntries = () => (this.#sampler?.samples ?? [])
        .map(sample => {
            const longitude = finiteNumber(sample?.longitude)
            const latitude = finiteNumber(sample?.latitude)
            const progress = finiteNumber(sample?.progress)
            if (longitude === null || latitude === null || progress === null) {
                return null
            }

            return {
                longitude,
                latitude,
                position: this.#groundPositionFromCoordinate({longitude, latitude}),
                progress,
            }
        })
        .filter(Boolean)

    #traceGuideEntries = () => {
        const samples = this.#sampler?.samples ?? null
        if (this.#traceGuide && this.#traceGuideSamples === samples) {
            return this.#traceGuide
        }

        // The path sampler owns Replay smoothing; applying Journey smoothing here would smooth the route twice.
        this.#smoothedGroundPositionCache = null
        this.#traceGuide = this.#rawTraceGuideEntries()
        this.#traceGuideSamples = samples
        return this.#traceGuide
    }

    /** Normalize a supplied guide once per installation, falling back to the sampler's trace guide. */
    #smoothedGuideEntries = () => {
        const guideSource = this.#options.smoothedGuide ?? null
        if (this.#providedTraceGuide === null || this.#providedTraceGuideSource !== guideSource) {
            // Camera guides are stable between show calls. Rebuilding Cartesian positions per frame
            // scales with the full route and overwhelms the dry run even without bitmap capture.
            this.#providedTraceGuideSource = guideSource
            this.#providedTraceGuide = (guideSource ?? [])
                .map(entry => {
                    const position = this.#groundPositionFromCoordinate(entry)
                    const progress = finiteNumber(entry?.progress)
                    if (!position || progress === null) {
                        return null
                    }

                    return {
                        longitude: Number(entry.longitude),
                        latitude: Number(entry.latitude),
                        position,
                        progress,
                    }
                })
                .filter(Boolean)
        }

        if (this.#providedTraceGuide.length >= 2) {
            return this.#providedTraceGuide
        }

        return this.#traceGuideEntries()
    }

    #smoothedProgressCursor = (progressValue = Number(this.#sample?.progress) || 0) => {
        const guide = this.#smoothedGuideEntries()
        if (guide.length < 2) {
            return {
                guide,
                leftIndex: 0,
                rightIndex: 0,
                ratio: 0,
            }
        }

        const progress = Math.max(0, Math.min(1, Number(progressValue) || 0))
        let low = 0
        let high = guide.length - 1

        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            if (guide[mid].progress < progress) {
                low = mid + 1
            } else {
                high = mid
            }
        }

        const rightIndex = Math.max(0, Math.min(guide.length - 1, low))
        const leftIndex = Math.max(0, rightIndex - 1)
        const left = guide[leftIndex]
        const right = guide[rightIndex]
        const progressSpan = Math.max(0, (right?.progress ?? 0) - (left?.progress ?? 0))
        const ratio = progressSpan > 0 ? (progress - left.progress) / progressSpan : 0

        return {
            guide,
            leftIndex,
            rightIndex,
            ratio: Math.max(0, Math.min(1, ratio)),
        }
    }

    #interpolatedSmoothedPosition = (progressValue = Number(this.#sample?.progress) || 0) => {
        const progress = Math.max(0, Math.min(1, Number(progressValue) || 0))
        const {guide, leftIndex, rightIndex, ratio} = this.#smoothedProgressCursor(progress)
        const left = guide[leftIndex]
        const right = guide[rightIndex]

        if (!isUsableCartesian3(left?.position)) {
            return null
        }

        if (!isUsableCartesian3(right?.position) || leftIndex === rightIndex || ratio <= 0) {
            return left.position
        }

        const longitude = left.longitude + ((right.longitude - left.longitude) * ratio)
        const latitude = left.latitude + ((right.latitude - left.latitude) * ratio)
        return this.#groundPositionFromCoordinate({longitude, latitude})
    }

    #limitTracePositions = positions => {
        const maxPoints = this.#maxRenderPoints
        if (!Array.isArray(positions) || positions.length <= maxPoints) {
            return positions ?? []
        }

        const lastIndex = positions.length - 1
        const selected = []
        for (let index = 0; index < maxPoints; index += 1) {
            const sourceIndex = Math.round((index * lastIndex) / (maxPoints - 1))
            const position = positions[sourceIndex]
            if (position && position !== selected[selected.length - 1]) {
                selected.push(position)
            }
        }

        return selected
    }

    /** Sample a bounded route range directly instead of copying all preceding coordinates. */
    #tracePositionRange = (positions, startIndex, endIndex) => {
        if (!Array.isArray(positions) || positions.length === 0 || endIndex < startIndex) {
            return []
        }

        const first = Math.max(0, Math.min(positions.length - 1, startIndex))
        const last = Math.max(first, Math.min(positions.length - 1, endIndex))
        const count = last - first + 1
        const maxPoints = this.#maxRenderPoints
        if (count <= maxPoints) {
            return positions.slice(first, last + 1)
        }

        const selected = []
        for (let index = 0; index < maxPoints; index += 1) {
            const sourceIndex = first + Math.round((index * (count - 1)) / (maxPoints - 1))
            const position = positions[sourceIndex]
            if (position && position !== selected[selected.length - 1]) {
                selected.push(position)
            }
        }

        return selected
    }

    #completedSmoothedPositions = () => {
        if ((Number(this.#sample?.progress) || 0) <= 0) {
            return []
        }

        const {leftIndex} = this.#smoothedProgressCursor()
        const positions = this.#smoothedGroundPositions()
        if (positions.length < 2) {
            return positions
        }

        if ((Number(this.#sample?.progress) || 0) >= 1) {
            return this.#limitTracePositions(positions)
        }

        const completed = this.#tracePositionRange(positions, 0, leftIndex)
        const interpolated = this.#interpolatedSmoothedPosition()
        const lastCompleted = completed[completed.length - 1]

        if (interpolated && interpolated !== lastCompleted) {
            completed.push(interpolated)
        }

        return this.#limitTracePositions(completed)
    }

    #liveCompletedSmoothedPositions = () => {
        if ((Number(this.#sample?.progress) || 0) <= 0) {
            return []
        }

        const {guide, leftIndex} = this.#smoothedProgressCursor()
        if (guide.length < 2) {
            return this.#smoothedGroundPositions()
        }

        if ((Number(this.#sample?.progress) || 0) >= 1) {
            return this.#limitTracePositions(this.#smoothedGroundPositions())
        }

        const completed = this.#tracePositionRange(this.#smoothedGroundPositions(), 0, leftIndex)

        const interpolated = this.#interpolatedSmoothedPosition()
        const lastWithAnchor = completed[completed.length - 1]
        if (interpolated && interpolated !== lastWithAnchor) {
            completed.push(interpolated)
        }

        return this.#limitTracePositions(completed)
    }

    #remainingSmoothedPositions = () => {
        const {rightIndex} = this.#smoothedProgressCursor()
        const positions = this.#smoothedGroundPositions()
        if (positions.length < 2) {
            return positions
        }

        const interpolated = this.#interpolatedSmoothedPosition()
        const remaining = this.#tracePositionRange(positions, rightIndex, positions.length - 1)

        return this.#limitTracePositions(interpolated ? [interpolated, ...remaining] : remaining)
    }

    #liveRemainingSmoothedPositions = () => {
        const {guide, rightIndex} = this.#smoothedProgressCursor()
        if (guide.length < 2) {
            return this.#smoothedGroundPositions()
        }

        const maxPoints = this.#maxRenderPoints
        const stride = Math.max(1, Math.ceil(guide.length / Math.max(2, maxPoints - 1)))
        const remaining = []
        const interpolated = this.#interpolatedSmoothedPosition()
        if (interpolated) {
            remaining.push(interpolated)
        }

        const anchor = guide[rightIndex]?.position
        const lastInterpolated = remaining[remaining.length - 1]
        if (anchor && anchor !== lastInterpolated) {
            remaining.push(anchor)
        }

        let index = Math.ceil((rightIndex + 1) / stride) * stride
        while (index < guide.length) {
            remaining.push(guide[index].position)
            index += stride
        }

        const lastGuidePosition = guide[guide.length - 1]?.position
        const lastRemaining = remaining[remaining.length - 1]
        if (lastGuidePosition && lastGuidePosition !== lastRemaining) {
            remaining.push(lastGuidePosition)
        }

        return this.#limitTracePositions(remaining)
    }

    /** Resolve active-mode colors and apply Basic scaling without changing baseline dimensions. */
    #style = () => {
        const settings = getJourneyReplaySettings()
        const replayStore = globalThis.lgs?.stores?.replay
        const basicMode = isJourneyReplayBasicMode()
        const progression = normalizeJourneyReplayProgressionStyle(
            basicMode ? settings.progression : replayStore?.progression ?? settings.progression,
        )
        const trace = normalizeJourneyReplayTrace(basicMode ? settings.trace : replayStore?.trace ?? settings.trace)
        const fill = progression.fill
        const border = progression.border
        const sizeScale = basicMode ? progression.sizeScale ?? 1 : 1
        const markerSizeScale = basicMode ? progression.markerSizeScale ?? sizeScale : 1
        const remaining = trace.remaining
        const fillColor = fill.color ?? this.#options.color ?? DEFAULT_COLOR
        const borderColor = border.color ?? this.#options.border ?? DEFAULT_BORDER
        const hasVisibleBorder = border.width > 0 && border.opacity > 0
        const effectBorderBaseColor = hasVisibleBorder ? borderColor : fillColor
        const effect = progression.effect
        const effectBorderOpacity = hasVisibleBorder ? border.opacity : fill.opacity
        const effectBorderColor = cssColor(effectBorderBaseColor, Color.fromCssColorString(DEFAULT_COLOR))
            .withAlpha(effectBorderOpacity)
        const effectFillColor = cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR))
            .withAlpha(fill.opacity)
        const effectFillEdgeColor = Color.lerp(
            effectFillColor,
            effectBorderColor,
            REPLAY_EFFECT_EDGE_BLEND,
            new Color(),
        ).withAlpha(fill.opacity)

        return {
            traceMode: trace.mode,
            fillColor: cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR)).withAlpha(fill.opacity),
            cursorColor: cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR)).withAlpha(Math.max(0.85, fill.opacity)),
            borderColor: cssColor(borderColor, Color.WHITE).withAlpha(border.opacity),
            effectMode: effect.mode,
            effectBorderOpacity,
            effectFillOpacity: fill.opacity,
            effectBorderColor,
            effectFillColor,
            effectFillEdgeColor,
            remainingColor: cssColor(remaining.color, Color.GRAY).withAlpha(remaining.opacity),
            remainingUseDefinedTrackStyle: remaining.useDefinedTrackStyle !== false,
            maxRenderPoints: basicMode
                ? normalizeReplaySampleCount(settings.sampleCount)
                : MAX_RENDER_POINTS,
            fillWidth: Math.max(REPLAY_MIN_TRACE_WIDTH, fill.width) * sizeScale,
            borderWidth: Math.max(0, border.width) * sizeScale,
            cursorDiameter: Math.max(CURSOR_MIN_RADIUS_METERS * 2, fill.width),
            cursorSizeScale: markerSizeScale,
            cursorBorder: Math.max(0, border.width) * markerSizeScale,
        }
    }

    /**
     * Creates the documented Cesium polyline glow material for a replay effect.
     *
     * @param {object} style - Normalized replay style values.
     * @returns {object|null} The effect material, or null when effects are disabled.
     */
    #effectMaterial = (style, effectColor, layer = 'border') => {
        if (style.effectMode === REPLAY_EFFECT_NONE) {
            return null
        }

        const alpha = layer === 'inner-glow'
            ? (style.effectMode === REPLAY_EFFECT_NEON
                ? REPLAY_EFFECT_NEON_FILL_ALPHA
                : REPLAY_EFFECT_GLOW_FILL_ALPHA)
            : (style.effectMode === REPLAY_EFFECT_NEON
                ? REPLAY_EFFECT_NEON_ALPHA
                : REPLAY_EFFECT_GLOW_ALPHA)

        return new PolylineGlowMaterialProperty({
            color: brightenEffectColor(effectColor, style.effectMode)
                .withAlpha(effectColor.alpha * alpha),
            glowPower: style.effectMode === REPLAY_EFFECT_NEON
                ? REPLAY_EFFECT_NEON_POWER
                : REPLAY_EFFECT_GLOW_POWER,
            taperPower: 1,
        })
    }

    /**
     * Creates the Cesium color material used for the visible effect core.
     *
     * @param {object} style - Normalized replay style values.
     * @returns {object|null} The effect core material, or null when effects are disabled.
     */
    #effectCoreMaterial = style => {
        if (style.effectMode === REPLAY_EFFECT_NONE) {
            return null
        }

        return new ColorMaterialProperty(style.effectFillColor)
    }

    /**
     * Resolves the material used by a replay trace while preserving the legacy no-effect path.
     *
     * @param {object} style - Normalized replay style values.
     * @param {object} fallbackMaterial - Existing trace material.
     * @returns {object} The material for the rendered trace.
     */
    #traceMaterial = (style, fallbackMaterial, effectColor = style.effectFillColor, layer = 'fill') => {
        if (style.effectMode === REPLAY_EFFECT_NONE) {
            return fallbackMaterial
        }

        return layer === 'core'
            ? this.#effectCoreMaterial(style)
            : this.#effectMaterial(style, effectColor, layer)
    }

    /**
     * Expands the rendered polyline while an effect is active so the glow has visible screen space.
     *
     * @param {object} style - Normalized replay style values.
     * @param {number} width - Base Cesium polyline width.
     * @param {'fill'|'border'} layer - Trace layer being rendered.
     * @returns {number} The effective Cesium polyline width.
     */
    #traceWidth = (style, width, layer = 'fill') => {
        if (
            style.effectMode === REPLAY_EFFECT_NONE
            || (style.effectFillOpacity <= 0 && style.effectBorderOpacity <= 0)
        ) {
            return width
        }

        if (layer === 'inner-glow') {
            const effectSpread = style.effectMode === REPLAY_EFFECT_NEON
                ? REPLAY_EFFECT_NEON_FILL_SPREAD_METERS
                : REPLAY_EFFECT_GLOW_FILL_SPREAD_METERS
            return width + effectSpread
        }

        const effectSpread = style.effectMode === REPLAY_EFFECT_NEON
            ? REPLAY_EFFECT_NEON_SPREAD_METERS
            : REPLAY_EFFECT_GLOW_SPREAD_METERS
        return layer === 'border' ? Math.max(style.fillWidth, width) + effectSpread : width
    }

    #trackStyleForSegment = (segment) => {
        const track = this.#sampler?.journey?.tracks?.get?.(segment?.trackSlug)
        return TrackUtils.getTrackRenderStyle(track)
    }

    /**
     * Resolves the endpoint from the shared completed-trace frame for the current sample.
     *
     * @param {Cartesian3} fallbackPosition - Smoothed sample used when completed geometry is unavailable.
     * @returns {Cartesian3} Position shared by the marker and completed trace.
     */
    #completedTracePositionForFrame = fallbackPosition => {
        if (typeof this.#completedTracePositionsFactory !== 'function') {
            return fallbackPosition
        }

        return this.#traceFrameForCurrentProgress(this.#completedTracePositionsFactory).positions.at(-1)
            ?? fallbackPosition
    }

    /**
     * Resolves the quantized progress shared by dynamic trace and marker properties.
     *
     * @returns {{progress: number, progressKey: number, progressStep: number}} Current trace progress state.
     */
    #dynamicTraceProgress = () => {
        const progress = Math.max(0, Math.min(1, Number(this.#sample?.progress) || 0))
        const progressStep = globalThis.lgs?.stores?.replay?.playing
            ? DYNAMIC_POLYLINE_PROGRESS_STEP_PLAYING
            : DYNAMIC_POLYLINE_PROGRESS_STEP

        return {
            progress,
            progressKey: Math.round(progress / progressStep),
            progressStep,
        }
    }

    /**
     * Clears dynamic trace snapshots so the next property evaluation rebuilds them.
     *
     * @returns {void}
     */
    #invalidateDynamicTraceFrames = () => {
        this.#dynamicTraceFrames.clear()
    }

    /**
     * Returns one geometry snapshot per dynamic trace factory and progress in the current frame.
     *
     * Sharing this snapshot removes property-evaluation order from marker alignment and keeps all
     * material layers that use the same factory on the same quantized progress sample.
     *
     * @param {Function} positionsFactory - Builds trace positions from the current replay sample.
     * @returns {{sampler: object|null, positionsFactory: Function, progressStep: number, progressKey: number, progress: number, positions: Array}} Shared trace frame.
     */
    #traceFrameForCurrentProgress = positionsFactory => {
        const progressState = this.#dynamicTraceProgress()
        const cachedFrame = this.#dynamicTraceFrames.get(positionsFactory)
        if (
            cachedFrame?.sampler !== this.#sampler
            || cachedFrame.progressStep !== progressState.progressStep
            || cachedFrame.progressKey !== progressState.progressKey
        ) {
            const positions = positionsFactory()
            this.#dynamicTraceFrames.set(positionsFactory, {
                sampler: this.#sampler,
                positionsFactory,
                ...progressState,
                positions: Array.isArray(positions) && positions.length >= 2 ? positions : [],
            })
        }

        return this.#dynamicTraceFrames.get(positionsFactory)
    }

    /**
     * Creates the reactive cursor position that consumes the shared completed-trace frame.
     *
     * @param {Cartesian3} fallbackPosition - Smoothed sample used when completed geometry is unavailable.
     * @returns {CallbackProperty} Cursor position synchronized with the completed trace.
     */
    #cursorPositionFromCompletedTrace = fallbackPosition => {
        this.#cursorTraceFallbackPosition = fallbackPosition
        if (!this.#cursorTracePositionProperty) {
            this.#cursorTracePositionProperty = new CallbackProperty((_time, result) => {
                const position = this.#completedTracePositionForFrame(this.#cursorTraceFallbackPosition)
                return Cartesian3.clone(position, result)
            }, false)
        }
        return this.#cursorTracePositionProperty
    }

    /** Update the projected marker using the same sample and appearance as the completed trace. */
    #updateCursor = (sample, {syncToTrace = false} = {}) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const style = this.#style()
        const longitude = finiteNumber(sample.longitude)
        const latitude = finiteNumber(sample.latitude)
        if (longitude === null || latitude === null) {
            this.#setCursorVisibility(false)
            return
        }

        const rawCursorPosition = Cartesian3.fromDegrees(longitude, latitude, 0)
        const tracePosition = this.#interpolatedSmoothedPosition(sample.progress) ?? rawCursorPosition
        const cursorPosition = syncToTrace
            ? this.#cursorPositionFromCompletedTrace(tracePosition)
            : rawCursorPosition
        // Scale the projected baseline after pixel limits so all three choices stay distinct at every zoom.
        const pointSize = this.#metersToPixels(style.cursorDiameter * 2, tracePosition, 80) * 2 * style.cursorSizeScale
        const outlineWidth = Math.max(0, Number(style.cursorBorder) || 0)
        if (this.#cursorBorder) {
            this.#cursorBorder.show = false
        }

        if (!this.#cursor) {
            this.#cursor = source.entities.add({
                id: `${source.name}#cursor`,
                name: 'JourneyReplay cursor',
                position: cursorPosition,
                point: {
                    pixelSize: pointSize,
                    color: style.cursorColor,
                    outlineColor: style.borderColor,
                    outlineWidth: style.effectMode === REPLAY_EFFECT_NONE ? outlineWidth : 0,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    // Keep depth testing enabled so terrain and 3D tiles can occlude the marker.
                    disableDepthTestDistance: 0,
                },
            })
            this.#syncCursorEffect({cursorPosition, pointSize, style})
            this.#setCursorVisibility(true)
            return
        }

        this.#cursor.position = cursorPosition
        this.#cursor.point.pixelSize = pointSize
        this.#cursor.point.color = style.cursorColor
        this.#cursor.point.outlineColor = style.borderColor
        this.#cursor.point.outlineWidth = style.effectMode === REPLAY_EFFECT_NONE ? outlineWidth : 0
        this.#cursor.point.heightReference = HeightReference.CLAMP_TO_GROUND
        // Keep depth testing enabled so terrain and 3D tiles can occlude the marker.
        this.#cursor.point.disableDepthTestDistance = 0
        this.#syncCursorEffect({cursorPosition, pointSize, style})
        this.#setCursorVisibility(true)
    }

    /**
     * Maintains layered point graphics for the replay marker effects.
     *
     * Cesium exposes point color and outline properties but no native Neon marker material,
     * so the renderer composes the effect from documented point primitives.
     *
     * @param {object} options - Marker position, size, and normalized style values.
     * @returns {void}
     */
    #syncCursorEffect = ({cursorPosition, pointSize, style}) => {
        const source = this.#ensureSource()
        this.#cursorEffectsEnabled = style.effectMode !== REPLAY_EFFECT_NONE
        if (!source || style.effectMode === REPLAY_EFFECT_NONE) {
            if (this.#cursorEffectOuter) {
                this.#cursorEffectOuter.show = false
            }
            if (this.#cursorEffectInner) {
                this.#cursorEffectInner.show = false
            }
            if (this.#cursorEffectCore) {
                this.#cursorEffectCore.show = false
            }
            return
        }

        if (!this.#cursorEffectOuter) {
            this.#cursorEffectOuter = source.entities.add({
                id: `${source.name}#cursor-effect-outer`,
                name: 'JourneyReplay cursor effect outer layer',
                position: cursorPosition,
                point: {
                    pixelSize: pointSize,
                    color: style.effectBorderColor,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: 0,
                },
            })
        }

        const outerAlpha = style.effectMode === REPLAY_EFFECT_NEON ? 0.65 : 0.55
        this.#cursorEffectOuter.position = cursorPosition
        this.#cursorEffectOuter.point.pixelSize = Math.max(pointSize * (style.effectMode === REPLAY_EFFECT_NEON ? 1.65 : 1.5), pointSize + 4)
        this.#cursorEffectOuter.point.color = brightenEffectColor(
            style.effectBorderColor,
            style.effectMode,
        ).withAlpha(style.effectBorderOpacity * outerAlpha)
        this.#cursorEffectOuter.point.heightReference = HeightReference.CLAMP_TO_GROUND
        this.#cursorEffectOuter.point.disableDepthTestDistance = 0
        this.#cursorEffectOuter.show = true

        if (!this.#cursorEffectInner) {
            this.#cursorEffectInner = source.entities.add({
                id: `${source.name}#cursor-effect-inner`,
                name: 'JourneyReplay cursor effect inner transition',
                position: cursorPosition,
                point: {
                    pixelSize: pointSize,
                    color: style.effectFillEdgeColor,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: 0,
                },
            })
        }

        const innerAlpha = style.effectMode === REPLAY_EFFECT_NEON
            ? REPLAY_EFFECT_NEON_FILL_ALPHA
            : REPLAY_EFFECT_GLOW_FILL_ALPHA
        this.#cursorEffectInner.position = cursorPosition
        this.#cursorEffectInner.point.pixelSize = pointSize + (style.effectMode === REPLAY_EFFECT_NEON ? 3 : 2)
        this.#cursorEffectInner.point.color = brightenEffectColor(
            style.effectFillEdgeColor,
            style.effectMode,
        ).withAlpha(style.effectFillOpacity * innerAlpha)
        this.#cursorEffectInner.point.heightReference = HeightReference.CLAMP_TO_GROUND
        this.#cursorEffectInner.point.disableDepthTestDistance = 0
        this.#cursorEffectInner.show = true

        if (style.effectMode !== REPLAY_EFFECT_NEON) {
            if (this.#cursorEffectCore) {
                this.#cursorEffectCore.show = false
            }
            return
        }

        if (!this.#cursorEffectCore) {
            this.#cursorEffectCore = source.entities.add({
                id: `${source.name}#cursor-effect-core`,
                name: 'JourneyReplay cursor effect core layer',
                position: cursorPosition,
                point: {
                    pixelSize: pointSize,
                    color: style.effectFillColor,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: 0,
                },
            })
        }

        this.#cursorEffectCore.position = cursorPosition
        this.#cursorEffectCore.point.pixelSize = Math.max(pointSize * 1.12, pointSize + 1)
        this.#cursorEffectCore.point.color = style.effectFillColor
        this.#cursorEffectCore.point.heightReference = HeightReference.CLAMP_TO_GROUND
        this.#cursorEffectCore.point.disableDepthTestDistance = 0
        this.#cursorEffectCore.show = true
    }

    /** Convert a world-space marker diameter to CSS pixels for the current camera. */
    #metersToPixels = (meters, position, maxPixels = 24) => {
        const viewer = this.#viewer()
        const scene = this.#scene()
        const camera = viewer?.camera
        const canvas = scene?.canvas ?? viewer?.scene?.canvas
        const drawingBufferHeight = finiteNumber(scene?.drawingBufferHeight ?? canvas?.height) ?? 0
        const clientHeight = finiteNumber(canvas?.clientHeight)
        const boundingHeight = finiteNumber(canvas?.getBoundingClientRect?.().height)
        const pixelRatio = finiteNumber(scene?.pixelRatio)
        // PointPrimitiveCollection applies scene.pixelRatio to pixelSize in its shader.
        const cssCanvasHeight = clientHeight > 0
            ? clientHeight
            : boundingHeight > 0
                ? boundingHeight
                : drawingBufferHeight / (pixelRatio > 0 ? pixelRatio : 1)
        const cameraPosition = camera?.positionWC ?? camera?.position
        const hasPosition = isUsableCartesian3(position)
        const hasCameraPosition = isUsableCartesian3(cameraPosition)
        const distance = hasPosition && hasCameraPosition
            ? Math.max(1, Cartesian3.distance(cameraPosition, position))
            : 1
        const fovy = finiteNumber(camera?.frustum?.fovy) ?? (Math.PI / 3)
        const tangent = Math.tan(fovy / 2)
        const pixelsPerMeter = cssCanvasHeight > 0 && Number.isFinite(tangent) && tangent > 0
            ? cssCanvasHeight / (2 * distance * tangent)
            : 1
        const safePixelsPerMeter = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0 ? pixelsPerMeter : 1
        const safeMeters = finiteNumber(meters) ?? 1

        return Math.max(4, Math.min(maxPixels, Math.round(Math.max(1, safeMeters) * safePixelsPerMeter)))
    }

    #polylineGeometryKey = positions => {
        if (!Array.isArray(positions) || positions.length === 0) {
            return '0'
        }

        const first = positions[0]
        const last = positions[positions.length - 1]
        return [
            positions.length,
            first.x.toFixed(3),
            first.y.toFixed(3),
            first.z.toFixed(3),
            last.x.toFixed(3),
            last.y.toFixed(3),
            last.z.toFixed(3),
        ].join(':')
    }

    /**
     * Builds a stable key for Cesium materials, including dynamic glow uniforms.
     *
     * @param {object} material - Cesium material or material property.
     * @returns {string} A key suitable for change detection.
     */
    #materialStyleKey = material => {
        const resolve = value => typeof value?.getValue === 'function' ? value.getValue() : value
        const color = resolve(material?.color)
        const outlineColor = resolve(material?.outlineColor)
        const outlineWidth = resolve(material?.outlineWidth)
        const glowPower = resolve(material?.glowPower)
        const taperPower = resolve(material?.taperPower)
        return [
            material?.constructor?.name ?? 'material',
            color?.toCssColorString?.() ?? `${color ?? ''}`,
            outlineColor?.toCssColorString?.() ?? `${outlineColor ?? ''}`,
            outlineWidth ?? '',
            glowPower ?? '',
            taperPower ?? '',
            material?.toCssColorString?.() ?? '',
        ].join(':')
    }

    #polylineStyleKey = ({width, material, zIndex, clampToGround = true, depthFailMaterial = null}) => [
        width,
        this.#materialStyleKey(material),
        this.#materialStyleKey(depthFailMaterial),
        zIndex,
        clampToGround === false ? 0 : 1,
    ].join(':')

    #polylineOptions = ({positions, width, material, zIndex, clampToGround = true, depthFailMaterial = null}) => {
        const options = {
            positions,
            clampToGround: clampToGround !== false,
            material,
            width,
            arcType: ArcType.GEODESIC,
        }

        if (options.clampToGround) {
            options.granularity = GROUND_POLYLINE_GRANULARITY_METERS
            options.zIndex = zIndex
        } else if (depthFailMaterial) {
            options.depthFailMaterial = depthFailMaterial
        }

        return options
    }

    #syncPolyline = (record, options) => {
        const geometryKey = this.#polylineGeometryKey(options.positions)
        const styleKey = this.#polylineStyleKey(options)
        const geometrySamples = this.#sampler?.samples ?? null
        const geometryGuide = this.#options.smoothedGuide ?? null

        if (record.geometryKey !== geometryKey
            || record.geometrySamples !== geometrySamples
            || record.geometryGuide !== geometryGuide) {
            record.entity.polyline.positions = options.positions
            record.geometryKey = geometryKey
            record.geometrySamples = geometrySamples
            record.geometryGuide = geometryGuide
        }

        if (record.styleKey !== styleKey) {
            record.entity.polyline.width = options.width
            record.entity.polyline.material = options.material
            record.entity.polyline.clampToGround = options.clampToGround !== false
            record.entity.polyline.depthFailMaterial = options.depthFailMaterial ?? undefined
            record.entity.polyline.zIndex = options.clampToGround === false ? undefined : options.zIndex
            record.styleKey = styleKey
        }

        record.entity.show = options.show ?? true
        record.width = options.width
        record.material = options.material
        record.zIndex = options.zIndex
        record.clampToGround = options.clampToGround !== false
        record.depthFailMaterial = options.depthFailMaterial ?? null
        record.show = options.show ?? true
    }

    #freezeDynamicLines = () => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        Array.from(this.#lineEntities.entries()).forEach(([key, record]) => {
            if (record.geometryKey !== 'dynamic' || typeof record.positionsFactory !== 'function') {
                return
            }

            const positions = record.positionsFactory()
            if (!Array.isArray(positions) || positions.length < 2) {
                record.entity.show = false
                record.show = false
                this.#hidePolylineEndCaps(key)
                return
            }

            const options = {
                positions,
                width: record.width,
                material: record.material,
                zIndex: record.zIndex,
                clampToGround: record.clampToGround !== false,
                depthFailMaterial: record.depthFailMaterial ?? null,
                show: record.show !== false && record.entity.show !== false,
            }

            const id = record.entity.id
            const name = record.entity.name
            source.entities.remove(record.entity)
            this.#lineEntities.delete(key)
            this.#upsertPolyline({
                key,
                id,
                name,
                ...options,
            })
            const capOptions = this.#lineCapEntities.get(`${key}#cap:start`)?.options
            if (capOptions) {
                this.#upsertPolylineEndCaps({
                    ...capOptions,
                    positions,
                    positionsFactory: null,
                })
            }
        })
    }

    #upsertPolyline = ({
                           key,
                           id,
                           name,
                           positions,
                           width,
                           material,
                           zIndex,
                           show = true,
                           clampToGround = true,
                           depthFailMaterial = null,
                       }) => {
        const source = this.#ensureSource()
        if (!source || positions.length < 2) {
            return
        }

        const options = {
            positions,
            width,
            material,
            zIndex,
            clampToGround: clampToGround !== false,
            depthFailMaterial,
            show,
        }
        const record = this.#lineEntities.get(key)
        if (
            record?.entity?.polyline
            && record.geometryKey !== 'dynamic'
            && record.clampToGround === options.clampToGround
        ) {
            this.#syncPolyline(record, options)
            return
        }

        if (record?.entity) {
            source.entities.remove(record.entity)
        }

        this.#lineEntities.set(key, {
            entity: source.entities.add({
                id,
                name,
                polyline: this.#polylineOptions(options),
                show,
            }),
            geometryKey: this.#polylineGeometryKey(positions),
            geometrySamples: this.#sampler?.samples ?? null,
            geometryGuide: this.#options.smoothedGuide ?? null,
            styleKey: this.#polylineStyleKey(options),
            width,
            material,
            zIndex,
            clampToGround: options.clampToGround,
            depthFailMaterial,
            show,
        })
    }

    #upsertDynamicPolyline = ({key, id, name, positionsFactory, width, material, zIndex, show = true}) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const styleKey = `${width}:${this.#materialStyleKey(material)}:${zIndex}`
        const record = this.#lineEntities.get(key)
        if (record?.entity?.polyline && record.geometryKey === 'dynamic') {
            if (record.styleKey !== styleKey) {
                record.entity.polyline.width = width
                record.entity.polyline.material = material
                record.entity.polyline.zIndex = zIndex
                record.styleKey = styleKey
            }
            record.positionsFactory = positionsFactory
            record.width = width
            record.material = material
            record.zIndex = zIndex
            record.show = show
            record.entity.show = show
            return
        }

        if (record?.entity) {
            source.entities.remove(record.entity)
        }

        const dynamicRecord = {
            entity: null,
            geometryKey: 'dynamic',
            styleKey,
            positionsFactory,
            width,
            material,
            zIndex,
            clampToGround: true,
            depthFailMaterial: null,
            show,
            lastProgressKey: null,
            lastPositions: [],
        }
        const dynamicPositions = new CallbackProperty(() => {
            const frame = this.#traceFrameForCurrentProgress(dynamicRecord.positionsFactory)
            dynamicRecord.lastProgressKey = frame.progressKey
            dynamicRecord.lastRenderedProgress = frame.progress
            dynamicRecord.lastPositions = frame.positions
            return dynamicRecord.lastPositions
        }, false)

        dynamicRecord.entity = source.entities.add({
            id,
            name,
            polyline: this.#polylineOptions({
                positions: dynamicPositions,
                width,
                material,
                zIndex,
            }),
            show,
        })

        this.#lineEntities.set(key, dynamicRecord)
    }

    /**
     * Add open semicircular caps that close the outline of a rendered Replay polyline.
     *
     * @param {object} options - Polyline endpoints and layered line style.
     * @returns {void}
     */
    #upsertPolylineEndCaps = ({
        key,
        id,
        name,
        positions = null,
        positionsFactory = null,
        fillWidth,
        borderWidth,
        fillColor,
        borderColor,
        show = true,
    }) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const isDynamic = typeof positionsFactory === 'function'
        const hasEndpoints = isDynamic || (Array.isArray(positions) && positions.length >= 2)
        const isVisible = show && hasEndpoints && borderWidth > fillWidth && borderColor?.alpha > 0
        const outlineWidth = Math.max(0, (borderWidth - fillWidth) / 2)
        const styleKey = [
            fillWidth,
            outlineWidth,
            fillColor?.toCssColorString?.() ?? `${fillColor ?? ''}`,
            borderColor?.toCssColorString?.() ?? `${borderColor ?? ''}`,
        ].join('|')

        for (const end of ['start', 'end']) {
            const capKey = `${key}#cap:${end}`
            let record = this.#lineCapEntities.get(capKey)
            if (!record && !isVisible) {
                continue
            }

            if (record && record.isDynamic !== isDynamic) {
                source.entities.remove(record.entity)
                this.#lineCapEntities.delete(capKey)
                record = null
            }

            if (!record) {
                record = {
                    entity: null,
                    end,
                    isDynamic,
                    positions: null,
                    positionsFactory: null,
                    styleKey: null,
                    show: isVisible,
                }
                /** Resolve the latest static or dynamic trace positions for this cap. */
                const positionsFromTrace = () => {
                    if (record.isDynamic) {
                        return this.#traceFrameForCurrentProgress(record.positionsFactory).positions
                    }

                    return record.positions
                }

                /** Resolve the current endpoint position for a dynamic Replay cap. */
                const positionFromTrace = () => {
                    const linePositions = positionsFromTrace()
                    if (!Array.isArray(linePositions) || linePositions.length < 2) {
                        return undefined
                    }

                    return record.end === 'start' ? linePositions[0] : linePositions.at(-1)
                }
                /** Resolve the current screen-space tangent direction for this cap. */
                const rotationFromTrace = () => getPolylineEndCapRotation(
                    lgs.viewer.scene,
                    positionsFromTrace(),
                    record.end,
                )
                record.entity = source.entities.add({
                    id: `${id}#cap-${end}`,
                    name: `${name} endpoint`,
                    position: isDynamic
                        ? new CallbackProperty(positionFromTrace, false)
                        : (end === 'start' ? positions[0] : positions.at(-1)),
                    billboard: {
                        image: createPolylineEndCapImage({fillWidth, borderWidth, fillColor, borderColor}),
                        width: borderWidth / 2,
                        height: borderWidth,
                        horizontalOrigin: HorizontalOrigin.LEFT,
                        verticalOrigin: VerticalOrigin.CENTER,
                        rotation: new CallbackProperty(rotationFromTrace, false),
                        heightReference: HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: 0,
                        zIndex: 42,
                    },
                    show: isVisible,
                })
                this.#lineCapEntities.set(capKey, record)
            }

            record.isDynamic = isDynamic
            record.positions = positions
            record.positionsFactory = positionsFactory
            record.show = isVisible
            record.options = {
                key,
                id,
                name,
                fillWidth,
                borderWidth,
                fillColor,
                borderColor,
                show,
            }
            record.entity.show = isVisible

            if (!isDynamic) {
                record.entity.position = end === 'start' ? positions[0] : positions.at(-1)
            }

            if (record.styleKey !== styleKey) {
                record.entity.billboard.image = createPolylineEndCapImage({fillWidth, borderWidth, fillColor, borderColor})
                record.entity.billboard.width = borderWidth / 2
                record.entity.billboard.height = borderWidth
                record.entity.billboard.horizontalOrigin = HorizontalOrigin.LEFT
                record.entity.billboard.verticalOrigin = VerticalOrigin.CENTER
                record.entity.billboard.heightReference = HeightReference.CLAMP_TO_GROUND
                record.entity.billboard.disableDepthTestDistance = 0
                record.entity.billboard.zIndex = 42
                record.styleKey = styleKey
            }
        }
    }

    /**
     * Synchronize endpoint caps with the Replay border and fill layers.
     *
     * @param {object} options - Active line geometry and normalized Replay style.
     * @returns {void}
     */
    #syncTraceLineCaps = ({key, id, name, positions, positionsFactory, style, fillWidth, borderWidth, show = true}) => {
        const hasEffect = style.effectMode !== REPLAY_EFFECT_NONE
        this.#upsertPolylineEndCaps({
            key,
            id,
            name,
            positions,
            positionsFactory,
            fillWidth,
            borderWidth,
            fillColor: hasEffect ? style.effectFillColor : style.fillColor,
            borderColor: hasEffect ? style.effectBorderColor : style.borderColor,
            show,
        })
    }

    #updateCompletedLines = (sample, {staticGeometry = false} = {}) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        const smoothedPositions = this.#smoothedGuideEntries()
        this.#invalidateDynamicTraceFrames()
        if (smoothedPositions.length >= 2) {
            const fillWidth = style.fillWidth
            const borderWidth = fillWidth + (style.borderWidth * 2)
            const renderedFillWidth = this.#traceWidth(style, fillWidth)
            const renderedInnerGlowWidth = this.#traceWidth(style, fillWidth, 'inner-glow')
            const renderedBorderWidth = this.#traceWidth(style, borderWidth, 'border')
            const activeKeys = new Set(['smoothed#border', 'smoothed#fill'])
            if (style.effectMode !== REPLAY_EFFECT_NONE) {
                activeKeys.add('smoothed#inner-glow')
            }
            const replayStore = globalThis.lgs?.stores?.replay
            const playing = replayStore?.playing === true && replayStore?.recordingSync !== true

            if (staticGeometry) {
                this.#completedTracePositionsFactory = null
                const positions = this.#completedSmoothedPositions()
                replayVideoTraceDebug('renderer.completed.stop.static', {
                    source: source.name ?? null,
                    positions: positions.length,
                    fillWidth,
                    borderWidth,
                    fillColor: style.fillColor?.toCssColorString?.() ?? null,
                    borderColor: style.borderColor?.toCssColorString?.() ?? null,
                })
                if (positions.length >= 2) {
                    this.#upsertPolyline({
                        key: 'smoothed#border',
                        id: `${source.name}#completed#smoothed#border`,
                        name: 'JourneyReplay completed track border',
                        positions,
                        material: this.#traceMaterial(style, style.borderColor, style.effectBorderColor, 'border'),
                        width: renderedBorderWidth,
                        zIndex: PROGRESS_Z_INDEX_BORDER,
                        clampToGround: true,
                    })
                    this.#syncTraceLineCaps({
                        key: 'smoothed#border',
                        id: `${source.name}#completed#smoothed#border`,
                        name: 'JourneyReplay completed track border',
                        positions,
                        style,
                        fillWidth: renderedFillWidth,
                        borderWidth: renderedBorderWidth,
                    })
                    this.#upsertPolyline({
                        key: 'smoothed#inner-glow',
                        id: `${source.name}#completed#smoothed#inner-glow`,
                        name: 'JourneyReplay completed track inner glow',
                        positions,
                        material: this.#traceMaterial(style, style.fillColor, style.effectFillEdgeColor, 'inner-glow'),
                        width: renderedInnerGlowWidth,
                        zIndex: PROGRESS_Z_INDEX_BORDER + 0.5,
                        clampToGround: true,
                    })
                    this.#upsertPolyline({
                        key: 'smoothed#fill',
                        id: `${source.name}#completed#smoothed#fill`,
                        name: 'JourneyReplay completed track',
                        positions,
                        material: this.#traceMaterial(style, style.fillColor, style.effectFillColor, 'core'),
                        width: renderedFillWidth,
                        zIndex: PROGRESS_Z_INDEX_FILL,
                        clampToGround: true,
                    })
                } else {
                    this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX))
                    return
                }
                this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            if (playing) {
                this.#completedTracePositionsFactory = this.#liveCompletedSmoothedPositions
                this.#upsertDynamicPolyline({
                    key: 'smoothed#border',
                    id: `${source.name}#completed#smoothed#border`,
                    name: 'JourneyReplay completed track border',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material: this.#traceMaterial(style, style.borderColor, style.effectBorderColor, 'border'),
                    width: renderedBorderWidth,
                    zIndex: PROGRESS_Z_INDEX_BORDER,
                })
                this.#syncTraceLineCaps({
                    key: 'smoothed#border',
                    id: `${source.name}#completed#smoothed#border`,
                    name: 'JourneyReplay completed track border',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    style,
                    fillWidth: renderedFillWidth,
                    borderWidth: renderedBorderWidth,
                })
                this.#upsertDynamicPolyline({
                    key: 'smoothed#inner-glow',
                    id: `${source.name}#completed#smoothed#inner-glow`,
                    name: 'JourneyReplay completed track inner glow',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material: this.#traceMaterial(style, style.fillColor, style.effectFillEdgeColor, 'inner-glow'),
                    width: renderedInnerGlowWidth,
                    zIndex: PROGRESS_Z_INDEX_BORDER + 0.5,
                })
                this.#upsertDynamicPolyline({
                    key: 'smoothed#fill',
                    id: `${source.name}#completed#smoothed#fill`,
                    name: 'JourneyReplay completed track',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material: this.#traceMaterial(style, style.fillColor, style.effectFillColor, 'core'),
                    width: renderedFillWidth,
                    zIndex: PROGRESS_Z_INDEX_FILL,
                })
                this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            this.#completedTracePositionsFactory = this.#completedSmoothedPositions
            this.#upsertDynamicPolyline({
                key: 'smoothed#border',
                id: `${source.name}#completed#smoothed#border`,
                name: 'JourneyReplay completed track border',
                positionsFactory: this.#completedSmoothedPositions,
                material: this.#traceMaterial(style, style.borderColor, style.effectBorderColor, 'border'),
                width: renderedBorderWidth,
                zIndex: PROGRESS_Z_INDEX_BORDER,
            })
            this.#syncTraceLineCaps({
                key: 'smoothed#border',
                id: `${source.name}#completed#smoothed#border`,
                name: 'JourneyReplay completed track border',
                positionsFactory: this.#completedSmoothedPositions,
                style,
                fillWidth: renderedFillWidth,
                borderWidth: renderedBorderWidth,
            })
            this.#upsertDynamicPolyline({
                key: 'smoothed#inner-glow',
                id: `${source.name}#completed#smoothed#inner-glow`,
                name: 'JourneyReplay completed track inner glow',
                positionsFactory: this.#completedSmoothedPositions,
                material: this.#traceMaterial(style, style.fillColor, style.effectFillEdgeColor, 'inner-glow'),
                width: renderedInnerGlowWidth,
                zIndex: PROGRESS_Z_INDEX_BORDER + 0.5,
            })
            this.#upsertDynamicPolyline({
                key: 'smoothed#fill',
                id: `${source.name}#completed#smoothed#fill`,
                name: 'JourneyReplay completed track',
                positionsFactory: this.#completedSmoothedPositions,
                material: this.#traceMaterial(style, style.fillColor, style.effectFillColor, 'core'),
                width: renderedFillWidth,
                zIndex: PROGRESS_Z_INDEX_FILL,
            })

            this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
            return
        }

        this.#completedTracePositionsFactory = null
        const segments = this.#sampler.completedSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const fillWidth = style.fillWidth
            const borderWidth = fillWidth + (style.borderWidth * 2)
            const renderedFillWidth = this.#traceWidth(style, fillWidth)
            const renderedInnerGlowWidth = this.#traceWidth(style, fillWidth, 'inner-glow')
            const renderedBorderWidth = this.#traceWidth(style, borderWidth, 'border')
            if (positions.length < 2) {
                return
            }

            const borderKey = `${segment.key}#border`
            activeKeys.add(borderKey)
            this.#upsertPolyline({
                key: borderKey,
                id: `${source.name}#completed#${borderKey}`,
                name: 'JourneyReplay completed track border',
                positions,
                material: this.#traceMaterial(style, style.borderColor, style.effectBorderColor, 'border'),
                width: renderedBorderWidth,
                zIndex: PROGRESS_Z_INDEX_BORDER,
            })
            this.#syncTraceLineCaps({
                key: borderKey,
                id: `${source.name}#completed#${borderKey}`,
                name: 'JourneyReplay completed track border',
                positions,
                style,
                fillWidth: renderedFillWidth,
                borderWidth: renderedBorderWidth,
            })

            const innerGlowKey = `${segment.key}#inner-glow`
            activeKeys.add(innerGlowKey)
            this.#upsertPolyline({
                key: innerGlowKey,
                id: `${source.name}#completed#${innerGlowKey}`,
                name: 'JourneyReplay completed track inner glow',
                positions,
                material: this.#traceMaterial(style, style.fillColor, style.effectFillEdgeColor, 'inner-glow'),
                width: renderedInnerGlowWidth,
                zIndex: PROGRESS_Z_INDEX_BORDER + 0.5,
            })

            const fillKey = `${segment.key}#fill`
            activeKeys.add(fillKey)
            this.#upsertPolyline({
                key: fillKey,
                id: `${source.name}#completed#${fillKey}`,
                name: 'JourneyReplay completed track',
                positions,
                material: this.#traceMaterial(style, style.fillColor, style.effectFillColor, 'core'),
                width: renderedFillWidth,
                zIndex: PROGRESS_Z_INDEX_FILL,
            })
        })

        this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
    }

    #updateRemainingLines = (sample, {hideRemainingTrace = false} = {}) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        if (hideRemainingTrace || style.traceMode !== REPLAY_TRACE_MODE_FULL) {
            this.#hideRemainingLines()
            return
        }

        const smoothedPositions = this.#smoothedGuideEntries()
        if (smoothedPositions.length >= 2) {
            const fillWidth = this.#traceWidth(style, style.fillWidth, 'border')
            const activeKeys = new Set([`${REMAINING_KEY_PREFIX}smoothed#fill`])
            const trackStyle = style.remainingUseDefinedTrackStyle ? this.#trackStyleForSegment(this.#sampler?.segments?.[0]) : null
            const remainingMaterial = style.remainingUseDefinedTrackStyle && trackStyle
                ? TrackUtils.createTrackMaterial(trackStyle, trackStyle.color)
                : style.remainingColor
            const replayStore = globalThis.lgs?.stores?.replay
            const playing = replayStore?.playing === true && replayStore?.recordingSync !== true
            if (playing) {
                this.#upsertDynamicPolyline({
                    key: `${REMAINING_KEY_PREFIX}smoothed#fill`,
                    id: `${source.name}#remaining#smoothed#fill`,
                    name: 'JourneyReplay remaining track',
                    positionsFactory: this.#liveRemainingSmoothedPositions,
                    material: this.#traceMaterial(style, remainingMaterial, style.effectFillColor, 'border'),
                    width: fillWidth,
                    zIndex: PROGRESS_Z_INDEX_REMAINING_FILL,
                })
                this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            this.#upsertDynamicPolyline({
                key: `${REMAINING_KEY_PREFIX}smoothed#fill`,
                id: `${source.name}#remaining#smoothed#fill`,
                name: 'JourneyReplay remaining track',
                positionsFactory: this.#remainingSmoothedPositions,
                material: this.#traceMaterial(style, remainingMaterial, style.effectFillColor, 'border'),
                width: fillWidth,
                zIndex: PROGRESS_Z_INDEX_REMAINING_FILL,
            })

            this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
            return
        }

        const segments = this.#sampler.remainingSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const fillWidth = this.#traceWidth(style, style.fillWidth, 'border')
            if (positions.length < 2) {
                return
            }
            const trackStyle = style.remainingUseDefinedTrackStyle ? this.#trackStyleForSegment(segment) : null
            const remainingMaterial = style.remainingUseDefinedTrackStyle && trackStyle
                ? TrackUtils.createTrackMaterial(trackStyle, trackStyle.color)
                : style.remainingColor

            const fillKey = `${REMAINING_KEY_PREFIX}${segment.key}#fill`
            activeKeys.add(fillKey)
            this.#upsertPolyline({
                key: fillKey,
                id: `${source.name}#remaining#${segment.key}#fill`,
                name: 'JourneyReplay remaining track',
                positions,
                material: this.#traceMaterial(style, remainingMaterial, style.effectFillColor, 'border'),
                width: fillWidth,
                zIndex: PROGRESS_Z_INDEX_REMAINING_FILL,
            })
        })

        this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
    }
}
