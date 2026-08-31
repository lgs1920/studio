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
    MIN_ROW_HEIGHT,
    MIN_ZOOM,
    SCALE_WIDTH,
    START_LEFT,
    TAG_NAME,
    ZOOM_STEP,
    clamp,
    createElement,
    createEvent,
    createIcon,
    formatTime,
    resolveClipIcon,
    resolveClipLabel,
    resolveColorClasses,
    resolveLegendBounds,
    resolveRowLabel,
    resolveScale,
    slotKey,
} from './LGS1920TimelineUtils.js'

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
    #resizeObserver = null
    #dragState = null
    #scrubPointerId = null
    #autoScrollFrame = null
    #edgeDirection = null
    #edgeStartedAt = null
    #editingRowId = null
    #editingLabelValue = ''
    #contextMenuState = null
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
            resolveColorClasses,
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
            updateLegendScroll: () => this.#updateLegendScroll(),
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
        this.#render()
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
        this.#resizeObserver?.disconnect()
        this.#removePointerListeners()
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
            this.#root.replaceChildren(this.#root.querySelector('style'))
            this.#surface = null
            return
        }

        this.hidden = false
        const {majorSeconds, scaleSplitCount} = resolveScale(this.#zoom)
        const durationSeconds = this.#durationSeconds()
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const scaleCount = Math.max(
            1,
            Math.ceil((durationSeconds * 1.2) / majorSeconds),
            Math.ceil(Math.max(0, this.#surfaceWidth) / scaleWidth),
        )
        this.#contentWidth = Math.max(this.#surfaceWidth, scaleOffset + (scaleCount * scaleWidth))
        this.#rowHeight = this.#resolveRowHeight()
        this.#root.replaceChildren(this.#root.querySelector('style'), this.#structure(scaleCount, majorSeconds, scaleSplitCount))
        this.#surface = this.#root.querySelector('[data-surface]')
        this.#installResizeObserver()
        this.#updateDynamicState()
    }

    /**
     * Resolve the row height using the same fixed minimum and available space
     * rules as the React/package adapter.
     *
     * @returns {number} Row height in pixels.
     */
    #resolveRowHeight = () => {
        const height = this.getBoundingClientRect?.().height ?? 0
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
        header.append(createElement('slot', '', {name: 'header'}), this.#playbackControls(), headerActions)
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
        if (this.#contextMenuState) section.append(this.#contextMenu())
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
        splitPanel.addEventListener('wa-reposition', event => {
            const width = Number(event.currentTarget?.positionInPixels)
            if (!Number.isFinite(width)) return
            this.#legendWidth = clamp(width, minimum, maximum)
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
     * @returns {HTMLElement} Button group.
     */
    #playbackControls = () => {
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
        ruler.append(add)
        legend.append(ruler)
        if (this.#menuOpen) legend.append(this.#menu())
        const viewport = createElement('div', 'lgs1920-wa-timeline__legend-viewport', {part: 'legend-viewport'})
        const rows = createElement('div', 'lgs1920-wa-timeline__legend-rows', {part: 'legend-rows'})
        rows.style.transform = `translateY(-${this.#surface?.scrollTop ?? 0}px)`
        this.#rows.forEach(row => rows.append(this.#legendRow(row)))
        viewport.append(rows)
        legend.append(viewport)
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
        const relativeY = clientY - rect.top + (this.#surface?.scrollTop ?? 0) - headerHeight
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
        return this.#renderer.surfaceElement(scaleCount, majorSeconds, scaleSplitCount)
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
        if (event.button !== 0 || event.target.closest('wa-button')) return
        event.preventDefault()
        this.#dragState = {
            type: 'row',
            rowId,
            pointerId: event.pointerId,
            dropIndex: this.#rows.findIndex(row => row.id === rowId),
            baseRows: cloneRows(this.#rows),
        }
        this.#addPointerListeners()
        this.#render()
    }

    /**
     * Install global pointer listeners for scrubbing, resizing, or row drag.
     */
    #addPointerListeners = () => {
        window.addEventListener('pointermove', this.#pointerMove, {passive: false})
        window.addEventListener('pointerup', this.#pointerUp)
        window.addEventListener('pointercancel', this.#pointerUp)
    }

    /**
     * Remove global pointer listeners and reset transient pointer state.
     */
    #removePointerListeners = () => {
        window.removeEventListener('pointermove', this.#pointerMove)
        window.removeEventListener('pointerup', this.#pointerUp)
        window.removeEventListener('pointercancel', this.#pointerUp)
        this.#dragState = null
        this.#scrubPointerId = null
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
            this.#clipEditor.preview(this.#dragState, event)
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
                this.#render()
            }
        })
        this.#resizeObserver.observe(this.#surface)
    }

    /**
     * Keep the external legend aligned with the scrollable track surface.
     */
    #updateLegendScroll = () => {
        const rows = this.#root.querySelector('.lgs1920-wa-timeline__legend-rows')
        if (rows) rows.style.transform = `translateY(-${this.#surface?.scrollTop ?? 0}px)`
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
