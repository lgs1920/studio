/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayWidgetGuideUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {buildCenteredGridLines} from '@Core/ui/widget-manager/widgetGridUtils'

const VALID_ORIENTATIONS = new Set(['horizontal', 'vertical'])
const DEFAULT_GUIDE_POSITIONS = [
    ...Array.from({length: 9}, (_, index) => (index + 1) / 10),
    ...Array.from({length: 9}, (_, index) => (((index + 1) * 10) + 5) / 100),
    // Keep the final slots inside the crop after both 10% placement passes.
    0.05,
    0.98,
]

/** Maximum number of guides allowed for each orientation. */
export const MAX_REPLAY_WIDGET_GUIDES_PER_ORIENTATION = 20

/**
 * Convert a candidate value to a finite number.
 *
 * @param {*} value - Candidate numeric value.
 * @returns {number|null} Finite number or null when the value is invalid.
 */
const toFiniteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Clamp a normalized crop coordinate to the visible crop.
 *
 * @param {number} value - Candidate normalized coordinate.
 * @returns {number} Coordinate between zero and one.
 */
const clampFraction = value => Math.min(1, Math.max(0, value))

/**
 * Replace the active alignment guide list in the Replay runtime store.
 *
 * @param {Array<Object>} guides - Current alignment guide data.
 * @returns {Array<Object>} Normalized runtime guides.
 */
export const setReplayWidgetGuides = guides => {
    const normalized = normalizeReplayWidgetGuides(guides)
    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        replayStore.alignmentGuides = normalized
    }
    return normalized
}

/**
 * Start or cancel placement of a Replay Expert alignment guide.
 *
 * @param {'horizontal'|'vertical'|null} orientation - Placement orientation.
 * @returns {'horizontal'|'vertical'|null} The active placement orientation.
 */
export const setReplayWidgetGuidePlacement = orientation => {
    const placement = VALID_ORIENTATIONS.has(orientation) ? orientation : null
    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        replayStore.guidePlacementOrientation = placement
    }
    return placement
}

/**
 * Normalize persisted Replay Expert alignment guides.
 *
 * @param {*} guides - Candidate guide collection.
 * @returns {Array<{id: string, orientation: string, position: number, blocked: boolean}>} Safe guide data.
 */
export const normalizeReplayWidgetGuides = guides => {
    if (!Array.isArray(guides)) {
        return []
    }

    const seenIds = new Set()
    const orientationCounts = new Map()
    return guides.flatMap(guide => {
        const id = String(guide?.id ?? '').trim()
        const position = toFiniteNumber(guide?.position)
        if (!id || seenIds.has(id) || !VALID_ORIENTATIONS.has(guide.orientation) || position === null) {
            return []
        }

        const orientationCount = orientationCounts.get(guide.orientation) ?? 0
        if (orientationCount >= MAX_REPLAY_WIDGET_GUIDES_PER_ORIENTATION) {
            return []
        }

        seenIds.add(id)
        orientationCounts.set(guide.orientation, orientationCount + 1)

        return [{
            id,
            orientation: guide.orientation,
            position:    clampFraction(position),
            blocked:     guide.blocked === true,
        }]
    })
}

/**
 * Resolve the default crop-relative position for a newly added guide.
 * Horizontal and vertical guides each follow the same independent placement sequence.
 *
 * @param {'horizontal'|'vertical'} orientation - Guide orientation.
 * @param {Array<Object>} guides - Current alignment guides.
 * @returns {number|null} Next default position or null when that orientation is full.
 */
export const nextReplayWidgetGuidePosition = (orientation, guides) => {
    if (!VALID_ORIENTATIONS.has(orientation)) {
        return null
    }

    const count = normalizeReplayWidgetGuides(guides)
        .filter(guide => guide.orientation === orientation)
        .length

    return DEFAULT_GUIDE_POSITIONS[count] ?? null
}

/**
 * Resolve the crop-relative alignment guides saved in the journey's Expert settings.
 *
 * @param {Object|null} journey - Journey with Replay Expert settings.
 * @returns {Array<{id: string, orientation: string, position: number, blocked: boolean}>} Normalized guides.
 */
export const journeyReplayExpertWidgetGuides = journey => normalizeReplayWidgetGuides(
    journey?.replay?.expert?.alignmentGuides,
)

/**
 * Save Replay Expert alignment guides to their journey and database.
 *
 * @param {Array<Object>} guides - Current crop-relative guide settings.
 * @param {Object|null} journey - Journey receiving the settings.
 * @returns {Array<Object>|null} Normalized saved guides.
 */
