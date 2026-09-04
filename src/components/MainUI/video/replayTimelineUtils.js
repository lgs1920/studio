/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replayTimelineUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared UI helpers for the Replay preparation timeline.
 */

export const REPLAY_TIMELINE_UI = Object.freeze({
    headerHeight: 42,
    horizontalScrollbarHeight: 8,
    minWidth: 352,
    minHeight: 156,
    layoutMinHeight: 74,
    maxWidth: 3840,
    maxHeight: 2160,
    minimumVisibleDurationSeconds: 5,
    minimumVisibleTrackCount: 1,
    maximumVisibleTrackCount: 3,
    previewTopHeight: 56,
    outerPadding: 24,
    outerBorderWidth: 2,
    legendResizerWidth: 6,
    scaleOffset: 20,
    scrubThrottleMillis: 50,
    legendMaxWidth: 250,
    legendMinWidth: 50,
    legendWidth: 150,
    rowHeight: 24,
    scaleIntervalMillis: 200,
    scaleSplitCount: 5,
    scaleWidth: 40,
    horizontalScrollDurationRatio: 0.2,
})

/**
 * Define the supported timeline zoom range and increment.
 */
export const REPLAY_TIMELINE_ZOOM = Object.freeze({
    defaultPercent: 0,
    maxPercent:     500,
    minPercent:     -50,
    stepPercent:    20,
})

/**
 * Define the major and minor time units used by the timeline ruler.
 *
 * The half-second unit is used only when the timeline is zoomed below the
 * default level so that the lower zoom boundary still has an observable
 * effect.
 */
export const REPLAY_TIMELINE_TIME_UNITS = Object.freeze([
    Object.freeze({
        id:             'half-second',
        majorSeconds:   0.5,
        minorMillis:    100,
        scaleSplitCount: 5,
        maxZoomPercent: -21,
    }),
    Object.freeze({
        id:             'second',
        majorSeconds:   1,
        minorMillis:    200,
        scaleSplitCount: 5,
        maxZoomPercent: 100,
    }),
    Object.freeze({
        id:             'ten-seconds',
        majorSeconds:   10,
        minorMillis:    1000,
        scaleSplitCount: 10,
        maxZoomPercent: 260,
    }),
    Object.freeze({
        id:             'thirty-seconds',
        majorSeconds:   30,
        minorMillis:    5000,
        scaleSplitCount: 6,
        maxZoomPercent: 360,
    }),
    Object.freeze({
        id:             'minute',
        majorSeconds:   60,
        minorMillis:    10000,
        scaleSplitCount: 6,
        maxZoomPercent: 440,
    }),
    Object.freeze({
        id:             'five-minutes',
        majorSeconds:   300,
        minorMillis:    30000,
        scaleSplitCount: 10,
        maxZoomPercent: REPLAY_TIMELINE_ZOOM.maxPercent,
    }),
])

/**
 * Clamp a timeline zoom percentage to the supported range.
 *
 * @param {number} zoomPercent - Requested zoom percentage.
 * @returns {number} Clamped zoom percentage.
 */
export const clampReplayTimelineZoom = zoomPercent => {
    const numericZoom = Number(zoomPercent)
    const safeZoom = Number.isFinite(numericZoom)
        ? numericZoom
        : REPLAY_TIMELINE_ZOOM.defaultPercent
    return Math.min(
        REPLAY_TIMELINE_ZOOM.maxPercent,
        Math.max(REPLAY_TIMELINE_ZOOM.minPercent, safeZoom),
    )
}

/**
 * Move the timeline zoom by one configured increment.
 *
 * @param {number} zoomPercent - Current zoom percentage.
 * @param {number} direction - Positive or negative movement direction.
 * @returns {number} Next clamped zoom percentage.
 */
export const stepReplayTimelineZoom = (zoomPercent, direction) => {
    const numericDirection = Number(direction)
    const sign = numericDirection < 0 ? -1 : numericDirection > 0 ? 1 : 0
    return clampReplayTimelineZoom(
        clampReplayTimelineZoom(zoomPercent) + (sign * REPLAY_TIMELINE_ZOOM.stepPercent),
    )
}

/**
 * Resolve the ruler unit for a timeline zoom percentage.
 *
 * @param {number} zoomPercent - Current zoom percentage.
 * @returns {Object} Major and minor ruler unit configuration.
 */
export const resolveReplayTimelineScale = zoomPercent => {
    const normalizedZoom = clampReplayTimelineZoom(zoomPercent)
    return REPLAY_TIMELINE_TIME_UNITS.find(unit => normalizedZoom <= unit.maxZoomPercent)
        ?? REPLAY_TIMELINE_TIME_UNITS[REPLAY_TIMELINE_TIME_UNITS.length - 1]
}

/**
 * Resolve the natural height of the Replay timeline surface.
 *
 * @param {number} rowCount - Number of visible timeline rows.
 * @returns {number} Timeline height in pixels.
 */
export const resolveReplayTimelineHeight = rowCount => REPLAY_TIMELINE_UI.previewTopHeight
    + REPLAY_TIMELINE_UI.outerPadding
    + REPLAY_TIMELINE_UI.outerBorderWidth
    + resolveReplayTimelineLayoutHeight(rowCount)

/**
 * Resolve the minimum height of the timeline layout inside its outer host.
 *
 * @param {number} rowCount - Number of timeline rows.
 * @returns {number} Timeline layout height in pixels.
 */
