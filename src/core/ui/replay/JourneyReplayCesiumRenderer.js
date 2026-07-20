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
    ArcType, CallbackProperty, Cartesian2, Cartesian3, Cartographic, Color, CustomDataSource, ExtrapolationType,
    HeightReference, JulianDate, LinearApproximation, SampledPositionProperty, SceneTransforms,
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

const rectNumber = (rect, key) => finiteNumber(rect?.[key]) ?? 0

const canvasCssSize = canvas => {
    const rect = canvas?.getBoundingClientRect?.() ?? {}
    const width = finiteNumber(rect.width) ?? finiteNumber(canvas?.clientWidth) ?? finiteNumber(canvas?.width) ?? 0
    const height = finiteNumber(rect.height) ?? finiteNumber(canvas?.clientHeight) ?? finiteNumber(canvas?.height) ?? 0

    return {
        left: rectNumber(rect, 'left'),
        top: rectNumber(rect, 'top'),
        width,
        height,
    }
}

const projectedBounds = points => {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let count = 0

    for (const point of points) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            continue
        }
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
        count += 1
    }

    if (count === 0) {
        return null
    }

    return {
        minX: Math.round(minX),
        minY: Math.round(minY),
        maxX: Math.round(maxX),
        maxY: Math.round(maxY),
    }
}

