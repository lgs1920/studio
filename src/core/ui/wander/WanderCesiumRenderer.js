/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderCesiumRenderer.js
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
    Cartesian3, Color, CustomDataSource, PolylineOutlineMaterialProperty,
} from 'cesium'

export const WANDER_DATA_SOURCE_PREFIX = 'wander'

const DEFAULT_RADIUS = 35
const DEFAULT_COLOR = '#1689CC'
const DEFAULT_BORDER = '#FFFFFF'
const EARTH_RADIUS = 6378137
const CURSOR_RING_SEGMENTS = 72

const cssColor = (value, fallback) => Color.fromCssColorString(value ?? '') ?? fallback

const positionsFromCoordinates = coordinates => coordinates.map(([longitude, latitude, altitude = 0]) =>
    Cartesian3.fromDegrees(longitude, latitude, altitude))

const cursorRingPositions = (sample, radius) => {
    const latitudeRadians = sample.latitude * Math.PI / 180
    const angularRadius = radius / EARTH_RADIUS
    const latitudeDelta = angularRadius * 180 / Math.PI
    const longitudeDelta = latitudeDelta / Math.max(Math.cos(latitudeRadians), 0.000001)
    const positions = []

    for (let index = 0; index <= CURSOR_RING_SEGMENTS; index++) {
        const angle = (index / CURSOR_RING_SEGMENTS) * Math.PI * 2
        positions.push(Cartesian3.fromDegrees(
            sample.longitude + (Math.cos(angle) * longitudeDelta),
            sample.latitude + (Math.sin(angle) * latitudeDelta),
            sample.altitude ?? sample.height ?? 0,
        ))
    }

    return positions
}

export class WanderCesiumRenderer {
    #source = null
    #cursor = null
    #lineEntities = new Map()
    #sampler = null
    #journeySlug = null
    #options = {}

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
        this.#sampler = null
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

        const name = `${WANDER_DATA_SOURCE_PREFIX}#${this.#journeySlug ?? 'current'}`
        const existing = viewer.dataSources.getByName?.(name)?.[0]
        this.#source = existing ?? new CustomDataSource(name)

        if (!existing) {
            viewer.dataSources.add(this.#source)
        }
        this.#source.show = true

        return this.#source
    }

    #style = () => {
        const track = globalThis.lgs?.theTrack
        const settings = globalThis.lgs?.settings?.getJourney?.pois?.wanderer
            ?? globalThis.lgs?.configuration?.journey?.pois?.wanderer
            ?? {}
        const color = this.#options.color ?? settings.color ?? track?.color ?? DEFAULT_COLOR
        const border = this.#options.border ?? settings.border ?? DEFAULT_BORDER

        const radius = Number(this.#options.radius ?? globalThis.lgs?.stores?.ui?.mainUI?.wander?.markerRadius ?? DEFAULT_RADIUS)

        return {
            radius: Number.isFinite(radius) ? Math.max(radius, DEFAULT_RADIUS) : DEFAULT_RADIUS,
            color:  cssColor(color, Color.fromCssColorString(DEFAULT_COLOR)),
            border: cssColor(border, Color.WHITE),
        }
    }

    #updateCursor = (sample) => {
        const source = this.#ensureSource()
        if (!source) {
            return
        }

        const style = this.#style()
        if (!this.#cursor) {
            this.#cursor = source.entities.add({
                id:       `${source.name}#cursor`,
                name:     'Wander cursor',
                polyline: {
                    positions:     cursorRingPositions(sample, style.radius),
                    clampToGround: true,
                    width:         5,
                    material:      new PolylineOutlineMaterialProperty({
                                                                            color:        style.color.withAlpha(0.95),
                                                                            outlineColor: style.border.withAlpha(0.95),
                                                                            outlineWidth: 2,
                                                                        }),
                    zIndex:        40,
                },
            })
            return
        }

        this.#cursor.polyline.positions = cursorRingPositions(sample, style.radius)
        this.#cursor.polyline.material = new PolylineOutlineMaterialProperty({
                                                                                 color:        style.color.withAlpha(0.95),
                                                                                 outlineColor: style.border.withAlpha(0.95),
                                                                                 outlineWidth: 2,
                                                                             })
        this.#cursor.show = true
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
            const positions = positionsFromCoordinates(segment.coordinates)
            if (positions.length < 2) {
                return
            }

            const entity = this.#lineEntities.get(segment.key)
            if (!entity) {
                const created = source.entities.add({
                    id:       `${source.name}#completed#${segment.key}`,
                    name:     'Wander completed track',
                    polyline: {
                        positions,
                        clampToGround: true,
                        material:      style.color.withAlpha(0.9),
                        width:         6,
                        zIndex:        20,
                    },
                })
                this.#lineEntities.set(segment.key, created)
                return
            }

            entity.polyline.positions = positions
            entity.polyline.material = style.color.withAlpha(0.9)
            entity.show = true
        })

        Array.from(this.#lineEntities.entries()).forEach(([key, entity]) => {
            if (!activeKeys.has(key)) {
                entity.show = false
            }
        })
    }
}
