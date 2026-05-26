/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughCesiumRenderer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartesian3, Cartographic, Color, CustomDataSource } from 'cesium'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { getFlythroughSettings, normalizeFlythroughProgressionStyle } from './FlythroughProgressionStyle'

export const FLYTHROUGH_DATA_SOURCE_PREFIX = 'flythrough'

const DEFAULT_COLOR = '#ff6a00'
const DEFAULT_BORDER = '#FFFFFF'
const CURSOR_HEIGHT_OFFSET = 3
const CURSOR_DIAMETER_MULTIPLIER = 2
const MIN_CURSOR_RADIUS = 0.5
const MIN_PROGRESS_WIDTH_METERS = 2
const MIN_PROGRESS_SCREEN_WIDTH = 2
const MAX_PROGRESS_SCREEN_WIDTH = 256
const PROGRESS_Z_INDEX_REMAINING_BORDER = 38
const PROGRESS_Z_INDEX_REMAINING_FILL = 39
const PROGRESS_Z_INDEX_BORDER = 40
const PROGRESS_Z_INDEX_FILL = 41
const REMAINING_KEY_PREFIX = 'remaining:'
const PATH_GEOMETRY_UPDATE_INTERVAL = 120

const cssColor = (value, fallback) => TrackUtils.cssColor(value, fallback)

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export class FlythroughCesiumRenderer {
    #source = null
    #cursor = null
    #lineEntities = new Map()
    #sampler = null
    #journeySlug = null
    #options = {}
    #terrainHeightCache = new Map()
    #lastPathGeometryUpdate = 0
    #lastPathGeometryDistance = null
    #sourceRaised = false
    #sourceAddPending = false

    constructor(options = {}) {
        this.#options = options
    }

    show = ({sampler, options = {}} = {}) => {
        this.#sampler = sampler ?? this.#sampler
        this.#options = {...this.#options, ...options}
        this.#journeySlug = this.#sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#ensureSource()
        this.#raiseSourceToTop()
        return this
    }

    update = ({sample, sampler = this.#sampler, forceGeometry = false} = {}) => {
        if (!sample || !sampler) {
            return
        }

        this.#sampler = sampler
        this.#ensureSource()
        this.#updateCursor(sample)
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
        this.#lineEntities.clear()
        this.#sampler = null
        this.#terrainHeightCache.clear()
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
        globalThis.lgs?.scene?.requestRender?.()
    }

    #resetSourceEntities = () => {
        this.#cursor = null
        this.#lineEntities.clear()
        this.#lastPathGeometryUpdate = 0
        this.#lastPathGeometryDistance = null
        this.#sourceRaised = false
        this.#sourceAddPending = false
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

    #terrainHeightAt = (longitude, latitude) => {
        const key = `${longitude.toFixed(6)}:${latitude.toFixed(6)}`
        if (this.#terrainHeightCache.has(key)) {
            return this.#terrainHeightCache.get(key)
        }

        const height = globalThis.lgs?.scene?.globe?.getHeight?.(Cartographic.fromDegrees(longitude, latitude))
        const resolved = finiteNumber(height)
        this.#terrainHeightCache.set(key, resolved)
        return resolved
    }

    #resolveHeight = (longitude, latitude, altitude, offset = 0) => {
        const sampleAltitude = finiteNumber(altitude)
        const terrainHeight = this.#terrainHeightAt(longitude, latitude)
        const baseHeight = sampleAltitude !== null && terrainHeight !== null
                           ? Math.max(sampleAltitude, terrainHeight)
                           : (sampleAltitude ?? terrainHeight ?? 0)
        return baseHeight + offset
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

    #trackForSlug = trackSlug => this.#sampler?.journey?.tracks?.get?.(trackSlug)
        ?? globalThis.lgs?.getJourneyByTrackSlug?.(trackSlug)?.tracks?.get?.(trackSlug)
        ?? null

    #trackRenderStyle = track => TrackUtils.getTrackRenderStyle(track)

    #style = () => {
        const settings = getFlythroughSettings()
        const progression = normalizeFlythroughProgressionStyle(
            globalThis.lgs?.stores?.flythrough?.progression ?? settings.progression,
        )
        const fill = progression.fill
        const border = progression.border
        const fillColor = fill.color ?? this.#options.color ?? DEFAULT_COLOR
        const borderColor = border.color ?? this.#options.border ?? DEFAULT_BORDER

        return {
            fillColor:    cssColor(fillColor, Color.fromCssColorString(DEFAULT_COLOR)).withAlpha(fill.opacity),
            borderColor:  cssColor(borderColor, Color.WHITE).withAlpha(border.opacity),
            fillWidth:    fill.width,
            borderWidth:  border.width,
            cursorRadius: Math.max(MIN_CURSOR_RADIUS, fill.width * CURSOR_DIAMETER_MULTIPLIER / 2),
        }
    }

    #updateCursor = (sample) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const style = this.#style()
        const cursorHeight = this.#resolveHeight(
            sample.longitude,
            sample.latitude,
            sample.altitude ?? sample.height,
            CURSOR_HEIGHT_OFFSET,
        )
        const radius = style.cursorRadius
        const borderWidth = style.borderWidth

        if (!this.#cursor) {
            this.#cursor = {
                border: source.entities.add({
                    id:       `${source.name}#cursor#border`,
                    name:     'Flythrough cursor border',
                    position: Cartesian3.fromDegrees(sample.longitude, sample.latitude, cursorHeight),
                    ellipse:  {
                        semiMajorAxis: radius + borderWidth,
                        semiMinorAxis: radius + borderWidth,
                        material:      style.borderColor,
                        height:        cursorHeight,
                    },
                }),
                fill:   source.entities.add({
                    id:       `${source.name}#cursor#fill`,
                    name:     'Flythrough cursor',
                    position: Cartesian3.fromDegrees(sample.longitude, sample.latitude, cursorHeight + 0.1),
                    ellipse:  {
                        semiMajorAxis: radius,
                        semiMinorAxis: radius,
                        material:      style.fillColor,
                        height:        cursorHeight + 0.1,
                    },
                }),
            }
            return
        }

        this.#cursor.border.position = Cartesian3.fromDegrees(sample.longitude, sample.latitude, cursorHeight)
        this.#cursor.border.ellipse.semiMajorAxis = radius + borderWidth
        this.#cursor.border.ellipse.semiMinorAxis = radius + borderWidth
        this.#cursor.border.ellipse.material = style.borderColor
        this.#cursor.border.ellipse.height = cursorHeight
        this.#cursor.border.show = true

        this.#cursor.fill.position = Cartesian3.fromDegrees(sample.longitude, sample.latitude, cursorHeight + 0.1)
        this.#cursor.fill.ellipse.semiMajorAxis = radius
        this.#cursor.fill.ellipse.semiMinorAxis = radius
        this.#cursor.fill.ellipse.material = style.fillColor
        this.#cursor.fill.ellipse.height = cursorHeight + 0.1
        this.#cursor.fill.show = true
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

    #screenWidthFromMeters = (track, widthMeters) => {
        const trackStyle = track ? this.#trackRenderStyle(track) : null
        const fallbackWidth = finiteNumber(trackStyle?.farPixelWidth) ?? MIN_PROGRESS_SCREEN_WIDTH
        const pixelsPerMeter = finiteNumber(track ? TrackUtils.meterWidthToPixelScale(track) : null)
        const metricWidth = Math.max(MIN_PROGRESS_WIDTH_METERS, widthMeters)
        const width = pixelsPerMeter === null
                      ? fallbackWidth
                      : pixelsPerMeter * metricWidth

        return Math.min(
            MAX_PROGRESS_SCREEN_WIDTH,
            Math.max(MIN_PROGRESS_SCREEN_WIDTH, width),
        )
    }

    #progressLineWidths = (track, style) => {
        const trackStyle = track ? this.#trackRenderStyle(track) : null
        const baseTrackWidth = Math.max(
            finiteNumber(trackStyle?.meterWidth) ?? 0,
            trackStyle?.underlay?.enabled ? finiteNumber(trackStyle.underlay.meterWidth) ?? 0 : 0,
        )
        const fillWidth = Math.max(MIN_PROGRESS_WIDTH_METERS, style.fillWidth, baseTrackWidth)
        const borderWidth = Math.max(0, style.borderWidth)

        return {
            fillWidth:         this.#screenWidthFromMeters(track, fillWidth),
            borderWidth:       borderWidth > 0 ? this.#screenWidthFromMeters(track, fillWidth + (borderWidth * 2)) : 0,
            borderWidthMeters: borderWidth,
        }
    }

    #updateCompletedLines = (sample) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        const segments = this.#sampler.completedSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const track = this.#trackForSlug(segment.trackSlug)
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const {fillWidth, borderWidth, borderWidthMeters} = this.#progressLineWidths(track, style)
            if (!track || positions.length < 2) {
                return
            }

            if (borderWidthMeters > 0) {
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
            }

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

        Array.from(this.#lineEntities.entries()).forEach(([key, record]) => {
            if (!key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key)) {
                record.entity.show = false
            }
        })
    }

    #updateRemainingLines = (sample) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        const segments = this.#sampler.remainingSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            const track = this.#trackForSlug(segment.trackSlug)
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates ?? [])
            const {fillWidth, borderWidth, borderWidthMeters} = this.#progressLineWidths(track, style)
            if (!track || positions.length < 2) {
                return
            }

            if (borderWidthMeters > 0) {
                const borderKey = `${REMAINING_KEY_PREFIX}${segment.key}#border`
                activeKeys.add(borderKey)
                this.#upsertPolyline({
                    key:      borderKey,
                    id:       `${source.name}#remaining#${segment.key}#border`,
                    name:     'Flythrough remaining track border',
                    positions,
                    material: style.borderColor.withAlpha(0.3),
                    width:    borderWidth,
                    zIndex:   PROGRESS_Z_INDEX_REMAINING_BORDER,
                })
            }

            const fillKey = `${REMAINING_KEY_PREFIX}${segment.key}#fill`
            activeKeys.add(fillKey)
            this.#upsertPolyline({
                key:      fillKey,
                id:       `${source.name}#remaining#${segment.key}#fill`,
                name:     'Flythrough remaining track',
                positions,
                material: style.fillColor.withAlpha(0.35),
                width:    fillWidth,
                zIndex:   PROGRESS_Z_INDEX_REMAINING_FILL,
            })
        })

        Array.from(this.#lineEntities.entries()).forEach(([key, record]) => {
            if (key.startsWith(REMAINING_KEY_PREFIX) && !activeKeys.has(key)) {
                record.entity.show = false
            }
        })
    }
}