export const resolveReplayTimelineLayoutHeight = rowCount => REPLAY_TIMELINE_UI.headerHeight
    + REPLAY_TIMELINE_UI.horizontalScrollbarHeight
    + (Math.min(
        REPLAY_TIMELINE_UI.maximumVisibleTrackCount,
        Math.max(REPLAY_TIMELINE_UI.minimumVisibleTrackCount, Math.floor(Number(rowCount) || 0)),
    ) * REPLAY_TIMELINE_UI.rowHeight)

/**
 * Resolve the minimum outer width required to show five seconds of the ruler.
 *
 * @returns {number} Minimum timeline width in pixels.
 */
export const resolveReplayTimelineMinimumWidth = () => REPLAY_TIMELINE_UI.minWidth

/**
 * Resolve the minimum outer dimensions required by the floating timeline.
 *
 * @param {number} rowCount - Number of timeline rows.
 * @returns {{width: number, height: number, layoutHeight: number}} Minimum dimensions.
 */
export const resolveReplayTimelineMinimumDimensions = rowCount => ({
    width:        resolveReplayTimelineMinimumWidth(),
    height:       resolveReplayTimelineHeight(rowCount),
    layoutHeight: resolveReplayTimelineLayoutHeight(rowCount),
})

/**
 * Resolve the row height used when the timeline receives additional vertical space.
 * The horizontal scrollbar consumes part of that space in the package-owned grid.
 *
 * @param {Object} options - Timeline layout dimensions.
 * @param {number} options.height - Available timeline height in pixels.
 * @param {number} options.rowCount - Number of timeline rows.
 * @returns {number} Vertical row height in pixels.
 */
export const resolveReplayTimelineRowHeight = ({height, rowCount}) => {
    const safeHeight = Number(height)
    const safeRowCount = Math.max(1, Math.floor(Number(rowCount) || 0))
    const availableRowsHeight = (Number.isFinite(safeHeight) ? safeHeight : resolveReplayTimelineLayoutHeight(0))
        - REPLAY_TIMELINE_UI.headerHeight
        - REPLAY_TIMELINE_UI.horizontalScrollbarHeight
    return Math.max(
        REPLAY_TIMELINE_UI.rowHeight,
        Math.floor(availableRowsHeight / safeRowCount),
    )
}

/**
 * Resolve the number of ruler units required to cover both the Replay duration
 * and the available horizontal timeline surface.
 *
 * @param {Object} options - Timeline scale dimensions.
 * @param {number} options.durationSeconds - Replay duration in seconds.
 * @param {number} options.majorSeconds - Duration represented by one major unit.
 * @param {number} [options.width=0] - Available timeline width in pixels.
 * @param {number} [options.durationPaddingRatio=0] - Additional duration reserved for horizontal scrolling.
 * @returns {number} Number of major ruler units.
 */
export const resolveReplayTimelineScaleCount = ({durationSeconds, majorSeconds, width = 0, durationPaddingRatio = 0}) => {
    const safeDuration = Math.max(0, Number(durationSeconds) || 0)
    const safeMajorSeconds = Math.max(Number.EPSILON, Number(majorSeconds) || 0)
    const safePaddingRatio = Math.max(0, Number(durationPaddingRatio) || 0)
    const durationScaleCount = Math.ceil((safeDuration * (1 + safePaddingRatio)) / safeMajorSeconds)
    const widthScaleCount = Math.ceil(Math.max(0, Number(width) || 0) / REPLAY_TIMELINE_UI.scaleWidth)
    return Math.max(1, durationScaleCount, widthScaleCount)
}

/**
 * Add stable row selectors used by the external timeline legend.
 *
 * @param {Array} editorData - Timeline editor rows.
 * @returns {Array} Editor rows decorated with stable row selectors.
 */
export const decorateReplayTimelineEditorData = editorData => (editorData ?? []).map((row, index) => ({
    ...row,
    classNames: [
        ...(row.classNames ?? []),
        `replay-timeline-row-index-${index}`,
    ],
}))

/**
 * Resolve the CSS transform used to align the external legend with the rows.
 *
 * @param {number} scrollTop - Current timeline vertical scroll offset.
 * @returns {string} CSS translation for the legend rows.
 */
export const resolveReplayTimelineLegendTransform = scrollTop => {
    const normalizedScrollTop = Number(scrollTop)
    const safeScrollTop = Number.isFinite(normalizedScrollTop) ? Math.max(0, normalizedScrollTop) : 0
    return `translateY(-${safeScrollTop}px)`
}

/**
 * Relay a track-name press to the package-owned row drag handle.
 *
 * @param {Object} options - Drag relay options.
 * @param {Object|null} options.event - React mouse event from the track legend.
 * @param {number} options.rowIndex - Position of the row in the editor data.
 * @param {HTMLElement|null} options.timelineElement - Timeline package root.
 * @returns {boolean} True when the package drag handle received the event.
 */
export const relayReplayTimelineRowDrag = ({event, rowIndex, timelineElement} = {}) => {
    if (!event || event.button !== 0 || !timelineElement) {
        return false
    }

    const rowElement = timelineElement.querySelector(`.replay-timeline-row-index-${rowIndex}`)
    const dragHandle = rowElement?.querySelector('.timeline-editor-edit-row-drag-handle')
    if (!dragHandle) {
        return false
    }

    event.preventDefault()
    dragHandle.dispatchEvent(new globalThis.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: event.button,
        buttons: event.buttons,
        clientX: event.clientX,
        clientY: event.clientY,
    }))
    return true
}