export const syncJourneyReplayExpertWidgetGuides = (guides, journey) => {
    if (!journey) {
        return null
    }

    const normalized = normalizeReplayWidgetGuides(guides)
    const replay = journey.replay ?? {}
    journey.replay = {
        ...replay,
        expert: {
            ...(replay.expert ?? {}),
            alignmentGuides: normalized,
        },
    }

    if (typeof journey.persistToDatabase === 'function') {
        void Promise.resolve(journey.persistToDatabase()).catch(error => {
            console.error(`[Replay persistence] Failed to save alignment guides for ${journey.slug ?? 'a Journey'}.`, error)
        })
    }

    return normalized
}

/**
 * Convert a pointer coordinate into a crop-relative guide position.
 *
 * @param {'horizontal'|'vertical'} orientation - Guide orientation.
 * @param {number} clientCoordinate - Pointer coordinate on the guide's axis.
 * @param {Object} rect - Crop board rectangle.
 * @returns {number} Clamped crop-relative guide position.
 */
export const replayWidgetGuidePositionFromPointer = (orientation, clientCoordinate, rect) => {
    const horizontalAxis = orientation === 'horizontal'
    const start = horizontalAxis ? rect?.top : rect?.left
    const size = horizontalAxis ? rect?.height : rect?.width
    const coordinate = toFiniteNumber(clientCoordinate)
    if (!Number.isFinite(start) || !Number.isFinite(size) || size <= 0 || coordinate === null) {
        return 0
    }

    return clampFraction((coordinate - start) / size)
}

/**
 * Collect crop and widget alignment coordinates for a guide orientation.
 *
 * @param {'horizontal'|'vertical'} orientation - Guide orientation.
 * @param {Object} rect - Crop board rectangle.
 * @param {Object[]} widgetRects - Peer widget rectangles.
 * @returns {number[]} Candidate viewport coordinates.
 */
const resolveAxisSnapPoints = (orientation, rect, widgetRects) => {
    const horizontalAxis = orientation === 'horizontal'
    const start = horizontalAxis ? rect.top : rect.left
    const end = horizontalAxis ? rect.bottom : rect.right
    const points = [start, start + ((end - start) / 2), end]

    for (const widgetRect of widgetRects) {
        const min = horizontalAxis ? widgetRect.top : widgetRect.left
        const max = horizontalAxis ? widgetRect.bottom : widgetRect.right
        if (min >= start && min <= end) {
            points.push(min)
        }
        if (max >= start && max <= end) {
            points.push(max)
        }
        if (min < end && max > start) {
            points.push((min + max) / 2)
        }
    }

    return points
}

/**
 * Snap a guide to nearby widget alignment points and enabled grid lines.
 *
 * @param {Object} options - Snap inputs.
 * @param {'horizontal'|'vertical'} options.orientation - Guide orientation.
 * @param {number} options.position - Crop-relative candidate position.
 * @param {Object} options.rect - Crop board rectangle.
 * @param {Object[]} [options.widgetRects=[]] - Peer widget rectangles.
 * @param {Object} [options.grid] - Active grid settings.
 * @param {number} [options.threshold=10] - Maximum snap distance in pixels.
 * @returns {number} Snapped crop-relative position.
 */
export const snapReplayWidgetGuidePosition = ({
    orientation,
    position,
    rect,
    widgetRects = [],
    grid = null,
    threshold = 10,
}) => {
    if (!VALID_ORIENTATIONS.has(orientation) || !rect || rect.width <= 0 || rect.height <= 0) {
        return clampFraction(toFiniteNumber(position) ?? 0)
    }

    const horizontalAxis = orientation === 'horizontal'
    const start = horizontalAxis ? rect.top : rect.left
    const size = horizontalAxis ? rect.height : rect.width
    const target = start + (clampFraction(toFiniteNumber(position) ?? 0) * size)
    const candidates = resolveAxisSnapPoints(orientation, rect, widgetRects)

    if (grid?.enabled && grid?.snap) {
        const lines = buildCenteredGridLines(rect, grid.size)
        candidates.push(...(horizontalAxis ? lines.horizontalGuidelines : lines.verticalGuidelines))
    }

    const nearest = candidates.reduce((best, candidate) => {
        const distance = Math.abs(candidate - target)
        return distance < best.distance ? {distance, position: candidate} : best
    }, {distance: Number.POSITIVE_INFINITY, position: target})

    return nearest.distance <= threshold
        ? clampFraction((nearest.position - start) / size)
        : clampFraction((target - start) / size)
}
