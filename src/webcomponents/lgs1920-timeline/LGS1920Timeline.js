/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920Timeline.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-09-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@web.awesome.me/webawesome-pro/dist/components/button/button.js'
import '@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js'
import '@web.awesome.me/webawesome-pro/dist/components/icon/icon.js'
import '@web.awesome.me/webawesome-pro/dist/components/input/input.js'
import '@web.awesome.me/webawesome-pro/dist/components/popup/popup.js'
import '@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js'
import styles from './lgs1920-timeline.css?inline'
import {cloneRows, createTimelineClipEditor, resolveClipInterval, trackAcceptsClip} from './LGS1920TimelineEditing.js'
import {createTimelineRenderer} from './LGS1920TimelineRendering.js'
import {
    ACCELERATION_INTERVAL,
    EDGE_SCROLL_SPEEDS,
    EDGE_TRIGGER_SIZE,
    GLOBAL_SLOTS,
    HEADER_HEIGHT,
    HORIZONTAL_SCROLLBAR_HEIGHT,
    MAX_ZOOM,
    MIN_VISIBLE_DURATION_SECONDS,
    MIN_ROW_HEIGHT,
    MIN_ZOOM,
    SCALE_WIDTH,
    START_LEFT,
    TAG_NAME,
    ZOOM_STEP,
    applyTimelinePaletteStyles,
    clamp,
    createElement,
    createEvent,
    createIcon,
    formatTime,
    formatRulerTime,
    resolveClipIcon,
    resolveClipLabel,
    resolveColorClasses,
    resolveLegendBounds,
    resolveRowLabel,
    resolveScale,
    slotKey,
} from './LGS1920TimelineUtils.js'

/**
 * Native pointing events that must remain local to the timeline surface.
 */
const TIMELINE_INPUT_EVENT_TYPES = Object.freeze([
    'auxclick',
    'click',
    'contextmenu',
    'dblclick',
    'drag',
    'dragend',
    'dragstart',
    'gotpointercapture',
    'lostpointercapture',
    'mousedown',
    'mouseenter',
    'mouseleave',
    'mousemove',
    'mouseout',
    'mouseover',
    'mouseup',
    'pointercancel',
    'pointerdown',
    'pointerenter',
    'pointerleave',
    'pointermove',
    'pointerout',
    'pointerover',
    'pointerrawupdate',
    'pointerup',
    'touchcancel',
    'touchend',
    'touchmove',
    'touchstart',
    'wheel',
])

/**
 * Continuation events that must reach an already active external gesture.
 */
const EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES = Object.freeze([
    'mousemove',
    'mouseup',
    'pointercancel',
    'pointermove',
    'pointerup',
    'touchcancel',
    'touchend',
    'touchmove',
])

/**
 * Web Awesome-compatible LGS1920 timeline custom element.
 *
 * The element is a controlled DOM adapter. It has no React hooks, Valtio
 * dependency, playback clock, or application store ownership. Applications
 * receive controlled props and emit interaction events.
 */
export class LGS1920Timeline extends HTMLElement {
    #root
    #projection = null
    #rows = []
    #timelineConfig = {}
    #trackDefinitions = []
    #currentTimeMillis = 0
    #playing = false
    #visible = true
    #clipOptions = []
    #zoom = 0
    #legendWidth = 136
    #interactionDurationMillis = null
    #rangeStartMillis = 0
    #rangeEndMillis = 0
    #rangeEndFollowsDuration = true
    #surfaceWidth = 0
    #contentWidth = START_LEFT + SCALE_WIDTH
    #rowHeight = MIN_ROW_HEIGHT
    #menuOpen = false
    #surface = null
    #tracksViewport = null
    #resizeObserver = null
    #scrollbarDrag = null
    #scrollbarDragCleanup = null
    #scrollbarHideTimer = null
    #scrollbarsInteractionActive = false
    #splitPanelDragCleanup = null
    #pointerCaptureTarget = null
    #pointerCaptureId = null
    #dragState = null
    #scrubPointerId = null
    #autoScrollFrame = null
    #edgeDirection = null
    #edgeStartedAt = null
    #editingRowId = null
    #editingLabelValue = ''
    #contextMenuState = null
    #inputPropagationBlockersInstalled = false
    #externalInteractionActive = false
    #clipEditor
    #renderer

