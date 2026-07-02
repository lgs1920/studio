/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughCesiumRenderer.js
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
    ArcType, CallbackProperty, Cartesian3, Color, CustomDataSource, ExtrapolationType, HeightReference, JulianDate,
    LinearApproximation, SampledPositionProperty,
}                                                                 from 'cesium'
import {
    FLYTHROUGH_TRACE_MODE_FULL, getFlythroughSettings, normalizeFlythroughProgressionStyle, normalizeFlythroughTrace,
}                                                                 from './FlythroughProgressionStyle'

export const FLYTHROUGH_DATA_SOURCE_PREFIX = 'flythrough'

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
const DYNAMIC_POLYLINE_PROGRESS_STEP_PLAYING = 0.004
const LIVE_PROGRESS_MAX_POINTS = 512
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

export class FlythroughCesiumRenderer {
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

    update = ({sample, sampler = this.#sampler, forceGeometry = false, freezeDynamic = false, hideCursor = false} = {}) => {
        if (!sample || !sampler) {
            return
        }

        this.#sampler = sampler
        this.#sample = sample
        this.#ensureSource()
        this.#updateCursor(sample)
        if (hideCursor) {
            this.#setCursorVisibility(false)
        }
        if (freezeDynamic) {
            this.#freezeDynamicLines()
            globalThis.lgs?.scene?.requestRender?.()
            return
        }
        if (forceGeometry || this.#shouldUpdatePathGeometry(sample)) {
            this.#updateCompletedLines(sample)
            this.#updateRemainingLines(sample)
        }
        globalThis.lgs?.scene?.requestRender?.()
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

    #setCursorVisibility = (visible) => {
        if (this.#cursor) {
            this.#cursor.show = visible
        }
        if (this.#cursorBorder) {
            this.#cursorBorder.show = visible && this.#cursorBorder.show !== false
        }
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

        const name = `${FLYTHROUGH_DATA_SOURCE_PREFIX}#${this.#journeySlug ?? 'current'}`
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
        if (globalThis.lgs?.stores?.flythrough?.playing) {
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
            }
        })
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
        const settings = getFlythroughSettings()
        const progression = normalizeFlythroughProgressionStyle(
            globalThis.lgs?.stores?.flythrough?.progression ?? settings.progression,
        )
        const trace = normalizeFlythroughTrace(globalThis.lgs?.stores?.flythrough?.trace ?? settings.trace)
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
        const borderSize = pointSize + Math.max(4, Math.round(pointSize * 0.35))
        if (style.cursorBorder > 0 && !this.#cursorBorder) {
            this.#cursorBorder = source.entities.add({
                id:       `${source.name}#cursor-border`,
                name:     'Flythrough cursor border',
                position: cursorPosition,
                point:    {
                    pixelSize:       borderSize,
                    color:           style.borderColor,
                    outlineColor:    style.borderColor,
                    outlineWidth:    0,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                },
            })
        }

        if (!this.#cursor) {
            this.#cursor = source.entities.add({
                id:       `${source.name}#cursor`,
                name:     'Flythrough cursor',
                position: cursorPosition,
                point:    {
                    pixelSize:       pointSize,
                    color:           style.cursorColor,
                    outlineColor:    style.cursorColor,
                    outlineWidth:    0,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                },
            })
            this.#setCursorVisibility(true)
            return
        }

        if (this.#cursorBorder) {
            this.#cursorBorder.position = cursorPosition
            this.#cursorBorder.point.pixelSize = borderSize
            this.#cursorBorder.point.color = style.borderColor
            this.#cursorBorder.point.outlineColor = style.borderColor
            this.#cursorBorder.point.outlineWidth = 0
            this.#cursorBorder.point.heightReference = HeightReference.CLAMP_TO_GROUND
            this.#cursorBorder.show = style.cursorBorder > 0
        }
        this.#cursor.position = cursorPosition
        this.#cursor.point.pixelSize = pointSize
        this.#cursor.point.color = style.cursorColor
        this.#cursor.point.outlineColor = style.cursorColor
        this.#cursor.point.outlineWidth = 0
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

    #polylineStyleKey = ({width, material, zIndex}) => [
        width,
        material?.toCssColorString?.() ?? `${material}`,
        zIndex,
    ].join(':')

    #polylineOptions = ({positions, width, material, zIndex}) => ({
        positions,
        clampToGround: true,
        material,
        width,
        zIndex,
        arcType: ArcType.GEODESIC,
    })

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
            record.entity.polyline.zIndex = options.zIndex
            record.styleKey = styleKey
        }

        record.entity.show = options.show ?? true
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
                return
            }

            const options = {
                positions,
                width:    record.width,
                material: record.material,
                zIndex:   record.zIndex,
                show:     record.show ?? record.entity.show,
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

    #upsertPolyline = ({key, id, name, positions, width, material, zIndex, show = true}) => {
        const source = this.#ensureSource()
        if (!source || positions.length < 2) {
            return
        }

        const options = {
            positions,
            width,
            material,
            zIndex,
            show,
        }
        const record = this.#lineEntities.get(key)
        if (record?.entity?.polyline) {
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
            show,
            lastProgressKey:  null,
            lastPositions:    [],
        }
        const dynamicPositions = new CallbackProperty(() => {
            const progress = Math.max(0, Math.min(1, Number(this.#sample?.progress) || 0))
            const progressStep = globalThis.lgs?.stores?.flythrough?.playing
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

    #updateCompletedLines = (sample) => {
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
            const playing = globalThis.lgs?.stores?.flythrough?.playing === true

            if (playing) {
                this.#upsertDynamicPolyline({
                    key:       'smoothed#border',
                    id:        `${source.name}#completed#smoothed#border`,
                    name:      'Flythrough completed track border',
                    positionsFactory: this.#liveCompletedSmoothedPositions,
                    material:  style.borderColor,
                    width:     borderWidth,
                    zIndex:    PROGRESS_Z_INDEX_BORDER,
                })
                this.#upsertDynamicPolyline({
                    key:       'smoothed#fill',
                    id:        `${source.name}#completed#smoothed#fill`,
                    name:      'Flythrough completed track',
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
                name:      'Flythrough completed track border',
                positionsFactory: this.#completedSmoothedPositions,
                material:  style.borderColor,
                width:     borderWidth,
                zIndex:    PROGRESS_Z_INDEX_BORDER,
            })
            this.#upsertDynamicPolyline({
                key:       'smoothed#fill',
                id:        `${source.name}#completed#smoothed#fill`,
                name:      'Flythrough completed track',
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
                                     name:      'Flythrough completed track border',
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
                                     name:      'Flythrough completed track',
                                     positions,
                                     material:  style.fillColor,
                                     width:     fillWidth,
                                     zIndex:    PROGRESS_Z_INDEX_FILL,
                                 })
        })

        this.#hideLineEntities(key => !key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
    }

    #updateRemainingLines = (sample) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        if (style.traceMode !== FLYTHROUGH_TRACE_MODE_FULL) {
            this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX))
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
            const playing = globalThis.lgs?.stores?.flythrough?.playing === true
            if (playing) {
                this.#upsertDynamicPolyline({
                    key:       `${REMAINING_KEY_PREFIX}smoothed#fill`,
                    id:        `${source.name}#remaining#smoothed#fill`,
                    name:      'Flythrough remaining track',
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
                name:     'Flythrough remaining track',
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
                name:     'Flythrough remaining track',
                positions,
                material: remainingMaterial,
                width:    fillWidth,
                zIndex:   PROGRESS_Z_INDEX_REMAINING_FILL,
            })
        })

        this.#hideLineEntities(key => key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key))
    }
}
