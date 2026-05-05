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

import {
    Cartesian3, Cartographic, Color, CornerType, CustomDataSource, HeightReference,
} from 'cesium'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { getFlythroughSettings, normalizeFlythroughProgressionStyle } from './FlythroughProgressionStyle'

export const FLYTHROUGH_DATA_SOURCE_PREFIX = 'flythrough'

const DEFAULT_COLOR = '#ff6a00'
const DEFAULT_BORDER = '#FFFFFF'
const CURSOR_HEIGHT_OFFSET = 3
const CURSOR_DIAMETER_MULTIPLIER = 2
const MIN_CURSOR_RADIUS = 0.5
const REMAINING_TRACK_Z_INDEX_UNDERLAY = 10
const REMAINING_TRACK_Z_INDEX_MAIN = 20
const PROGRESS_Z_INDEX_BORDER = 40
const PROGRESS_Z_INDEX_FILL = 41

const cssColor = (value, fallback) => Color.fromCssColorString(value ?? '') ?? fallback

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export class FlythroughCesiumRenderer {
    #source = null
    #cursor = null
    #lineEntities = new Map()
    #remainingLineEntities = new Map()
    #maskedTrackSources = new Map()
    #sampler = null
    #journeySlug = null
    #options = {}
    #terrainHeightCache = new Map()

    constructor(options = {}) {
        this.#options = options
    }

    show = ({sampler, options = {}} = {}) => {
        this.#sampler = sampler ?? this.#sampler
        this.#options = {...this.#options, ...options}
        this.#journeySlug = this.#sampler?.journey?.slug ?? globalThis.lgs?.theJourney?.slug ?? 'current'
        this.#ensureSource()
        return this
    }

    update = ({sample, sampler = this.#sampler} = {}) => {
        if (!sample || !sampler) {
            return
        }

        this.#sampler = sampler
        this.#ensureSource()
        this.#updateOriginalTrackMask()
        this.#updateRemainingTrackLines(sample)
        this.#updateCursor(sample)
        this.#updateCompletedLines(sample)
        globalThis.lgs?.scene?.requestRender?.()
    }

    clear = () => {
        const viewer = globalThis.lgs?.viewer
        if (viewer && this.#source) {
            try {
                viewer.dataSources.remove(this.#source, true)
            }
            catch {
                this.#source.entities.removeAll()
            }
        }

        this.#source = null
        this.#cursor = null
        this.#lineEntities.clear()
        this.#remainingLineEntities.clear()
        this.#restoreOriginalTrackSources()
        this.#sampler = null
        this.#terrainHeightCache.clear()
        globalThis.lgs?.scene?.requestRender?.()
    }

    #ensureSource = () => {
        if (this.#source) {
            return this.#source
        }

        const viewer = globalThis.lgs?.viewer
        if (!viewer) {
            return null
        }

        const name = `${FLYTHROUGH_DATA_SOURCE_PREFIX}#${this.#journeySlug ?? 'current'}`
        const existing = viewer.dataSources.getByName?.(name)?.[0]
        this.#source = existing ?? new CustomDataSource(name)

        if (!existing) {
            viewer.dataSources.add(this.#source).then(source => {
                viewer.dataSources.raiseToTop(source)
                globalThis.lgs?.scene?.requestRender?.()
            })
        }
        else {
            viewer.dataSources.raiseToTop(existing)
        }
        this.#source.show = true

        return this.#source
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

    #groundPositionFromCoordinate = (coordinate) => {
        const longitude = finiteNumber(Array.isArray(coordinate) ? coordinate[0] : coordinate?.longitude)
        const latitude = finiteNumber(Array.isArray(coordinate) ? coordinate[1] : coordinate?.latitude)
        if (longitude === null || latitude === null) {
            return null
        }

        return Cartesian3.fromDegrees(longitude, latitude, 0)
    }

    #groundPositionsFromCoordinates = coordinates => coordinates
        .map(coordinate => this.#groundPositionFromCoordinate(coordinate))
        .filter(Boolean)

    #trackForSlug = trackSlug => this.#sampler?.journey?.tracks?.get?.(trackSlug)
        ?? globalThis.lgs?.getJourneyByTrackSlug?.(trackSlug)?.tracks?.get?.(trackSlug)
        ?? null

    #trackSource = trackSlug => globalThis.lgs?.viewer?.dataSources?.getByName?.(trackSlug)?.[0] ?? null

    #updateOriginalTrackMask = () => {
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

        Array.from(this.#maskedTrackSources.entries()).forEach(([trackSlug, entry]) => {
            if (!selectedTrackSlugs.has(trackSlug)) {
                entry.source.show = entry.show
                this.#maskedTrackSources.delete(trackSlug)
            }
        })
    }

    #restoreOriginalTrackSources = () => {
        this.#maskedTrackSources.forEach(entry => {
            entry.source.show = entry.show
        })
        this.#maskedTrackSources.clear()
    }

    #trackLineStyle = track => {
        const style = TrackUtils.getTrackRenderStyle(track)
        const pixelsPerMeter = TrackUtils.meterWidthToPixelScale(track)
        const mainWidth = TrackUtils.resolveStyledTrackWidth(
            style,
            pixelsPerMeter * style.meterWidth,
            style.farPixelWidth,
        )
        const underlayWidth = TrackUtils.resolveStyledTrackWidth(
            style,
            pixelsPerMeter * style.underlay.meterWidth,
            style.underlay.pixelWidth,
        )

        return {
            style,
            mainWidth,
            underlayWidth,
            mainMaterial:     TrackUtils.createTrackMaterial(style),
            underlayMaterial: TrackUtils.createTrackMaterial({
                                                                ...style,
                                                                dash: {
                                                                    ...style.dash,
                                                                    enabled: false,
                                                                },
                                                            },
                                                            style.underlay.color),
        }
    }

    #style = () => {
        const settings = getFlythroughSettings()
        const progression = normalizeFlythroughProgressionStyle(
            globalThis.lgs?.stores?.ui?.mainUI?.flythrough?.progression ?? settings.progression,
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

    #upsertRemainingLine = ({key, positions, material, width, zIndex, name}) => {
        const source = this.#ensureSource()
        if (!source || positions.length < 2) {
            return
        }

        const entity = this.#remainingLineEntities.get(key)
        if (!entity) {
            this.#remainingLineEntities.set(
                key,
                source.entities.add({
                    id:       `${source.name}#remaining#${key}`,
                    name,
                    polyline: {
                        positions,
                        clampToGround: true,
                        material,
                        width,
                        zIndex,
                    },
                }),
            )
            return
        }

        entity.polyline.positions = positions
        entity.polyline.material = material
        entity.polyline.width = width
        entity.polyline.zIndex = zIndex
        entity.show = true
    }

    #updateRemainingTrackLines = (sample) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const activeKeys = new Set()
        const segments = this.#sampler.remainingSegmentsAt(sample)

        segments.forEach(segment => {
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates)
            const track = this.#trackForSlug(segment.trackSlug)
            if (!track || positions.length < 2) {
                return
            }

            const trackLine = this.#trackLineStyle(track)

            if (trackLine.style.underlay.enabled) {
                const key = `${segment.key}#underlay`
                activeKeys.add(key)
                this.#upsertRemainingLine({
                                              key,
                                              positions,
                                              material: trackLine.underlayMaterial,
                                              width:    trackLine.underlayWidth,
                                              zIndex:   REMAINING_TRACK_Z_INDEX_UNDERLAY,
                                              name:     'Flythrough remaining track underlay',
                                          })
            }

            const key = `${segment.key}#main`
            activeKeys.add(key)
            this.#upsertRemainingLine({
                                          key,
                                          positions,
                                          material: trackLine.mainMaterial,
                                          width:    trackLine.mainWidth,
                                          zIndex:   REMAINING_TRACK_Z_INDEX_MAIN,
                                          name:     'Flythrough remaining track',
                                      })
        })

        Array.from(this.#remainingLineEntities.entries()).forEach(([key, entity]) => {
            if (!activeKeys.has(key)) {
                entity.show = false
            }
        })
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

    #updateCompletedLines = (sample) => {
        const source = this.#ensureSource()
        if (!source || !this.#sampler) {
            return
        }

        const style = this.#style()
        const segments = this.#sampler.completedSegmentsAt(sample)
        const activeKeys = new Set()

        segments.forEach(segment => {
            activeKeys.add(segment.key)
            const positions = this.#groundPositionsFromCoordinates(segment.coordinates)
            const width = style.fillWidth
            const borderWidth = style.borderWidth
            if (positions.length < 2) {
                return
            }

            const entities = this.#lineEntities.get(segment.key)
            if (!entities) {
                const border = source.entities.add({
                    id:       `${source.name}#completed#${segment.key}#border`,
                    name:     'Flythrough completed track border',
                    corridor: {
                        positions,
                        width:      width + (borderWidth * 2),
                        material:   style.borderColor,
                        cornerType: CornerType.ROUNDED,
                        heightReference: HeightReference.CLAMP_TO_GROUND,
                        zIndex:     PROGRESS_Z_INDEX_BORDER,
                    },
                })
                const fill = source.entities.add({
                    id:       `${source.name}#completed#${segment.key}#fill`,
                    name:     'Flythrough completed track',
                    corridor: {
                        positions,
                        width,
                        material:   style.fillColor,
                        cornerType: CornerType.ROUNDED,
                        heightReference: HeightReference.CLAMP_TO_GROUND,
                        zIndex:     PROGRESS_Z_INDEX_FILL,
                    },
                })
                this.#lineEntities.set(segment.key, {border, fill})
                return
            }

            entities.border.corridor.positions = positions
            entities.border.corridor.width = width + (borderWidth * 2)
            entities.border.corridor.material = style.borderColor
            entities.border.corridor.heightReference = HeightReference.CLAMP_TO_GROUND
            entities.border.corridor.zIndex = PROGRESS_Z_INDEX_BORDER
            entities.border.show = true

            entities.fill.corridor.positions = positions
            entities.fill.corridor.width = width
            entities.fill.corridor.material = style.fillColor
            entities.fill.corridor.heightReference = HeightReference.CLAMP_TO_GROUND
            entities.fill.corridor.zIndex = PROGRESS_Z_INDEX_FILL
            entities.fill.show = true
        })

        Array.from(this.#lineEntities.entries()).forEach(([key, entities]) => {
            if (!activeKeys.has(key)) {
                entities.border.show = false
                entities.fill.show = false
            }
        })
    }
}