    /**
     * Construct the shadow DOM host and its persistent stylesheet.
     */
    constructor() {
        super()
        this.#root = this.attachShadow({mode: 'open'})
        const style = document.createElement('style')
        style.textContent = styles
        this.#root.append(style)
        this.#clipEditor = createTimelineClipEditor({
            getRows: () => this.#rows,
            getTimelineConfig: () => this.#timelineConfig,
            getProjectionDurationMillis: () => this.#projection?.durationMillis ?? 0,
            getTimeAtClientX: clientX => this.#timeAtClientX(clientX),
            getTrackAtClientY: clientY => this.#trackAtClientY(clientY),
            getRangeEndFollowsDuration: () => this.#rangeEndFollowsDuration,
            setRangeEndMillis: value => {
                this.#rangeEndMillis = value
            },
            setRows: rows => {
                this.#rows = rows
            },
            setInteractionDurationMillis: value => {
                this.#interactionDurationMillis = value
            },
            emit: (name, detail) => this.#emit(name, detail),
            render: () => this.#render(),
        })
        this.#renderer = createTimelineRenderer({
            createElement,
            createIcon,
            formatRulerTime,
            resolveColorClasses,
            applyTimelinePaletteStyles,
            resolveRowLabel,
            resolveClipLabel,
            resolveClipIcon,
            numericToken: (name, fallback) => this.#numericToken(name, fallback),
            getTimelineConfig: () => this.#timelineConfig,
            getRows: () => this.#rows,
            getDragState: () => this.#dragState,
            getEditingRowId: () => this.#editingRowId,
            getEditingLabelValue: () => this.#editingLabelValue,
            setEditingLabelValue: value => {
                this.#editingLabelValue = value
            },
            getRangeStartMillis: () => this.#rangeStartMillis,
            getRangeEndMillis: () => this.#rangeEndMillis,
            getDurationMillis: () => this.#durationMillis(),
            getContentWidth: () => this.#contentWidth,
            getZoom: () => this.#zoom,
            contextualSlot: (prefix, identifier, globalName, fallback) => this.#contextualSlot(prefix, identifier, globalName, fallback),
            hasContextualSlot: (prefix, identifier) => this.#hasContextualSlot(prefix, identifier),
            globalSlotContent: (name, fallback) => this.#globalSlotContent(name, fallback),
            button: options => this.#button(options),
            openContextMenu: (type, identifier, anchor, event) => this.#openContextMenu(type, identifier, anchor, event),
            beginTrackLabelEdit: row => this.#beginTrackLabelEdit(row),
            commitTrackLabelEdit: () => this.#commitTrackLabelEdit(),
            cancelTrackLabelEdit: () => this.#cancelTrackLabelEdit(),
            startRowDrag: (event, rowId) => this.#startRowDrag(event, rowId),
            toggleTrackVisibility: (row, event) => this.#toggleTrackVisibility(row, event),
            startClipInteraction: (event, clipId, mode, edge) => this.#startClipInteraction(event, clipId, mode, edge),
            resizeClipByKeyboard: (clipId, edge, event) => this.#clipEditor.resizeByKeyboard(clipId, edge, event),
            startRangeInteraction: (event, edge) => this.#startRangeInteraction(event, edge),
            moveRangeByKeyboard: (edge, event) => this.#moveRangeByKeyboard(edge, event),
            seek: (clientX, settled) => this.#seek(clientX, settled),
            addPointerListeners: () => this.#addPointerListeners(),
            capturePointer: event => this.#capturePointer(event),
            handleWheel: event => this.#handleWheel(event),
            handleKeyDown: event => this.#handleKeyDown(event),
            emit: (name, detail) => this.#emit(name, detail),
            setScrubPointerId: value => {
                this.#scrubPointerId = value
            },
            scaleWidth: () => this.#numericToken('scale-width', SCALE_WIDTH),
            scaleOffset: () => this.#numericToken('scale-offset', START_LEFT),
        })
    }

    /**
     * Declare the attributes that are handled by the custom element itself.
     *
     * @returns {Array<string>} Observed attributes.
     */
    static get observedAttributes() {
        return []
    }

    /**
     * Render the component when it is attached to the document.
     */
    connectedCallback() {
        this.setAttribute('role', 'region')
        if (!this.getAttribute('aria-label')) this.setAttribute('aria-label', 'Timeline')
        this.#installInputPropagationBlockers()
        this.#render()
    }

    /**
     * Stop native pointing events at the Web Component host after internal
     * timeline listeners have handled them.
     *
     * @param {Event} event - Native pointing event.
     */
    #stopInputPropagation = event => {
        if (this.#externalInteractionActive
            && EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES.includes(event.type)) return
        event.stopPropagation()
    }

    /**
     * Install the local input boundary once for the lifetime of the host.
     */
    #installInputPropagationBlockers = () => {
        if (this.#inputPropagationBlockersInstalled) return
        for (const eventType of TIMELINE_INPUT_EVENT_TYPES) {
            this.addEventListener(eventType, this.#stopInputPropagation)
        }
        this.#inputPropagationBlockersInstalled = true
    }

    /**
     * Remove the local input boundary when the host leaves the document.
     */
    #removeInputPropagationBlockers = () => {
        if (!this.#inputPropagationBlockersInstalled) return
        for (const eventType of TIMELINE_INPUT_EVENT_TYPES) {
            this.removeEventListener(eventType, this.#stopInputPropagation)
        }
        this.#inputPropagationBlockersInstalled = false
    }

    /**
     * Get the global timeline configuration.
     *
     * @returns {Object} Timeline configuration.
     */
    get timeline() {
        return {...this.#timelineConfig}
    }

    /**
     * Set the global timeline configuration.
     *
     * @param {Object} value - Timeline configuration.
     */
    set timeline(value) {
        this.#interactionDurationMillis = null
        const config = value && typeof value === 'object' ? Object.assign({}, value) : {}
        this.#rangeEndFollowsDuration = !Number.isFinite(Number(config.rangeEndMillis))
        const {minimum, maximum} = resolveLegendBounds(config)
        this.#timelineConfig = Object.assign({}, config, {
            legendMinWidth: minimum,
            legendMaxWidth: maximum,
        })
        if (this.#timelineConfig.interactive === false) {
            this.#menuOpen = false
            this.#contextMenuState = null
            this.#dragState = null
            this.#removePointerListeners()
            this.#stopAutoScroll()
        }
        this.#visible = this.#timelineConfig.visible !== false
        this.#syncPublicProps()
    }

    /**
     * Get the public track definitions.
     *
     * @returns {Array} Track definitions.
     */
    get tracks() {
        return this.#rows.map(row => this.#publicTrack(row))
    }

    /**
     * Set the public track definitions.
     *
     * @param {Array} value - Track definitions.
     */
    set tracks(value) {
        this.#interactionDurationMillis = null
        this.#trackDefinitions = Array.isArray(value) ? value : []
        this.#syncPublicProps()
    }

    /**
     * Get the current logical timeline time.
     *
     * @returns {number} Current time in milliseconds.
     */
    get currentTimeMillis() {
        return this.#currentTimeMillis
    }

    /**
     * Set the current logical timeline time.
     *
     * @param {number} value - Time in milliseconds.
     */
    set currentTimeMillis(value) {
        this.#currentTimeMillis = Math.max(0, Number(value) || 0)
        this.#updateDynamicState()
    }

    /**
     * Get the current playback state.
     *
     * @returns {boolean} Whether playback is active.
     */
    get playing() {
        return this.#playing
    }

    /**
     * Set the current playback state.
     *
     * @param {boolean} value - Whether playback is active.
     */
    set playing(value) {
        this.#playing = value === true
        if (this.isConnected) this.#render()
    }

    /**
     * Get the clip insertion options.
     *
     * @returns {Array} Clip options.
     */
    get clipOptions() {
        return [...this.#clipOptions]
    }

    /**
     * Set the clip insertion options.
     *
     * @param {Array} value - Clip options.
     */
    set clipOptions(value) {
        this.#clipOptions = Array.isArray(value) ? value : []
        if (this.isConnected) this.#render()
    }

    /**
     * Release observers, pointer listeners, and animation frames.
     */
    disconnectedCallback() {
        this.#removeInputPropagationBlockers()
        this.#resizeObserver?.disconnect()
        this.#removePointerListeners()
        this.#finishScrollbarDrag()
        this.#finishSplitPanelDrag()
        this.#externalInteractionActive = false
        this.#scrollbarsInteractionActive = false
        this.#clearScrollbarHideTimer()
        this.#stopAutoScroll()
    }

    /**
     * Synchronize the public properties with the internal editor projection.
     */
    #syncPublicProps = () => {
        const durationMillis = Number(this.#timelineConfig.durationMillis
            ?? (Number(this.#timelineConfig.durationSeconds) * 1000)) || 0
        const editorData = this.#trackDefinitions.map(track => ({
            ...track,
            actions: track.clips ?? [],
        }))
        this.#applyState({
            projection: {...this.#timelineConfig, durationMillis, durationSeconds: durationMillis / 1000, editorData},
            currentTimeMillis: this.#currentTimeMillis,
            playing: this.#playing,
            visible: this.#visible,
            clipOptions: this.#clipOptions,
            zoomPercent: this.#timelineConfig.zoomPercent,
            legendWidth: this.#timelineConfig.legendWidth,
            rangeStartMillis: this.#timelineConfig.rangeStartMillis,
            rangeEndMillis: this.#timelineConfig.rangeEndMillis ?? durationMillis,
        })
    }

    /**
     * Apply normalized controlled state to internal presentation state.
     *
     * @param {Object} state - Normalized timeline state.
     */
    #applyState = (state = {}) => {
        this.#projection = state.projection ?? null
        this.#rows = state.editorData ?? state.projection?.editorData ?? state.rows ?? []
        this.#currentTimeMillis = Math.max(0, Number(state.currentTimeMillis ?? 0) || 0)
        this.#playing = state.playing === true
        this.#visible = state.visible !== false
        this.#clipOptions = Array.isArray(state.clipOptions) ? state.clipOptions : []
        if (Number.isFinite(Number(state.zoomPercent))) this.#zoom = clamp(Number(state.zoomPercent), MIN_ZOOM, MAX_ZOOM)
        if (Number.isFinite(Number(state.legendWidth))) {
            const {minimum, maximum} = resolveLegendBounds(this.#timelineConfig)
            this.#legendWidth = clamp(Number(state.legendWidth), minimum, maximum)
        }
        const durationMillis = Number(this.#projection?.durationMillis) || 0
        if (Number.isFinite(Number(state.rangeStartMillis))) {
            this.#rangeStartMillis = clamp(Number(state.rangeStartMillis), 0, durationMillis)
        } else {
            this.#rangeStartMillis = 0
        }
        if (Number.isFinite(Number(state.rangeEndMillis))) {
            this.#rangeEndMillis = clamp(Math.max(this.#rangeStartMillis, Number(state.rangeEndMillis)), this.#rangeStartMillis, durationMillis)
        } else {
            this.#rangeEndMillis = durationMillis
        }
        this.#render()
    }

    /**
     * Set the controlled logical time without emitting a seek event.
     *
     * @param {number} timeMillis - Logical time in milliseconds.
     */
    setTime(timeMillis) {
        this.#currentTimeMillis = this.#normalizeTime(timeMillis)
        this.#updateDynamicState()
    }

    /**
     * Set the visible zoom percentage and rerender the ruler.
     *
     * @param {number} zoomPercent - Requested zoom percentage.
     */
    setZoom(zoomPercent) {
        this.#zoom = clamp(Number(zoomPercent) || 0, MIN_ZOOM, MAX_ZOOM)
        this.#render()
    }

    /**
     * Keep the custom scrollbar rails visible for an external pointer gesture.
     *
     * @param {boolean} active - Whether the external gesture is active.
     */
    setScrollbarsInteractionActive(active) {
        this.#scrollbarsInteractionActive = active === true
        if (this.#scrollbarsInteractionActive) {
            this.#showScrollbars()
            return
        }
        this.#scheduleScrollbarHide()
    }

    /**
     * Preserve an external drag or resize when its pointer crosses the host.
     *
     * Starting events remain local to the timeline. Only movement, completion,
     * and cancellation events cross the host while this state is active.
     *
     * @param {boolean} active - Whether an external gesture is active.
     */
    setExternalInteractionActive(active) {
        this.#externalInteractionActive = active === true
        this.setScrollbarsInteractionActive(this.#externalInteractionActive)
    }

    /**
     * Recompute dimensions after the host container changes size.
     */
    handleResize() {
        this.#surfaceWidth = this.#surface?.clientWidth ?? 0
        this.#render()
    }

    /**
     * Convert an internal row to the public track shape.
     *
     * @param {Object} row - Internal timeline row.
     * @returns {Object} Public track definition.
     */
    #publicTrack = row => {
        const {actions, ...track} = row
        return {...track, clips: actions ?? []}
    }

    /**
     * Build a public snapshot for controlled track changes.
     *
     * @returns {Object} Current timeline and track state.
     */
    #publicSnapshot = () => ({
        timeline: {
            ...this.#timelineConfig,
            durationMillis: this.#durationMillis(),
            currentTimeMillis: this.#currentTimeMillis,
            playing: this.#playing,
            visible: this.#visible,
            zoomPercent: this.#zoom,
            legendWidth: this.#legendWidth,
            rangeStartMillis: this.#rangeStartMillis,
            rangeEndMillis: this.#rangeEndMillis,
        },
        tracks: this.#rows.map(row => this.#publicTrack(row)),
    })

    /**
     * Start editing one track label.
     *
     * @param {Object} row - Track row to edit.
     */
    #beginTrackLabelEdit = row => {
        if (row?.editable === false) return
        this.#editingRowId = row.id
        this.#editingLabelValue = resolveRowLabel(row)
        this.#render()
        const input = [...this.#root.querySelectorAll('[data-edit-row-id]')]
            .find(element => element.getAttribute('data-edit-row-id') === String(row.id))
        input?.focus?.()
    }

    /**
     * Commit the active track label edit and emit a serializable change event.
     */
    #commitTrackLabelEdit = () => {
        if (this.#editingRowId === null) return
        const row = this.#rows.find(value => value.id === this.#editingRowId)
        if (!row) return this.#cancelTrackLabelEdit()
        const previousLabel = resolveRowLabel(row)
        const label = this.#editingLabelValue.trim() || previousLabel
        this.#rows = this.#rows.map(value => value.id === this.#editingRowId ? {...value, label} : value)
        const rowId = this.#editingRowId
        this.#editingRowId = null
        this.#editingLabelValue = ''
        this.#emit('track-label-change', {
            trackId: rowId,
            label,
            previousLabel,
            tracks: this.#rows.map(row => this.#publicTrack(row)),
            data: this.#publicSnapshot(),
        })
        this.#render()
    }

    /**
     * Cancel the active track label edit.
     */
    #cancelTrackLabelEdit = () => {
        this.#editingRowId = null
        this.#editingLabelValue = ''
        this.#render()
    }

    /**
     * Read a numeric component token with a JavaScript fallback.
     *
     * @param {string} name - Token suffix without the component prefix.
     * @param {number} fallback - Value used when the token is not numeric.
     * @returns {number} Numeric token value.
     */
    #numericToken = (name, fallback) => {
        const value = Number.parseFloat(globalThis.getComputedStyle?.(this)?.getPropertyValue(`--lgs-timeline-${name}`))
        return Number.isFinite(value) ? value : fallback
    }

    /**
     * Return the current projection duration in milliseconds.
     *
     * @returns {number} Duration in milliseconds.
     */
    #durationMillis = () => {
        if (Number.isFinite(this.#interactionDurationMillis)) return this.#interactionDurationMillis
        const duration = this.#projection?.durationMillis ?? (Number(this.#projection?.durationSeconds) * 1000)
        return Math.max(0, Number(duration) || 0)
    }

    /**
     * Return the current projection duration in seconds.
     *
     * @returns {number} Duration in seconds.
     */
    #durationSeconds = () => this.#durationMillis() / 1000

    /**
     * Normalize a time to the controlled projection duration.
     *
     * @param {number} timeMillis - Requested time in milliseconds.
     * @returns {number} Clamped time in milliseconds.
     */
    #normalizeTime = timeMillis => clamp(Number(timeMillis) || 0, 0, this.#durationMillis())

    /**
     * Render the empty or active component state.
     */
    #render = () => {
        if (!this.#visible || !this.#projection) {
            this.hidden = true
            this.#finishScrollbarDrag()
            this.#finishSplitPanelDrag()
            this.#externalInteractionActive = false
            this.#scrollbarsInteractionActive = false
            this.#clearScrollbarHideTimer()
            this.#root.replaceChildren(this.#root.querySelector('style'))
            this.#surface = null
            this.#tracksViewport = null
            return
        }

        this.hidden = false
        const previousScrollLeft = this.#surface?.scrollLeft ?? 0
        const previousScrollTop = this.#tracksViewport?.scrollTop ?? 0
        this.#finishScrollbarDrag()
        const {majorSeconds, scaleSplitCount} = resolveScale(this.#zoom)
        const durationSeconds = this.#durationSeconds()
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const scaleCount = Math.max(
            1,
            Math.ceil((Math.max(durationSeconds, this.#numericToken('min-visible-duration', MIN_VISIBLE_DURATION_SECONDS)) * 1.2) / majorSeconds),
            Math.ceil(Math.max(0, this.#surfaceWidth) / scaleWidth),
        )
        this.#contentWidth = Math.max(this.#surfaceWidth, scaleOffset + (scaleCount * scaleWidth))
        this.#rowHeight = this.#resolveRowHeight()
        this.#root.replaceChildren(this.#root.querySelector('style'), this.#structure(scaleCount, majorSeconds, scaleSplitCount))
        this.#surface = this.#root.querySelector('[data-surface]')
        this.#tracksViewport = this.#root.querySelector('[data-tracks-viewport]')
        if (this.#surface) {
            this.#surface.scrollLeft = previousScrollLeft
        }
        if (this.#tracksViewport) {
            this.#tracksViewport.scrollTop = previousScrollTop
        }
        this.#installResizeObserver()
        this.#updateLegendScroll()
        this.#updateScrollbars()
        this.#showScrollbars()
        this.#scheduleScrollbarHide()
        const renderedSurface = this.#surface
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                if (this.#surface === renderedSurface) this.#updateScrollbars()
            })
        }
        this.#updateDynamicState()
    }

    /**
     * Resolve the row height from the actual track layout when available.
     *
     * The host can also contain a header area, so using its full height would
     * make the rows overflow below the timeline surface.
     *
     * @returns {number} Row height in pixels.
     */
    #resolveRowHeight = () => {
        const layoutHeight = this.#root.querySelector('[data-layout]')?.getBoundingClientRect?.().height ?? 0
        const hostHeight = this.getBoundingClientRect?.().height ?? 0
        const height = layoutHeight > 0 ? layoutHeight : hostHeight
        const headerHeight = this.#numericToken('header-height', HEADER_HEIGHT)
        const scrollbarHeight = this.#numericToken('scrollbar-height', HORIZONTAL_SCROLLBAR_HEIGHT)
        const minimumRowHeight = this.#numericToken('row-height', MIN_ROW_HEIGHT)
        const available = Number(height) - headerHeight - scrollbarHeight
        return Math.max(minimumRowHeight, Math.floor(available / Math.max(1, this.#rows.length)))
    }

    /**
     * Create the component structure for one render pass.
     *
     * @param {number} scaleCount - Number of major ruler units.
     * @param {number} majorSeconds - Seconds represented by one major unit.
     * @param {number} scaleSplitCount - Minor ruler subdivision count.
     * @returns {HTMLElement} Rendered section.
     */
    #structure = (scaleCount, majorSeconds, scaleSplitCount) => {
        const section = createElement('section', 'lgs1920-wa-timeline', {
            part: 'timeline',
            'data-testid': 'lgs1920-wa-timeline',
            'aria-label': this.getAttribute('aria-label') || 'Video timeline tracks',
        })
        section.append(createElement('slot', 'lgs1920-wa-timeline__additional-content-slot', {name: 'additional-content'}), this.#slotRegistry())

        const top = createElement('div', 'lgs1920-wa-timeline__top', {part: 'top'})
        const header = createElement('header', 'lgs1920-wa-timeline__header', {part: 'header'})
        const headerActions = createElement('span', 'lgs1920-wa-timeline__header-actions', {part: 'header-actions'})
        headerActions.append(
            createElement('slot', '', {name: 'timeline-actions'}),
            createElement('slot', '', {name: 'header-actions'}),
        )
        header.append(createElement('slot', '', {name: 'header'}))
        const playbackControls = this.#playbackControls()
        if (playbackControls) header.append(playbackControls)
        header.append(headerActions)
        top.append(header)

        const playback = createElement('div', 'lgs1920-wa-timeline__playback-controls', {part: 'playback-controls', 'aria-label': 'Timeline playback controls'})
        playback.append(
            createElement('slot', '', {name: 'playback-start'}),
            this.#slotWithFallback('playback-current', this.#timeText(this.#currentTimeMillis / 1000, 'current')),
            this.#slotWithFallback('playback-separator', document.createTextNode(' / ')),
            this.#slotWithFallback('playback-total', this.#timeText(this.#durationSeconds(), 'total')),
            createElement('slot', '', {name: 'playback-end'}),
        )
        top.append(playback)
        section.append(top)

        const layout = createElement('div', 'lgs1920-wa-timeline__layout', {
            part: 'layout',
            'data-layout': '',
            'data-capture-exclude': 'true',
        })
        layout.style.setProperty('--lgs-timeline-legend-width', `${this.#legendWidth}px`)
        layout.style.setProperty('--lgs-timeline-row-height', `${this.#rowHeight}px`)
        layout.append(this.#splitPanel(scaleCount, majorSeconds, scaleSplitCount), this.#trackDropIndicator())
        section.append(layout)
        if (this.#contextMenuState && this.#timelineConfig.interactive !== false) section.append(this.#contextMenu())
        section.append(createElement('slot', '', {name: 'footer'}))
        return section
    }

    /**
     * Create the Web Awesome split panel for the track legend and time surface.
     *
     * @param {number} scaleCount - Number of major ruler units.
     * @param {number} majorSeconds - Seconds represented by one major unit.
     * @param {number} scaleSplitCount - Minor ruler subdivision count.
     * @returns {HTMLElement} Split panel element.
     */
    #splitPanel = (scaleCount, majorSeconds, scaleSplitCount) => {
        const {minimum, maximum} = resolveLegendBounds(this.#timelineConfig)
        const splitPanel = createElement('wa-split-panel', 'lgs1920-wa-timeline__split-panel', {
            part: 'split-panel',
            orientation: 'horizontal',
            primary: 'start',
            'position-in-pixels': this.#legendWidth,
        })
        splitPanel.style.setProperty('--min', `${minimum}px`)
        splitPanel.style.setProperty('--max', `min(${maximum}px, calc(100% - ${minimum}px))`)
        splitPanel.style.setProperty('--divider-width', 'var(--lgs-timeline-resizer-width)')
        splitPanel.style.setProperty('--divider-hit-area', 'var(--lgs-timeline-resizer-hit-area)')
        splitPanel.addEventListener('pointerdown', event => this.#startSplitPanelDrag(event, splitPanel))
        splitPanel.addEventListener('wa-reposition', event => {
            const width = Number(event.currentTarget?.positionInPixels)
            if (!Number.isFinite(width)) return
            this.#legendWidth = clamp(width, minimum, maximum)
            this.#root.querySelector('[data-layout]')?.style.setProperty('--lgs-timeline-legend-width', `${this.#legendWidth}px`)
            this.#showScrollbars()
            this.#updateScrollbars()
            if (!this.#scrollbarsInteractionActive) this.#scheduleScrollbarHide()
        })

        const legend = this.#legend()
        legend.slot = 'start'
        const surface = this.#surfaceElement(scaleCount, majorSeconds, scaleSplitCount)
        surface.slot = 'end'
        splitPanel.append(legend, surface)
        return splitPanel
    }

    /**
     * Create the horizontal track insertion indicator used during row drag.
     *
     * @returns {HTMLElement} Drop indicator element.
     */
    #trackDropIndicator = () => {
        const indicator = createElement('div', 'lgs1920-wa-timeline__track-drop-indicator', {
            part: 'track-drop-indicator',
            'data-track-drop-indicator': '',
            'aria-hidden': 'true',
        })
        const dropIndex = this.#dragState?.type === 'row' ? this.#dragState.dropIndex : null
        if (Number.isFinite(dropIndex)) {
            const headerHeight = this.#numericToken('header-height', HEADER_HEIGHT)
            indicator.style.top = `${headerHeight + (dropIndex * this.#rowHeight)}px`
        } else {
            indicator.hidden = true
        }
        return indicator
    }

    /**
     * Create the Web Awesome video timeline playback controls.
     *
     * @returns {HTMLElement|null} Button group, or null for display-only timelines.
     */
    #playbackControls = () => {
        if (this.#timelineConfig.interactive === false) return null
        const controls = createElement('wa-button-group', '', {label: 'Timeline playback controls', part: 'controls'})
        const play = this.#button({
            iconName: this.#playing ? 'pause' : 'play',
            label: this.#playing ? 'Pause timeline' : 'Play timeline',
            testId: 'timeline-play',
            iconSlot: this.#playing ? 'pause-icon' : 'play-icon',
            labelSlot: this.#playing ? 'pause-label' : 'play-label',
        })
        play.addEventListener('click', () => this.#emit(this.#playing ? 'pause' : 'play', {}))
        const restart = this.#button({
            iconName: 'arrow-rotate-left',
            label: 'Restart timeline',
            testId: 'timeline-restart',
            iconSlot: 'restart-icon',
            labelSlot: 'restart-label',
        })
        restart.addEventListener('click', () => this.#emit('restart', {}))
        controls.append(play, restart)
        return controls
    }

    /**
     * Create one Web Awesome button with icon and label slots.
     *
     * @param {Object} options - Button options.
     * @returns {HTMLElement} Button element.
     */
    #button = ({iconName, label, testId, iconSlot, iconSlotElement, labelSlot, variant = 'neutral', appearance = 'plain'}) => {
        const button = createElement('wa-button', '', {
            appearance,
            size: 's',
            variant,
            'aria-label': label,
            'data-testid': `lgs1920-wa-${testId}`,
        })
        if (iconSlotElement) {
            button.append(iconSlotElement)
        } else if (iconSlot) {
            button.append(this.#slotWithFallback(iconSlot, createIcon(iconName, 'solid')))
        }
        if (labelSlot) button.append(this.#slotWithFallback(labelSlot, document.createTextNode(label)))
        return button
    }

    /**
     * Create a fallback slot element for a static slot name.
     *
     * @param {string} name - Slot name.
     * @param {Node} fallback - Fallback content.
     * @returns {HTMLSlotElement} Slot element.
     */
    #slotWithFallback = (name, fallback) => {
        const slot = createElement('slot', '', {name})
        if (fallback) slot.append(fallback)
        return slot
    }

    /**
     * Create a text node with a test hook and an accessible label.
     *
     * @param {number} seconds - Time in seconds.
     * @param {string} type - Current or total time type.
     * @returns {HTMLElement} Time label.
     */
    #timeText = (seconds, type) => {
        const element = createElement('span', '', {
            [`data-${type}-time`]: '',
            'data-testid': `lgs1920-wa-timeline-${type}-time`,
        })
        element.append(document.createTextNode(formatTime(seconds)))
        return element
    }

    /**
     * Create hidden global slot sources used to clone labels and icons into
     * repeated track and clip contexts.
     *
     * @returns {HTMLElement} Slot registry.
     */
    #slotRegistry = () => {
        const registry = createElement('div', 'lgs1920-wa-timeline__slot-registry', {'aria-hidden': 'true'})
        GLOBAL_SLOTS.forEach(name => registry.append(createElement('slot', '', {name})))
        return registry
    }

    /**
     * Clone content from a global slot, or return fallback content.
     *
     * @param {string} name - Global slot name.
     * @param {Node} fallback - Fallback content.
     * @returns {Array<Node>} Cloned content.
     */
    #globalSlotContent = (name, fallback) => {
        const assigned = [...this.children].filter(element => element.slot === name)
        if (assigned.length === 0) return fallback ? [fallback] : []
        return assigned.flatMap(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'template') {
                return [...node.content.cloneNode(true).childNodes]
            }
            return [node.cloneNode(true)]
        })
    }

    /**
     * Clone content from the first populated global slot in a list.
     *
     * @param {Array<string>} names - Candidate global slot names.
     * @param {Node} fallback - Final fallback content.
     * @returns {Array<Node>} Cloned content.
     */
    #globalSlotContentFrom = (names, fallback) => {
        const name = names.find(value => [...this.children].some(element => element.slot === value))
        return name ? this.#globalSlotContent(name, fallback) : (fallback ? [fallback] : [])
    }

    /**
     * Check whether a contextual light-DOM slot is populated.
     *
     * @param {string} prefix - Contextual slot prefix.
     * @param {string} identifier - Context identifier.
     * @returns {boolean} Whether the contextual slot exists.
     */
    #hasContextualSlot = (prefix, identifier) => {
        const name = `${prefix}-${slotKey(identifier)}`
        return [...this.children].some(element => element.slot === name)
    }

    /**
     * Create a contextual slot with a per-track or per-clip override and a
     * global slot fallback.
     *
     * @param {string} prefix - Contextual slot prefix.
     * @param {string} identifier - Context identifier.
     * @param {string} globalName - Global fallback slot name.
     * @param {Node} fallback - Final fallback content.
     * @returns {HTMLSlotElement} Contextual slot.
     */
    #contextualSlot = (prefix, identifier, globalName, fallback) => {
        const slotName = `${prefix}-${slotKey(identifier)}`
        const slot = createElement('slot', '', {name: slotName})
        const names = Array.isArray(globalName) ? globalName : [globalName]
        this.#globalSlotContentFrom(names, fallback).forEach(node => slot.append(node))
        return slot
    }

    /**
     * Create the track legend and its clip insertion menu.
     *
     * @returns {HTMLElement} Legend element.
     */
    #legend = () => {
        const legend = createElement('div', 'lgs1920-wa-timeline__legend', {part: 'legend'})
        const ruler = createElement('div', 'lgs1920-wa-timeline__legend-ruler', {part: 'legend-ruler'})
        ruler.append(createElement('slot', '', {name: 'timeline-toolbar'}))
        const add = this.#button({
            iconName: 'plus',
            label: 'Add clip to timeline',
            testId: 'add-clip',
            iconSlot: 'add-clip-icon',
            labelSlot: 'add-clip-label',
            variant: 'brand',
            appearance: 'filled',
        })
        add.id = 'lgs1920-timeline-clip-menu-trigger'
        add.setAttribute('aria-haspopup', 'menu')
        add.setAttribute('aria-expanded', `${this.#menuOpen}`)
        add.addEventListener('click', () => {
            this.#menuOpen = !this.#menuOpen
            this.#render()
        })
        if (this.#timelineConfig.interactive !== false) ruler.append(add)
        legend.append(ruler)
        if (this.#menuOpen && this.#timelineConfig.interactive !== false) legend.append(this.#menu())
        const viewport = createElement('div', 'lgs1920-wa-timeline__legend-viewport', {part: 'legend-viewport'})
        const rows = createElement('div', 'lgs1920-wa-timeline__legend-rows', {part: 'legend-rows'})
        this.#rows.forEach(row => rows.append(this.#legendRow(row)))
        viewport.append(rows)
        legend.append(this.#scrollbarShell(viewport, {role: 'legend', horizontal: false, vertical: true}))
        return legend
    }

    /**
     * Create the anchored Web Awesome popup used by the clip menu.
     *
     * @returns {HTMLElement} Popup element.
     */
    #menu = () => {
        const popup = createElement('wa-popup', 'lgs1920-wa-timeline__popup', {
            placement: 'right-start',
            distance: 4,
            active: true,
            anchor: 'lgs1920-timeline-clip-menu-trigger',
            part: 'popup',
        })
        const menu = createElement('div', 'lgs1920-wa-timeline__menu', {role: 'menu', part: 'menu'})
        this.#clipOptions.forEach(option => {
            const item = createElement('wa-button', 'lgs1920-wa-timeline__menu-item', {
                appearance: 'plain',
                size: 's',
                role: 'menuitem',
            })
            item.append(...this.#globalSlotContent('clip-option-icon', createIcon(option.icon ?? 'film')))
            item.append(...this.#globalSlotContent('clip-option-label', document.createTextNode(option.label ?? option.key ?? 'Clip')))
            item.addEventListener('click', () => {
                this.#insertClip(option)
                this.#menuOpen = false
                this.#render()
            })
            menu.append(item)
        })
        if (this.#clipOptions.length === 0) menu.append(createElement('slot', '', {name: 'empty-state'}))
        popup.append(menu)
        return popup
    }

    /**
     * Insert a clip from a clip-menu option at the current playhead.
     *
     * @param {Object} option - Clip insertion option.
     */
    #insertClip = option => {
        const requestedTrackId = option?.trackId ?? this.#timelineConfig.defaultTrackId
        const target = this.#rows.find(row => row.id === requestedTrackId)
            ?? this.#rows.find(row => trackAcceptsClip(row, {kind: option?.kind ?? option?.key}))
        const start = Math.max(0, Number(option?.start ?? (this.#currentTimeMillis / 1000)) || 0)
        const duration = Math.max(0, Number(option?.duration ?? this.#timelineConfig.defaultClipDuration ?? 1) || 0)
        const id = option?.clip?.id
            ?? option?.id
            ?? `${option?.key ?? 'clip'}-${Date.now()}`
        const clip = {
            ...(option?.clip ?? {}),
            id,
            kind: option?.clip?.kind ?? option?.kind ?? option?.key ?? 'clip',
            label: option?.clip?.label ?? option?.label ?? option?.key ?? 'Clip',
            start,
            end: Number(option?.end) > start ? Number(option.end) : start + duration,
        }
        if (!target || !trackAcceptsClip(target, clip)) {
            this.#emit('add-clip', {group: option?.group, key: option?.key, option, clip: null, trackId: null, tracks: this.tracks})
            return
        }
        const result = this.#clipEditor.place({
            baseRows: cloneRows(this.#rows),
            clip,
            targetTrackId: target.id,
        })
        if (!result) {
            this.#emit('add-clip', {group: option?.group, key: option?.key, option, clip: null, trackId: target.id, tracks: this.tracks})
            return
        }
        this.#rows = result.rows
        this.#interactionDurationMillis = result.durationMillis
        const entry = this.#clipEditor.findClipEntry(result.rows, id)
        this.#emit('add-clip', {
            group: option?.group,
            key: option?.key,
            option,
            clip: entry ? Object.assign({}, entry.clip, {trackId: entry.row.id}) : null,
            trackId: target.id,
            durationMillis: result.durationMillis,
            tracks: result.rows.map(row => this.#publicTrack(row)),
        })
    }

    /**
     * Open a context menu anchored to a track or clip.
     *
     * @param {string} type - Context type: `track` or `clip`.
     * @param {string} identifier - Track or clip identifier.
     * @param {HTMLElement} anchor - Anchor element in the shadow tree.
     * @param {MouseEvent} event - Context-menu event.
     */
    #openContextMenu = (type, identifier, anchor, event) => {
        event.preventDefault()
        this.#contextMenuState = {type, identifier, anchorId: anchor.id}
        this.#emit('context-menu-open', {type, identifier, event})
        this.#render()
    }

    /**
     * Close the active context menu and refresh the component.
     */
    #closeContextMenu = () => {
        this.#contextMenuState = null
        this.#render()
    }

    /**
     * Create a Web Awesome menu item for a context menu command.
     *
     * @param {string} label - Visible command label.
     * @param {string} value - Command value.
     * @param {Function} callback - Command callback.
     * @returns {HTMLElement} Menu item.
     */
    #contextMenuItem = (label, value, callback) => {
        const item = createElement('wa-button', 'lgs1920-wa-timeline__context-menu-item', {
            appearance: 'plain',
            size: 's',
            role: 'menuitem',
            value,
        })
        item.append(document.createTextNode(label))
        item.addEventListener('click', event => {
            event.preventDefault()
            callback(event)
        })
        return item
    }

    /**
     * Create the context menu for the active track or clip.
     *
     * @returns {HTMLElement} Context popup.
     */
    #contextMenu = () => {
        const state = this.#contextMenuState
        const popup = createElement('wa-popup', 'lgs1920-wa-timeline__context-popup', {
            placement: 'bottom-start',
            distance: 4,
            active: true,
            anchor: state.anchorId,
            part: 'context-popup',
        })
        const menu = createElement('div', 'lgs1920-wa-timeline__context-menu', {
            label: state.type === 'track' ? 'Track actions' : 'Clip actions',
            role: 'menu',
            part: 'context-menu',
        })
        if (state.type === 'track') {
            const row = this.#rows.find(value => value.id === state.identifier)
            menu.append(this.#contextMenuItem('Rename track', 'rename-track', () => {
                this.#closeContextMenu()
                this.#beginTrackLabelEdit(row)
            }))
            if (row?.canHide) {
                menu.append(this.#contextMenuItem(row.visible === false ? 'Show track' : 'Hide track', 'toggle-track-visibility', event => {
                    this.#toggleTrackVisibility(row, event)
                }))
            }
            menu.append(...this.#globalSlotContent('track-context-menu', null))
        } else {
            const clip = this.#findClip(state.identifier)
            menu.append(this.#contextMenuItem('Edit clip', 'edit-clip', event => {
                this.#emit('clip-label-edit-request', {clip, event})
                this.#closeContextMenu()
            }))
            menu.append(this.#contextMenuItem(clip?.visible === false ? 'Show clip' : 'Hide clip', 'toggle-clip-visibility', event => {
                this.#toggleClipVisibility(clip, event)
            }))
            menu.append(...this.#globalSlotContent('clip-context-menu', null))
        }
        popup.append(menu)
        return popup
    }

    /**
     * Find a clip by identifier in the current tracks.
     *
     * @param {string} identifier - Clip identifier.
     * @returns {Object|null} Matching clip and its track context.
     */
    #findClip = identifier => {
        for (const row of this.#rows) {
            const clip = (row.actions ?? []).find(value => value.id === identifier)
            if (clip) return Object.assign({}, clip, {trackId: row.id})
        }
        return null
    }

    /**
     * Convert a surface client coordinate to timeline seconds.
     *
     * @param {number} clientX - Pointer client coordinate.
     * @returns {number} Timeline seconds.
     */
    #timeAtClientX = clientX => {
        const rect = this.#surface?.getBoundingClientRect()
        if (!rect) return 0
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const x = Math.max(scaleOffset, clientX - rect.left + (this.#surface?.scrollLeft ?? 0))
        return ((x - scaleOffset) / Math.max(Number.EPSILON, scaleWidth)) * majorSeconds
    }

    /**
     * Resolve the track below a surface client coordinate.
     *
     * @param {number} clientY - Pointer client coordinate.
     * @returns {Object|null} Track under the pointer.
     */
    #trackAtClientY = clientY => {
        const rect = this.#surface?.getBoundingClientRect()
        if (!rect) return null
        const headerHeight = this.#numericToken('header-height', HEADER_HEIGHT)
        const relativeY = clientY - rect.top + (this.#tracksViewport?.scrollTop ?? 0) - headerHeight
        if (relativeY < 0) return null
        const index = Math.floor(relativeY / Math.max(MIN_ROW_HEIGHT, this.#rowHeight))
        return this.#rows[index] ?? null
    }

    /**
     * Start a pointer interaction for moving or resizing a clip.
     *
     * @param {PointerEvent} event - Pointer event.
     * @param {string} clipId - Clip identifier.
     * @param {'move'|'resize'} mode - Interaction mode.
     * @param {'start'|'end'|null} edge - Resized edge.
     */
    #startClipInteraction = (event, clipId, mode, edge = null) => {
        if (event.button !== 0 || this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry) return
        if (mode === 'move' && (entry.clip.movable === false || entry.clip.fixed === true)) return
        if (mode === 'resize' && (entry.clip.resizable === false || entry.clip.fixed === true)) return
        event.preventDefault()
        event.stopPropagation()
        this.#capturePointer(event)
        const interval = resolveClipInterval(entry.clip)
        this.#interactionDurationMillis = null
        this.#dragState = {
            type: 'clip',
            mode,
            edge,
            clipId,
            sourceTrackId: entry.row.id,
            targetTrackId: entry.row.id,
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId,
            startTime: this.#timeAtClientX(event.clientX),
            originalStart: interval.start,
            originalEnd: interval.end,
            baseRows: cloneRows(this.#rows),
            lastResult: null,
        }
        this.#addPointerListeners()
        this.#emit('before-drag', {
            context: this.#dragContext(this.#dragState),
            event,
            data: this.#publicSnapshot(),
        })
        this.#emit('clip-change-start', this.#clipEditor.changeDetail(this.#dragState, {
            rows: this.#dragState.baseRows,
            durationMillis: Number(this.#projection?.durationMillis) || 0,
        }, event))
    }
    /**
     * Toggle a track visibility state and emit its controlled change event.
     *
     * @param {Object} row - Track row.
     * @param {Event} event - Triggering event.
     */
    #toggleTrackVisibility = (row, event) => {
        if (!row?.canHide) return
        event?.stopPropagation?.()
        const visible = row.visible === false
        this.#rows = this.#rows.map(value => value.id === row.id ? {...value, visible} : value)
        this.#contextMenuState = null
        this.#emit('track-visibility-change', {trackId: row.id, visible, track: this.#publicTrack(Object.assign({}, row, {visible})), event, data: this.#publicSnapshot()})
        this.#render()
    }

    /**
     * Toggle a clip visibility state and emit its controlled change event.
     *
     * @param {Object|null} clip - Clip to toggle.
     * @param {Event} event - Triggering event.
     */
    #toggleClipVisibility = (clip, event) => {
        if (!clip) return
        const visible = clip.visible === false
        this.#rows = this.#rows.map(row => row.id !== clip.trackId
            ? row
            : {...row, actions: (row.actions ?? []).map(value => value.id === clip.id ? {...value, visible} : value)})
        this.#contextMenuState = null
        this.#emit('clip-visibility-change', {trackId: clip.trackId, clipId: clip.id, visible, clip: Object.assign({}, clip, {visible}), event, data: this.#publicSnapshot()})
        this.#render()
    }

    #legendRow = row => {
        return this.#renderer.legendRow(row)
    }

    #surfaceElement = (scaleCount, majorSeconds, scaleSplitCount) => {
        const surface = this.#renderer.surfaceElement(scaleCount, majorSeconds, scaleSplitCount)
        const tracksViewport = surface.querySelector('[data-tracks-viewport]')
        return this.#scrollbarShell(surface, {role: 'surface', horizontal: true, vertical: true, verticalView: tracksViewport ?? surface})
    }

    /**
     * Wrap a timeline view with LGS-style custom scrollbars.
     *
     * Native scrollbars are kept functionally active on the view, while the
     * visual rails and thumbs are rendered in the component shadow tree.
     *
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {Object} options - Scrollbar axes and synchronization role.
     * @param {string} options.role - View role used for vertical syncing.
     * @param {boolean} options.horizontal - Whether to render a horizontal rail.
     * @param {boolean} options.vertical - Whether to render a vertical rail.
     * @returns {HTMLElement} Scrollbar shell containing the view.
     */
    #scrollbarShell = (view, {role, horizontal, vertical, verticalView = view}) => {
        view.classList.add('view')
        view.setAttribute('data-scroll-view', role)
        const shell = createElement('div', `lgs-scrollbars lgs1920-wa-timeline__scroll-shell lgs1920-wa-timeline__scroll-shell--${role}`, {
            'data-scrollbar-shell': role,
        })
        shell.append(view)
        if (horizontal) shell.append(this.#scrollbarTrack(view, 'horizontal'))
        if (vertical) shell.append(this.#scrollbarTrack(verticalView, 'vertical'))
        shell.addEventListener('pointerenter', this.#showScrollbars)
        shell.addEventListener('pointerleave', this.#scheduleScrollbarHide)
        shell.addEventListener('focusin', this.#showScrollbars)
        shell.addEventListener('focusout', this.#scheduleScrollbarHide)
        return shell
    }

    /**
     * Create one custom scrollbar rail and its draggable thumb.
     *
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {'horizontal'|'vertical'} axis - Scrollbar axis.
     * @returns {HTMLElement} Scrollbar rail.
     */
    #scrollbarTrack = (view, axis) => {
        const track = createElement('div', `track-${axis} lgs1920-wa-timeline__scrollbar-track lgs1920-wa-timeline__scrollbar-track--${axis}`, {
            'data-scrollbar-track': axis,
            'data-scrollbar-view': view.getAttribute('data-scroll-view'),
            role: 'scrollbar',
            'aria-orientation': axis,
            'aria-valuemin': 0,
            'aria-valuemax': 0,
            'aria-valuenow': 0,
            tabindex: 0,
        })
        const thumb = createElement('div', `thumb-${axis} lgs1920-wa-timeline__scrollbar-thumb lgs1920-wa-timeline__scrollbar-thumb--${axis}`, {
            'data-scrollbar-thumb': axis,
        })
        track.append(thumb)
        view.addEventListener('scroll', () => {
            this.#showScrollbars()
            this.#scheduleScrollbarHide()
            const viewRole = view.getAttribute('data-scroll-view')
            if (viewRole === 'legend') this.#syncTracksScroll()
            if (viewRole === 'tracks') this.#updateLegendScroll()
            else this.#updateScrollbars()
        })
        track.addEventListener('pointerdown', event => this.#startScrollbarDrag(event, view, axis, track, thumb))
        track.addEventListener('keydown', event => this.#handleScrollbarKeyDown(event, view, axis))
        return track
    }

    /**
     * Update every custom rail from its associated native scroll view.
     */
    #updateScrollbars = () => {
        this.#root.querySelectorAll('[data-scrollbar-shell]').forEach(shell => {
            shell.querySelectorAll('[data-scrollbar-track]').forEach(track => {
                const axis = track.getAttribute('data-scrollbar-track')
                const viewRole = track.getAttribute('data-scrollbar-view')
                const view = shell.querySelector(`[data-scroll-view="${viewRole}"]`)
                const thumb = track.querySelector('[data-scrollbar-thumb]')
                if (view && thumb) this.#updateScrollbarGeometry(view, axis, track, thumb)
            })
        })
    }

    /**
     * Recompute one rail visibility, thumb size, and thumb position.
     *
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {'horizontal'|'vertical'} axis - Scrollbar axis.
     * @param {HTMLElement} track - Scrollbar rail.
     * @param {HTMLElement} thumb - Scrollbar thumb.
     */
    #updateScrollbarGeometry = (view, axis, track, thumb) => {
        const scrollSize = axis === 'vertical' ? view.scrollHeight : view.scrollWidth
        const clientSize = axis === 'vertical' ? view.clientHeight : view.clientWidth
        const scrollOffset = axis === 'vertical' ? view.scrollTop : view.scrollLeft
        track.hidden = false
        const trackSize = axis === 'vertical' ? track.clientHeight : track.clientWidth
        const overflowing = scrollSize > clientSize && clientSize > 0 && trackSize > 0
        track.hidden = !overflowing
        thumb.hidden = !overflowing
        if (!overflowing) {
            thumb.style.transform = axis === 'vertical' ? 'translateY(0px)' : 'translateX(0px)'
            thumb.style[axis === 'vertical' ? 'height' : 'width'] = '0px'
            track.setAttribute('aria-valuemax', '0')
            track.setAttribute('aria-valuenow', '0')
            return
        }
        const minimumSize = this.#numericToken('scrollbar-thumb-min-size', 30)
        const thumbSize = Math.min(trackSize, Math.max(minimumSize, Math.ceil((clientSize / scrollSize) * trackSize)))
        const maximumOffset = Math.max(0, trackSize - thumbSize)
        const maximumScroll = Math.max(1, scrollSize - clientSize)
        const thumbOffset = clamp((scrollOffset / maximumScroll) * maximumOffset, 0, maximumOffset)
        thumb.style[axis === 'vertical' ? 'height' : 'width'] = `${thumbSize}px`
        thumb.style.transform = axis === 'vertical' ? `translateY(${thumbOffset}px)` : `translateX(${thumbOffset}px)`
        track.setAttribute('aria-valuemax', `${scrollSize - clientSize}`)
        track.setAttribute('aria-valuenow', `${scrollOffset}`)
    }

    /**
     * Begin dragging a custom scrollbar thumb or page to a track position.
     *
     * @param {PointerEvent} event - Pointer event.
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {'horizontal'|'vertical'} axis - Scrollbar axis.
     * @param {HTMLElement} track - Scrollbar rail.
     * @param {HTMLElement} thumb - Scrollbar thumb.
     */
    #startScrollbarDrag = (event, view, axis, track, thumb) => {
        if (event.button !== 0 || track.hidden) return
        event.preventDefault()
        event.stopPropagation()
        this.#showScrollbars()
        this.#clearScrollbarHideTimer()
        const trackRect = track.getBoundingClientRect()
        const thumbRect = thumb.getBoundingClientRect()
        const coordinate = axis === 'vertical' ? event.clientY : event.clientX
        const trackStart = axis === 'vertical' ? trackRect.top : trackRect.left
        const thumbStart = axis === 'vertical' ? thumbRect.top : thumbRect.left
        const thumbSize = axis === 'vertical' ? thumbRect.height : thumbRect.width
        const offset = event.target === thumb || thumb.contains(event.target)
            ? coordinate - thumbStart
            : thumbSize / 2
        if (!(event.target === thumb || thumb.contains(event.target))) {
            this.#setScrollbarOffset(view, axis, coordinate - trackStart - offset, track)
        }
        this.#finishScrollbarDrag()
        this.#capturePointer(event)
        this.#scrollbarDrag = {view, axis, track, thumb, offset}
        this.#scrollbarDragCleanup = () => {
            window.removeEventListener('pointermove', this.#scrollbarPointerMove, true)
            window.removeEventListener('pointerup', this.#scrollbarPointerUp, true)
            window.removeEventListener('pointercancel', this.#scrollbarPointerUp, true)
        }
        window.addEventListener('pointermove', this.#scrollbarPointerMove, {passive: false, capture: true})
        window.addEventListener('pointerup', this.#scrollbarPointerUp, true)
        window.addEventListener('pointercancel', this.#scrollbarPointerUp, true)
    }

    /**
     * Move a view from a pointer position expressed on its scrollbar rail.
     *
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {'horizontal'|'vertical'} axis - Scrollbar axis.
     * @param {number} pointerOffset - Pointer offset within the rail.
     * @param {HTMLElement} track - Scrollbar rail.
     */
    #setScrollbarOffset = (view, axis, pointerOffset, track) => {
        const scrollSize = axis === 'vertical' ? view.scrollHeight : view.scrollWidth
        const clientSize = axis === 'vertical' ? view.clientHeight : view.clientWidth
        const trackSize = axis === 'vertical' ? track.clientHeight : track.clientWidth
        const minimumSize = this.#numericToken('scrollbar-thumb-min-size', 30)
        const thumbSize = Math.min(trackSize, Math.max(minimumSize, Math.ceil((clientSize / Math.max(scrollSize, 1)) * trackSize)))
        const maximumOffset = Math.max(0, trackSize - thumbSize)
        const ratio = maximumOffset > 0 ? clamp(pointerOffset / maximumOffset, 0, 1) : 0
        const value = ratio * Math.max(0, scrollSize - clientSize)
        if (axis === 'vertical') view.scrollTop = value
        else view.scrollLeft = value
    }

    /**
     * Keep subsequent pointer events attached to the active gesture target.
     *
     * @param {PointerEvent} event - Pointer event that starts the gesture.
     */
    #capturePointer = event => {
        const target = event.currentTarget instanceof Element ? event.currentTarget : event.target
        if (!target?.setPointerCapture || !Number.isFinite(event.pointerId)) return
        target.setPointerCapture(event.pointerId)
        this.#pointerCaptureTarget = target
        this.#pointerCaptureId = event.pointerId
    }

    /**
     * Release the pointer captured by the active gesture, when supported.
     */
    #releasePointerCapture = () => {
        const target = this.#pointerCaptureTarget
        const pointerId = this.#pointerCaptureId
        this.#pointerCaptureTarget = null
        this.#pointerCaptureId = null
        if (!target?.releasePointerCapture || !Number.isFinite(pointerId)) return
        target.releasePointerCapture(pointerId)
    }

    /**
     * Handle pointer movement while dragging a custom thumb.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #scrollbarPointerMove = event => {
        if (!this.#scrollbarDrag) return
        event.preventDefault()
        this.#showScrollbars()
        const {view, axis, track, offset} = this.#scrollbarDrag
        const trackRect = track.getBoundingClientRect()
        const coordinate = axis === 'vertical' ? event.clientY : event.clientX
        const trackStart = axis === 'vertical' ? trackRect.top : trackRect.left
        this.#setScrollbarOffset(view, axis, coordinate - trackStart - offset, track)
    }

    /**
     * End a custom scrollbar drag and restart the inactivity timer.
     */
    #scrollbarPointerUp = () => {
        this.#finishScrollbarDrag()
        this.#scheduleScrollbarHide()
    }

    /**
     * Begin keeping rails visible while the split-panel divider is dragged.
     *
     * @param {PointerEvent} event - Pointer event from the split panel.
     * @param {HTMLElement} splitPanel - Timeline split panel.
     */
    #startSplitPanelDrag = (event, splitPanel) => {
        if (event.button !== 0 || !this.#isSplitPanelDividerEvent(event, splitPanel)) return
        this.#finishSplitPanelDrag()
        this.#capturePointer(event)
        this.setExternalInteractionActive(true)
        this.#splitPanelDragCleanup = () => {
            window.removeEventListener('pointermove', this.#splitPanelPointerMove, true)
            window.removeEventListener('pointerup', this.#splitPanelPointerUp, true)
            window.removeEventListener('pointercancel', this.#splitPanelPointerUp, true)
        }
        window.addEventListener('pointermove', this.#splitPanelPointerMove, {passive: false, capture: true})
        window.addEventListener('pointerup', this.#splitPanelPointerUp, true)
        window.addEventListener('pointercancel', this.#splitPanelPointerUp, true)
    }

    /**
     * Check whether a pointer event originated from the split-panel divider.
     *
     * @param {PointerEvent} event - Pointer event to inspect.
     * @param {HTMLElement} splitPanel - Timeline split panel.
     * @returns {boolean} Whether the event belongs to the divider.
     */
    #isSplitPanelDividerEvent = (event, splitPanel) => event.target === splitPanel
        || event.composedPath().some(target => target?.getAttribute?.('part')?.split(/\s+/).includes('divider'))

    /**
     * Keep rails visible while the split-panel divider continues moving.
     */
    #splitPanelPointerMove = () => {
        if (!this.#splitPanelDragCleanup) return
        this.#showScrollbars()
    }

    /**
     * End split-panel divider activity and restart the inactivity timer.
     */
    #splitPanelPointerUp = () => {
        const wasDragging = Boolean(this.#splitPanelDragCleanup)
        this.#finishSplitPanelDrag()
        this.setExternalInteractionActive(false)
        if (wasDragging) queueMicrotask(this.#renderAfterSplitPanelDrag)
    }

    /**
     * Rebuild width-dependent ruler geometry after the divider gesture ends.
     */
    #renderAfterSplitPanelDrag = () => {
        if (this.isConnected && !this.#splitPanelDragCleanup) this.#render()
    }

    /**
     * Remove global split-panel divider listeners.
     */
    #finishSplitPanelDrag = () => {
        this.#splitPanelDragCleanup?.()
        this.#splitPanelDragCleanup = null
        this.#releasePointerCapture()
    }

    /**
     * Handle keyboard movement on a custom scrollbar rail.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     * @param {HTMLElement} view - Scrollable timeline view.
     * @param {'horizontal'|'vertical'} axis - Scrollbar axis.
     */
    #handleScrollbarKeyDown = (event, view, axis) => {
        const positive = axis === 'vertical' ? ['ArrowDown', 'PageDown'] : ['ArrowRight', 'PageDown']
        const negative = axis === 'vertical' ? ['ArrowUp', 'PageUp'] : ['ArrowLeft', 'PageUp']
        if (![...positive, ...negative].includes(event.key)) return
        event.preventDefault()
        const page = axis === 'vertical' ? view.clientHeight : view.clientWidth
        const delta = positive.includes(event.key) ? page : -page
        if (axis === 'vertical') view.scrollTop += delta
        else view.scrollLeft += delta
    }

    /**
     * Remove global custom scrollbar drag listeners.
     */
    #finishScrollbarDrag = () => {
        this.#scrollbarDragCleanup?.()
        this.#scrollbarDragCleanup = null
        this.#scrollbarDrag = null
        this.#releasePointerCapture()
    }

    /**
     * Read the custom scrollbar auto-hide delay from the host CSS token.
     *
     * @returns {number} Auto-hide delay in milliseconds.
     */
    #scrollbarAutoHideDelay = () => {
        const value = globalThis.getComputedStyle?.(this)?.getPropertyValue('--lgs-timeline-scrollbar-auto-hide-delay')?.trim()
        const amount = Number.parseFloat(value)
        if (!Number.isFinite(amount) || amount < 0) return 3_000
        return value.endsWith('ms') ? amount : amount * 1_000
    }

    /**
     * Clear the pending custom scrollbar auto-hide timer.
     */
    #clearScrollbarHideTimer = () => {
        if (this.#scrollbarHideTimer !== null) clearTimeout(this.#scrollbarHideTimer)
        this.#scrollbarHideTimer = null
    }

    /**
     * Show all custom rails and cancel their inactivity timer.
     */
    #showScrollbars = () => {
        this.#clearScrollbarHideTimer()
        this.#root.querySelectorAll('[data-scrollbar-shell]').forEach(shell => shell.classList.remove('lgs1920-wa-timeline__scroll-shell--idle'))
    }

    /**
     * Hide all custom rails after the configured inactivity delay.
     */
    #scheduleScrollbarHide = () => {
        this.#clearScrollbarHideTimer()
        if (this.#scrollbarsInteractionActive) return
        if (!this.#root.querySelector('[data-scrollbar-shell]')) return
        const delay = this.#scrollbarAutoHideDelay()
        if (delay <= 0) return
        this.#scrollbarHideTimer = setTimeout(() => {
            this.#root.querySelectorAll('[data-scrollbar-shell]').forEach(shell => shell.classList.add('lgs1920-wa-timeline__scroll-shell--idle'))
            this.#scrollbarHideTimer = null
        }, delay)
    }

    /**
     * Start dragging a video range boundary.
     *
     * @param {PointerEvent} event - Pointer event.
     * @param {'start'|'end'} edge - Range boundary.
     */
    #startRangeInteraction = (event, edge) => {
        if (event.button !== 0 || this.#timelineConfig.editable === false) return
        event.preventDefault()
        event.stopPropagation()
        this.#capturePointer(event)
        this.#dragState = {
            type: 'range',
            edge,
            startX: event.clientX,
            pointerId: event.pointerId,
            initialStartMillis: this.#rangeStartMillis,
            initialEndMillis: this.#rangeEndMillis,
        }
        this.#rangeEndFollowsDuration = false
        this.#addPointerListeners()
        this.#emit('range-change-start', this.#rangeChangeDetail(event))
    }

    /**
     * Preview a video range boundary movement.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #previewRangeInteraction = event => {
        const state = this.#dragState
        if (state?.type !== 'range') return
        const nextMillis = clamp(this.#timeAtClientX(event.clientX) * 1000, 0, this.#durationMillis())
        if (state.edge === 'start') {
            this.#rangeStartMillis = Math.min(nextMillis, this.#rangeEndMillis)
        } else {
            this.#rangeEndMillis = Math.max(nextMillis, this.#rangeStartMillis)
        }
        this.#emit('range-changing', this.#rangeChangeDetail(event))
        this.#updateDynamicState()
    }

    /**
     * Move a video range boundary with the keyboard.
     *
     * @param {'start'|'end'} edge - Range boundary.
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #moveRangeByKeyboard = (edge, event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        const step = Number(this.#timelineConfig.keyboardStepSeconds) > 0
            ? Number(this.#timelineConfig.keyboardStepSeconds) * 1000
            : 100
        const delta = (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
        this.#rangeEndFollowsDuration = false
        if (edge === 'start') {
            this.#rangeStartMillis = clamp(this.#rangeStartMillis + delta, 0, this.#rangeEndMillis)
        } else {
            this.#rangeEndMillis = clamp(this.#rangeEndMillis + delta, this.#rangeStartMillis, this.#durationMillis())
        }
        this.#emit('range-change', this.#rangeChangeDetail(event))
        this.#render()
    }

    /**
     * Build a public detail payload for a video range edit.
     *
     * @param {Event} event - Triggering event.
     * @returns {Object} Range event detail.
     */
    #rangeChangeDetail = event => ({
        rangeStartMillis: this.#rangeStartMillis,
        rangeEndMillis: this.#rangeEndMillis,
        durationMillis: this.#durationMillis(),
        event,
    })

    /**
     * Seek from a client X coordinate using the package-compatible ruler math.
     *
     * @param {number} clientX - Pointer client X coordinate.
     * @param {boolean} settled - Whether the interaction has settled.
     */
    #seek = (clientX, settled) => {
        const rect = this.#surface?.getBoundingClientRect()
        const duration = this.#durationMillis()
        if (!rect || duration <= 0) return
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const x = clamp(clientX - rect.left + (this.#surface?.scrollLeft ?? 0), scaleOffset, this.#contentWidth)
        const timeMillis = this.#normalizeTime(((x - scaleOffset) / scaleWidth) * majorSeconds * 1000)
        this.#currentTimeMillis = timeMillis
        this.#emit('seek', {timeMillis, progress: duration > 0 ? timeMillis / duration : 0, settled})
        this.#updateDynamicState()
    }

    /**
     * Start a row drag from the external legend.
     *
     * @param {PointerEvent} event - Pointer event.
     * @param {string} rowId - Dragged row identifier.
     */
    #startRowDrag = (event, rowId) => {
        const row = this.#rows.find(value => value.id === rowId)
        if (event.button !== 0
            || event.target.closest('wa-button')
            || !row
            || this.#timelineConfig.editable === false
            || row.fixed === true
            || row.movable === false) return
        event.preventDefault()
        this.#capturePointer(event)
        this.#dragState = {
            type: 'row',
            rowId,
            pointerId: event.pointerId,
            dropIndex: this.#rows.findIndex(row => row.id === rowId),
            baseRows: cloneRows(this.#rows),
        }
        this.#addPointerListeners()
        this.#emit('before-drag', {
            context: this.#dragContext(this.#dragState),
            event,
            data: this.#publicSnapshot(),
        })
        this.#render()
    }

    /**
     * Resolve the public context attached to a row or clip drag.
     *
     * @param {Object} state - Active drag state.
     * @returns {Object} Public drag context.
     */
    #dragContext = state => {
        if (state?.type === 'row') {
            return {
                type: 'piste',
                pisteId: state.rowId,
                trackId: state.rowId,
            }
        }
        const entry = state?.type === 'clip'
            ? this.#clipEditor.findClipEntry(this.#rows, state.clipId)
            : null
        const pisteId = entry?.row.id ?? state?.targetTrackId ?? state?.sourceTrackId ?? null
        return {
            type: 'clip',
            pisteId,
            trackId: pisteId,
            clipId: state?.clipId ?? null,
        }
    }

    /**
     * Install global pointer listeners for scrubbing, resizing, or row drag.
     */
    #addPointerListeners = () => {
        window.addEventListener('pointermove', this.#pointerMove, {passive: false, capture: true})
        window.addEventListener('pointerup', this.#pointerUp, true)
        window.addEventListener('pointercancel', this.#pointerUp, true)
    }

    /**
     * Remove global pointer listeners and reset transient pointer state.
     */
    #removePointerListeners = () => {
        window.removeEventListener('pointermove', this.#pointerMove, true)
        window.removeEventListener('pointerup', this.#pointerUp, true)
        window.removeEventListener('pointercancel', this.#pointerUp, true)
        this.#dragState = null
        this.#scrubPointerId = null
        this.#releasePointerCapture()
        this.#stopAutoScroll()
    }

    /**
     * Handle global pointer movement for all timeline interactions.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #pointerMove = event => {
        if (this.#scrubPointerId !== null) {
            if (event.pointerId !== this.#scrubPointerId) return
            event.preventDefault()
            this.#seek(event.clientX, false)
            return
        }
        if (this.#dragState?.type === 'clip') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            const previousResult = this.#dragState.lastResult
            this.#clipEditor.preview(this.#dragState, event)
            if (this.#dragState.lastResult && this.#dragState.lastResult !== previousResult) {
                this.#emit('drag', {
                    context: this.#dragContext(this.#dragState),
                    event,
                    data: this.#publicSnapshot(),
                })
            }
            return
        }
        if (this.#dragState?.type === 'range') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            this.#previewRangeInteraction(event)
            return
        }
        if (this.#dragState?.type === 'row') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            this.#handleRowAutoScroll(event.clientX)
            const viewport = this.#root.querySelector('.lgs1920-wa-timeline__legend-viewport')
            const rect = viewport?.getBoundingClientRect()
            if (!rect) return
            const rowHeight = Math.max(MIN_ROW_HEIGHT, this.#rowHeight)
            const dropIndex = clamp(Math.floor((event.clientY - rect.top + (rowHeight / 2)) / rowHeight), 0, this.#rows.length)
            this.#dragState.dropIndex = dropIndex
            this.#emit('drag', {
                context: this.#dragContext(this.#dragState),
                event,
                data: this.#publicSnapshot(),
            })
            const currentIndex = this.#rows.findIndex(row => row.id === this.#dragState?.rowId)
            const targetIndex = clamp(dropIndex > currentIndex ? dropIndex - 1 : dropIndex, 0, Math.max(0, this.#rows.length - 1))
            if (currentIndex < 0 || currentIndex === targetIndex) {
                this.#render()
                return
            }
            const rows = [...this.#rows]
            const [row] = rows.splice(currentIndex, 1)
            rows.splice(targetIndex, 0, row)
            this.#rows = rows
            this.#render()
        }
    }

    /**
     * Complete the active pointer interaction and emit a reorder event when
     * a row was moved.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #pointerUp = event => {
        if (this.#scrubPointerId !== null) this.#seek(event.clientX, true)
        const state = this.#dragState
        if (state?.type === 'range' && event.type === 'pointercancel') {
            this.#rangeStartMillis = state.initialStartMillis
            this.#rangeEndMillis = state.initialEndMillis
        }
        if (state?.type === 'range' && event.type === 'pointerup') {
            this.#emit('range-change', this.#rangeChangeDetail(event))
        }
        if (state?.type === 'clip' && state.lastResult) {
            if (event.type === 'pointerup') this.#emit('clip-change', this.#clipEditor.changeDetail(state, state.lastResult, event))
            else {
                this.#rows = state.baseRows
                this.#interactionDurationMillis = null
            }
        }
        if (state?.type === 'row' && event.type === 'pointercancel') this.#rows = state.baseRows
        if (state?.type === 'row' && event.type === 'pointerup') {
            this.#emit('reorder', {
                trackIds: this.#rows.filter(row => !row.fixed && row.movable !== false).map(row => row.id),
                tracks: this.#rows.map(row => this.#publicTrack(row)),
                dropIndex: state.dropIndex,
            })
        }
        if (state?.type === 'row' || state?.type === 'clip') {
            this.#emit('after-drag', {
                context: this.#dragContext(state),
                committed: event.type === 'pointerup' && (state.type === 'row' || Boolean(state.lastResult)),
                event,
                data: this.#publicSnapshot(),
            })
        }
        this.#removePointerListeners()
        if (state?.type === 'row' || state?.type === 'clip' || state?.type === 'range') this.#render()
    }

    /**
     * Resolve and start the patched edge auto-scroll behavior.
     *
     * @param {number} clientX - Pointer client X coordinate.
     */
    #handleRowAutoScroll = clientX => {
        const rect = this.#surface?.getBoundingClientRect()
        if (!rect) return
        const rightEdge = rect.right - EDGE_TRIGGER_SIZE
        const leftEdge = rect.left + EDGE_TRIGGER_SIZE
        const direction = clientX >= rightEdge ? 1 : clientX <= leftEdge ? -1 : null
        if (direction === null) {
            this.#stopAutoScroll()
            return
        }
        if (this.#edgeDirection !== direction || this.#edgeStartedAt === null) {
            this.#edgeDirection = direction
            this.#edgeStartedAt = Date.now()
        }
        if (this.#autoScrollFrame !== null) return
        const loop = () => {
            if (!this.#surface || this.#dragState?.type !== 'row') {
                this.#stopAutoScroll()
                return
            }
            const heldMillis = Math.max(0, Date.now() - (this.#edgeStartedAt ?? Date.now()))
            const speedIndex = Math.min(EDGE_SCROLL_SPEEDS.length - 1, Math.floor(heldMillis / ACCELERATION_INTERVAL))
            this.#surface.scrollLeft += this.#edgeDirection * EDGE_SCROLL_SPEEDS[speedIndex]
            this.#autoScrollFrame = requestAnimationFrame(loop)
        }
        this.#autoScrollFrame = requestAnimationFrame(loop)
    }

    /**
     * Stop the edge auto-scroll animation and reset acceleration.
     */
    #stopAutoScroll = () => {
        if (this.#autoScrollFrame !== null) cancelAnimationFrame(this.#autoScrollFrame)
        this.#autoScrollFrame = null
        this.#edgeDirection = null
        this.#edgeStartedAt = null
    }

    /**
     * Install the surface resize observer.
     */
    #installResizeObserver = () => {
        this.#resizeObserver?.disconnect()
        if (typeof ResizeObserver === 'undefined' || !this.#surface) return
        this.#resizeObserver = new ResizeObserver(entries => {
            const width = entries.find(entry => entry.target === this.#surface)?.contentRect.width
            if (Number.isFinite(width) && width !== this.#surfaceWidth) {
                this.#surfaceWidth = width
                if (this.#splitPanelDragCleanup) {
                    this.#updateScrollbars()
                    return
                }
                this.#render()
            } else this.#updateScrollbars()
        })
        this.#resizeObserver.observe(this.#surface)
    }

    /**
     * Keep the title and track views aligned on their shared vertical axis.
     */
    #updateLegendScroll = () => {
        const legend = this.#root.querySelector('[data-scroll-view="legend"]')
        if (legend && this.#tracksViewport && legend.scrollTop !== this.#tracksViewport.scrollTop) {
            legend.scrollTop = this.#tracksViewport.scrollTop
        }
        this.#updateScrollbars()
    }

    /**
     * Push a title-column scroll position into the track surface.
     */
    #syncTracksScroll = () => {
        const legend = this.#root.querySelector('[data-scroll-view="legend"]')
        if (legend && this.#tracksViewport && this.#tracksViewport.scrollTop !== legend.scrollTop) {
            this.#tracksViewport.scrollTop = legend.scrollTop
        }
    }

    /**
     * Handle Ctrl/Cmd-free zoom gestures from the timeline surface.
     *
     * @param {WheelEvent} event - Wheel event.
     */
    #handleWheel = event => {
        if (!event.ctrlKey || !event.deltaY) return
        event.preventDefault()
        this.#zoom = clamp(this.#zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), MIN_ZOOM, MAX_ZOOM)
        this.#render()
    }

    /**
     * Handle keyboard zoom gestures from the focused timeline surface.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #handleKeyDown = event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        this.#zoom = clamp(this.#zoom + (event.key === 'ArrowRight' ? ZOOM_STEP : -ZOOM_STEP), MIN_ZOOM, MAX_ZOOM)
        this.#render()
    }

    /**
     * Update playback labels and controlled cursor geometry.
     */
    #updateDynamicState = () => {
        const current = this.#root.querySelector('[data-current-time]')
        const total = this.#root.querySelector('[data-total-time]')
        current?.replaceChildren(document.createTextNode(formatTime(this.#currentTimeMillis / 1000)))
        total?.replaceChildren(document.createTextNode(formatTime(this.#durationSeconds())))
        const duration = this.#durationMillis()
        const ratio = duration > 0 ? clamp(this.#currentTimeMillis / duration, 0, 1) : 0
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const position = scaleOffset + ((ratio * this.#durationSeconds()) / majorSeconds * scaleWidth)
        const playhead = this.#root.querySelector('[data-playhead]')
        const end = this.#root.querySelector('[data-end-marker]')
        const rangeStart = this.#root.querySelector('[data-range-handle="start"]')
        const rangeEnd = this.#root.querySelector('[data-range-handle="end"]')
        if (playhead) playhead.style.left = `${position}px`
        if (end) end.style.left = `${scaleOffset + ((this.#durationSeconds() / majorSeconds) * scaleWidth)}px`
        if (rangeStart) {
            rangeStart.style.left = `${scaleOffset + ((this.#rangeStartMillis / 1000) / majorSeconds * scaleWidth)}px`
            rangeStart.setAttribute('aria-valuenow', `${this.#rangeStartMillis}`)
        }
        if (rangeEnd) {
            rangeEnd.style.left = `${scaleOffset + ((this.#rangeEndMillis / 1000) / majorSeconds * scaleWidth)}px`
            rangeEnd.setAttribute('aria-valuenow', `${this.#rangeEndMillis}`)
            rangeEnd.setAttribute('aria-valuemax', `${this.#durationMillis()}`)
        }
    }

    /**
     * Emit the canonical component event.
     *
     * @param {string} name - Event suffix.
     * @param {Object} detail - Event detail payload.
     */
    #emit = (name, detail) => {
        this.dispatchEvent(createEvent(`lgs1920-timeline-${name}`, detail))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, LGS1920Timeline)
}
