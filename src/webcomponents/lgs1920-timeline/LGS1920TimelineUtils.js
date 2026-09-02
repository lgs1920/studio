/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const TAG_NAME = 'lgs1920-timeline'
export const MIN_ZOOM = -50
export const MAX_ZOOM = 500
export const ZOOM_STEP = 20
export const START_LEFT = 20
export const SCALE_WIDTH = 40
export const MIN_VISIBLE_DURATION_SECONDS = 5
export const MIN_LEGEND_WIDTH = 100
export const MAX_LEGEND_WIDTH = 230
export const HEADER_HEIGHT = 42
export const HORIZONTAL_SCROLLBAR_HEIGHT = 8
export const MIN_ROW_HEIGHT = 24
export const EDGE_TRIGGER_SIZE = 24
export const EDGE_SCROLL_SPEEDS = [8, 16, 32, 64, 128]
export const ACCELERATION_INTERVAL = 100
export const EDGE_TIME_ACCELERATION_INTERVAL = 500
export const EDGE_SCROLL_TIME_STEPS = [10, 100, 500, 1_000, 5_000, 30_000]
export const GLOBAL_SLOTS = [
    'track-label',
    'drag-trigger',
    'visibility',
    'name',
    'actions',
    'clip-icon',
    'clip-label',
    'clip-content',
    'clip-start-handle',
    'clip-end-handle',
    'timeline-start-handle',
    'timeline-end-handle',
    'scale-label',
    'clip-option-icon',
    'clip-option-label',
    'track-context-menu',
]

/**
 * Create a DOM element with a class name and HTML attributes.
 *
 * @param {string} tagName - Element tag name.
 * @param {string} [className=''] - Optional class name.
 * @param {Object} [attributes={}] - Attributes to apply.
 * @returns {HTMLElement} Created element.
 */
export const createElement = (tagName, className = '', attributes = {}) => {
    const element = document.createElement(tagName)
    if (className) element.className = className
    Object.entries(attributes).forEach(([name, value]) => {
        if (value === true) element.setAttribute(name, '')
        else if (value !== false && value !== null && value !== undefined) element.setAttribute(name, `${value}`)
    })
    return element
}

/**
 * Create a Font Awesome-backed Web Awesome icon.
 *
 * @param {string} name - Font Awesome icon name.
 * @param {string} [variant='regular'] - Web Awesome icon variant.
 * @returns {HTMLElement} Icon element.
 */
export const createIcon = (name, variant = 'regular') => createElement('wa-icon', '', {name, variant, label: ''})

/**
 * Create a composed, bubbling custom event.
 *
 * @param {string} name - Event name.
 * @param {Object} detail - Event detail payload.
 * @returns {CustomEvent} Composed custom event.
 */
export const createEvent = (name, detail) => new CustomEvent(name, {bubbles: true, composed: true, detail})

/**
 * Format elapsed seconds as a compact minute and second label.
 *
 * @param {number} seconds - Elapsed time in seconds.
 * @returns {string} Formatted elapsed-time label.
 */
export const formatTime = seconds => {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
    return `${Math.floor(totalSeconds / 60)}:${`${totalSeconds % 60}`.padStart(2, '0')}`
}

/**
 * Format a ruler value without unnecessary decimal places.
 *
 * @param {number} seconds - Ruler value in seconds.
 * @returns {string} Ruler label.
 */
export const formatScale = seconds => {
    const normalizedSeconds = Math.max(0, Number(seconds) || 0)
    return `${Number.isInteger(normalizedSeconds) ? normalizedSeconds : Number(normalizedSeconds.toFixed(3))}`
}

/**
 * Format a ruler time using the smallest useful time precision.
 *
 * @param {number} seconds - Ruler time in seconds.
 * @returns {string} Zero-padded ruler label.
 */
export const formatRulerTime = seconds => {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor(totalSeconds / 60)
    const remainderSeconds = totalSeconds % 60
    const paddedHours = `${hours}`
    const paddedMinutes = `${minutes % 60}`.padStart(2, '0')
    const paddedSeconds = `${remainderSeconds}`.padStart(2, '0')

    if (totalSeconds >= 3600) {
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
    }
    if (totalSeconds >= 60) {
        return `${minutes}:${paddedSeconds}`
    }
    return `${totalSeconds}`
}

/**
 * Resolve a human-readable clip label.
 *
 * @param {Object} clip - Timeline clip.
 * @returns {string} Clip label.
 */
export const resolveClipLabel = clip => String(clip?.label ?? clip?.name ?? clip?.kind ?? '')

/**
 * Resolve a Font Awesome icon for a timeline clip.
 *
 * @param {Object} clip - Timeline clip.
 * @returns {string} Icon name.
 */
