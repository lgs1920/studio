/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: OrbitSettings.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_JOURNEY, CURRENT_POI } from '@Core/constants'

export const ORBIT_RPM_MIN = 0.2
export const ORBIT_RPM_MAX = 3
export const ORBIT_RPM_STEP = 0.1
export const ORBIT_DIRECTION_MIN = -2
export const ORBIT_DIRECTION_MAX = 2
export const ORBIT_DIRECTION_STEP = 0.2
export const DEFAULT_ORBIT_RPM = 1
export const DEFAULT_ORBIT_DIRECTION = 1
export const PANORAMA_HEIGHT_OFFSET_MIN = 50
export const PANORAMA_HEIGHT_OFFSET_MAX = 5000
export const PANORAMA_HEIGHT_OFFSET_STEP = 100
export const PANORAMA_PITCH_MIN = -90
export const PANORAMA_PITCH_MAX = 0
export const PANORAMA_PITCH_STEP = 1
export const DEFAULT_PANORAMA_HEIGHT_OFFSET = 1000
export const DEFAULT_PANORAMA_PITCH = -12

const roundToStep = (value, step) => Number((Math.round(value / step) * step).toFixed(1))
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const normalizeOrbitRPM = (value, fallback = DEFAULT_ORBIT_RPM) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    return Math.min(ORBIT_RPM_MAX, Math.max(ORBIT_RPM_MIN, roundToStep(numericValue, ORBIT_RPM_STEP)))
}

export const normalizeOrbitDirection = (value, fallback = DEFAULT_ORBIT_DIRECTION) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    const normalized = Math.min(ORBIT_DIRECTION_MAX, Math.max(ORBIT_DIRECTION_MIN, roundToStep(numericValue, ORBIT_DIRECTION_STEP)))
    return Object.is(normalized, -0) ? 0 : normalized
}

export const normalizePanoramaHeightOffset = (value, fallback = DEFAULT_PANORAMA_HEIGHT_OFFSET) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    return clamp(numericValue, PANORAMA_HEIGHT_OFFSET_MIN, PANORAMA_HEIGHT_OFFSET_MAX)
}

export const normalizePanoramaPitch = (value, fallback = DEFAULT_PANORAMA_PITCH) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    return clamp(numericValue, PANORAMA_PITCH_MIN, PANORAMA_PITCH_MAX)
}

export const getOrbitSettings = (target, key) => {
    const source = target?.[key] ?? {}

    return {
        rpm:       normalizeOrbitRPM(source.rpm),
        direction: normalizeOrbitDirection(source.direction),
    }
}

export const resolveOrbitEntity = (target) => {
    if (!target?.element) {
        return null
    }

    if (target.element === CURRENT_POI) {
        const poiId = target.slug ?? target.id
        return poiId ? lgs.stores.main.components.pois.list.get(poiId) ?? null : null
    }

    if (target.element === CURRENT_JOURNEY) {
        const journeySlug = target.slug ?? target.id
        return journeySlug ? lgs.getJourneyBySlug(journeySlug) ?? null : null
    }

    return null
}

export const persistOrbitSettings = (target, key, updates = {}) => {
    const entity = resolveOrbitEntity(target)
    if (!entity) {
        return
    }

    const nextSettings = {
        ...(entity[key] ?? {}),
        ...updates,
    }

    if (Object.prototype.hasOwnProperty.call(nextSettings, 'rpm')) {
        nextSettings.rpm = normalizeOrbitRPM(nextSettings.rpm)
    }
    if (Object.prototype.hasOwnProperty.call(nextSettings, 'direction')) {
        nextSettings.direction = normalizeOrbitDirection(nextSettings.direction)
    }
    if (key === 'panorama' && Object.prototype.hasOwnProperty.call(nextSettings, 'heightOffset')) {
        nextSettings.heightOffset = normalizePanoramaHeightOffset(nextSettings.heightOffset)
    }
    if (key === 'panorama' && Object.prototype.hasOwnProperty.call(nextSettings, 'pitch')) {
        nextSettings.pitch = normalizePanoramaPitch(nextSettings.pitch)
    }

    if (entity.element === CURRENT_POI) {
        return __.ui.poiManager.updatePOI(entity.id, {[key]: nextSettings})
    }

    if (entity.element === CURRENT_JOURNEY) {
        entity[key] = nextSettings
        return entity.persistToDatabase()
    }
}

export const setOrbitStoreSettings = (store, settings = {}) => {
    store.rpm = normalizeOrbitRPM(settings.rpm)
    store.direction = normalizeOrbitDirection(settings.direction)
}

export const getOrbitDirectionLabel = (direction) => {
    const normalized = normalizeOrbitDirection(direction)
    if (normalized === 0) {
        return 'Pause'
    }

    return `${normalized > 0 ? 'CW' : 'CCW'} ${Math.abs(normalized).toFixed(1)}`
}
