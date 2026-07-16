/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgetGridUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const DEFAULT_WIDGET_GRID_SIZE = 30
export const MIN_WIDGET_GRID_SIZE = 1
export const MAX_WIDGET_GRID_SIZE = 1000
export const DEFAULT_WIDGET_GRID_SETTINGS = {
    enabled: false,
    size:    DEFAULT_WIDGET_GRID_SIZE,
}

const toFiniteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

export const normalizeWidgetGridSize = (value, fallback = DEFAULT_WIDGET_GRID_SIZE) => {
    const number = toFiniteNumber(value)
    const resolved = number ?? fallback
    return Math.min(Math.max(Math.round(resolved), MIN_WIDGET_GRID_SIZE), MAX_WIDGET_GRID_SIZE)
}

export const getWidgetGridSettings = (settings = DEFAULT_WIDGET_GRID_SETTINGS) => ({
    enabled: Boolean(settings?.enabled),
    size:    normalizeWidgetGridSize(settings?.size),
})

const normalizeGridAxisSize = (size, axis) => {
    if (size && typeof size === 'object') {
        return normalizeWidgetGridSize(size[axis])
    }
    return normalizeWidgetGridSize(size)
}

const buildAxisLines = (center, min, max, size) => {
    if (!Number.isFinite(center) || !Number.isFinite(min) || !Number.isFinite(max) || size <= 0 || max <= min) {
        return []
    }

    const lines = []
    for (let position = center; position <= max; position += size) {
        if (position >= min) {
            lines.push(position)
        }
    }
    for (let position = center - size; position >= min; position -= size) {
        if (position <= max) {
            lines.push(position)
        }
    }

    return lines.sort((a, b) => a - b)
}

export const buildCenteredGridLines = (rect, size = DEFAULT_WIDGET_GRID_SIZE) => {
    const gridSizeX = normalizeGridAxisSize(size, 'x')
    const gridSizeY = normalizeGridAxisSize(size, 'y')
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return {verticalGuidelines: [], horizontalGuidelines: []}
    }

    const centerX = rect.left + (rect.width / 2)
    const centerY = rect.top + (rect.height / 2)

    return {
        verticalGuidelines:   buildAxisLines(centerX, rect.left, rect.right, gridSizeX),
        horizontalGuidelines: buildAxisLines(centerY, rect.top, rect.bottom, gridSizeY),
    }
}