export const resolveClipIcon = clip => clip?.icon
    ?? (clip?.kind === 'start' ? 'play' : clip?.kind === 'stop' ? 'stop' : 'film')

/**
 * Resolve a human-readable row label.
 *
 * @param {Object} row - Timeline row.
 * @returns {string} Row label.
 */
export const resolveRowLabel = row => String(row?.label ?? row?.id ?? '')

/**
 * Join Web Awesome color classes with a safe fallback.
 *
 * @param {Array} colorClasses - Web Awesome color classes.
 * @returns {string} Class string.
 */
export const resolveColorClasses = colorClasses => Array.isArray(colorClasses) && colorClasses.length > 0
    ? colorClasses.join(' ')
    : 'wa-neutral wa-neutral-blue'

const TIMELINE_PALETTE_COLORS = new Set([
    'red',
    'orange',
    'yellow',
    'green',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
    'gray',
])

/**
 * Resolve the palette name from Web Awesome neutral color classes.
 *
 * @param {Array} colorClasses - Web Awesome color classes.
 * @returns {string} Supported palette color name.
 */
export const resolveTimelinePaletteColor = colorClasses => {
    const colorClass = (Array.isArray(colorClasses) ? colorClasses : [])
        .find(value => typeof value === 'string' && value.startsWith('wa-neutral-'))
    const color = colorClass?.slice('wa-neutral-'.length)
    return TIMELINE_PALETTE_COLORS.has(color) ? color : 'blue'
}

/**
 * Apply direct palette tokens to a timeline color surface.
 *
 * This keeps colors visible when the timeline is rendered in a Shadow DOM,
 * where the application's global Web Awesome utility selectors do not match.
 *
 * @param {HTMLElement} element - Timeline element receiving the color.
 * @param {Array} colorClasses - Web Awesome color classes.
 */
export const applyTimelinePaletteStyles = (element, colorClasses) => {
    const color = resolveTimelinePaletteColor(colorClasses)
    element.style.backgroundColor = `var(--wa-color-${color}-50)`
    element.style.borderColor = `var(--wa-color-${color}-60)`
    element.style.color = `var(--wa-color-${color}-on)`
    element.style.setProperty('--wa-color-fill-loud', `var(--wa-color-${color}-50)`)
    element.style.setProperty('--wa-color-border-loud', `var(--wa-color-${color}-60)`)
    element.style.setProperty('--wa-color-on-loud', `var(--wa-color-${color}-on)`)
    element.style.setProperty('--lgs-timeline-clip-handle-color', `var(--wa-color-${color}-on)`)
    element.style.setProperty('--lgs-timeline-clip-handle-hover-color', `var(--wa-color-${color}-on)`)
}

/**
 * Create a stable slot suffix from a user-provided identifier.
 *
 * @param {string} identifier - Track or clip identifier.
 * @returns {string} Slot-safe identifier.
 */
export const slotKey = identifier => String(identifier ?? '')

/**
 * Clamp a numeric value between two bounds.
 *
 * @param {number} value - Value to clamp.
 * @param {number} minimum - Lower bound.
 * @param {number} maximum - Upper bound.
 * @returns {number} Clamped value.
 */
export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

/**
 * Resolve the configurable track title width bounds.
 *
 * @param {Object} timeline - Timeline configuration.
 * @returns {{minimum: number, maximum: number}} Width bounds in pixels.
 */
export const resolveLegendBounds = (timeline = {}) => {
    const configuredMinimum = Number(timeline.legendMinWidth)
    const configuredMaximum = Number(timeline.legendMaxWidth)
    const minimum = Number.isFinite(configuredMinimum) && configuredMinimum > 0 ? configuredMinimum : MIN_LEGEND_WIDTH
    const maximum = Math.max(minimum, Number.isFinite(configuredMaximum) && configuredMaximum > 0 ? configuredMaximum : MAX_LEGEND_WIDTH)
    return {minimum, maximum}
}

/**
 * Resolve the major ruler unit for the configured zoom.
 *
 * @param {number} zoomPercent - Current zoom percentage.
 * @returns {{majorSeconds: number, scaleSplitCount: number}} Ruler configuration.
 */
export const resolveScale = zoomPercent => {
    const zoom = clamp(Number(zoomPercent) || 0, MIN_ZOOM, MAX_ZOOM)
    if (zoom <= -21) return {majorSeconds: 0.5, scaleSplitCount: 5}
    if (zoom <= 100) return {majorSeconds: 1, scaleSplitCount: 5}
    if (zoom <= 260) return {majorSeconds: 10, scaleSplitCount: 10}
    if (zoom <= 360) return {majorSeconds: 30, scaleSplitCount: 6}
    if (zoom <= 440) return {majorSeconds: 60, scaleSplitCount: 6}
    return {majorSeconds: 300, scaleSplitCount: 10}
}
