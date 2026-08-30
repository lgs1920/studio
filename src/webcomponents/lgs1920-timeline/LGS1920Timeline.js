import '@web.awesome.me/webawesome-pro/dist/components/button/button.js'
import '@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js'
import '@web.awesome.me/webawesome-pro/dist/components/icon/icon.js'
import '@web.awesome.me/webawesome-pro/dist/components/input/input.js'
import '@web.awesome.me/webawesome-pro/dist/components/popup/popup.js'
import {parse as parseYaml} from 'yaml'
import styles from './lgs1920-timeline.css?inline'

const TAG_NAME = 'lgs1920-timeline'
const MIN_ZOOM = -50
const MAX_ZOOM = 500
const ZOOM_STEP = 20
const START_LEFT = 20
const SCALE_WIDTH = 40
const MIN_LEGEND_WIDTH = 120
const MAX_LEGEND_WIDTH = 300
const HEADER_HEIGHT = 42
const HORIZONTAL_SCROLLBAR_HEIGHT = 8
const MIN_ROW_HEIGHT = 24
const EDGE_TRIGGER_SIZE = 24
const EDGE_SCROLL_SPEEDS = [8, 16, 32, 64, 128]
const ACCELERATION_INTERVAL = 100
const GLOBAL_SLOTS = [
    'track-drag-icon',
    'track-visibility-icon',
    'track-icon',
    'track-label',
    'drag-trigger',
    'visibility',
    'name',
    'actions',
    'track-actions',
    'action-icon',
    'action-label',
    'action-content',
    'scale-label',
    'widget-option-icon',
    'widget-option-label',
    'track-context-menu',
    'item-context-menu',
]

/**
 * Create a DOM element with a class name and HTML attributes.
 *
 * @param {string} tagName - Element tag name.
 * @param {string} [className=''] - Optional class name.
 * @param {Object} [attributes={}] - Attributes to apply.
 * @returns {HTMLElement} Created element.
 */
