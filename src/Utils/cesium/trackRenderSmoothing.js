/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackRenderSmoothing.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const TRACK_RENDER_SMOOTHING_DEFAULT = Object.freeze({
    enabled: false,
    step:    1,
})

export const TRACK_RENDER_SMOOTHING_MIN_STEP = 1
export const TRACK_RENDER_SMOOTHING_MAX_STEP = 4

const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

const normalizeBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return Boolean(fallback)
    }
    if (typeof value === 'boolean') {
        return value
    }

    return ['true', '1', 'yes', 'on'].includes(`${value}`.toLowerCase())
}

const normalizeStep = (value, fallback = TRACK_RENDER_SMOOTHING_DEFAULT.step) => {
    const number = finiteNumber(value) ?? finiteNumber(fallback) ?? TRACK_RENDER_SMOOTHING_DEFAULT.step

    return Math.min(
        TRACK_RENDER_SMOOTHING_MAX_STEP,
        Math.max(TRACK_RENDER_SMOOTHING_MIN_STEP, Math.round(number)),
    )
}

const cloneCoordinate = coordinate => Array.isArray(coordinate) ? [...coordinate] : coordinate

const deepClone = value => JSON.parse(JSON.stringify(value))

const interpolateCoordinate = (start, stop, ratio) => {
    const dimensions = Math.max(2, Math.min(start?.length ?? 0, stop?.length ?? 0))

    return Array.from({length: dimensions}, (_, index) => {
        const startValue = finiteNumber(start?.[index])
        const stopValue = finiteNumber(stop?.[index])

        if (startValue === undefined || stopValue === undefined) {
            return ratio < 0.5 ? start?.[index] : stop?.[index]
        }

        return startValue + ((stopValue - startValue) * ratio)
    })
}

const chaikinPass = segment => {
    if (!Array.isArray(segment) || segment.length < 3) {
        return Array.isArray(segment) ? segment.map(cloneCoordinate) : []
    }

    const result = [cloneCoordinate(segment[0])]

    for (let index = 0; index < segment.length - 1; index++) {
        const start = segment[index]
        const stop = segment[index + 1]

        result.push(interpolateCoordinate(start, stop, 0.25))
        result.push(interpolateCoordinate(start, stop, 0.75))
    }

    result.push(cloneCoordinate(segment[segment.length - 1]))

    return result
}

export const normalizeTrackRenderSmoothing = (value = undefined, fallback = TRACK_RENDER_SMOOTHING_DEFAULT) => {
    const fallbackSettings = {
        ...TRACK_RENDER_SMOOTHING_DEFAULT,
        ...(fallback ?? {}),
    }
    const settings = value ?? fallbackSettings

    return {
        enabled: normalizeBoolean(settings.enabled, fallbackSettings.enabled),
        step:    normalizeStep(settings.step, fallbackSettings.step),
    }
}

export const defaultTrackRenderSmoothing = () => normalizeTrackRenderSmoothing(
    globalThis.lgs?.settings?.getJourney?.renderSmoothing,
    TRACK_RENDER_SMOOTHING_DEFAULT,
)

const getJourneyFromTrack = track => {
    const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey
    if (editorJourney?.slug && editorJourney.slug === track?.parent) {
        return editorJourney
    }

    return globalThis.lgs?.getJourneyBySlug?.(track?.parent)
}

export const resolveTrackRenderSmoothing = track => {
    const defaults = defaultTrackRenderSmoothing()
    const journey = getJourneyFromTrack(track)
    const isMultiTrackJourney = (journey?.tracks?.size ?? 0) > 1
    const source = isMultiTrackJourney
                   ? track?.renderSmoothing
                   : (journey?.renderSmoothing ?? track?.renderSmoothing)

    return normalizeTrackRenderSmoothing(source, defaults)
}

export const trackRenderSmoothingKey = track => {
    const smoothing = resolveTrackRenderSmoothing(track)

    return `${smoothing.enabled ? 1 : 0}:${smoothing.step}`
}

export const smoothCoordinateSegment = (coordinates, step) => {
    let result = Array.isArray(coordinates) ? coordinates.map(cloneCoordinate) : []

    for (let index = 0; index < step; index++) {
        result = chaikinPass(result)
    }

    return result
}

export const getTrackRenderContent = track => {
    const content = track?.content
    const geometry = content?.geometry
    const smoothing = resolveTrackRenderSmoothing(track)

    if (!smoothing.enabled || !geometry || ![LINE_STRING, MULTI_LINE_STRING].includes(geometry.type)) {
        return content
    }

    const renderContent = deepClone(content)

    renderContent.geometry.coordinates = geometry.type === LINE_STRING
                                         ? smoothCoordinateSegment(geometry.coordinates, smoothing.step)
                                         : (geometry.coordinates ?? [])
                                             .map(segment => smoothCoordinateSegment(segment, smoothing.step))

    return renderContent
}
