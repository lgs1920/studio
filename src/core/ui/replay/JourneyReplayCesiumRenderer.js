/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCesiumRenderer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-28
 * Last modified: 2026-05-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { normalizeTrackRenderSmoothing, smoothCoordinateSegment } from '@Utils/cesium/trackRenderSmoothing'
import { TrackUtils }                                              from '@Utils/cesium/TrackUtils'
import {
    ArcType, CallbackProperty, Cartesian3, Cartographic, Color, CustomDataSource, HeightReference,
}                                                                 from 'cesium'
import {
    REPLAY_TRACE_MODE_FULL, getJourneyReplaySettings, normalizeJourneyReplayProgressionStyle, normalizeJourneyReplayTrace,
}                                                                 from './JourneyReplayProgressionStyle'
import { replayVideoTraceDebug }                                  from './ReplayVideoTraceDebug'

export const REPLAY_DATA_SOURCE_PREFIX = 'replay'

const DEFAULT_COLOR = '#ff6a00'
const DEFAULT_BORDER = '#FFFFFF'

const CURSOR_MIN_RADIUS_METERS = 0.1
const MIN_PROGRESS_WIDTH = 3
const MIN_PROGRESS_BORDER_WIDTH = 1
const PROGRESS_Z_INDEX_REMAINING_FILL = 39
const PROGRESS_Z_INDEX_BORDER = 40
const PROGRESS_Z_INDEX_FILL = 41
const REMAINING_KEY_PREFIX = 'remaining:'
const PATH_GEOMETRY_UPDATE_INTERVAL = 120
const DYNAMIC_POLYLINE_PROGRESS_STEP = 0.002
const DYNAMIC_POLYLINE_PROGRESS_STEP_PLAYING = 0.00025
const LIVE_PROGRESS_MAX_POINTS = 2048
const GROUND_POLYLINE_GRANULARITY_METERS = 8
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
    #lineEntities = new Map()
    #sampler = null
    #journeySlug = null
    #options = {}
    #sample = null
    #lastPathGeometryUpdate = 0
    #lastPathGeometryDistance = null
    #sourceRaised = false
    #sourceAddPending = false
    #maskedTrackSources = new Map()
    #traceGuide = null
    #traceGuideKey = null
    #traceHidden = false

    constructor(options = {}) {
        this.#options = options
    }

    show = ({sampler, options = {}} = {}) => {
        this.#sampler = sampler ?? this.#sampler
        this.#options = {...this.#options, ...options}
        this.#journeySlug = this.#sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#ensureSource()
        if (this.#source) {
            this.#source.show = false
        }
        this.#raiseSourceToTop()
        this.#maskOriginalTrackSources()
        return this
    }

    update = ({
                  sample,
                  sampler = this.#sampler,
                  forceGeometry = false,
                  freezeDynamic = false,
                  hideCursor = false,
                  hideTrace = false,
                  showTrace = true,
                  hideRemainingTrace = false,
                  staticCompletedTrace = false,
                  completedTraceMode = staticCompletedTrace ? 'static' : 'dynamic',
              } = {}) => {
        if (!sample || !sampler) {
            return
        }

        this.#sampler = sampler
        this.#sample = sample
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
        const shouldUpdateGeometry = forceGeometry
                                     || (!hideTrace && wasTraceHidden)
                                     || (!freezeDynamic && this.#shouldUpdatePathGeometry(sample))
        if (shouldUpdateGeometry) {
            this.#updateCompletedLines(sample, {staticGeometry: completedTraceMode === 'static'})
            this.#updateRemainingLines(sample, {hideRemainingTrace})
        }
        else if (hideRemainingTrace) {
            this.#hideRemainingLines()
        }
        if (freezeDynamic && !staticCompletedTrace) {
            this.#freezeDynamicLines()
        }
        if (hideTrace || !showTrace) {
            this.#hideLineEntities(() => true)
        }
        if (this.#source) {
            this.#source.show = !hideTrace && showTrace
        }
        this.#traceHidden = hideTrace || !showTrace
        this.#updateCursor(sample)
        this.#syncCursorVisibilityWithTrace({hideCursor: hideCursor || !showTrace})
        if (stopCompletedTrace) {
            replayVideoTraceDebug('renderer.update.stop.end', {
                progress: sample.progress,
                shouldUpdateGeometry,
                completedTraceMode,
                entities: this.#traceEntitySummary(),
            })
        }
        globalThis.lgs?.scene?.requestRender?.()
    }

    #traceEntitySummary = () => {
        const summary = {
            records:  this.#lineEntities.size,
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

    clear = () => {
        const source = this.#source

        if (this.#source) {
            try {
                this.#source.entities.removeAll()
                this.#source.show = false
            }
            catch {
                // The source may already have been removed by Cesium during a journey switch.
            }
        }

        this.#restoreOriginalTrackSources()
        this.#removeSource(source)

        this.#cursor = null
        this.#cursorBorder = null
        this.#lineEntities.clear()
        this.#sampler = null
        this.#sample = null
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        this.#traceGuide = null
        this.#traceGuideKey = null
        this.#traceHidden = false
        globalThis.lgs?.scene?.requestRender?.()
    }

    hideCursor = () => {
        this.#setCursorVisibility(false)
        globalThis.lgs?.scene?.requestRender?.()
    }

    #setCursorVisibility = (visible) => {
        if (this.#cursor) {
            this.#cursor.show = visible
        }
        if (this.#cursorBorder) {
            this.#cursorBorder.show = false
        }
    }

    #hasVisibleTraceEntity = () => Array.from(this.#lineEntities.values())
        .some(record => Boolean(record?.entity?.polyline) && record.entity.show !== false)

    #syncCursorVisibilityWithTrace = ({hideCursor = false} = {}) => {
        this.#setCursorVisibility(!hideCursor && this.#hasVisibleTraceEntity())
    }

    #resetSourceEntities = () => {
        this.#cursor = null
        this.#cursorBorder = null
        this.#lineEntities.clear()
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        this.#traceGuide = null
        this.#traceGuideKey = null
        this.#traceHidden = false
    }

    #dataSources = () => globalThis.lgs?.viewer?.dataSources ?? null

    #sourceInCollection = (source = this.#source) => {
        const dataSources = this.#dataSources()
        return Boolean(source && dataSources?.contains?.(source))
    }

    #removeSource = (source = this.#source) => {
        const dataSources = this.#dataSources()

        if (source && dataSources?.contains?.(source)) {
            try {
                dataSources.remove?.(source, true)
            }
            catch {
                // The source may already have been removed by Cesium during scene cleanup.
            }
        }

        if (this.#source === source) {
            this.#source = null
        }
        this.#sourceAddPending = false
    }

    #ensureSource = () => {
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

        const name = `${REPLAY_DATA_SOURCE_PREFIX}#${this.#journeySlug ?? 'current'}`
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
                globalThis.lgs?.scene?.requestRender?.()
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

    #shouldUpdatePathGeometry = (sample) => {
        if (globalThis.lgs?.stores?.replay?.playing) {
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

    #hideLineEntities = predicate => {
        Array.from(this.#lineEntities.entries()).forEach(([key, record]) => {
            if (predicate(key, record)) {
                record.entity.show = false
                record.show = false
            }
        })
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

            const globe = globalThis.lgs?.scene?.globe ?? globalThis.lgs?.viewer?.scene?.globe ?? null
            const terrainHeight = finiteNumber(globe?.getHeight?.(cartographic))
            const height = terrainHeight ?? finiteNumber(cartographic.height) ?? 0
            return Cartesian3.fromRadians(
                cartographic.longitude,
                cartographic.latitude,
                height,
            )
        })
        .filter(Boolean)

    #groundPositionsFromCoordinates = coordinates => coordinates
        .map(coordinate => this.#groundPositionFromCoordinate(coordinate))
        .filter(Boolean)

    #trackSource = trackSlug => globalThis.lgs?.viewer?.dataSources?.getByName?.(trackSlug)?.[0] ?? null

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

    #smoothedGroundPositions = () => this.#smoothedGuideEntries().map(entry => entry.position)

    #traceGuideKeyForSampler = smoothing => {
        const samples = this.#sampler?.samples ?? []
        const first = samples[0]
        const last = samples[samples.length - 1]
        return [
            this.#journeySlug,
            samples.length,
            first?.progress ?? 0,
            first?.longitude ?? 0,
            first?.latitude ?? 0,
            last?.progress ?? 1,
            last?.longitude ?? 0,
            last?.latitude ?? 0,
            smoothing.enabled ? 1 : 0,
            smoothing.step,
        ].join(':')
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
        const smoothing = normalizeTrackRenderSmoothing(
            globalThis.lgs?.settings?.getJourney?.renderSmoothing,
            {enabled: false, step: 1},
        )
        const key = this.#traceGuideKeyForSampler(smoothing)
        if (this.#traceGuide && this.#traceGuideKey === key) {
            return this.#traceGuide
        }

        const raw = this.#rawTraceGuideEntries()

        if (!smoothing.enabled) {
            this.#traceGuide = raw
            this.#traceGuideKey = key
            return raw
        }

        const coordinates = raw.map(entry => [entry.longitude, entry.latitude, entry.progress])
        const smoothedCoordinates = smoothCoordinateSegment(coordinates, smoothing.step)
        const guide = smoothedCoordinates.map(coordinate => {
            const longitude = finiteNumber(coordinate[0])
            const latitude = finiteNumber(coordinate[1])
            const progress = finiteNumber(coordinate[2])
            if (longitude === null || latitude === null || progress === null) {
                return null
            }

            return {
                longitude,
                latitude,
                position: this.#groundPositionFromCoordinate({longitude, latitude}),
                progress,
            }
        }).filter(Boolean)

        this.#traceGuide = guide
        this.#traceGuideKey = key
        return guide
    }

    #smoothedGuideEntries = () => {
        const providedGuide = (this.#options.smoothedGuide ?? [])
            .map(entry => {
                const position = this.#groundPositionFromCoordinate(entry)
                const progress = finiteNumber(entry?.progress)
                if (!position || progress === null) {
                    return null
                }

                return {
                    longitude: Number(entry.longitude),
                    latitude:  Number(entry.latitude),
                    position,
                    progress,
                }
            })
            .filter(Boolean)

        if (providedGuide.length >= 2) {
            return providedGuide
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
            }
            else {
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
        if (!Array.isArray(positions) || positions.length <= LIVE_PROGRESS_MAX_POINTS) {
            return positions ?? []
        }

        const lastIndex = positions.length - 1
        const selected = []
        for (let index = 0; index < LIVE_PROGRESS_MAX_POINTS; index += 1) {
            const sourceIndex = Math.round((index * lastIndex) / (LIVE_PROGRESS_MAX_POINTS - 1))
            const position = positions[sourceIndex]
            if (position && position !== selected[selected.length - 1]) {
                selected.push(position)
            }
        }

        return selected
    }

    #completedSmoothedPositions = () => {
        const {guide, leftIndex} = this.#smoothedProgressCursor()
        const positions = guide.map(entry => entry.position)
        if (positions.length < 2) {
            return positions
        }

        if ((Number(this.#sample?.progress) || 0) >= 1) {
            return this.#limitTracePositions(positions)
        }

        const completed = positions.slice(0, leftIndex + 1)
        const interpolated = this.#interpolatedSmoothedPosition()
        const lastCompleted = completed[completed.length - 1]

        if (interpolated && interpolated !== lastCompleted) {
            completed.push(interpolated)
        }

        return this.#limitTracePositions(completed)
    }

    #liveCompletedSmoothedPositions = () => {
        const {guide, leftIndex} = this.#smoothedProgressCursor()
        if (guide.length < 2) {
            return guide.map(entry => entry.position)
        }

        if ((Number(this.#sample?.progress) || 0) >= 1) {
            return this.#limitTracePositions(guide.map(entry => entry.position))
        }

        const completed = guide.slice(0, leftIndex + 1).map(entry => entry.position)

        const interpolated = this.#interpolatedSmoothedPosition()
        const lastWithAnchor = completed[completed.length - 1]
        if (interpolated && interpolated !== lastWithAnchor) {
            completed.push(interpolated)
        }
        if (completed.length < 2 && guide[1]?.position) {
            completed.push(guide[1].position)
        }

        return this.#limitTracePositions(completed)
    }

    #remainingSmoothedPositions = () => {
        const {guide, rightIndex} = this.#smoothedProgressCursor()
        const positions = guide.map(entry => entry.position)
        if (positions.length < 2) {
            return positions
        }

        const interpolated = this.#interpolatedSmoothedPosition()
        const remaining = positions.slice(rightIndex)

        return this.#limitTracePositions(interpolated ? [interpolated, ...remaining] : remaining)
    }

    #liveRemainingSmoothedPositions = () => {
        const {guide, rightIndex} = this.#smoothedProgressCursor()
        if (guide.length < 2) {
            return guide.map(entry => entry.position)
        }

        const stride = Math.max(1, Math.ceil(guide.length / Math.max(2, LIVE_PROGRESS_MAX_POINTS - 1)))
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

    #style = () => {
        const settings = getJourneyReplaySettings()
        const progression = normalizeJourneyReplayProgressionStyle(
            globalThis.lgs?.stores?.replay?.progression ?? settings.progression,
        )
        const trace = normalizeJourneyReplayTrace(globalThis.lgs?.stores?.replay?.trace ?? settings.trace)
        const fill = progression.fill
        const border = progression.border
        const remaining = trace.remaining
        const fillColor = fill.color ?? this.#options.color ?? DEFAULT_COLOR
        const borderColor = border.color ?? this.#options.border ?? DEFAULT_BORDER

        return {
            traceMode:      trace.mode,
            fillColor:      cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR)).withAlpha(fill.opacity),
            cursorColor:    cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR)).withAlpha(Math.max(0.85, fill.opacity)),
            borderColor:    cssColor(borderColor, Color.WHITE).withAlpha(border.opacity),
            remainingColor: cssColor(remaining.color, Color.GRAY).withAlpha(remaining.opacity),
            remainingUseDefinedTrackStyle: remaining.useDefinedTrackStyle !== false,
            fillWidth:      Math.max(MIN_PROGRESS_WIDTH, fill.width),
            borderWidth:    Math.max(MIN_PROGRESS_BORDER_WIDTH, border.width),
            cursorDiameter:  Math.max(CURSOR_MIN_RADIUS_METERS * 2, fill.width),
            cursorBorder:    Math.max(0, border.width),
        }
    }

    #trackStyleForSegment = (segment) => {
        const track = this.#sampler?.journey?.tracks?.get?.(segment?.trackSlug)
        return TrackUtils.getTrackRenderStyle(track)
    }

    #updateCursor = (sample) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const style = this.#style()
        const cursorPosition = Cartesian3.fromDegrees(sample.longitude, sample.latitude, 0)
        const pointSize = this.#metersToPixels(style.cursorDiameter * 2, cursorPosition, 80) * 2
        const outlineWidth = Math.max(0, Number(style.cursorBorder) || 0)
        if (this.#cursorBorder) {
            this.#cursorBorder.show = false
        }

        if (!this.#cursor) {
            this.#cursor = source.entities.add({
                id:       `${source.name}#cursor`,
                name:     'JourneyReplay cursor',
                position: cursorPosition,
                point:    {
                    pixelSize:       pointSize,
                    color:           style.cursorColor,
                    outlineColor:    style.borderColor,
                    outlineWidth,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    // Keep depth testing enabled so terrain and 3D tiles can occlude the marker.
                    disableDepthTestDistance: 0,
                },
            })
            this.#setCursorVisibility(true)
            return
        }

        this.#cursor.position = cursorPosition
        this.#cursor.point.pixelSize = pointSize
        this.#cursor.point.color = style.cursorColor
        this.#cursor.point.outlineColor = style.borderColor
        this.#cursor.point.outlineWidth = outlineWidth
        this.#cursor.point.heightReference = HeightReference.CLAMP_TO_GROUND
        // Keep depth testing enabled so terrain and 3D tiles can occlude the marker.
        this.#cursor.point.disableDepthTestDistance = 0
        this.#setCursorVisibility(true)
    }

    #metersToPixels = (meters, position, maxPixels = 24) => {
        const viewer = globalThis.lgs?.viewer
        const camera = viewer?.camera
        const canvasHeight = viewer?.scene?.canvas?.height ?? globalThis.lgs?.scene?.canvas?.height ?? 0
        const cameraPosition = camera?.positionWC ?? camera?.position
        const distance = Math.max(1, Cartesian3.distance(cameraPosition ?? position, position))
        const fovy = camera?.frustum?.fovy ?? (Math.PI / 3)
        const pixelsPerMeter = canvasHeight > 0
                              ? canvasHeight / (2 * distance * Math.tan(fovy / 2))
                              : 1

        return Math.max(4, Math.min(maxPixels, Math.round(Math.max(1, meters) * pixelsPerMeter)))
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

    #polylineStyleKey = ({width, material, zIndex, clampToGround = true, depthFailMaterial = null}) => [
        width,
        material?.toCssColorString?.() ?? `${material}`,
        depthFailMaterial?.toCssColorString?.() ?? `${depthFailMaterial ?? ''}`,
        zIndex,
        clampToGround === false ? 0 : 1,
    ].join(':')

    #polylineOptions = ({positions, width, material, zIndex, clampToGround = true, depthFailMaterial = null}) => {
        const options = {
            positions,
            clampToGround: clampToGround !== false,
            material,
            width,
            arcType:       ArcType.GEODESIC,
        }

        if (options.clampToGround) {
            options.granularity = GROUND_POLYLINE_GRANULARITY_METERS
            options.zIndex = zIndex
        }
        else if (depthFailMaterial) {
            options.depthFailMaterial = depthFailMaterial
        }

        return options
    }

    #syncPolyline = (record, options) => {
        const geometryKey = this.#polylineGeometryKey(options.positions)
        const styleKey = this.#polylineStyleKey(options)

        if (record.geometryKey !== geometryKey) {
            record.entity.polyline.positions = options.positions
            record.geometryKey = geometryKey
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
                return
            }

            const options = {
                positions,
                width:    record.width,
                material: record.material,
                zIndex:   record.zIndex,
                clampToGround: record.clampToGround !== false,
                depthFailMaterial: record.depthFailMaterial ?? null,
                show:     record.show !== false && record.entity.show !== false,
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
            entity:      source.entities.add({
                id,
                name,
                polyline: this.#polylineOptions(options),
                show,
            }),
            geometryKey: this.#polylineGeometryKey(positions),
            styleKey:    this.#polylineStyleKey(options),
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

        const styleKey = `${width}:${material?.toCssColorString?.() ?? `${material}`}:${zIndex}`
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
            entity:           null,
            geometryKey:      'dynamic',
            styleKey,
            positionsFactory,
            width,
            material,
            zIndex,
            clampToGround: true,
            depthFailMaterial: null,
            show,
            lastProgressKey:  null,
            lastPositions:    [],
        }
        const dynamicPositions = new CallbackProperty(() => {
            const progress = Math.max(0, Math.min(1, Number(this.#sample?.progress) || 0))
            const progressStep = globalThis.lgs?.stores?.replay?.playing
                                 ? DYNAMIC_POLYLINE_PROGRESS_STEP_PLAYING
                                 : DYNAMIC_POLYLINE_PROGRESS_STEP
            const progressKey = Math.round(progress / progressStep)
            if (dynamicRecord.lastProgressKey === progressKey) {
                return dynamicRecord.lastPositions
            }

            const positions = dynamicRecord.positionsFactory()
            dynamicRecord.lastProgressKey = progressKey
            dynamicRecord.lastPositions = Array.isArray(positions) && positions.length >= 2 ? positions : []
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

    #updateCompletedLines = (sample, {staticGeometry = false} = {}) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        const smoothedPositions = this.#smoothedGroundPositions()
        if (smoothedPositions.length >= 2) {
            const fillWidth = style.fillWidth
            const borderWidth = Math.max(fillWidth + (style.borderWidth * 2), fillWidth + 2)
            const activeKeys = new Set(['smoothed#border', 'smoothed#fill'])
            const replayStore = globalThis.lgs?.stores?.replay
            const playing = replayStore?.playing === true && replayStore?.recordingSync !== true

            if (staticGeometry) {
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
                        key:               'smoothed#border',
                        id:                `${source.name}#completed#smoothed#border`,
                        name:              'JourneyReplay completed track border',
                        positions,
                        material:          style.borderColor,
                        width:             borderWidth,
                        zIndex:            PROGRESS_Z_INDEX_BORDER,
                        clampToGround:     true,
                    })
                    this.#upsertPolyline({
                        key:               'smoothed#fill',
                        id:                `${source.name}#completed#smoothed#fill`,
                        name:              'JourneyReplay completed track',
                        positions,
                        material:          style.fillColor,
                        width:             fillWidth,
                        zIndex:            PROGRESS_Z_INDEX_FILL,
                        clampToGround:     true,
                    })
                }
                else {
                    this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX))
                    return
                }
                this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            if (playing) {
                this.#upsertDynamicPolyline({
                    key:       'smoothed#border',
                    id:        `${source.name}#completed#smoothed#border`,
                    name:      'JourneyReplay completed track border',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material:  style.borderColor,
                    width:     borderWidth,
                    zIndex:    PROGRESS_Z_INDEX_BORDER,
                })
                this.#upsertDynamicPolyline({
                    key:       'smoothed#fill',
                    id:        `${source.name}#completed#smoothed#fill`,
                    name:      'JourneyReplay completed track',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material:  style.fillColor,
                    width:     fillWidth,
                    zIndex:    PROGRESS_Z_INDEX_FILL,
                })
                this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            this.#upsertDynamicPolyline({
                key:       'smoothed#border',
                id:        `${source.name}#completed#smoothed#border`,
                name:      'JourneyReplay completed track border',
                positionsFactory: this.#completedSmoothedPositions,
                material:  style.borderColor,
                width:     borderWidth,
                zIndex:    PROGRESS_Z_INDEX_BORDER,
            })
            this.#upsertDynamicPolyline({
                key:       'smoothed#fill',
                id:        `${source.name}#completed#smoothed#fill`,
                name:      'JourneyReplay completed track',
                positionsFactory: this.#completedSmoothedPositions,
                material:  style.fillColor,
                width:     fillWidth,
                zIndex:    PROGRESS_Z_INDEX_FILL,
            })

            this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
            return
        }

        const segments = this.#sampler.completedSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const fillWidth = style.fillWidth
            const borderWidth = Math.max(fillWidth + (style.borderWidth * 2), fillWidth + 2)
            if (positions.length < 2) {
                return
            }

            const borderKey = `${segment.key}#border`
            activeKeys.add(borderKey)
            this.#upsertPolyline({
                                     key:       borderKey,
                                     id:        `${source.name}#completed#${borderKey}`,
                                     name:      'JourneyReplay completed track border',
                                     positions,
                                     material:  style.borderColor,
                                     width:     borderWidth,
                                     zIndex:    PROGRESS_Z_INDEX_BORDER,
                                 })

            const fillKey = `${segment.key}#fill`
            activeKeys.add(fillKey)
            this.#upsertPolyline({
                                     key:       fillKey,
                                     id:        `${source.name}#completed#${fillKey}`,
                                     name:      'JourneyReplay completed track',
                                     positions,
                                     material:  style.fillColor,
                                     width:     fillWidth,
                                     zIndex:    PROGRESS_Z_INDEX_FILL,
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

        const smoothedPositions = this.#smoothedGroundPositions()
        if (smoothedPositions.length >= 2) {
            const fillWidth = style.fillWidth
            const activeKeys = new Set([`${REMAINING_KEY_PREFIX}smoothed#fill`])
            const trackStyle = style.remainingUseDefinedTrackStyle ? this.#trackStyleForSegment(this.#sampler?.segments?.[0]) : null
            const remainingMaterial = style.remainingUseDefinedTrackStyle && trackStyle
                                      ? TrackUtils.createTrackMaterial(trackStyle, trackStyle.color)
                                      : style.remainingColor
            const replayStore = globalThis.lgs?.stores?.replay
            const playing = replayStore?.playing === true && replayStore?.recordingSync !== true
            if (playing) {
                this.#upsertDynamicPolyline({
                    key:       `${REMAINING_KEY_PREFIX}smoothed#fill`,
                    id:        `${source.name}#remaining#smoothed#fill`,
                    name:      'JourneyReplay remaining track',
                    positionsFactory: this.#liveRemainingSmoothedPositions,
                    material:  remainingMaterial,
                    width:     fillWidth,
                    zIndex:    PROGRESS_Z_INDEX_REMAINING_FILL,
                })
                this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
                return
            }

            this.#upsertDynamicPolyline({
                key:      `${REMAINING_KEY_PREFIX}smoothed#fill`,
                id:       `${source.name}#remaining#smoothed#fill`,
                name:     'JourneyReplay remaining track',
                positionsFactory: this.#remainingSmoothedPositions,
                material: remainingMaterial,
                width:    fillWidth,
                zIndex:   PROGRESS_Z_INDEX_REMAINING_FILL,
            })

            this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
            return
        }

        const segments = this.#sampler.remainingSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const fillWidth = style.fillWidth
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
                key:      fillKey,
                id:       `${source.name}#remaining#${segment.key}#fill`,
                name:     'JourneyReplay remaining track',
                positions,
                material: remainingMaterial,
                width:    fillWidth,
                zIndex:   PROGRESS_Z_INDEX_REMAINING_FILL,
            })
        })

        this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
    }
}