const createElement = (tagName, className = '', attributes = {}) => {
    const element = document.createElement(tagName)
    if (className) element.className = className
    Object.entries(attributes).forEach(([name, value]) => {
        if (value === true) {
            element.setAttribute(name, '')
        } else if (value !== false && value !== null && value !== undefined) {
            element.setAttribute(name, `${value}`)
        }
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
const createIcon = (name, variant = 'regular') => createElement('wa-icon', '', {
    name,
    variant,
    label: '',
})

/**
 * Create a composed, bubbling custom event.
 *
 * @param {string} name - Event name.
 * @param {Object} detail - Event detail payload.
 * @returns {CustomEvent} Composed custom event.
 */
const createEvent = (name, detail) => new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
})

/**
 * Format elapsed seconds as a compact minute and second label.
 *
 * @param {number} seconds - Elapsed time in seconds.
 * @returns {string} Formatted elapsed-time label.
 */
const formatTime = seconds => {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
    return `${Math.floor(totalSeconds / 60)}:${`${totalSeconds % 60}`.padStart(2, '0')}`
}

/**
 * Format a ruler value without unnecessary decimal places.
 *
 * @param {number} seconds - Ruler value in seconds.
 * @returns {string} Ruler label.
 */
const formatScale = seconds => {
    const normalizedSeconds = Math.max(0, Number(seconds) || 0)
    return `${Number.isInteger(normalizedSeconds) ? normalizedSeconds : Number(normalizedSeconds.toFixed(3))}`
}

/**
 * Resolve a human-readable action label.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} Action label.
 */
const resolveActionLabel = action => String(action?.label ?? action?.widgetId ?? action?.kind ?? '')

/**
 * Resolve a human-readable row label.
 *
 * @param {Object} row - Timeline row.
 * @returns {string} Row label.
 */
const resolveRowLabel = row => row?.id === 'replay' ? 'Replay' : String(row?.label ?? row?.id ?? '')

/**
 * Resolve a Font Awesome icon for a timeline action.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} Icon name.
 */
const resolveActionIcon = action => action?.icon
    ?? (action?.kind === 'start' ? 'play' : action?.kind === 'stop' ? 'stop' : 'puzzle-piece')

/**
 * Join Web Awesome color classes with a safe fallback.
 *
 * @param {Array} colorClasses - Web Awesome color classes.
 * @returns {string} Class string.
 */
const resolveColorClasses = colorClasses => Array.isArray(colorClasses) && colorClasses.length > 0
    ? colorClasses.join(' ')
    : 'wa-neutral wa-neutral-blue'

/**
 * Create a stable slot suffix from a user-provided identifier.
 *
 * @param {string} identifier - Row or action identifier.
 * @returns {string} Slot-safe identifier.
 */
const slotKey = identifier => String(identifier ?? '')

/**
 * Clamp a numeric value between two bounds.
 *
 * @param {number} value - Value to clamp.
 * @param {number} minimum - Lower bound.
 * @param {number} maximum - Upper bound.
 * @returns {number} Clamped value.
 */
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

/**
 * Resolve the major ruler unit for the configured zoom.
 *
 * @param {number} zoomPercent - Current zoom percentage.
 * @returns {{majorSeconds: number, scaleSplitCount: number}} Ruler configuration.
 */
const resolveScale = zoomPercent => {
    const zoom = clamp(Number(zoomPercent) || 0, MIN_ZOOM, MAX_ZOOM)
    if (zoom <= -21) return {majorSeconds: 0.5, scaleSplitCount: 5}
    if (zoom <= 100) return {majorSeconds: 1, scaleSplitCount: 5}
    if (zoom <= 260) return {majorSeconds: 10, scaleSplitCount: 10}
    if (zoom <= 360) return {majorSeconds: 30, scaleSplitCount: 6}
    if (zoom <= 440) return {majorSeconds: 60, scaleSplitCount: 6}
    return {majorSeconds: 300, scaleSplitCount: 10}
}

/**
 * Web Awesome-compatible LGS1920 timeline custom element.
 *
 * The element is a controlled DOM adapter. It has no React hooks, Valtio
 * dependency, playback clock, or application store ownership. Applications
 * provide a replay projection through setState and handle the emitted events.
 */
export class LGS1920Timeline extends HTMLElement {
    #root
    #projection = null
    #rows = []
    #currentTimeMillis = 0
    #playing = false
    #linkedPreparation = false
    #widgetOptions = []
    #dataValue = null
    #dataFormat = 'auto'
    #zoom = 0
    #legendWidth = 136
    #surfaceWidth = 0
    #contentWidth = START_LEFT + SCALE_WIDTH
    #rowHeight = MIN_ROW_HEIGHT
    #menuOpen = false
    #parent = null
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

    /**
     * Construct the shadow DOM host and its persistent stylesheet.
     */
    constructor() {
        super()
        this.#root = this.attachShadow({mode: 'open'})
        const style = document.createElement('style')
        style.textContent = styles
        this.#root.append(style)
    }

    /**
     * Declare the attribute that controls the optional popup parent.
     *
     * @returns {Array<string>} Observed attributes.
     */
    static get observedAttributes() {
        return ['parent', 'data', 'data-format', 'persist-key']
    }

    /**
     * Get the optional parent used as the popup positioning boundary.
     *
     * @returns {HTMLElement|null} Resolved parent element.
     */
    get parent() {
        return this.#parent
    }

    /**
     * Set the optional parent used as the popup positioning boundary.
     *
     * @param {HTMLElement|string|null} value - Element or selector.
     */
    set parent(value) {
        this.#parent = this.#resolveParent(value)
        if (this.isConnected) this.#render()
    }

    /**
     * Get the current serializable timeline data snapshot.
     *
     * @returns {Object} Timeline data snapshot.
     */
    get data() {
        return this.#dataSnapshot()
    }

    /**
     * Set timeline data from an object, JSON string, or YAML string.
     *
     * @param {Object|string} value - Timeline data.
     */
    set data(value) {
        this.setData(value)
    }

    /**
     * Get the active data parser format.
     *
     * @returns {string} `auto`, `json`, or `yaml`.
     */
    get dataFormat() {
        return this.#dataFormat
    }

    /**
     * Set the active data parser format.
     *
     * @param {string} value - `auto`, `json`, or `yaml`.
     */
    set dataFormat(value) {
        this.#dataFormat = ['auto', 'json', 'yaml'].includes(value) ? value : 'auto'
        if (this.#dataValue !== null) this.setData(this.#dataValue)
    }

    /**
     * Get the optional local persistence key for edited track labels.
     *
     * @returns {string} Persistence key.
     */
    get persistKey() {
        return this.getAttribute('persist-key') || ''
    }

    /**
     * Set the optional local persistence key for edited track labels.
     *
     * @param {string} value - Persistence key.
     */
    set persistKey(value) {
        if (value) {
            this.setAttribute('persist-key', value)
        } else {
            this.removeAttribute('persist-key')
        }
    }

    /**
     * React to an observed attribute change.
     *
     * @param {string} name - Changed attribute name.
     * @param {string|null} oldValue - Previous attribute value.
     * @param {string|null} newValue - New attribute value.
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'parent' && oldValue !== newValue) {
            this.#parent = this.#resolveParent(newValue)
            if (this.isConnected) this.#render()
        }
        if (name === 'data-format' && oldValue !== newValue) this.dataFormat = newValue
        if (name === 'data' && oldValue !== newValue && newValue !== null) this.setData(newValue)
        if (name === 'persist-key' && oldValue !== newValue && this.#rows.length > 0) {
            this.#restorePersistedLabels()
            this.#render()
        }
    }

    /**
     * Render the component when it is attached to the document.
     */
    connectedCallback() {
        this.setAttribute('role', 'region')
        if (!this.getAttribute('aria-label')) this.setAttribute('aria-label', 'Timeline')
        this.#parent = this.#resolveParent(this.#parent ?? this.getAttribute('parent'))
        this.#render()
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
     * Apply controlled timeline state and refresh the DOM projection.
     *
     * @param {Object} state - Controlled state.
     * @param {Object} [state.projection] - Replay preparation projection.
     * @param {Array} [state.editorData] - Timeline rows when no projection is supplied.
     * @param {number} [state.currentTimeMillis=0] - Current logical time.
     * @param {boolean} [state.playing=false] - Whether Replay is playing.
     * @param {boolean} [state.linkedPreparation=false] - Whether the preview is active.
     * @param {Array} [state.widgetOptions=[]] - Add-widget menu options.
     * @param {number} [state.zoomPercent] - Controlled zoom percentage.
     * @param {number} [state.legendWidth] - Controlled legend width.
     */
    setState(state = {}) {
        if (state.data !== undefined) {
            this.setData(state.data)
            return
        }
        this.#dataValue = null
        this.#applyState(state)
    }

    /**
     * Apply timeline data in object, JSON, or YAML form.
     *
     * @param {Object|string} value - Timeline data.
     */
    setData(value) {
        try {
            const parsed = this.#parseData(value)
            this.#dataValue = value
            this.#applyState(this.#normalizeData(parsed))
        } catch (error) {
            this.#emit('data-error', {value, error})
        }
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
        this.#linkedPreparation = state.linkedPreparation === true
        this.#widgetOptions = Array.isArray(state.widgetOptions) ? state.widgetOptions : []
        if (Number.isFinite(Number(state.zoomPercent))) this.#zoom = clamp(Number(state.zoomPercent), MIN_ZOOM, MAX_ZOOM)
        if (Number.isFinite(Number(state.legendWidth))) this.#legendWidth = clamp(Number(state.legendWidth), MIN_LEGEND_WIDTH, MAX_LEGEND_WIDTH)
        this.#restorePersistedLabels()
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
     * Resolve a parent value to a DOM element.
     *
     * @param {HTMLElement|string|null} value - Element or selector.
     * @returns {HTMLElement|null} Resolved element.
     */
    #resolveParent = value => {
        if (value instanceof HTMLElement) return value
        if (typeof value !== 'string' || !value) return null
        try {
            return document.querySelector(value)
        } catch {
            return null
        }
    }

    /**
     * Parse an object, JSON string, or YAML string into timeline data.
     *
     * @param {Object|string} value - Raw timeline data.
     * @returns {Object} Parsed timeline data.
     */
    #parseData = value => {
        if (value && typeof value === 'object') return value
        if (typeof value !== 'string' || !value.trim()) throw new TypeError('Timeline data must be an object, JSON string, or YAML string')
        if (this.#dataFormat === 'json') return JSON.parse(value)
        if (this.#dataFormat === 'yaml') return parseYaml(value)
        try {
            return JSON.parse(value)
        } catch {
            return parseYaml(value)
        }
    }

    /**
     * Normalize the public data format to the internal projection format.
     *
     * @param {Object} data - Parsed timeline data.
     * @returns {Object} Controlled component state.
     */
    #normalizeData = data => {
        const tracks = data?.tracks ?? data?.editorData ?? []
        const editorData = tracks.map(track => ({
            ...track,
            actions: track.actions ?? track.items ?? [],
        }))
        const durationMillis = Number(data?.durationMillis ?? (Number(data?.durationSeconds) * 1000)) || 0
        return {
            projection: Object.assign({}, data, {
                durationMillis,
                durationSeconds: durationMillis / 1000,
                editorData,
            }),
            currentTimeMillis: data?.currentTimeMillis,
            playing: data?.playing,
            linkedPreparation: data?.linkedPreparation !== false,
            widgetOptions: data?.widgetOptions,
            zoomPercent: data?.zoomPercent,
            legendWidth: data?.legendWidth,
        }
    }

    /**
     * Build a serializable data snapshot containing the current track labels.
     *
     * @returns {Object} Current timeline data.
     */
    #dataSnapshot = () => ({
        ...(this.#dataValue && typeof this.#dataValue === 'object' ? this.#dataValue : {}),
        durationMillis: this.#durationMillis(),
        durationSeconds: this.#durationSeconds(),
        currentTimeMillis: this.#currentTimeMillis,
        playing: this.#playing,
        linkedPreparation: this.#linkedPreparation,
        zoomPercent: this.#zoom,
        legendWidth: this.#legendWidth,
        tracks: this.#rows.map(row => ({
            ...row,
            items: row.actions ?? [],
        })),
    })

    /**
     * Restore persisted track labels from local storage when enabled.
     */
    #restorePersistedLabels = () => {
        const key = this.persistKey
        if (!key || typeof localStorage === 'undefined') return
        try {
            const value = JSON.parse(localStorage.getItem(`lgs1920-timeline:${key}:labels`) || '{}')
            this.#rows = this.#rows.map(row => value[row.id] === undefined ? row : {...row, label: value[row.id]})
        } catch {
            return
        }
    }

    /**
     * Persist the current track labels to local storage when enabled.
     */
    #persistLabels = () => {
        const key = this.persistKey
        if (!key || typeof localStorage === 'undefined') return
        try {
            const labels = Object.fromEntries(this.#rows.map(row => [row.id, resolveRowLabel(row)]))
            localStorage.setItem(`lgs1920-timeline:${key}:labels`, JSON.stringify(labels))
        } catch {
            return
        }
    }

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
        this.#persistLabels()
        this.#emit('track-label-change', {
            rowId,
            label,
            previousLabel,
            rows: this.#rows,
            data: this.#dataSnapshot(),
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
        if (!this.#linkedPreparation || !this.#projection) {
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
            part: 'container',
            'data-testid': 'lgs1920-wa-timeline',
            'aria-label': this.getAttribute('aria-label') || 'Replay tracks',
        })
        section.append(createElement('slot', 'lgs1920-wa-timeline__additional-content-slot', {name: 'additional-content'}), this.#slotRegistry())

        const top = createElement('div', 'lgs1920-wa-timeline__top', {part: 'top'})
        const header = createElement('header', 'lgs1920-wa-timeline__header', {part: 'header'})
        header.append(createElement('slot', '', {name: 'header'}), this.#transportControls())
        top.append(header)

        const transport = createElement('div', 'lgs1920-wa-timeline__transport', {part: 'transport', 'aria-label': 'Replay transport'})
        transport.append(
            createElement('slot', '', {name: 'transport-start'}),
            this.#slotWithFallback('transport-current', this.#timeText(this.#currentTimeMillis / 1000, 'current')),
            this.#slotWithFallback('transport-separator', document.createTextNode(' / ')),
            this.#slotWithFallback('transport-total', this.#timeText(this.#durationSeconds(), 'total')),
            createElement('slot', '', {name: 'transport-end'}),
        )
        top.append(transport)
        section.append(top)

        const layout = createElement('div', 'lgs1920-wa-timeline__layout', {
            part: 'layout',
            'data-layout': '',
            'data-capture-exclude': 'true',
        })
        layout.style.setProperty('--lgs-timeline-legend-width', `${this.#legendWidth}px`)
        layout.style.setProperty('--lgs-timeline-row-height', `${this.#rowHeight}px`)
        layout.append(this.#legend(), this.#resizer(), this.#surfaceElement(scaleCount, majorSeconds, scaleSplitCount))
        section.append(layout)
        if (this.#contextMenuState) section.append(this.#contextMenu())
        section.append(createElement('slot', '', {name: 'footer'}))
        return section
    }

    /**
     * Create the Web Awesome transport controls.
     *
     * @returns {HTMLElement} Button group.
     */
    #transportControls = () => {
        const controls = createElement('wa-button-group', '', {label: 'Replay controls', part: 'controls'})
        const play = this.#button({
            iconName: this.#playing ? 'pause' : 'play',
            label: this.#playing ? 'Pause Replay' : 'Play Replay',
            testId: 'timeline-play',
            iconSlot: this.#playing ? 'pause-icon' : 'play-icon',
            labelSlot: this.#playing ? 'pause-label' : 'play-label',
        })
        play.addEventListener('click', () => this.#emit(this.#playing ? 'pause' : 'play', {}))
        const replay = this.#button({
            iconName: 'arrow-rotate-left',
            label: 'Replay from beginning',
            testId: 'timeline-replay',
            iconSlot: 'replay-icon',
            labelSlot: 'replay-label',
        })
        replay.addEventListener('click', () => this.#emit('replay', {}))
        const exportButton = this.#button({
            iconName: 'clapperboard-play',
            label: 'Create HQ video',
            testId: 'timeline-export',
            iconSlot: 'export-icon',
            labelSlot: 'export-label',
            variant: 'brand',
            appearance: 'filled',
        })
        exportButton.addEventListener('click', () => this.#emit('export', {}))
        controls.append(play, replay, exportButton)
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
     * repeated row and action contexts.
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
     * Create a contextual slot with a per-row or per-action override and a
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
     * Create the track legend and its add-widget menu.
     *
     * @returns {HTMLElement} Legend element.
     */
    #legend = () => {
        const legend = createElement('div', 'lgs1920-wa-timeline__legend', {part: 'legend'})
        const ruler = createElement('div', 'lgs1920-wa-timeline__legend-ruler', {part: 'legend-ruler'})
        ruler.append(createElement('slot', '', {name: 'timeline-toolbar'}))
        const add = this.#button({
            iconName: 'plus',
            label: 'Add widget to timeline',
            testId: 'add-widget',
            iconSlot: 'add-widget-icon',
            labelSlot: 'add-widget-label',
            variant: 'brand',
            appearance: 'filled',
        })
        add.id = 'lgs1920-timeline-widget-menu-trigger'
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
     * Create the anchored Web Awesome popup used by the widget menu.
     *
     * @returns {HTMLElement} Popup element.
     */
    #menu = () => {
        const popup = createElement('wa-popup', 'lgs1920-wa-timeline__popup', {
            placement: 'right-start',
            distance: 4,
            active: true,
            anchor: 'lgs1920-timeline-widget-menu-trigger',
            part: 'popup',
        })
        const boundary = this.#parent
        if (boundary) {
            popup.flipBoundary = boundary
            popup.shiftBoundary = boundary
            popup.autoSizeBoundary = boundary
        }
        const menu = createElement('div', 'lgs1920-wa-timeline__menu', {role: 'menu', part: 'menu'})
        this.#widgetOptions.forEach(option => {
            const item = createElement('wa-button', 'lgs1920-wa-timeline__menu-item', {
                appearance: 'plain',
                size: 's',
                role: 'menuitem',
            })
            item.append(...this.#globalSlotContent('widget-option-icon', createIcon(option.icon ?? 'puzzle-piece')))
            item.append(...this.#globalSlotContent('widget-option-label', document.createTextNode(option.label ?? option.key ?? 'Widget')))
            item.addEventListener('click', () => {
                this.#emit('add-widget', {group: option.group, key: option.key, option})
                this.#menuOpen = false
                this.#render()
            })
            menu.append(item)
        })
        if (this.#widgetOptions.length === 0) menu.append(createElement('slot', '', {name: 'empty-state'}))
        popup.append(menu)
        return popup
    }

    /**
     * Open a context menu anchored to a track or item.
     *
     * @param {string} type - Context type: `track` or `item`.
     * @param {string} identifier - Track or item identifier.
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
     * Create the context menu for the active track or item.
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
        if (this.#parent) {
            popup.flipBoundary = this.#parent
            popup.shiftBoundary = this.#parent
            popup.autoSizeBoundary = this.#parent
        }
        const menu = createElement('div', 'lgs1920-wa-timeline__context-menu', {
            label: state.type === 'track' ? 'Track actions' : 'Item actions',
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
            const action = this.#findAction(state.identifier)
            menu.append(this.#contextMenuItem('Edit item', 'edit-item', event => {
                this.#emit('item-label-edit-request', {action, event})
                this.#closeContextMenu()
            }))
            menu.append(this.#contextMenuItem(action?.visible === false ? 'Show item' : 'Hide item', 'toggle-item-visibility', event => {
                this.#toggleItemVisibility(action, event)
            }))
            menu.append(...this.#globalSlotContent('item-context-menu', null))
        }
        popup.append(menu)
        return popup
    }

    /**
     * Find an action by identifier in the current rows.
     *
     * @param {string} identifier - Action identifier.
     * @returns {Object|null} Matching action and its row context.
     */
    #findAction = identifier => {
        for (const row of this.#rows) {
            const action = (row.actions ?? []).find(value => value.id === identifier)
            if (action) return Object.assign({}, action, {rowId: row.id})
        }
        return null
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
        this.#emit('visibility-change', {rowId: row.id, visible, row: Object.assign({}, row, {visible}), event, data: this.#dataSnapshot()})
        this.#render()
    }

    /**
     * Toggle an action visibility state and emit its controlled change event.
     *
     * @param {Object|null} action - Action to toggle.
     * @param {Event} event - Triggering event.
     */
    #toggleItemVisibility = (action, event) => {
        if (!action) return
        const visible = action.visible === false
        this.#rows = this.#rows.map(row => row.id !== action.rowId
            ? row
            : {...row, actions: (row.actions ?? []).map(value => value.id === action.id ? {...value, visible} : value)})
        this.#contextMenuState = null
        this.#emit('item-visibility-change', {rowId: action.rowId, itemId: action.id, visible, action: Object.assign({}, action, {visible}), event, data: this.#dataSnapshot()})
        this.#render()
    }

    /**
     * Create one track legend row.
     *
     * @param {Object} row - Timeline row.
     * @returns {HTMLElement} Legend row.
     */
    #legendRow = row => {
        const movable = row.movable !== false && row.fixed !== true
        const label = resolveRowLabel(row)
        const element = createElement('div', `lgs1920-wa-timeline__legend-row ${resolveColorClasses(row.colorClasses)}${movable ? ' lgs1920-wa-timeline__legend-row--movable' : ''}${this.#dragState?.rowId === row.id ? ' lgs1920-wa-timeline__legend-row--dragging' : ''}`, {
            part: 'legend-row',
            id: `lgs1920-timeline-track-${slotKey(row.id)}`,
            'data-row-id': row.id,
            'aria-label': label,
        })
        element.style.height = 'var(--lgs-timeline-row-height)'
        element.addEventListener('contextmenu', event => this.#openContextMenu('track', row.id, element, event))
        const iconFrame = createElement('span', `lgs1920-wa-timeline__icon-frame ${resolveColorClasses(row.colorClasses)}`, {part: 'legend-icon'})
        iconFrame.append(this.#contextualSlot('track-icon', row.id, ['track-icon'], createIcon(row.icon ?? (row.id === 'replay' ? 'route' : 'puzzle-piece'))))
        const labelPrefix = this.#hasContextualSlot('name', row.id) ? 'name' : 'track-label'
        const labelElement = this.#editingRowId === row.id
            ? createElement('wa-input', 'lgs1920-wa-timeline__label-editor', {
                size: 's',
                value: this.#editingLabelValue,
                label: `Edit ${label}`,
                'data-edit-row-id': row.id,
            })
            : this.#contextualSlot(labelPrefix, row.id, ['name', 'track-name', 'track-label'], document.createTextNode(label))
        if (this.#editingRowId === row.id) {
            labelElement.addEventListener('input', event => {
                this.#editingLabelValue = event.target.value ?? ''
            })
            labelElement.addEventListener('change', () => this.#commitTrackLabelEdit())
            labelElement.addEventListener('blur', () => this.#commitTrackLabelEdit())
            labelElement.addEventListener('keydown', event => {
                if (event.key === 'Enter') this.#commitTrackLabelEdit()
                if (event.key === 'Escape') this.#cancelTrackLabelEdit()
            })
        } else if (row.editable !== false) {
            labelElement.addEventListener('dblclick', event => {
                event.preventDefault()
                event.stopPropagation()
                this.#beginTrackLabelEdit(row)
            })
        }
        const trackContent = createElement('span', 'lgs1920-wa-timeline__track-content', {part: 'legend-content'})
        trackContent.append(iconFrame, labelElement)
        const actions = createElement('span', 'lgs1920-wa-timeline__track-actions', {part: 'track-actions'})
        actions.addEventListener('pointerdown', event => event.stopPropagation())
        actions.append(this.#contextualSlot('drag-trigger', row.id, ['drag-trigger', 'track-drag-icon'], createIcon(movable ? 'grip-dots-vertical' : 'thumbtack', 'solid')))
        if (row.canHide) {
            const visibility = this.#button({
                iconName: row.visible === false ? 'eye' : 'eye-slash',
                label: row.visible === false ? `Show ${label}` : `Hide ${label}`,
                testId: 'visibility',
                iconSlotElement: this.#contextualSlot('visibility', row.id, ['visibility', 'track-visibility-icon'], createIcon(row.visible === false ? 'eye' : 'eye-slash', 'solid')),
            })
            visibility.addEventListener('click', event => {
                event.stopPropagation()
                this.#toggleTrackVisibility(row, event)
            })
            actions.append(visibility)
        }
        const actionsPrefix = this.#hasContextualSlot('actions', row.id) ? 'actions' : 'track-actions'
        actions.append(this.#contextualSlot(actionsPrefix, row.id, ['actions', 'track-actions'], null))
        element.append(trackContent, actions)
        if (movable) element.addEventListener('pointerdown', event => this.#startRowDrag(event, row.id))
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
    #surfaceElement = (scaleCount, majorSeconds, scaleSplitCount) => {
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const surface = createElement('div', 'lgs1920-wa-timeline__surface', {
            part: 'surface',
            'data-surface': '',
            tabindex: 0,
            role: 'group',
            'aria-label': 'Timeline time scale and scrubbing',
            'data-zoom-percent': this.#zoom,
        })
        const canvas = createElement('div', 'lgs1920-wa-timeline__canvas', {part: 'canvas'})
        canvas.style.width = `${this.#contentWidth}px`
        const ruler = createElement('div', 'lgs1920-wa-timeline__ruler', {part: 'ruler'})
        ruler.style.width = `${this.#contentWidth}px`
        for (let index = 0; index <= scaleCount; index += 1) {
            const tick = createElement('span', `lgs1920-wa-timeline__tick${index === 0 ? ' lgs1920-wa-timeline__tick--origin' : ''}`, {part: 'tick'})
            tick.style.left = `${scaleOffset + (index * scaleWidth)}px`
            const tickLabel = this.#contextualSlot('scale-label', index, 'scale-label', document.createTextNode(formatScale(index * majorSeconds)))
            tick.append(tickLabel)
            for (let split = 1; split < scaleSplitCount; split += 1) {
                const minor = createElement('span', 'lgs1920-wa-timeline__minor-tick', {part: 'minor-tick'})
                minor.style.left = `${scaleOffset + ((index + (split / scaleSplitCount)) * scaleWidth)}px`
                ruler.append(minor)
            }
            ruler.append(tick)
        }
        ruler.append(createElement('slot', '', {name: 'timeline-ruler'}))
        const tracks = createElement('div', 'lgs1920-wa-timeline__tracks', {part: 'tracks'})
        tracks.style.width = `${this.#contentWidth}px`
        this.#rows.forEach(row => {
            const track = createElement('div', `lgs1920-wa-timeline__track${row.visible === false ? ' lgs1920-wa-timeline__track--hidden' : ''}`, {part: 'track', 'data-row-id': row.id})
            track.style.height = 'var(--lgs-timeline-row-height)'
            for (const action of row.actions ?? []) track.append(this.#action(action, majorSeconds))
            tracks.append(track)
        })
        canvas.append(ruler, tracks, createElement('div', 'lgs1920-wa-timeline__playhead', {part: 'playhead', 'data-playhead': ''}), createElement('div', 'lgs1920-wa-timeline__end-marker', {part: 'end-marker', 'data-end-marker': ''}))
        surface.append(canvas)
        surface.addEventListener('scroll', () => this.#updateLegendScroll())
        surface.addEventListener('click', event => {
            if (!event.target.closest('.lgs1920-wa-timeline__action')) this.#seek(event.clientX, true)
        })
        surface.addEventListener('wheel', event => this.#handleWheel(event))
        surface.addEventListener('keydown', event => this.#handleKeyDown(event))
        surface.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('.lgs1920-wa-timeline__action')) return
            this.#scrubPointerId = event.pointerId
            this.#addPointerListeners()
            this.#seek(event.clientX, false)
        })
        return surface
    }

    /**
     * Create one visual timeline action.
     *
     * @param {Object} value - Timeline action.
     * @param {number} majorSeconds - Seconds represented by one ruler unit.
     * @returns {HTMLElement} Action element.
     */
    #action = (value, majorSeconds) => {
        const scaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const start = Math.max(0, Number(value.start) || 0)
        const end = Math.max(start, Number(value.end) || start)
        const action = createElement('div', `lgs1920-wa-timeline__action ${resolveColorClasses(value.colorClasses)}${value.visible === false ? ' lgs1920-wa-timeline__action--hidden' : ''}`, {
            part: 'action',
            id: `lgs1920-timeline-item-${slotKey(value.id)}`,
            'data-action-id': value.id,
            'data-action-kind': value.kind,
            'aria-label': resolveActionLabel(value),
        })
        action.style.left = `${scaleOffset + ((start / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
        action.style.width = `${Math.max(this.#numericToken('action-min-width', 8), ((end - start) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
        const preview = createElement('span', 'lgs1920-wa-timeline__action-preview', {part: 'action-preview'})
        preview.append(this.#contextualSlot('action-icon', value.id, 'action-icon', createIcon(resolveActionIcon(value), 'solid')))
        preview.append(this.#contextualSlot('action-label', value.id, 'action-label', document.createTextNode(resolveActionLabel(value))))
        action.append(this.#contextualSlot('action-content', value.id, ['action-content'], preview))
        action.addEventListener('contextmenu', event => this.#openContextMenu('item', value.id, action, event))
        action.addEventListener('dblclick', event => this.#emit('action-dblclick', {action: value, event}))
        return action
    }

    /**
     * Create the draggable legend width separator.
     *
     * @returns {HTMLElement} Resize separator.
     */
    #resizer = () => {
        const resizer = createElement('div', 'lgs1920-wa-timeline__resizer', {
            part: 'resizer',
            role: 'separator',
            'aria-label': 'Resize track title area',
            'aria-orientation': 'vertical',
            'aria-valuemin': MIN_LEGEND_WIDTH,
            'aria-valuemax': MAX_LEGEND_WIDTH,
            'aria-valuenow': this.#legendWidth,
            tabindex: 0,
        })
        resizer.addEventListener('pointerdown', event => {
            if (event.button !== 0) return
            event.preventDefault()
            event.stopPropagation()
            this.#dragState = {type: 'resize', startX: event.clientX, startWidth: this.#legendWidth}
            this.#addPointerListeners()
        })
        return resizer
    }

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
        this.#dragState = {type: 'row', rowId}
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
        if (this.#dragState?.type === 'resize') {
            event.preventDefault()
            this.#legendWidth = clamp((this.#dragState.startWidth ?? this.#legendWidth) + event.clientX - (this.#dragState.startX ?? event.clientX), MIN_LEGEND_WIDTH, MAX_LEGEND_WIDTH)
            this.#render()
            return
        }
        if (this.#dragState?.type === 'row') {
            event.preventDefault()
            this.#handleRowAutoScroll(event.clientX)
            const viewport = this.#root.querySelector('.lgs1920-wa-timeline__legend-viewport')
            const rect = viewport?.getBoundingClientRect()
            if (!rect) return
            const targetIndex = clamp(Math.floor((event.clientY - rect.top) / Math.max(MIN_ROW_HEIGHT, this.#rowHeight)), 0, this.#rows.length - 1)
            const currentIndex = this.#rows.findIndex(row => row.id === this.#dragState?.rowId)
            if (currentIndex < 0 || currentIndex === targetIndex) return
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
        if (this.#dragState?.type === 'row') {
            this.#emit('reorder', {
                rowIds: this.#rows.filter(row => !row.fixed && row.movable !== false).map(row => row.id),
                rows: this.#rows,
            })
            this.#render()
        }
        this.#removePointerListeners()
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
     * Update transport labels and controlled cursor geometry.
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
        if (playhead) playhead.style.left = `${position}px`
        if (end) end.style.left = `${scaleOffset + ((this.#durationSeconds() / majorSeconds) * scaleWidth)}px`
    }

    /**
     * Emit both the current component event and the previous compatibility
     * event prefix so consumers can migrate without changing the React path.
     *
     * @param {string} name - Event suffix.
     * @param {Object} detail - Event detail payload.
     */
    #emit = (name, detail) => {
        this.dispatchEvent(createEvent(`lgs1920-timeline-${name}`, detail))
        this.dispatchEvent(createEvent(`lgs1920-wa-timeline-${name}`, detail))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, LGS1920Timeline)
}
