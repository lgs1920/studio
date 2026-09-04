/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineRendering.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-09-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Create the timeline visual renderer.
 *
 * @param {Object} options - Renderer dependencies.
 * @returns {Object} Rendering operations.
 */
export const createTimelineRenderer = ({
    createElement,
    createIcon,
    formatRulerTime,
    resolveColorClasses,
    applyTimelinePaletteStyles,
    resolveRowLabel,
    resolveClipLabel,
    resolveClipIcon,
    numericToken,
    getTimelineConfig,
    getRows,
    getDragState,
    getEditingRowId,
    getEditingLabelValue,
    setEditingLabelValue,
    getRangeStartMillis,
    getRangeEndMillis,
    getCurrentTimeMillis,
    getDurationMillis,
    getContentWidth,
    getZoom,
    contextualSlot,
    hasContextualSlot,
    globalSlotContent,
    button,
    removeTrack,
    beginTrackLabelEdit,
    commitTrackLabelEdit,
    cancelTrackLabelEdit,
    startRowDrag,
    toggleTrackVisibility,
    startClipInteraction,
    resizeClipByKeyboard,
    startRangeInteraction,
    setRangeBoundaryToLimit,
    moveRangeByKeyboard,
    startPlayheadInteraction,
    movePlayheadByKeyboard,
    seek,
    addPointerListeners,
    capturePointer,
    handleWheel,
    handleKeyDown,
    emit,
    setScrubPointerId,
    scaleWidth,
    scaleOffset,
}) => {
    /**
     * Create one visual timeline clip.
     *
     * @param {Object} value - Timeline clip.
     * @param {number} majorSeconds - Seconds represented by one ruler unit.
     * @param {boolean} trackVisible - Whether the owning track is visible.
     * @returns {HTMLElement} Clip element.
     */
    const clip = (value, majorSeconds, trackVisible = true, trackEditable = true) => {
        const start = Math.max(0, Number(value.start) || 0)
        const end = Math.max(start, Number(value.end) || start)
        const dragState = getDragState()
        const isDragging = dragState?.type === 'clip' && dragState.clipId === value.id
        const isResizing = isDragging && dragState.mode === 'resize'
        const element = createElement('div', `lgs1920-wa-timeline__clip ${resolveColorClasses(value.colorClasses)}${value.visible === false ? ' lgs1920-wa-timeline__clip--hidden' : ''}${trackVisible === false ? ' lgs1920-wa-timeline__clip--track-hidden' : ''}${isDragging ? ' lgs1920-wa-timeline__clip--dragging' : ''}${isResizing ? ' lgs1920-wa-timeline__clip--resizing' : ''}`, {
            part: 'clip',
            id: `lgs1920-timeline-clip-${String(value.id ?? '')}`,
            'data-clip-id': value.id,
            'data-clip-kind': value.kind,
            'aria-label': resolveClipLabel(value),
        })
        applyTimelinePaletteStyles(element, value.colorClasses)
        const timeline = getTimelineConfig()
        const interactive = timeline.interactive !== false
        const editable = timeline.editable !== false && trackEditable !== false
        const movable = interactive && editable
        const resizable = interactive && editable && value.resizable !== false
        if (movable) element.classList.add('lgs1920-wa-timeline__clip--movable')
        element.style.left = `${scaleOffset() + ((start / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth())}px`
        element.style.width = `${Math.max(numericToken('clip-min-width', 8), ((end - start) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth())}px`
        const preview = createElement('span', 'lgs1920-wa-timeline__clip-preview', {part: 'clip-preview'})
        preview.append(
            contextualSlot('clip-icon', value.id, 'clip-icon', createIcon(resolveClipIcon(value), 'solid')),
            contextualSlot('clip-label', value.id, 'clip-label', document.createTextNode(resolveClipLabel(value))),
        )
        element.append(
            clipHandle(value, 'start', resizable),
            contextualSlot('clip-content', value.id, ['clip-content'], preview),
            clipHandle(value, 'end', resizable),
        )
        if (interactive) {
            element.addEventListener('pointerdown', event => {
                if (event.target.closest('[data-clip-handle]')) return
                startClipInteraction(event, value.id, 'move')
            })
            element.addEventListener('dblclick', event => {
                emit('dblclick', {
                    clip: value,
                    context: {type: 'clip', pisteId: value.trackId ?? null, clipId: value.id},
                    event,
                })
            })
        }
        return element
    }

    /**
     * Create a clip edge handle with a contextual slot and keyboard support.
     *
     * @param {Object} value - Timeline clip.
     * @param {'start'|'end'} edge - Clip edge.
     * @param {boolean} enabled - Whether resizing is enabled.
     * @returns {HTMLElement} Clip handle.
     */
    const clipHandle = (value, edge, enabled) => {
        const handle = createElement('span', `lgs1920-wa-timeline__clip-handle lgs1920-wa-timeline__clip-handle--${edge}`, {
            part: `clip-${edge}-handle`,
            'data-clip-handle': edge,
            'aria-label': `${edge === 'start' ? 'Start' : 'End'} of ${resolveClipLabel(value)}`,
            role: 'slider',
            tabindex: enabled ? 0 : -1,
            'aria-hidden': enabled ? null : 'true',
        })
        handle.append(contextualSlot(`clip-${edge}-handle`, value.id, `clip-${edge}-handle`, createIcon('grip-lines-vertical', 'solid')))
        if (enabled) {
            handle.addEventListener('pointerdown', event => startClipInteraction(event, value.id, 'resize', edge))
            handle.addEventListener('keydown', event => resizeClipByKeyboard(value.id, edge, event))
        }
        return handle
    }

    /**
     * Create a draggable video range boundary handle.
     *
     * @param {'start'|'end'} edge - Range boundary.
     * @returns {HTMLElement} Range handle.
     */
    const rangeHandle = edge => {
        const isStart = edge === 'start'
        const timeMillis = isStart ? getRangeStartMillis() : getRangeEndMillis()
        const interactive = getTimelineConfig().interactive !== false
        const handle = createElement('div', `lgs1920-wa-timeline__range-handle lgs1920-wa-timeline__range-handle--${edge}`, {
            part: `timeline-${edge}-handle`,
            'data-range-handle': edge,
            role: 'slider',
            tabindex: interactive && getTimelineConfig().editable !== false ? 0 : -1,
            'aria-label': `${isStart ? 'Video start' : 'Video end'} position`,
            'aria-valuemin': 0,
            'aria-valuemax': getDurationMillis(),
            'aria-valuenow': timeMillis,
        })
        const grip = createElement('span', 'lgs1920-wa-timeline__range-grip', {part: `timeline-${edge}-grip`})
        grip.append(...globalSlotContent(`timeline-${edge}-handle`, createIcon('grip-dots-vertical', 'solid')))
        handle.append(grip)
        if (interactive) {
            handle.addEventListener('pointerdown', event => startRangeInteraction(event, edge))
            handle.addEventListener('keydown', event => moveRangeByKeyboard(edge, event))
            handle.addEventListener('dblclick', event => setRangeBoundaryToLimit(edge, event))
        }
        return handle
    }

    /**
     * Create one track legend row.
     *
     * @param {Object} row - Timeline row.
     * @returns {HTMLElement} Legend row.
     */
    const legendRow = row => {
        const timeline = getTimelineConfig()
        const interactive = timeline.interactive !== false
        const editable = interactive && timeline.editable !== false && row.editable !== false
        const titleDisabled = row.visible === false || !editable
        const titleEditable = editable && row.visible !== false
        const readOnly = row.editable === false
        const label = resolveRowLabel(row)
        const dragState = getDragState()
        const isClipDropTarget = dragState?.type === 'clip'
            && dragState.targetTrackId === row.id
            && dragState.sourceTrackId !== row.id
        const isRejectedRow = dragState?.type === 'row'
            && dragState.rowId === row.id
            && dragState.dropRejected === true
        const element = createElement('div', `lgs1920-wa-timeline__legend-row ${resolveColorClasses(row.colorClasses)}${readOnly ? ' lgs1920-wa-timeline__legend-row--read-only' : ' lgs-widget-no-drag'}${row.visible === false ? ' lgs1920-wa-timeline__legend-row--hidden' : ''}${titleDisabled ? ' lgs1920-wa-timeline__legend-row--title-disabled' : ''}${editable ? ' lgs1920-wa-timeline__legend-row--movable' : ''}${dragState?.rowId === row.id ? ' lgs1920-wa-timeline__legend-row--dragging' : ''}${isClipDropTarget ? ' lgs1920-wa-timeline__legend-row--clip-drop-target' : ''}`, {
            part: 'legend-row',
            id: `lgs1920-timeline-track-${String(row.id ?? '')}`,
            'data-row-id': row.id,
            'aria-label': label,
        })
        if (isRejectedRow) element.classList.add('lgs1920-wa-timeline__legend-row--drop-rejected')
        element.style.height = 'var(--lgs-timeline-row-height)'
        const labelPrefix = hasContextualSlot('name', row.id) ? 'name' : 'track-label'
        const editing = getEditingRowId() === row.id && titleEditable
        const labelElement = editing
            ? createElement('wa-input', 'lgs1920-wa-timeline__label-editor', {
                size: 's',
                value: getEditingLabelValue(),
                'aria-label': `Edit ${label}`,
                'data-edit-row-id': row.id,
            })
            : contextualSlot(labelPrefix, row.id, ['name', 'track-label'], document.createTextNode(label))
        if (editing) {
            labelElement.addEventListener('input', event => {
                setEditingLabelValue(event.target.value ?? '')
            })
            labelElement.addEventListener('change', () => commitTrackLabelEdit())
            labelElement.addEventListener('blur', () => commitTrackLabelEdit())
            labelElement.addEventListener('keydown', event => {
                if (event.key === 'Enter') commitTrackLabelEdit()
                if (event.key === 'Escape') cancelTrackLabelEdit()
            })
        }
        const trackContent = createElement('span', `lgs1920-wa-timeline__track-content${titleDisabled ? ' lgs1920-wa-timeline__track-content--title-disabled' : ''}`, {
            part: 'legend-content',
            'aria-disabled': titleDisabled ? 'true' : null,
        })
        trackContent.append(labelElement)
        if (titleEditable) {
            trackContent.addEventListener('dblclick', event => {
                event.preventDefault()
                event.stopPropagation()
                beginTrackLabelEdit(row)
            })
        }
        if (editable) {
            trackContent.addEventListener('pointerdown', event => {
                if (event.button !== 0 || event.target?.closest?.('wa-input')) return
                event.stopPropagation()
                startRowDrag(event, row.id)
            })
        }
        const actions = createElement('span', 'lgs1920-wa-timeline__track-actions', {part: 'track-actions'})
        if (interactive) actions.addEventListener('pointerdown', event => event.stopPropagation())
        if (editable && row.canHide) {
            const visibility = button({
                iconName: row.visible === false ? 'eye' : 'eye-slash',
                label: row.visible === false ? `Show ${label}` : `Hide ${label}`,
                testId: 'visibility',
                iconSlotElement: contextualSlot('visibility', row.id, 'visibility', createIcon(row.visible === false ? 'eye' : 'eye-slash', 'solid')),
            })
            visibility.addEventListener('click', event => {
                event.stopPropagation()
                toggleTrackVisibility(row, event)
            })
            actions.append(visibility)
        } else {
            actions.append(createElement('span', 'lgs1920-wa-timeline__action-placeholder', {
                part: 'visibility-placeholder',
                'aria-hidden': 'true',
            }))
        }
        if (editable) {
            const remove = button({
                iconName: 'trash-can',
                label: `Remove ${label}`,
                testId: 'remove-track',
                variant: 'danger',
                iconSlotElement: contextualSlot('remove', row.id, 'remove', createIcon('trash-can', 'regular')),
            })
            remove.addEventListener('click', event => {
                event.stopPropagation()
                removeTrack(row, event)
            })
            actions.append(remove)
        } else {
            actions.append(createElement('span', 'lgs1920-wa-timeline__action-placeholder', {
                part: 'remove-placeholder',
                'aria-hidden': 'true',
            }))
        }
        if (editable) actions.append(contextualSlot('actions', row.id, 'actions', null))
        element.append(actions, trackContent)
        return element
    }

    /**
     * Create the ruler, tracks, playhead, and end marker surface.
     *
     * @param {number} scaleCount - Number of major ruler units.
     * @param {number} majorSeconds - Seconds represented by one major unit.
     * @param {number} scaleSplitCount - Minor ruler subdivision count.
     * @returns {HTMLElement} Timeline surface.
     */
    const surfaceElement = (scaleCount, majorSeconds, scaleSplitCount) => {
        const interactive = getTimelineConfig().interactive !== false
        const surface = createElement('wa-card', 'lgs1920-wa-timeline__surface', {
            part: 'surface',
            appearance: 'plain',
            'data-surface': '',
            tabindex: interactive ? 0 : -1,
            role: 'group',
            'aria-label': 'Timeline time scale and scrubbing',
            'data-zoom-percent': getZoom(),
        })
        const canvas = createElement('div', 'lgs1920-wa-timeline__canvas', {part: 'canvas'})
        canvas.style.width = `${getContentWidth()}px`
        const ruler = createElement('div', 'lgs1920-wa-timeline__ruler', {part: 'ruler'})
        ruler.style.width = `${getContentWidth()}px`
        for (let index = 0; index <= scaleCount; index += 1) {
            const tick = createElement('span', `lgs1920-wa-timeline__tick${index === 0 ? ' lgs1920-wa-timeline__tick--origin' : ''}`, {part: 'tick'})
            tick.style.left = `${scaleOffset() + (index * scaleWidth())}px`
            tick.append(contextualSlot('scale-label', index, 'scale-label', document.createTextNode(formatRulerTime(index * majorSeconds))))
            for (let split = 1; split < scaleSplitCount; split += 1) {
                const minor = createElement('span', 'lgs1920-wa-timeline__minor-tick', {part: 'minor-tick'})
                minor.style.left = `${scaleOffset() + ((index + (split / scaleSplitCount)) * scaleWidth())}px`
                ruler.append(minor)
            }
            ruler.append(tick)
        }
        ruler.append(
            createElement('slot', '', {name: 'timeline-ruler'}),
            createElement('div', 'lgs1920-wa-timeline__clip-edge-indicator', {
                part: 'clip-edge-indicator',
                'data-clip-edge-indicator': '',
                'aria-hidden': 'true',
                hidden: true,
            }),
            createElement('div', 'lgs1920-wa-timeline__clip-move-endpoint lgs1920-wa-timeline__clip-move-endpoint--start', {
                part: 'clip-move-start-endpoint',
                'data-clip-move-endpoint': 'start',
                'aria-hidden': 'true',
                hidden: true,
            }),
            createElement('div', 'lgs1920-wa-timeline__clip-move-endpoint lgs1920-wa-timeline__clip-move-endpoint--end', {
                part: 'clip-move-end-endpoint',
                'data-clip-move-endpoint': 'end',
                'aria-hidden': 'true',
                hidden: true,
            }),
        )
        const tracks = createElement('div', 'lgs1920-wa-timeline__tracks', {part: 'tracks'})
        tracks.style.width = `${getContentWidth()}px`
        getRows().forEach(row => {
            const dragState = getDragState()
            const isClipDropTarget = dragState?.type === 'clip'
                && dragState.targetTrackId === row.id
                && dragState.sourceTrackId !== row.id
            const isRejectedRow = dragState?.type === 'row'
                && dragState.rowId === row.id
                && dragState.dropRejected === true
            const track = createElement('div', `lgs1920-wa-timeline__track${row.editable === false ? ' lgs1920-wa-timeline__track--read-only' : ''}${row.visible === false ? ' lgs1920-wa-timeline__track--hidden' : ''}${dragState?.type === 'row' && dragState.rowId === row.id ? ' lgs1920-wa-timeline__track--dragging' : ''}${isRejectedRow ? ' lgs1920-wa-timeline__track--drop-rejected' : ''}${isClipDropTarget ? ' lgs1920-wa-timeline__track--clip-drop-target' : ''}`, {part: 'track', 'data-row-id': row.id})
            track.style.height = 'var(--lgs-timeline-row-height)'
            const trackBackground = createElement('div', `lgs1920-wa-timeline__track-background${row.editable === false ? ' lgs1920-wa-timeline__track-background--read-only' : ''}${row.visible === false ? ' lgs1920-wa-timeline__track-background--hidden' : ''}`, {
                part: 'track-background',
                'data-row-id': row.id,
                'aria-hidden': 'true',
            })
            track.append(trackBackground)
            for (const value of row.actions ?? []) {
                track.append(clip(Object.assign({}, value, {trackId: row.id}), majorSeconds, row.visible !== false, row.editable !== false))
            }
            tracks.append(track)
        })
        const tracksViewport = createElement('div', 'lgs1920-wa-timeline__tracks-viewport', {
            part: 'tracks-viewport',
            'data-tracks-viewport': '',
            'data-scroll-view': 'tracks',
        })
        tracksViewport.style.width = `${getContentWidth()}px`
        const playhead = createElement('div', 'lgs1920-wa-timeline__playhead', {
            part: 'playhead',
            'data-playhead': '',
            role: 'slider',
            tabindex: interactive ? 0 : -1,
            'aria-label': 'Current timeline position',
            'aria-valuemin': getRangeStartMillis(),
            'aria-valuemax': getRangeEndMillis(),
            'aria-valuenow': getCurrentTimeMillis(),
        })
        const playheadGrip = createElement('span', 'lgs1920-wa-timeline__playhead-grip', {part: 'playhead-grip'})
        playheadGrip.append(createIcon('grip-dots-vertical', 'solid'))
        playhead.append(playheadGrip)
        if (interactive) {
            playheadGrip.addEventListener('pointerdown', event => startPlayheadInteraction(event))
            playhead.addEventListener('keydown', event => movePlayheadByKeyboard(event))
        }
        const overlay = createElement('div', 'lgs1920-wa-timeline__overlay', {part: 'overlay', 'data-overlay': ''})
        overlay.append(
            rangeHandle('start'),
            rangeHandle('end'),
            playhead,
            createElement('div', 'lgs1920-wa-timeline__end-marker', {part: 'end-marker', 'data-end-marker': ''}),
        )
        tracksViewport.append(tracks)
        canvas.append(ruler, tracksViewport, overlay)
        surface.append(canvas)
        if (interactive) {
            surface.addEventListener('pointerdown', event => {
                if (event.button !== 0 || event.target.closest('.lgs1920-wa-timeline__clip')) return
                if (event.target.closest('[data-range-handle]')) return
                const rangeHandle = [...overlay.querySelectorAll('[data-range-handle]')]
                    .map(handle => ({
                        handle,
                        distance: Math.abs(event.clientX - (handle.getBoundingClientRect().left + (handle.getBoundingClientRect().width / 2))),
                    }))
                    .sort((left, right) => left.distance - right.distance)[0]
                if (!rangeHandle || rangeHandle.distance > 8) return
                event.preventDefault()
                event.stopImmediatePropagation()
                startRangeInteraction(event, rangeHandle.handle.getAttribute('data-range-handle'))
            }, true)
            surface.addEventListener('click', event => {
                if (event.target.closest('.lgs1920-wa-timeline__clip, [data-range-handle], [data-playhead]')) return
                seek(event.clientX, true)
            })
            surface.addEventListener('wheel', event => handleWheel(event))
            surface.addEventListener('keydown', event => handleKeyDown(event))
            surface.addEventListener('pointerdown', event => {
                if (event.button !== 0 || event.target.closest('.lgs1920-wa-timeline__clip')) return
                setScrubPointerId(event.pointerId)
                capturePointer(event)
                addPointerListeners()
                seek(event.clientX, false)
            })
        }
        return surface
    }

    return {clip, clipHandle, legendRow, rangeHandle, surfaceElement}
}