const visibleProjectedPointCount = (points, crop) => points.reduce((count, point) => (
    point
    && point.x >= 0
    && point.x <= crop.width
    && point.y >= 0
    && point.y <= crop.height
        ? count + 1
        : count
), 0)

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
    #smoothedPositionProperty = null
    #smoothedPositionPropertyKey = null
    #traceGuide = null
    #traceGuideKey = null

    constructor(options = {}) {
        this.#options = options
    }

    show = ({sampler, options = {}} = {}) => {
        this.#sampler = sampler ?? this.#sampler
        this.#options = {...this.#options, ...options}
        this.#journeySlug = this.#sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#ensureSource()
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
        const shouldUpdateGeometry = forceGeometry || (!freezeDynamic && this.#shouldUpdatePathGeometry(sample))
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
        if (hideTrace) {
            this.#hideLineEntities(() => true)
        }
        this.#updateCursor(sample)
        this.#syncCursorVisibilityWithTrace({hideCursor})
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

    createCompletedTraceVideoOverlay = ({
                                            cropRect = null,
                                            outputDpr = null,
                                            sourceCanvas: exportSourceCanvas = null,
                                            phaseSlot = 'stop',
                                        } = {}) => {
        const scene = globalThis.lgs?.viewer?.scene ?? globalThis.lgs?.scene ?? null
        const sceneCanvas = scene?.canvas ?? globalThis.lgs?.viewer?.canvas ?? null
        const sourceCanvas = exportSourceCanvas
                             ?? globalThis.lgs?.canvas
                             ?? sceneCanvas
                             ?? globalThis.lgs?.scene?.canvas
                             ?? null
        const debugSlot = `${phaseSlot || 'trace'}`
        const debugEvent = suffix => `renderer.overlay.${debugSlot}.${suffix}`
        if (!sourceCanvas || !scene || typeof document === 'undefined' || !this.#sampler || !this.#sample) {
            replayVideoTraceDebug(debugEvent('skip.missing-runtime'), {
                hasSourceCanvas: Boolean(sourceCanvas),
                hasSceneCanvas: Boolean(sceneCanvas),
                hasScene: Boolean(scene),
                hasDocument: typeof document !== 'undefined',
                hasSampler: Boolean(this.#sampler),
                hasSample: Boolean(this.#sample),
            })
            return null
        }

        const sourceRect = canvasCssSize(sourceCanvas)
        const sceneRect = canvasCssSize(sceneCanvas ?? sourceCanvas)
        const sceneDpr = sceneRect.width > 0 ? Math.max(1, (finiteNumber(sceneCanvas?.width) ?? sceneRect.width) / sceneRect.width) : 1
        const crop = {
            left:   finiteNumber(cropRect?.left ?? cropRect?.x) ?? 0,
            top:    finiteNumber(cropRect?.top ?? cropRect?.y) ?? 0,
            width:  finiteNumber(cropRect?.width) ?? finiteNumber(sourceRect.width) ?? finiteNumber(sourceCanvas.width) ?? 0,
            height: finiteNumber(cropRect?.height) ?? finiteNumber(sourceRect.height) ?? finiteNumber(sourceCanvas.height) ?? 0,
        }
        if (crop.width <= 0 || crop.height <= 0) {
            replayVideoTraceDebug(debugEvent('skip.invalid-crop'), {
                crop,
                sourceCanvasWidth: sourceCanvas.width ?? null,
                sourceCanvasHeight: sourceCanvas.height ?? null,
            })
            return null
        }

        const positions = this.#terrainSurfacePositions(this.#completedSmoothedPositions())
        if (positions.length < 2) {
            replayVideoTraceDebug(debugEvent('skip.no-positions'), {
                positions: positions.length,
                samplerSamples: this.#sampler?.samples?.length ?? null,
                sampleProgress: this.#sample?.progress ?? null,
            })
            return null
        }

        const dpr = Math.max(1, finiteNumber(outputDpr)
                                ?? finiteNumber(globalThis.window?.devicePixelRatio)
                                ?? 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(crop.width * dpr))
        canvas.height = Math.max(1, Math.round(crop.height * dpr))
        canvas.style.width = `${crop.width}px`
        canvas.style.height = `${crop.height}px`

        const ctx = canvas.getContext?.('2d')
        if (!ctx) {
            replayVideoTraceDebug(debugEvent('skip.no-context'), {
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
            })
            return null
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const projectedCandidates = [
            {
                mode: 'scene-css-to-source-css',
                points: [],
            },
            {
                mode: 'scene-css',
                points: [],
            },
            {
                mode: 'scene-drawing-buffer-to-source-css',
                points: [],
            },
        ]

        positions.forEach(position => {
            let point = null
            try {
                point = SceneTransforms.worldToWindowCoordinates(scene, position, new Cartesian2()) ?? null
            }
            catch {
                point = null
            }

            if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                projectedCandidates[0].points.push({
                    x: point.x + sceneRect.left - sourceRect.left - crop.left,
                    y: point.y + sceneRect.top - sourceRect.top - crop.top,
                })
                projectedCandidates[1].points.push({
                    x: point.x - crop.left,
                    y: point.y - crop.top,
                })
            }
            else {
                projectedCandidates[0].points.push(null)
                projectedCandidates[1].points.push(null)
            }

            let bufferPoint = null
            try {
                bufferPoint = SceneTransforms.worldToDrawingBufferCoordinates?.(scene, position, new Cartesian2()) ?? null
            }
            catch {
                bufferPoint = null
            }

            if (bufferPoint && Number.isFinite(bufferPoint.x) && Number.isFinite(bufferPoint.y)) {
                projectedCandidates[2].points.push({
                    x: (bufferPoint.x / sceneDpr) + sceneRect.left - sourceRect.left - crop.left,
                    y: (bufferPoint.y / sceneDpr) + sceneRect.top - sourceRect.top - crop.top,
                })
            }
            else {
                projectedCandidates[2].points.push(null)
            }
        })

        const scoredCandidates = projectedCandidates.map(candidate => ({
            ...candidate,
            projected: candidate.points.filter(Boolean).length,
            visible:   visibleProjectedPointCount(candidate.points, crop),
            bounds:    projectedBounds(candidate.points),
        }))
        const selectedCandidate = scoredCandidates.reduce((best, candidate) => {
            if (!best) {
                return candidate
            }
            if (candidate.visible !== best.visible) {
                return candidate.visible > best.visible ? candidate : best
            }
            return candidate.projected > best.projected ? candidate : best
        }, null)
        const projected = selectedCandidate?.points ?? []
        const projectedCount = projected.filter(Boolean).length
        const visibleCount = visibleProjectedPointCount(projected, crop)
        const bounds = projectedBounds(projected)

        const drawTrace = (color, width) => {
            ctx.strokeStyle = color.toCssColorString?.() ?? `${color}`
            ctx.lineWidth = width
            ctx.beginPath()
            let active = false
            let drawnPoints = 0
            for (const point of projected) {
                if (!point) {
                    active = false
                    continue
                }

                if (!active) {
                    ctx.moveTo(point.x, point.y)
                    active = true
                }
                else {
                    ctx.lineTo(point.x, point.y)
                }
                drawnPoints += 1
            }
            if (drawnPoints >= 2) {
                ctx.stroke()
            }
            return drawnPoints
        }

        const style = this.#style()
        const fillWidth = Math.max(style.fillWidth, 5)
        const borderWidth = Math.max(fillWidth + (style.borderWidth * 2), fillWidth + 4)
        const drawnPoints = drawTrace(style.borderColor, borderWidth)
        drawTrace(style.fillColor, fillWidth)

        if (drawnPoints < 2) {
            replayVideoTraceDebug(debugEvent('skip.not-drawn'), {
                positions: positions.length,
                projected: projectedCount,
                visible: visibleCount,
                drawnPoints,
                crop,
                dpr,
                sourceRect,
                sceneRect,
                sceneDpr,
                projectionMode: selectedCandidate?.mode ?? null,
                bounds,
                candidates: scoredCandidates.map(candidate => ({
                    mode:      candidate.mode,
                    projected: candidate.projected,
                    visible:   candidate.visible,
                    bounds:    candidate.bounds,
                })),
            })
            return null
        }

        replayVideoTraceDebug(debugEvent('created'), {
            positions: positions.length,
            projected: projectedCount,
            visible: visibleCount,
            drawnPoints,
            crop,
            dpr,
            sourceRect,
            sceneRect,
            sceneDpr,
            projectionMode: selectedCandidate?.mode ?? null,
            bounds,
            candidates: scoredCandidates.map(candidate => ({
                mode:      candidate.mode,
                projected: candidate.projected,
                visible:   candidate.visible,
                bounds:    candidate.bounds,
            })),
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            fillWidth,
            borderWidth,
            fillColor: style.fillColor?.toCssColorString?.() ?? null,
            borderColor: style.borderColor?.toCssColorString?.() ?? null,
        })

        return {
            element: canvas,
            options: {
                x:             0,
                y:             0,
                w:             crop.width,
                h:             crop.height,
                contentWidth:  crop.width,
                contentHeight: crop.height,
                scale:         1,
            },
        }
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
        if (this.#source) {
            try {
                this.#source.entities.removeAll()
                this.#source.show = false
            }
            catch {
                // The source may already have been removed by Cesium during a journey switch.
            }
        }

        this.#cursor = null
        this.#cursorBorder = null
        this.#lineEntities.clear()
        this.#sampler = null
        this.#sample = null
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        this.#smoothedPositionProperty = null
        this.#smoothedPositionPropertyKey = null
        this.#traceGuide = null
        this.#traceGuideKey = null
        this.#restoreOriginalTrackSources()
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
        this.#smoothedPositionProperty = null
        this.#smoothedPositionPropertyKey = null
        this.#traceGuide = null
        this.#traceGuideKey = null
    }

    #dataSources = () => globalThis.lgs?.viewer?.dataSources ?? null

    #sourceInCollection = (source = this.#source) => {
        const dataSources = this.#dataSources()
        return Boolean(source && dataSources?.contains?.(source))
    }

    #ensureSource = () => {
        if (this.#source && (this.#sourceInCollection() || this.#sourceAddPending)) {
            this.#source.show = true
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
            dataSources.add(this.#source).then(source => {
                if (this.#source === source && dataSources.contains?.(source)) {
                    dataSources.raiseToTop(source)
                    this.#sourceRaised = true
                }
                this.#sourceAddPending = false
                globalThis.lgs?.scene?.requestRender?.()
            }).catch(() => {
                this.#sourceAddPending = false
            })
        }
        this.#source.show = true

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

    #traceGuideKeyForSampler = () => {
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
        ].join(':')
    }

    #rawTraceGuideEntries = () => (this.#sampler?.samples ?? [])
        .map(sample => {
            const position = this.#groundPositionFromCoordinate(sample)
            const progress = finiteNumber(sample?.progress)
            if (!position || progress === null) {
                return null
            }

            return {
                progress,
                position,
            }
        })
        .filter(Boolean)

    #traceGuideEntries = () => {
        const key = this.#traceGuideKeyForSampler()
        if (this.#traceGuide && this.#traceGuideKey === key) {
            return this.#traceGuide
        }

        const raw = this.#rawTraceGuideEntries()
        const smoothing = normalizeTrackRenderSmoothing(
            globalThis.lgs?.settings?.getJourney?.renderSmoothing,
            {enabled: false, step: 1},
        )

        if (!smoothing.enabled) {
            this.#traceGuide = raw
            this.#traceGuideKey = key
            return raw
        }

        const coordinates = raw.map(entry => [entry.position.x, entry.position.y, entry.position.z, entry.progress])
        const smoothedCoordinates = smoothCoordinateSegment(coordinates, smoothing.step)
        const guide = smoothedCoordinates.map(coordinate => ({
            progress: coordinate[3] ?? 0,
            position: new Cartesian3(coordinate[0], coordinate[1], coordinate[2] ?? 0),
        }))

        this.#traceGuide = guide
        this.#traceGuideKey = key
        return guide
    }

    #smoothedGuideEntries = () => {
        const traceGuide = this.#traceGuideEntries()
        if (traceGuide.length >= 2) {
            return traceGuide
        }

        return (this.#options.smoothedGuide ?? [])
            .map(entry => {
                const position = this.#groundPositionFromCoordinate(entry)
                const progress = finiteNumber(entry?.progress)
                if (!position || progress === null) {
                    return null
                }

                return {
                    progress,
                    position,
                }
            })
            .filter(Boolean)
    }

    #smoothedGuideKey = () => {
        const guide = this.#smoothedGuideEntries()
        return `${guide.length}:${guide[0]?.progress ?? 0}:${guide[guide.length - 1]?.progress ?? 1}`
    }

    #smoothedTimeForProgress = progress => JulianDate.addSeconds(
        JulianDate.fromIso8601('2026-01-01T00:00:00Z'),
        Math.max(0, Math.min(1, progress)) * 1000,
        new JulianDate(),
    )

    #smoothedPositionPropertyForGuide = () => {
        const key = this.#smoothedGuideKey()
        if (this.#smoothedPositionProperty && this.#smoothedPositionPropertyKey === key) {
            return this.#smoothedPositionProperty
        }

        const guide = this.#smoothedGuideEntries()
        if (guide.length < 2) {
            this.#smoothedPositionProperty = null
            this.#smoothedPositionPropertyKey = key
            return null
        }

        const property = new SampledPositionProperty()
        guide.forEach(entry => {
            property.addSample(
                this.#smoothedTimeForProgress(entry.progress),
                entry.position,
            )
        })
        property.setInterpolationOptions({
            interpolationDegree: 1,
            interpolationAlgorithm: LinearApproximation,
        })
        property.forwardExtrapolationType = ExtrapolationType.HOLD
        property.backwardExtrapolationType = ExtrapolationType.HOLD

        this.#smoothedPositionProperty = property
        this.#smoothedPositionPropertyKey = key
        return property
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
        const property = this.#smoothedPositionPropertyForGuide()
        if (property) {
            return property.getValue(this.#smoothedTimeForProgress(progress))
        }

        const {guide, leftIndex, rightIndex, ratio} = this.#smoothedProgressCursor(progress)
        const left = guide[leftIndex]?.position
        const right = guide[rightIndex]?.position

        if (!left) {
            return null
        }

        if (!right || leftIndex === rightIndex || ratio <= 0) {
            return left
        }

        return Cartesian3.lerp(left, right, ratio, new Cartesian3())
    }

    #completedSmoothedPositions = () => {
        const {guide, leftIndex} = this.#smoothedProgressCursor()
        const positions = guide.map(entry => entry.position)
        if (positions.length < 2) {
            return positions
        }

        const completed = positions.slice(0, leftIndex + 1)
        const interpolated = this.#interpolatedSmoothedPosition()
        const lastCompleted = completed[completed.length - 1]

        if (interpolated && interpolated !== lastCompleted) {
            completed.push(interpolated)
        }

        return completed
    }

    #liveCompletedSmoothedPositions = () => {
        const {guide, leftIndex} = this.#smoothedProgressCursor()
        if (guide.length < 2) {
            return guide.map(entry => entry.position)
        }

        const stride = Math.max(1, Math.ceil(guide.length / Math.max(2, LIVE_PROGRESS_MAX_POINTS - 1)))
        const completed = [guide[0].position]
        for (let index = stride; index <= leftIndex; index += stride) {
            completed.push(guide[index].position)
        }

        const anchor = guide[leftIndex]?.position
        const lastCompleted = completed[completed.length - 1]
        if (anchor && anchor !== lastCompleted) {
            completed.push(anchor)
        }

        const interpolated = this.#interpolatedSmoothedPosition()
        const lastWithAnchor = completed[completed.length - 1]
        if (interpolated && interpolated !== lastWithAnchor) {
            completed.push(interpolated)
        }
        if (completed.length < 2 && guide[1]?.position) {
            completed.push(guide[1].position)
        }

        return completed
    }

    #remainingSmoothedPositions = () => {
        const {guide, rightIndex} = this.#smoothedProgressCursor()
        const positions = guide.map(entry => entry.position)
        if (positions.length < 2) {
            return positions
        }

        const interpolated = this.#interpolatedSmoothedPosition()
        const remaining = positions.slice(rightIndex)

        return interpolated ? [interpolated, ...remaining] : remaining
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

        return remaining
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
            const playing = globalThis.lgs?.stores?.replay?.playing === true

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
            const playing = globalThis.lgs?.stores?.replay?.playing === true
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
