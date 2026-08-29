/**
 * Shared UI helpers for the Replay preparation timeline.
 */

export const REPLAY_TIMELINE_UI = Object.freeze({
    headerHeight: 42,
    legendWidth: 136,
    minHeight: 66,
    rowHeight: 24,
    scaleIntervalMillis: 200,
    scaleSplitCount: 5,
    scaleWidth: 40,
})

/**
 * Resolve the natural height of the Replay timeline surface.
 *
 * @param {number} rowCount - Number of visible timeline rows.
 * @returns {number} Timeline height in pixels.
 */
export const resolveReplayTimelineHeight = rowCount => Math.max(
    REPLAY_TIMELINE_UI.minHeight,
    REPLAY_TIMELINE_UI.headerHeight + (Math.max(0, Number(rowCount) || 0) * REPLAY_TIMELINE_UI.rowHeight),
)

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
 * @param {Object|null} options.row - Timeline row represented by the legend entry.
 * @param {number} options.rowIndex - Position of the row in the editor data.
 * @param {HTMLElement|null} options.timelineElement - Timeline package root.
 * @returns {boolean} True when the package drag handle received the event.
 */
export const relayReplayTimelineRowDrag = ({event, row, rowIndex, timelineElement} = {}) => {
    if (!event || row?.movable === false || row?.fixed === true || event.button !== 0 || !timelineElement) {
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
