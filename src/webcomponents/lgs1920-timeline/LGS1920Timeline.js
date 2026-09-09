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
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@web.awesome.me/webawesome-pro/dist/components/button/button.js'
import '@web.awesome.me/webawesome-pro/dist/components/card/card.js'
import '@web.awesome.me/webawesome-pro/dist/components/color-picker/color-picker.js'
import '@web.awesome.me/webawesome-pro/dist/components/icon/icon.js'
import '@web.awesome.me/webawesome-pro/dist/components/input/input.js'
import '@web.awesome.me/webawesome-pro/dist/components/popup/popup.js'
import '@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js'
import '@web.awesome.me/webawesome-pro/dist/components/tooltip/tooltip.js'
import styles from './lgs1920-timeline.css?inline'
import {createTimelineClipScroll} from './LGS1920TimelineClipScroll.js'
import {cloneRows, createTimelineClipEditor, normalizeClipLayout, resolveClipInterval, trackAcceptsClip} from './LGS1920TimelineEditing.js'
import {
    allowsHostInteraction,
    EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES,
    TIMELINE_ARROW_KEYS,
    TIMELINE_HORIZONTAL_ARROW_KEYS,
    TIMELINE_INPUT_EVENT_TYPES,
    TIMELINE_KEYBOARD_KEYS,
    TIMELINE_KEYBOARD_EDITABLE_SELECTOR,
    HOST_DRAG_CONTINUATION_EVENT_TYPES,
    HOST_DRAG_START_EVENT_TYPES,
} from './LGS1920TimelineInteraction.js'
import {createTimelineRenderer} from './LGS1920TimelineRendering.js'
import {
    ACCELERATION_INTERVAL,
    DEFAULT_TIMELINE_COLOR_SWATCHES,
    EDGE_TIME_ACCELERATION_INTERVAL,
    EDGE_SCROLL_SPEEDS,
    EDGE_SCROLL_TIME_STEPS,
    EDGE_TRIGGER_SIZE,
    END_PADDING,
    GLOBAL_SLOTS,
    HEADER_HEIGHT,
    HORIZONTAL_SCROLLBAR_HEIGHT,
    MAX_ZOOM,
    MIN_VISIBLE_DURATION_SECONDS,
    MIN_ROW_HEIGHT,
    MAX_ROW_HEIGHT,
    MIN_ZOOM,
    ROW_ZOOM_STEP,
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
    normalizeTimelineColorSwatches,
    resolveClipIcon,
    resolveClipLabel,
    resolveColorClasses,
    resolveLegendBounds,
    resolveRowLabel,
    resolveScale,
    resolveTimelineColorValue,
    resolveTimelinePaletteFromValue,
    slotKey,
} from './LGS1920TimelineUtils.js'

const ROW_DRAG_THRESHOLD = 4
const CLIP_DRAG_THRESHOLD = 4
const TOUCH_CLIP_DRAG_THRESHOLD = 8
const CLIP_OPTION_DRAG_MIME = 'application/x-lgs1920-timeline-clip'
const STRUCTURAL_CONFIG_KEYS = Object.freeze([
    'interactive',
    'editable',
    'showClipMenu',
    'legendMinWidth',
    'legendMaxWidth',
    'legendWidth',
    'hostInteraction',
    'hostNoDragClass',
    'horizontalFit',
    'swatches',
    'colorSwatches',
    'clipActions',
    'clipContextMenuActions',
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
    #localRowsDirty = false
    #localDurationDirty = false
    #currentTimeMillis = 0
    #playing = false
    #visible = true
    #clipOptions = null
    #zoom = 0
    #verticalZoomRowHeight = null
    #interactionDurationMillis = null
    #rangeStartMillis = 0
    #rangeEndMillis = 0
    #rangeEndFollowsDuration = true
    #surfaceWidth = 0
    #contentWidth = START_LEFT + SCALE_WIDTH
    #rowHeight = MIN_ROW_HEIGHT
    #legendWidth = null
    #building = true
    #buildingFrame = null
    #buildingLayoutSignature = null
    #initialBuildComplete = false
    #menuOpen = false
    #draggedClipOption = null
    #generatedClipIdentifiers = new Set()
    #clipContextMenuClipId = null
    #clipContextMenuAnchor = null
    #selectedClipKey = null
    #clipCopyState = null
    #clipCopyPresentationFrame = null
    #trackNumber = 0
    #horizontalFitActive = false
    #lastControlledZoomPercent = null
    #surface = null
    #tracksViewport = null
    #resizeObserver = null
    #scrollbarDrag = null
    #scrollbarDragCleanup = null
    #scrollbarHideTimer = null
    #scrollbarsInteractionActive = false
    #nativeSplitPanelInteractionActive = false
    #pointerCaptureTarget = null
    #pointerCaptureId = null
    #dragState = null
    #clipSnapGuide = null
    #clipSnapGuideTimer = null
    #scrubPointerId = null
    #autoScrollFrame = null
    #edgeDirection = null
    #edgeStartedAt = null
    #edgeLastStepAt = null
    #edgePointerEvent = null
    #editingRowId = null
    #editingLabelValue = ''
    #suppressRangeClick = false
    #inputPropagationBlockersInstalled = false
    #externalInteractionActive = false
    #pendingControlledState = null
    #clipEditor
    #clipScroll
    #clipWorkspaceWidth = 0
    #renderer

    /**
     * Build a stable signature for controlled or internal row snapshots.
     *
     * @param {Array} rows - Timeline rows.
     * @returns {string} Normalized row signature.
     */
    #rowSignature = rows => JSON.stringify((rows ?? []).map(row => {
        const {actions, clips, ...stable} = row ?? {}
        return {...stable, clips: actions ?? clips ?? []}
    }))

    /**
     * Build a placement signature that ignores projection-only clip metadata.
     *
     * @param {Array} rows - Timeline rows.
     * @returns {string} Clip placement signature.
     */
    #placementSignature = rows => JSON.stringify((rows ?? []).map(row => ({
        id: row?.id,
        clips: (row?.actions ?? row?.clips ?? []).map(clip => [clip.id, clip.start, clip.end]),
    })))

    /**
     * Construct the shadow DOM host and its persistent stylesheet.
     */
    constructor() {
        super()
        this.#root = this.attachShadow({mode: 'open'})
        this.#root.addEventListener('pointerdown', () => {
            this.#suppressRangeClick = false
        }, true)
        this.#root.addEventListener('click', event => {
            if (!this.#suppressRangeClick) return
            this.#suppressRangeClick = false
            event.preventDefault()
            event.stopImmediatePropagation()
        }, true)
        const style = document.createElement('style')
        style.textContent = styles
        this.#root.append(style, this.#buildingOverlay())
        this.#clipEditor = createTimelineClipEditor({
            getRows: () => this.#rows,
            getTimelineConfig: () => this.#timelineConfig,
            getProjectionDurationMillis: () => this.#dragState?.initialDurationMillis ?? this.#durationMillis(),
            getMajorRulerUnit: () => {
                const {majorSeconds, scaleSplitCount} = resolveScale(this.#zoom)
                const scaleWidth = this.#scaleWidth()
                const splitCount = Number(scaleSplitCount)
                return {
                    seconds: majorSeconds,
                    pixels: scaleWidth,
                    minorSeconds: splitCount > 1 ? majorSeconds / splitCount : null,
                    minorPixels: splitCount > 1 ? scaleWidth / splitCount : null,
                }
            },
            getTimeAtClientX: clientX => this.#timeAtClientX(clientX),
            getTrackAtClientY: clientY => this.#trackAtClientY(clientY),
            getCurrentTimeMillis: () => this.#currentTimeMillis,
            getRangeEndFollowsDuration: () => this.#rangeEndFollowsDuration,
            getRangeEndMillis: () => this.#dragState?.initialRangeEndMillis ?? this.#rangeEndMillis,
            setRangeEndMillis: value => {
                this.#rangeEndMillis = value
            },
            setRows: rows => {
                this.#rows = rows
                // Preview rows are transient during a pointer gesture. A
                // keyboard edit has no active drag state and is committed
                // immediately, so retain it across the next controlled sync.
                if (!this.#dragState) this.#localRowsDirty = true
            },
            setInteractionDurationMillis: value => {
                const nextDurationMillis = Number.isFinite(Number(value)) ? Number(value) : null
                if (nextDurationMillis === this.#interactionDurationMillis) return
                if (!this.#dragState && Number.isFinite(nextDurationMillis)
                    && nextDurationMillis !== (Number(this.#projection?.durationMillis) || 0)) {
                    this.#localDurationDirty = true
                }
                this.#interactionDurationMillis = nextDurationMillis
                this.#refreshDurationGeometry()
            },
            emit: (name, detail, options) => this.#emit(name, detail, options),
            render: () => this.#updateClipInteractionPresentation(),
        })
        this.#clipScroll = createTimelineClipScroll({
            getSurface: () => this.#surface,
            getTracksViewport: () => this.#tracksViewport,
            canScrollHorizontal: () => this.#dragState?.type === 'clip',
            extendWorkspace: pixels => {
                const state = this.#dragState
                if (state?.type !== 'clip' || state.dropRejected || this.#timelineConfig.durationPolicy === 'fixed') return
                if (state.mode === 'resize' && (state.edge !== 'end' || this.#timelineConfig.resizeExtendsDuration === false)) return
                const requiredWidth = this.#surface.scrollLeft + this.#surface.clientWidth + pixels + 32
                if (requiredWidth <= this.#contentWidth) return
                this.#clipWorkspaceWidth = requiredWidth
                this.#refreshDurationGeometry()
            },
            preview: event => {
                if (['clip', 'row'].includes(this.#dragState?.type)) this.#pointerMove(event)
            },
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
            allowsHostInteraction: () => allowsHostInteraction(this.#timelineConfig),
            getRows: () => this.#rows,
            getDragState: () => this.#dragState,
            getEditingRowId: () => this.#editingRowId,
            getEditingLabelValue: () => this.#editingLabelValue,
            setEditingLabelValue: value => {
                this.#editingLabelValue = value
            },
            getRangeStartMillis: () => this.#rangeStartMillis,
            getRangeEndMillis: () => this.#rangeEndMillis,
            getCurrentTimeMillis: () => this.#currentTimeMillis,
            getDurationMillis: () => this.#durationMillis(),
            getContentWidth: () => this.#contentWidth,
            getZoom: () => this.#zoom,
            isClipSelected: clip => this.#isClipSelected(clip),
            contextualSlot: (prefix, identifier, globalName, fallback) => this.#contextualSlot(prefix, identifier, globalName, fallback),
            hasContextualSlot: (prefix, identifier) => this.#hasContextualSlot(prefix, identifier),
            globalSlotContent: (name, fallback) => this.#globalSlotContent(name, fallback),
            button: options => this.#button(options),
            removeTrack: (row, event) => this.#removeTrack(row, event),
            removeClip: (clipId, event) => this.#removeClip(clipId, event),
            duplicateClip: (clipId, event) => this.#duplicateClip(clipId, event),
            toggleClipEnabled: (clipId, event) => this.#toggleClipEnabled(clipId, event),
            toggleClipVisibility: (clipId, event) => this.#toggleClipVisibility(clipId, event),
            selectClip: (clip, event, element) => this.#selectClip(clip, event, element),
            openClipContextMenu: (clip, event) => this.#openClipContextMenu(clip, event),
            beginTrackLabelEdit: row => this.#beginTrackLabelEdit(row),
            commitTrackLabelEdit: event => this.#commitTrackLabelEdit(event),
            cancelTrackLabelEdit: () => this.#cancelTrackLabelEdit(),
            startRowDrag: (event, rowId) => this.#startRowDrag(event, rowId),
            toggleTrackVisibility: (row, event) => this.#toggleTrackVisibility(row, event),
            handleClipDragOver: (event, rowId, track) => this.#handleClipDragOver(event, rowId, track),
            handleClipDragLeave: (event, track) => this.#handleClipDragLeave(event, track),
            handleClipDrop: (event, rowId, track) => this.#handleClipDrop(event, rowId, track),
            startClipInteraction: (event, clipId, mode, edge, wasSelected) => this.#startClipInteraction(event, clipId, mode, edge, wasSelected),
            resizeClipByKeyboard: (clipId, edge, event) => this.#clipEditor.resizeByKeyboard(clipId, edge, event),
            startRangeInteraction: (event, edge) => this.#startRangeInteraction(event, edge),
            setRangeBoundaryToLimit: (edge, event) => this.#setRangeBoundaryToLimit(edge, event),
            moveRangeByKeyboard: (edge, event) => this.#moveRangeByKeyboard(edge, event),
            startPlayheadInteraction: event => this.#startPlayheadInteraction(event),
            movePlayheadByKeyboard: event => this.#movePlayheadByKeyboard(event),
            seek: (clientX, settled) => this.#seek(clientX, settled),
            addPointerListeners: () => this.#addPointerListeners(),
            capturePointer: event => this.#capturePointer(event),
            handleWheel: event => this.#handleWheel(event),
            handleKeyDown: event => this.#handleKeyDown(event, true),
            handleRulerClick: event => this.#handleRulerClick(event),
            emit: (name, detail) => this.#emit(name, detail),
            setScrubPointerId: value => {
                this.#scrubPointerId = value
            },
            scaleWidth: () => this.#scaleWidth(),
            scaleOffset: () => this.#numericToken('scale-offset', START_LEFT),
        })
    }

    /**
     * Declare the attributes that are handled by the custom element itself.
     *
     * @returns {Array<string>} Observed attributes.
     */
    static get observedAttributes() {
        return ['data-widget-selectable']
    }

    /**
     * Apply the host interaction mode before React installs external gesture listeners.
     *
     * @param {string} name - Changed attribute name.
     * @param {string|null} previousValue - Previous attribute value.
     * @param {string|null} value - New attribute value.
     */
    attributeChangedCallback(name, previousValue, value) {
        if (name !== 'data-widget-selectable' || previousValue === value) return
        const config = {...this.#timelineConfig}
        if (value === null) delete config.hostInteraction
        else config.hostInteraction = 'selectable'
        if (!this.isConnected) {
            this.#timelineConfig = config
            return
        }
        this.timeline = config
    }

    /**
     * Render the component when it is attached to the document.
     */
    connectedCallback() {
        this.setAttribute('role', 'region')
        if (!this.getAttribute('aria-label')) this.setAttribute('aria-label', 'Timeline')
        this.#installInputPropagationBlockers()
        window.addEventListener('keydown', this.#handleWindowKeyDown, true)
        this.#render()
        this.setAttribute('data-ready', '')
    }

    /**
     * Check whether an input event belongs to an application-provided custom menu.
     *
     * Slotted controls own their input lifecycle and must remain interactive even
     * though the timeline keeps its internal surface events local to the host.
     *
     * @param {Event} event - Native input event.
     * @returns {boolean} Whether the event originated in the custom menu slot.
     */
    #isCustomMenuEvent = event => {
        const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : []
        return composedPath.some(target => target?.getAttribute?.('slot') === 'custom-menu')
    }

    /**
     * Resolve a stable key for one clip selection.
     *
     * @param {string|number|null} trackId - Track identifier.
     * @param {string|number|null} clipId - Clip identifier.
     * @returns {string} Selection key.
     */
    #clipSelectionKey = (trackId, clipId) => `${String(trackId ?? '')}\u0000${String(clipId ?? '')}`

    /**
     * Test whether a clip is the current selection.
     *
     * @param {Object} clip - Clip to inspect.
     * @returns {boolean} Whether the clip is selected.
     */
    #isClipSelected = clip => this.#selectedClipKey === this.#clipSelectionKey(clip?.trackId, clip?.id)

    /**
     * Update the selected state on rendered clips without rebuilding the timeline.
     */
    #updateClipSelectionPresentation = () => {
        this.#root.querySelectorAll('[data-clip-id]').forEach(element => {
            const selected = this.#selectedClipKey === this.#clipSelectionKey(
                element.getAttribute('data-clip-track-id'),
                element.getAttribute('data-clip-id'),
            )
            element.classList.toggle('lgs1920-wa-timeline__clip--selected', selected)
            element.setAttribute('aria-selected', selected ? 'true' : 'false')
        })
    }

    /**
     * Select a clip and keep the native pointer event inside the timeline.
     *
     * @param {Object} clip - Clip to select.
     * @param {Event} event - Triggering pointer or context-menu event.
     * @param {HTMLElement|null} element - Rendered clip element to focus.
     */
    #selectClip = (clip, event, element = null) => {
        const trackId = clip?.trackId ?? this.#rows.find(row => (row.actions ?? []).some(value => value.id === clip?.id))?.id
        if (trackId === undefined || clip?.id === undefined || clip?.id === null) return
        const previousSelectionKey = this.#selectedClipKey
        this.#selectedClipKey = this.#clipSelectionKey(trackId, clip.id)
        event?.stopPropagation?.()
        element?.focus?.({preventScroll: true})
        this.#updateClipSelectionPresentation()
        if (previousSelectionKey === this.#selectedClipKey) return
        this.#emit('clip-select', {
            selected: true,
            clipId: clip.id,
            trackId,
            clip: Object.assign({}, clip, {trackId}),
            event,
            data: this.#publicSnapshot(),
        })
    }

    /**
     * Clear the current clip selection and notify the host.
     *
     * @param {Event} event - Triggering pointer or keyboard event.
     * @returns {boolean} Whether a selection was cleared.
     */
    #clearClipSelection = event => {
        if (this.#selectedClipKey === null) return false
        const selectedKey = this.#selectedClipKey
        const entry = this.#rows
            .flatMap(row => (row.actions ?? []).map(clip => ({row, clip})))
            .find(({row, clip}) => selectedKey === this.#clipSelectionKey(row.id, clip.id))
        this.#selectedClipKey = null
        this.#updateClipSelectionPresentation()
        if (entry) {
            this.#emit('clip-select', {
                selected: false,
                clipId: entry.clip.id,
                trackId: entry.row.id,
                clip: Object.assign({}, entry.clip, {trackId: entry.row.id}),
                event,
                data: this.#publicSnapshot(),
            })
        }
        return true
    }

    /**
     * Clear a clip selection when pointer input lands outside every clip.
     *
     * @param {PointerEvent} event - Pointer event inside the timeline shadow root.
     */
    #handleClipSelectionPointerDown = event => {
        if (this.#selectedClipKey === null) return
        const path = event.composedPath?.() ?? []
        if (path.some(target => target?.closest?.('[data-clip-id]'))) return
        const menu = this.#root.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')
        if (menu && path.includes(menu)) return
        this.#clearClipSelection(event)
    }

    /**
     * Clear selection and context-menu state when their clips disappear.
     */
    #reconcileClipSelection = () => {
        const selectedClipExists = this.#selectedClipKey === null
            || [...this.#root.querySelectorAll('[data-clip-id]')].some(element => (
                this.#selectedClipKey === this.#clipSelectionKey(
                    element.getAttribute('data-clip-track-id'),
                    element.getAttribute('data-clip-id'),
                )
            ))
            || this.#rows.some(row => (row.actions ?? []).some(clip => (
                this.#selectedClipKey === this.#clipSelectionKey(row.id, clip.id)
            )))
        if (!selectedClipExists) this.#selectedClipKey = null
        if (this.#clipContextMenuClipId === null) return
        const menuEntry = this.#clipEditor.findClipEntry(this.#rows, this.#clipContextMenuClipId)
        if (menuEntry) return
        this.#clipContextMenuClipId = null
        this.#clipContextMenuAnchor = null
        window.removeEventListener('pointerdown', this.#handleClipContextMenuOutsidePointerDown, true)
    }

    /**
     * Check whether an input event originated from the split-panel divider.
     *
     * @param {Event} event - Native input event.
     * @returns {boolean} Whether the event belongs to the divider gesture.
     */
    #isSplitPanelDividerEvent = event => {
        const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : []
        return composedPath.some(target => (
            target instanceof Element
            && target.getAttribute('part')?.split(' ').includes('divider')
        ))
    }

    /**
     * Stop native pointing events at the Web Component host after internal
     * timeline listeners have handled them.
     *
     * @param {Event} event - Native pointing event.
     */
    #stopInputPropagation = event => {
        if (this.#isCustomMenuEvent(event)) return
        if (HOST_DRAG_START_EVENT_TYPES.includes(event.type)
            && this.#isSplitPanelDividerEvent(event)) {
            event.stopImmediatePropagation()
            return
        }
        if (allowsHostInteraction(this.#timelineConfig)
            && (HOST_DRAG_START_EVENT_TYPES.includes(event.type)
                || HOST_DRAG_CONTINUATION_EVENT_TYPES.includes(event.type)
                || event.type === 'click'
                || event.type === 'contextmenu'
                || event.type === 'dblclick'
                || event.type === 'drag'
                || event.type === 'dragend'
                || event.type === 'dragstart'
                || event.type === 'gotpointercapture'
                || event.type === 'lostpointercapture')) return
        if (event.type === 'keydown') {
            if (event.target?.closest?.(TIMELINE_KEYBOARD_EDITABLE_SELECTOR)) return
            if (!TIMELINE_KEYBOARD_KEYS.includes(event.key)) return
        }
        if (this.#nativeSplitPanelInteractionActive
            && EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES.includes(event.type)) return
        if (this.#externalInteractionActive
            && EXTERNAL_INTERACTION_CONTINUATION_EVENT_TYPES.includes(event.type)) return
        event.stopImmediatePropagation()
    }

    /**
     * Install the local input boundary once for the lifetime of the host.
     */
    #installInputPropagationBlockers = () => {
        if (this.#inputPropagationBlockersInstalled) return
        for (const eventType of TIMELINE_INPUT_EVENT_TYPES) {
            this.addEventListener(eventType, this.#stopInputPropagation)
            this.#root.addEventListener(eventType, this.#stopInputPropagation)
        }
        this.#root.addEventListener('pointerdown', this.#handleClipSelectionPointerDown, true)
        this.#inputPropagationBlockersInstalled = true
    }

    /**
     * Remove the local input boundary when the host leaves the document.
     */
    #removeInputPropagationBlockers = () => {
        if (!this.#inputPropagationBlockersInstalled) return
        for (const eventType of TIMELINE_INPUT_EVENT_TYPES) {
            this.removeEventListener(eventType, this.#stopInputPropagation)
            this.#root.removeEventListener(eventType, this.#stopInputPropagation)
        }
        this.#root.removeEventListener('pointerdown', this.#handleClipSelectionPointerDown, true)
        this.#inputPropagationBlockersInstalled = false
    }

    /**
     * Get the global timeline configuration.
     *
     * @returns {Object} Timeline configuration.
     */
    get timeline() {
        return {
            ...this.#timelineConfig,
            durationMillis: this.#durationMillis(),
            rangeStartMillis: this.#rangeStartMillis,
            rangeEndMillis: this.#rangeEndMillis,
        }
    }

    /**
     * Set the global timeline configuration.
     *
     * @param {Object} value - Timeline configuration.
     */
    set timeline(value) {
        const previousStructureConfig = this.#structureConfig(this.#timelineConfig, STRUCTURAL_CONFIG_KEYS)
        const config = value && typeof value === 'object' ? Object.assign({}, value) : {}
        const previousControlledDuration = Number(this.#timelineConfig.durationMillis
            ?? (Number(this.#timelineConfig.durationSeconds) * 1000)) || 0
        const requestedDuration = Number(config.durationMillis
            ?? (Number(config.durationSeconds) * 1000)) || 0
        const preserveLocalDuration = this.#localDurationDirty
            && requestedDuration === previousControlledDuration
        if (!this.#dragState && !preserveLocalDuration) this.#interactionDurationMillis = null
        if (!preserveLocalDuration) this.#localDurationDirty = false
        const requestedZoom = Number(config.zoomPercent)
        const applyControlledZoom = Number.isFinite(requestedZoom)
            && (this.#lastControlledZoomPercent === null || requestedZoom !== this.#lastControlledZoomPercent)
        this.#lastControlledZoomPercent = Number.isFinite(requestedZoom) ? requestedZoom : null
        this.#rangeEndFollowsDuration = !Number.isFinite(Number(config.rangeEndMillis))
        const {minimum, maximum, initial} = resolveLegendBounds(config)
        if (!Number.isFinite(this.#legendWidth)) this.#legendWidth = initial
        this.#timelineConfig = Object.assign({}, config, {
            legendMinWidth: minimum,
            legendMaxWidth: maximum,
            legendWidth: initial,
            swatches: config.swatches ?? config.colorSwatches ?? DEFAULT_TIMELINE_COLOR_SWATCHES,
        })
        this.toggleAttribute('data-keyboard-zoom-active', this.#timelineConfig.keyboardZoomActive === true)
        if (this.#timelineConfig.interactive === false || this.#timelineConfig.editable === false) {
            this.#menuOpen = false
            window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
            this.#editingRowId = null
            this.#editingLabelValue = ''
            this.#dragState = null
            this.#removePointerListeners()
            this.#stopAutoScroll()
        }
        this.#visible = this.#timelineConfig.visible !== false
        this.#syncPublicProps({
            zoomPercent: applyControlledZoom ? requestedZoom : undefined,
            forceRender: previousStructureConfig !== this.#structureConfig(this.#timelineConfig, STRUCTURAL_CONFIG_KEYS),
        })
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
     * Get the identifier of the selected clip.
     *
     * @returns {string|number|null} Selected clip identifier.
     */
    get selectedClipId() {
        if (this.#selectedClipKey === null) return null
        const separatorIndex = this.#selectedClipKey.indexOf('\u0000')
        return separatorIndex < 0 ? null : this.#selectedClipKey.slice(separatorIndex + 1)
    }

    /**
     * Select a clip by its identifier, or clear the selection.
     *
     * @param {string|number|null} value - Clip identifier.
     */
    set selectedClipId(value) {
        if (value === null || value === undefined) {
            this.#selectedClipKey = null
        } else {
            const entry = this.#clipEditor.findClipEntry(this.#rows, value)
            this.#selectedClipKey = entry ? this.#clipSelectionKey(entry.row.id, entry.clip.id) : null
        }
        this.#updateClipSelectionPresentation()
    }

    /**
     * Set the public track definitions.
     *
     * @param {Array} value - Track definitions.
     */
    set tracks(value) {
        if (!this.#localDurationDirty) this.#interactionDurationMillis = null
        const incoming = (Array.isArray(value) ? value : []).map(row => {
            const {actions, ...track} = row ?? {}
            return {...track, clips: normalizeClipLayout(track.clips ?? actions)}
        })
        const controlledRowsChanged = this.#rowSignature(incoming) !== this.#rowSignature(this.#trackDefinitions)
        const localPlacementChanged = this.#placementSignature(this.#rows) !== this.#placementSignature(this.#trackDefinitions)
        const baselineIds = this.#trackDefinitions.map(row => row.id)
        const incomingIds = incoming.map(row => row.id)
        const incomingUsesBaselineIds = incomingIds.length === baselineIds.length
            && incomingIds.every((id, index) => id === baselineIds[index])
        const preserveLocalRows = this.#localRowsDirty
            && (
                !controlledRowsChanged
                || (incomingUsesBaselineIds && localPlacementChanged
                    && this.#placementSignature(incoming) === this.#placementSignature(this.#rows))
            )
        if (!preserveLocalRows) {
            this.#localRowsDirty = false
            if (controlledRowsChanged) {
                this.#localDurationDirty = false
                this.#interactionDurationMillis = null
            }
        }
        this.#trackDefinitions = incoming
        const editedRow = this.#trackDefinitions.find(row => row.id === this.#editingRowId)
        if (editedRow && (editedRow.visible === false || editedRow.editable === false)) {
            window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
            this.#editingRowId = null
            this.#editingLabelValue = ''
        }
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
        this.#currentTimeMillis = this.#normalizeTime(value)
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
        this.#updatePlaybackButton()
    }

    /**
     * Get the clip insertion options.
     *
     * @returns {Array} Clip options.
     */
    get clipOptions() {
        return this.#clipOptions ? [...this.#clipOptions] : []
    }

    /**
     * Set the clip insertion options.
     *
     * @param {Array} value - Clip options.
     */
    set clipOptions(value) {
        this.#clipOptions = value === null || value === undefined
            ? null
            : (Array.isArray(value) ? value : [])
        if (this.isConnected) this.#render()
    }

    /**
     * Release observers, pointer listeners, and animation frames.
     */
    disconnectedCallback() {
        this.#cancelBuildingCompletion()
        this.#removeInputPropagationBlockers()
        window.removeEventListener('keydown', this.#handleWindowKeyDown, true)
        window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
        this.#resizeObserver?.disconnect()
        this.#removePointerListeners()
        this.#finishScrollbarDrag()
        this.#finishNativeSplitPanelInteraction()
        this.#externalInteractionActive = false
        this.#scrollbarsInteractionActive = false
        this.#clearScrollbarHideTimer()
        this.#clearClipSnapGuide()
        this.#stopAutoScroll()
        this.#cancelClipCopy()
        this.#closeClipContextMenu()
    }

    /**
     * Open the contextual menu for an editable clip at the pointer position.
     *
     * @param {Object} clip - Clip receiving the context action.
     * @param {PointerEvent|MouseEvent} event - Context-menu event.
     */
    #openClipContextMenu = (clip, event) => {
        if (this.#timelineConfig.editable === false || clip?.editable === false) return
        if (this.#dragState?.type === 'clip') {
            const state = this.#dragState
            this.#pointerUp({
                type: 'pointercancel',
                pointerId: state.pointerId,
                clientX: state.startX,
                clientY: state.startY,
            })
        }
        this.#selectClip(clip, event, event?.currentTarget)
        const rect = {
            x: Number(event.clientX) || 0,
            y: Number(event.clientY) || 0,
            width: 0,
            height: 0,
            top: Number(event.clientY) || 0,
            right: Number(event.clientX) || 0,
            bottom: Number(event.clientY) || 0,
            left: Number(event.clientX) || 0,
        }
        this.#clipContextMenuClipId = clip.id
        this.#clipContextMenuAnchor = {
            getBoundingClientRect: () => rect,
        }
        window.addEventListener('pointerdown', this.#handleClipContextMenuOutsidePointerDown, true)
        this.#render()
    }

    /**
     * Resolve custom actions configured for the clip context menu.
     *
     * @returns {Array} Valid custom clip actions.
     */
    #resolvedClipActions = () => {
        const configured = this.#timelineConfig.clipActions
            ?? this.#timelineConfig.clipContextMenuActions
        return (Array.isArray(configured) ? configured : [])
            .filter(action => action && typeof action === 'object' && String(action.key ?? '').trim() && String(action.label ?? '').trim())
            .map(action => ({
                ...action,
                key: String(action.key).trim(),
                label: String(action.label).trim(),
            }))
    }

    /**
     * Resolve a safe DOM identifier for a custom menu action.
     *
     * @param {string} key - Action key.
     * @returns {string} Safe identifier.
     */
    #clipActionKey = key => String(key).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')

    /**
     * Emit a configured custom action for the selected clip.
     *
     * @param {string} clipId - Clip identifier.
     * @param {Object} action - Configured action.
     * @param {Event} event - Triggering menu event.
     */
    #runClipAction = (clipId, action, event) => {
        if (action?.disabled === true || this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        event?.preventDefault?.()
        event?.stopPropagation?.()
        const detail = {
            action,
            key: action.key,
            clipId,
            trackId: entry.row.id,
            clip: Object.assign({}, entry.clip, {trackId: entry.row.id}),
            tracks: this.tracks,
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('clip-action', detail).defaultPrevented) return
        this.#emit('clip-action', detail)
        this.#emitAfter('clip-action', detail)
    }

    /**
     * Close the clip contextual menu and remove its outside-pointer listener.
     *
     * @param {Object} [options={}] - Close behavior options.
     * @param {boolean} [options.render=true] - Whether to rebuild the timeline.
     */
    #closeClipContextMenu = ({render = true} = {}) => {
        this.#clipContextMenuClipId = null
        this.#clipContextMenuAnchor = null
        window.removeEventListener('pointerdown', this.#handleClipContextMenuOutsidePointerDown, true)
        if (render && this.isConnected && this.#menuOpen === false) this.#render()
        if (!render) this.#root.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')?.remove()
    }

    /**
     * Close the clip contextual menu when a pointer is pressed outside it.
     *
     * @param {PointerEvent} event - Pointer event to inspect.
     */
    #handleClipContextMenuOutsidePointerDown = event => {
        const path = event.composedPath?.() ?? []
        const menu = this.#root.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')
        if (menu && path.includes(menu)) return
        this.#closeClipContextMenu()
    }

    /**
     * Synchronize the public properties with the internal editor projection.
     */
    #syncPublicProps = ({zoomPercent, forceRender = false} = {}) => {
        const durationMillis = Number(this.#timelineConfig.durationMillis
            ?? (Number(this.#timelineConfig.durationSeconds) * 1000)) || 0
        const sourceTracks = this.#localRowsDirty
            ? this.#rows.map(row => this.#publicTrack(row))
            : this.#trackDefinitions
        const editorData = sourceTracks.map(track => ({
            ...track,
            actions: track.clips ?? [],
        }))
        this.#applyState({
            projection: {...this.#timelineConfig, durationMillis, durationSeconds: durationMillis / 1000, editorData},
            currentTimeMillis: this.#currentTimeMillis,
            playing: this.#playing,
            visible: this.#visible,
            clipOptions: this.#clipOptions,
            zoomPercent,
            forceRender,
            rangeStartMillis: this.#timelineConfig.rangeStartMillis,
            rangeEndMillis: this.#localDurationDirty
                ? this.#rangeEndMillis
                : (this.#timelineConfig.rangeEndMillis ?? durationMillis),
        })
    }

    /**
     * Apply normalized controlled state to internal presentation state.
     *
     * @param {Object} state - Normalized timeline state.
     */
    #applyState = (state = {}) => {
        if (this.#dragState?.type === 'clip') {
            const pendingState = Object.assign({}, this.#pendingControlledState, state)
            pendingState.forceRender = Boolean(this.#pendingControlledState?.forceRender || state.forceRender)
            this.#pendingControlledState = pendingState
            return
        }
        const nextProjection = state.projection ?? null
        const incomingRows = state.editorData ?? nextProjection?.editorData ?? state.rows ?? []
        const sourceRows = this.#trackDefinitions.map(row => ({
            ...row,
            actions: row.clips ?? [],
        }))
        const preserveLocalRows = this.#localRowsDirty
            && (
                this.#rowSignature(incomingRows) === this.#rowSignature(sourceRows)
                || this.#rowSignature(incomingRows) === this.#rowSignature(this.#rows)
            )
        const nextRows = preserveLocalRows ? this.#rows : incomingRows
        const patchInPlace = state.forceRender !== true && this.#canPatchControlledState(nextProjection, nextRows, state)
        this.#projection = nextProjection
        this.#rows = nextRows
        this.#playing = state.playing === true
        this.#visible = state.visible !== false
        this.#clipOptions = state.clipOptions === null || state.clipOptions === undefined
            ? null
            : (Array.isArray(state.clipOptions) ? state.clipOptions : [])
        if (nextProjection?.horizontalFit === true) {
            this.#horizontalFitActive = true
        }
        else if (Number.isFinite(Number(state.zoomPercent))) {
            this.#horizontalFitActive = false
            this.#zoom = this.#clampHorizontalZoom(state.zoomPercent)
        }
        const projectionDurationMillis = Number(this.#projection?.durationMillis) || 0
        const durationMillis = this.#localDurationDirty && Number.isFinite(this.#interactionDurationMillis)
            ? Math.max(projectionDurationMillis, this.#interactionDurationMillis)
            : projectionDurationMillis
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
        this.#currentTimeMillis = this.#normalizeTime(state.currentTimeMillis ?? 0)
        if (patchInPlace) this.#updateClipInteractionPresentation()
        else this.#render()
    }

    /**
     * Check whether controlled clip data can update the existing DOM in place.
     *
     * @param {Object|null} projection - Next normalized projection.
     * @param {Array} rows - Next editor rows.
     * @param {Object} state - Other controlled values that may require a full render.
     * @returns {boolean} Whether a full structure render is unnecessary.
     */
    #canPatchControlledState = (projection, rows, state) => {
        if (!this.#surface || !this.#tracksViewport || !projection) return false
        const currentDuration = Number(this.#projection?.durationMillis) || 0
        const nextDuration = Number(projection.durationMillis) || 0
        if (currentDuration !== nextDuration) return false
        if (state.visible !== undefined && state.visible !== this.#visible) return false
        if (state.playing !== undefined && state.playing !== this.#playing) return false
        if (Number.isFinite(Number(state.zoomPercent))) return false
        if (JSON.stringify(this.#clipOptions) !== JSON.stringify(state.clipOptions ?? null)) return false

        const shape = value => {
            const stable = Object.assign({}, value)
            delete stable.start
            delete stable.end
            delete stable.duration
            delete stable.startMillis
            delete stable.endMillis
            delete stable.durationMillis
            return stable
        }
        const rowShape = row => {
            const {actions, clips, ...stable} = row ?? {}
            return {
                stable,
                actions: (actions ?? clips ?? []).map(action => shape(action)),
            }
        }
        return JSON.stringify(this.#rows.map(rowShape)) === JSON.stringify(rows.map(rowShape))
    }

    /**
     * Serialize the configuration fields that determine the rendered structure.
     *
     * @param {Object} config - Timeline configuration.
     * @param {Array<string>} keys - Structure-affecting field names.
     * @returns {string} Stable structure signature.
     */
    #structureConfig = (config, keys) => JSON.stringify(keys.map(key => [key, config?.[key]]))

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
        this.#horizontalFitActive = false
        this.#zoom = this.#clampHorizontalZoom(zoomPercent)
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
        this.#refreshLayoutMetrics()
    }

    /**
     * Convert an internal row to the public track shape.
     *
     * @param {Object} row - Internal timeline row.
     * @returns {Object} Public track definition.
     */
    #publicTrack = row => {
        const track = Object.assign({}, row)
        const actions = track.actions ?? []
        delete track.actions
        delete track.locked
        delete track.movable
        delete track.fixed
        const clips = actions.map(clip => {
            const publicClip = Object.assign({}, clip)
            delete publicClip.movable
            delete publicClip.fixed
            return publicClip
        })
        return Object.assign({}, track, {clips})
    }

    /**
     * Resolve whether a track can be edited by the current timeline.
     *
     * @param {Object|null} row - Track row.
     * @returns {boolean} Whether track editing is enabled.
     */
    #isTrackEditable = row => this.#timelineConfig.editable !== false && row?.editable !== false

    /**
     * Resolve the allowed insertion interval between read-only track bounds.
     *
     * Rows are rendered from top to bottom. A single read-only row acts as a
     * boundary on the side where it is placed; two or more read-only rows
     * delimit the editable interval between the highest and lowest bounds.
     *
     * @param {Array} rows - Rows in rendered order.
     * @returns {{minimum: number, maximum: number}|null} Allowed insertion interval.
     */
    #trackInsertionBounds = rows => {
        const lockedIndexes = rows
            .map((row, index) => row.editable === false ? index : null)
            .filter(index => index !== null)
        if (lockedIndexes.length === 0) return {minimum: 0, maximum: rows.length}
        if (lockedIndexes.length === 1) {
            const boundary = lockedIndexes[0]
            return boundary === rows.length - 1
                ? {minimum: 0, maximum: boundary}
                : {minimum: boundary + 1, maximum: rows.length}
        }
        const highestLock = Math.min(...lockedIndexes)
        const lowestLock = Math.max(...lockedIndexes)
        if (lowestLock - highestLock <= 1) return null
        return {minimum: highestLock + 1, maximum: lowestLock}
    }

    /**
     * Resolve whether an insertion index is not directly between two read-only rows.
     *
     * @param {Array} rows - Rows in rendered order.
     * @param {number} index - Candidate insertion index.
     * @returns {boolean} Whether the insertion index is allowed.
     */
    #isTrackInsertionAllowed = (rows, index) => {
        const bounds = this.#trackInsertionBounds(rows)
        if (!bounds || index < bounds.minimum || index > bounds.maximum) return false
        return !(rows[index - 1]?.editable === false && rows[index]?.editable === false)
    }

    /**
     * Resolve the highest available insertion position for a new track.
     *
     * @param {Array} rows - Rows in rendered order.
     * @returns {number|null} Insertion index or null when no position exists.
     */
    #trackInsertionIndex = rows => {
        const bounds = this.#trackInsertionBounds(rows)
        if (!bounds) return null
        for (let index = bounds.minimum; index <= bounds.maximum; index += 1) {
            if (this.#isTrackInsertionAllowed(rows, index)) return index
        }
        return null
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
            rangeStartMillis: this.#rangeStartMillis,
            rangeEndMillis: this.#rangeEndMillis,
        },
        tracks: this.#rows.map(row => this.#publicTrack(row)),
    })

    /**
     * Cancel an active track-label edit when the pointer is outside its input.
     *
     * @param {PointerEvent} event - Pointer event to inspect.
     */
    #handleTrackLabelOutsidePointerDown = event => {
        if (this.#editingRowId === null) return
        const editingRowId = String(this.#editingRowId)
        const path = event.composedPath?.() ?? []
        if (path.some(target => String(target?.getAttribute?.('data-edit-row-id') ?? '') === editingRowId)) return
        this.#cancelTrackLabelEdit()
    }

    /**
     * Start editing one track label.
     *
     * @param {Object} row - Track row to edit.
     */
    #beginTrackLabelEdit = row => {
        if (!this.#isTrackEditable(row)) return
        this.#editingRowId = row.id
        this.#editingLabelValue = resolveRowLabel(row)
        this.#render()
        window.addEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
        const input = [...this.#root.querySelectorAll('[data-edit-row-id]')]
            .find(element => element.getAttribute('data-edit-row-id') === String(row.id))
        input?.focus?.()
    }

    /**
     * Commit the active track label edit and emit a serializable change event.
     *
     * @param {Event} event - Triggering input event.
     */
    #commitTrackLabelEdit = event => {
        if (this.#editingRowId === null) return
        if (this.#timelineConfig.editable === false) return this.#cancelTrackLabelEdit()
        const row = this.#rows.find(value => value.id === this.#editingRowId)
        if (!row) return this.#cancelTrackLabelEdit()
        const previousLabel = resolveRowLabel(row)
        const label = this.#editingLabelValue.trim() || previousLabel
        const rowId = this.#editingRowId
        const nextRows = this.#rows.map(value => value.id === rowId ? {...value, label} : value)
        const detail = {
            trackId: rowId,
            label,
            previousLabel,
            tracks: nextRows.map(value => this.#publicTrack(value)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        const request = this.#emitBefore('track-label-change', detail)
        if (request.defaultPrevented) return
        this.#rows = nextRows
        this.#localRowsDirty = true
        window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
        this.#editingRowId = null
        this.#editingLabelValue = ''
        this.#emit('track-label-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('track-label-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Cancel the active track label edit.
     */
    #cancelTrackLabelEdit = () => {
        window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
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
     * Resolve the lowest zoom that fits the complete timeline in the surface.
     *
     * @returns {number} Container-dependent minimum zoom percentage.
     */
    #minimumHorizontalZoom = () => {
        const durationSeconds = this.#durationSeconds()
        const surfaceWidth = this.#surface?.clientWidth || this.#surfaceWidth
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const endPadding = this.#numericToken('end-padding', END_PADDING)
        const baseScaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const availableWidth = Number(surfaceWidth) - scaleOffset - endPadding
        if (durationSeconds <= 0 || !Number.isFinite(availableWidth) || availableWidth <= 0) return MIN_ZOOM
        const minimumFactor = availableWidth / (durationSeconds * baseScaleWidth)
        const minimumZoom = Number(((minimumFactor - 1) * 100).toFixed(6))
        return Math.max(MIN_ZOOM, Math.min(0, minimumZoom))
    }

    /**
     * Clamp a horizontal zoom against the current container-dependent bound.
     *
     * @param {number} zoomPercent - Requested horizontal zoom percentage.
     * @returns {number} Clamped horizontal zoom percentage.
     */
    #clampHorizontalZoom = zoomPercent => clamp(Number(zoomPercent) || 0, this.#minimumHorizontalZoom(), MAX_ZOOM)

    /**
     * Resolve the pixel width of one major ruler interval at the current zoom.
     *
     * @returns {number} Pixel width of one major ruler interval.
     */
    #scaleWidth = () => {
        const {majorSeconds} = resolveScale(this.#zoom)
        const baseScaleWidth = this.#numericToken('scale-width', SCALE_WIDTH)
        const zoomFactor = (100 + this.#zoom) / 100
        return baseScaleWidth * zoomFactor * majorSeconds
    }

    /**
     * Resolve the number of major ruler intervals required by the current duration.
     *
     * @param {number} durationSeconds - Duration represented by the timeline.
     * @param {number} majorSeconds - Seconds represented by one major interval.
     * @param {number} scaleWidth - Pixel width of one major interval.
     * @returns {number} Number of major ruler intervals.
     */
    #scaleCountForDuration = (durationSeconds, majorSeconds, scaleWidth) => Math.max(
        1,
        Math.ceil(Math.max(durationSeconds, this.#numericToken('min-visible-duration', MIN_VISIBLE_DURATION_SECONDS)) / majorSeconds),
        Math.ceil(Math.max(0, this.#surfaceWidth) / scaleWidth),
    )

    /**
     * Resolve the rendered width required by the current duration.
     *
     * @param {number} durationSeconds - Duration represented by the timeline.
     * @param {number} majorSeconds - Seconds represented by one major interval.
     * @param {number} scaleWidth - Pixel width of one major interval.
     * @returns {number} Required timeline content width in pixels.
     */
    #contentWidthForDuration = (durationSeconds, majorSeconds, scaleWidth) => {
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const endPadding = this.#numericToken('end-padding', END_PADDING)
        const minimumDuration = this.#numericToken('min-visible-duration', MIN_VISIBLE_DURATION_SECONDS)
        return Math.max(
            this.#surfaceWidth,
            scaleOffset + ((Math.max(durationSeconds, minimumDuration) / majorSeconds) * scaleWidth) + endPadding,
        )
    }

    /**
     * Update duration-dependent geometry without rebuilding stable timeline DOM.
     *
     * The ruler units are added or removed in place while the scroll surfaces
     * and tracks receive their new width immediately. An extending clip
     * therefore remains fully visible during a resize or move preview.
     */
    #refreshDurationGeometry = () => {
        if (!this.#projection || !this.#surface) return
        const {majorSeconds, scaleSplitCount} = resolveScale(this.#zoom)
        const durationSeconds = this.#durationSeconds()
        const scaleWidth = this.#scaleWidth()
        const nextScaleCount = this.#scaleCountForDuration(durationSeconds, majorSeconds, scaleWidth)
        this.#contentWidth = Math.max(this.#clipWorkspaceWidth, this.#contentWidthForDuration(durationSeconds, majorSeconds, scaleWidth))
        const widthSelectors = ['[part="canvas"]', '[part="ruler"]', '[part="tracks-viewport"]', '[part="tracks"]']
        widthSelectors.forEach(selector => {
            const element = this.#root.querySelector(selector)
            if (element) element.style.width = `${this.#contentWidth}px`
        })
        this.#renderer.updateRulerDuration(
            this.#root.querySelector('[part="ruler"]'),
            nextScaleCount,
            majorSeconds,
            scaleSplitCount,
        )
        this.#updateDynamicState()
        this.#updateScrollbars()
    }

    /**
     * Normalize a time to the controlled projection duration.
     *
     * @param {number} timeMillis - Requested time in milliseconds.
     * @returns {number} Clamped time in milliseconds.
     */
    #normalizeTime = timeMillis => {
        const maximum = Number.isFinite(this.#rangeEndMillis) ? this.#rangeEndMillis : this.#durationMillis()
        return clamp(Number(timeMillis) || 0, this.#rangeStartMillis, Math.max(this.#rangeStartMillis, maximum))
    }

    /**
     * Keep the main playhead inside the selected range without moving it when
     * a range boundary changes around its current position.
     */
    #clampCurrentTimeToRange = () => {
        const minimum = this.#rangeStartMillis
        const maximum = Math.max(minimum, this.#rangeEndMillis)
        if (this.#currentTimeMillis < minimum) this.#currentTimeMillis = minimum
        if (this.#currentTimeMillis > maximum) this.#currentTimeMillis = maximum
    }

    /**
     * Render the empty or active component state.
     */
    #render = () => {
        this.#reconcileClipSelection()
        if (!this.#visible || !this.#projection) {
            this.#cancelBuildingCompletion()
            this.#building = this.#visible
                && !this.#initialBuildComplete
                && this.#timelineConfig.showBuildingOverlay !== false
            // Keep the host in the layout while the initial projection is pending so
            // the opaque construction overlay can cover the first incomplete frame.
            this.hidden = !this.#building && (!this.#visible || !this.#projection)
            this.#finishScrollbarDrag()
            this.#externalInteractionActive = false
            this.#scrollbarsInteractionActive = false
            this.#clearScrollbarHideTimer()
            const initialOverlay = this.#building
                ? this.#root.querySelector('[data-building-overlay]') ?? this.#buildingOverlay()
                : null
            this.#root.replaceChildren(
                this.#root.querySelector('style'),
                ...(initialOverlay ? [initialOverlay] : []),
            )
            this.#surface = null
            this.#tracksViewport = null
            return
        }

        const initialOverlayEnabled = this.#timelineConfig.showBuildingOverlay !== false
        if (!this.#initialBuildComplete && initialOverlayEnabled) {
            // A copy preview rerenders the timeline while the initial layout is
            // settling. Keep that completion alive so the preview cannot reset
            // the construction overlay.
            if (!this.#building) this.#startBuilding()
        }
        else {
            this.#cancelBuildingCompletion()
            this.#building = false
        }
        this.hidden = false
        const {minimum: legendMinimum, maximum: legendMaximum, initial: legendInitial} = resolveLegendBounds(this.#timelineConfig)
        if (!Number.isFinite(this.#legendWidth)) this.#legendWidth = legendInitial
        const previousScrollLeft = this.#surface?.scrollLeft ?? 0
        const previousSurfaceRect = this.#surface?.getBoundingClientRect?.()
        const previousAnchorTimeSeconds = previousSurfaceRect
            ? this.#timeAtClientX(previousSurfaceRect.left)
            : null
        const previousScrollTop = this.#tracksViewport?.scrollTop ?? 0
        this.#finishScrollbarDrag()
        this.#zoom = this.#horizontalFitActive
            ? this.#minimumHorizontalZoom()
            : this.#clampHorizontalZoom(this.#zoom)
        const {majorSeconds, scaleSplitCount} = resolveScale(this.#zoom)
        const durationSeconds = this.#durationSeconds()
        const scaleWidth = this.#scaleWidth()
        const scaleCount = this.#scaleCountForDuration(durationSeconds, majorSeconds, scaleWidth)
        this.#contentWidth = Math.max(this.#clipWorkspaceWidth, this.#contentWidthForDuration(durationSeconds, majorSeconds, scaleWidth))
        this.#rowHeight = this.#resolveRowHeight()
        const structure = this.#structure(scaleCount, majorSeconds, scaleSplitCount)
        this.#reuseSplitPanel(structure)
        const initialOverlay = this.#building
            ? this.#root.querySelector('[data-building-overlay]') ?? this.#buildingOverlay()
            : null
        this.#root.replaceChildren(
            this.#root.querySelector('style'),
            structure,
            ...(initialOverlay ? [initialOverlay] : []),
        )
        this.#applyLegendWidth(this.#root.querySelector('[part="split-panel"]'), {
            minimum: legendMinimum,
            maximum: legendMaximum,
            preferred: this.#legendWidth ?? legendInitial,
        })
        this.#surface = this.#root.querySelector('[data-surface]')
        this.#tracksViewport = this.#root.querySelector('[data-tracks-viewport]')
        const measuredSurfaceWidth = this.#surface?.clientWidth ?? 0
        const surfaceWidthChanged = measuredSurfaceWidth > 0 && measuredSurfaceWidth !== this.#surfaceWidth
        if (surfaceWidthChanged) this.#surfaceWidth = measuredSurfaceWidth
        if (surfaceWidthChanged) {
            this.#render()
            return
        }
        if (this.#surface) {
            // Preserve the time at the viewport edge, even when a duration
            // change causes the ruler scale or content width to be rebuilt.
            const maximumScrollLeft = Math.max(
                0,
                Math.max(this.#surface.scrollWidth, this.#contentWidth)
                    - (this.#surface.clientWidth || 0),
            )
            if (Number.isFinite(previousAnchorTimeSeconds)) {
                this.#surface.scrollLeft = clamp(
                    (previousAnchorTimeSeconds / majorSeconds) * scaleWidth,
                    0,
                    maximumScrollLeft,
                )
            } else {
                this.#surface.scrollLeft = clamp(previousScrollLeft, 0, maximumScrollLeft)
            }
        }
        this.#updateTimelineViewportMargins(this.#surface)
        if (this.#tracksViewport) {
            this.#tracksViewport.scrollTop = previousScrollTop
        }
        this.#positionRowDragGhost()
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
        this.#updateClipSelectionPresentation()
        this.#updateClipCopyPresentation()
        this.#scheduleClipCopyPresentation()
        this.#updateClipSnapGuidePresentation()
        if (!this.#initialBuildComplete && this.isConnected) {
            if (initialOverlayEnabled) this.#scheduleBuildingCompletion()
            else this.#initialBuildComplete = true
        }
    }

    /**
     * Keep the construction overlay visible until the initial mount settles.
     *
     * @returns {void}
     */
    #startBuilding = () => {
        this.#cancelBuildingCompletion()
        this.#building = true
        this.#buildingLayoutSignature = null
    }

    /**
     * Capture the measurable layout state used to release the building overlay.
     *
     * @returns {string} Stable layout signature.
     */
    #buildingLayout = () => {
        const surface = this.#surface
        const canvas = this.#root.querySelector('[part="canvas"]')
        const tracks = this.#root.querySelector('[part="tracks"]')
        const surfaceRect = surface?.getBoundingClientRect?.() ?? {}
        const canvasRect = canvas?.getBoundingClientRect?.() ?? {}
        return [
            surface?.clientWidth ?? 0,
            surface?.clientHeight ?? 0,
            surface?.scrollWidth ?? 0,
            surfaceRect.width ?? 0,
            surfaceRect.height ?? 0,
            canvas?.style.width ?? '',
            canvasRect.width ?? 0,
            canvasRect.height ?? 0,
            tracks?.style.width ?? '',
        ].join('|')
    }

    /**
     * Remove the construction overlay after the rendered timeline has settled.
     *
     * @returns {void}
     */
    #scheduleBuildingCompletion = () => {
        if (this.#clipCopyState && this.#buildingFrame !== null) return
        const complete = () => {
            this.#buildingFrame = null
            const surfaceWidth = this.#surface?.clientWidth ?? 0
            const layoutMeasured = this.#surfaceWidth > 0 || surfaceWidth > 0
            const layoutSignature = this.#buildingLayout()
            const layoutStable = layoutSignature === this.#buildingLayoutSignature
            if (typeof requestAnimationFrame === 'function'
                && typeof ResizeObserver !== 'undefined'
                && this.#projection
                && (!layoutMeasured || !layoutStable)) {
                this.#buildingLayoutSignature = layoutSignature
                this.#buildingFrame = requestAnimationFrame(() => {
                    this.#buildingFrame = requestAnimationFrame(complete)
                })
                return
            }
            this.#building = false
            this.#initialBuildComplete = true
            this.#buildingLayoutSignature = null
            this.#root.querySelector('[data-building-overlay]')?.remove()
            this.#root.querySelector('[data-building]')?.removeAttribute('data-building')
        }
        if (typeof requestAnimationFrame !== 'function') {
            complete()
            return
        }
        this.#buildingFrame = requestAnimationFrame(() => {
            this.#buildingFrame = requestAnimationFrame(complete)
        })
    }

    /**
     * Cancel a pending construction-overlay completion.
     *
     * @returns {void}
     */
    #cancelBuildingCompletion = () => {
        if (this.#buildingFrame === null) return
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.#buildingFrame)
        this.#buildingFrame = null
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
        const naturalRowHeight = Math.max(minimumRowHeight, Math.floor(available / Math.max(1, this.#rows.length)))
        const requestedRowHeight = Number.isFinite(this.#verticalZoomRowHeight)
            ? this.#verticalZoomRowHeight
            : naturalRowHeight
        return clamp(requestedRowHeight, minimumRowHeight, MAX_ROW_HEIGHT)
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
        const section = createElement('wa-card', 'lgs1920-wa-timeline', {
            part: 'timeline',
            'data-testid': 'lgs1920-wa-timeline',
            'aria-label': this.getAttribute('aria-label') || 'Video timeline tracks',
            appearance: 'plain',
        })
        if (this.#building) section.setAttribute('data-building', '')
        section.append(createElement('slot', 'lgs1920-wa-timeline__additional-content-slot', {name: 'additional-content'}), this.#slotRegistry())

        const top = createElement('div', 'lgs1920-wa-timeline__top', {part: 'top'})
        const header = createElement('header', 'lgs1920-wa-timeline__header', {part: 'header'})
        const headerStart = createElement('span', 'lgs1920-wa-timeline__header-start', {part: 'header-start'})
        const headerActions = createElement('span', 'lgs1920-wa-timeline__header-actions', {part: 'header-actions'})
        headerActions.append(
            createElement('slot', '', {name: 'timeline-actions'}),
            createElement('slot', '', {name: 'header-actions'}),
        )
        headerStart.append(this.#timelineTools(), createElement('slot', '', {name: 'header'}), headerActions)
        header.append(
            headerStart,
            createElement('slot', 'lgs1920-wa-timeline__custom-menu', {
                name: 'custom-menu',
                part: 'custom-menu',
            }),
        )
        const playbackControls = this.#playbackControls()
        if (playbackControls) header.append(playbackControls)
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
        })
        layout.style.setProperty('--lgs-timeline-row-height', `${this.#rowHeight}px`)
        layout.append(this.#splitPanel(scaleCount, majorSeconds, scaleSplitCount))
        section.append(layout)
        const clipContextMenu = this.#clipContextMenu()
        if (clipContextMenu) section.append(clipContextMenu)
        section.append(createElement('slot', '', {name: 'footer'}))
        return section
    }

    /**
     * Create the opaque overlay shown while the timeline is being constructed.
     *
     * @returns {HTMLElement} Construction overlay.
     */
    #buildingOverlay = () => {
        const icon = createIcon('paintbrush', 'solid')
        icon.setAttribute('animation', 'wag')
        icon.setAttribute('aria-hidden', 'true')
        icon.setAttribute('role', 'presentation')
        const label = createElement('span', 'lgs1920-wa-timeline__building-overlay-text', {
            part: 'building-overlay-text',
        })
        label.append(this.#slotWithFallback('overlay-text', document.createTextNode('Building...')))
        const overlay = createElement('div', 'lgs1920-wa-timeline__building-overlay', {
            part: 'building-overlay',
            'data-building-overlay': '',
            role: 'status',
            'aria-live': 'polite',
        })
        overlay.append(icon, label)
        return overlay
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
        })
        splitPanel.style.setProperty('--min', `${minimum}px`)
        splitPanel.style.setProperty('--max', `min(${maximum}px, calc(100% - ${minimum}px))`)
        splitPanel.style.setProperty('--divider-width', 'var(--lgs-timeline-resizer-width)')
        splitPanel.style.setProperty('--divider-hit-area', 'var(--lgs-timeline-resizer-hit-area)')
        splitPanel.addEventListener('mousedown', this.#startNativeSplitPanelInteraction)
        splitPanel.addEventListener('touchstart', this.#startNativeSplitPanelInteraction)
        splitPanel.addEventListener('wa-reposition', this.#handleSplitPanelReposition)

        const legend = this.#legend()
        legend.slot = 'start'
        const surface = this.#surfaceElement(scaleCount, majorSeconds, scaleSplitCount)
        surface.slot = 'end'
        splitPanel.append(legend, surface)
        return splitPanel
    }

    /**
     * Apply the title panel width after the split panel has entered the DOM.
     *
     * Web Awesome resolves pixel positions against its measured panel size.
     * Applying the initial width before connection can therefore resolve to the
     * lower CSS bound. A second frame also covers the first real layout pass.
     *
     * @param {HTMLElement|null} splitPanel - Native split panel element.
     * @param {{minimum: number, maximum: number, preferred: number}} bounds - Width bounds.
     * @returns {void}
     */
    #applyLegendWidth = (splitPanel, {minimum, maximum, preferred}) => {
        if (!splitPanel) return
        const requested = clamp(Number(preferred) || 0, minimum, maximum)
        this.#legendWidth = requested
        splitPanel.positionInPixels = requested
        const applyMeasuredWidth = () => {
            if (!splitPanel.isConnected || this.#legendWidth !== requested) return
            const panelWidth = splitPanel.getBoundingClientRect?.().width ?? 0
            if (!Number.isFinite(panelWidth) || panelWidth <= 0) return
            const measuredMaximum = Math.max(minimum, Math.min(maximum, panelWidth - minimum))
            const resolved = clamp(requested, minimum, measuredMaximum)
            splitPanel.positionInPixels = resolved
        }
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                applyMeasuredWidth()
                requestAnimationFrame(applyMeasuredWidth)
            })
        }
    }

    /**
     * Create the Web Awesome video timeline playback controls.
     *
     * @returns {HTMLElement|null} Transport toolbar, or null for display-only timelines.
     */
    #playbackControls = () => {
        if (this.#timelineConfig.interactive === false) return null
        const controls = createElement('div', 'lgs1920-wa-timeline__transport lgs-widget-no-drag', {
            part: 'transport',
            'aria-label': 'Timeline transport controls',
        })
        const transportButtons = createElement('div', 'lgs1920-wa-timeline__transport-buttons', {
            label: 'Timeline transport controls',
            part: 'controls',
            role: 'toolbar',
            'aria-label': 'Timeline transport controls',
        })
        const start = this.#button({
            iconName: 'backward-step',
            label: 'Go to timeline start',
            testId: 'timeline-restart',
            iconSlot: 'start-icon',
            variant: 'brand',
            appearance: 'plain',
            disabled: this.#isAtRangeStart(),
        })
        start.addEventListener('click', event => {
            if (start.hasAttribute('disabled')) return
            this.#emitAction('restart', this.#positionDetail({
                source: 'go-to-start',
                timeMillis: this.#rangeStartMillis,
                event,
            }))
        })
        const previous = this.#button({
            iconName: 'chevron-left',
            label: 'Previous frame',
            testId: 'timeline-previous-frame',
            iconSlot: 'previous-frame-icon',
            variant: 'brand',
            appearance: 'plain',
            disabled: this.#isAtRangeStart(),
        })
        previous.addEventListener('click', event => {
            if (previous.hasAttribute('disabled')) return
            this.#emitAction('seek', this.#frameStepDetail(-1, event))
        })
        const play = this.#button({
            iconName: this.#playing ? 'pause' : 'play',
            label: this.#playing ? 'Pause timeline' : 'Play timeline',
            testId: 'timeline-play',
            iconSlot: this.#playing ? 'pause-icon' : 'play-icon',
            variant: 'brand',
            appearance: 'plain',
        })
        play.addEventListener('click', event => this.#emitAction(this.#playing ? 'pause' : 'play', {
            source: this.#playing ? 'timeline-pause' : 'timeline-play',
            timeMillis: this.#currentTimeMillis,
            event,
        }))
        const stop = this.#button({
            iconName: 'stop',
            label: 'Stop timeline',
            testId: 'timeline-stop',
            iconSlot: 'stop-icon',
            variant: 'brand',
            appearance: 'plain',
        })
        stop.addEventListener('click', event => this.#emitAction('stop', {
            source: 'timeline-stop',
            timeMillis: this.#currentTimeMillis,
            event,
        }))
        const next = this.#button({
            iconName: 'chevron-right',
            label: 'Next frame',
            testId: 'timeline-next-frame',
            iconSlot: 'next-frame-icon',
            variant: 'brand',
            appearance: 'plain',
            disabled: this.#isAtRangeEnd(),
        })
        next.addEventListener('click', event => {
            if (next.hasAttribute('disabled')) return
            this.#emitAction('seek', this.#frameStepDetail(1, event))
        })
        const end = this.#button({
            iconName: 'forward-step',
            label: 'Go to timeline end',
            testId: 'timeline-end',
            iconSlot: 'end-icon',
            variant: 'brand',
            appearance: 'plain',
            disabled: this.#isAtRangeEnd(),
        })
        end.addEventListener('click', event => {
            if (end.hasAttribute('disabled')) return
            this.#emitAction('seek', this.#positionDetail({
                source: 'go-to-end',
                timeMillis: this.#rangeEndMillis,
                event,
            }))
        })
        transportButtons.append(start, previous, play, stop, next, end)
        controls.append(transportButtons)
        return controls
    }

    /**
     * Create one Web Awesome button with icon and label slots.
     *
     * @param {Object} options - Button options.
     * @returns {HTMLElement} Button element.
     */
    #button = ({iconName, label, testId, iconSlot, iconSlotElement, labelSlot, variant = 'neutral', appearance = 'plain', disabled = false}) => {
        const button = createElement('wa-button', 'lgs-widget-no-drag', {
            appearance,
            size: 's',
            variant,
            'aria-label': label,
            title: label,
            disabled,
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
     * Create a Web Awesome tooltip for a timeline view button.
     *
     * @param {string} buttonId - ID of the tooltip target button.
     * @param {string} label - Tooltip and accessible action label.
     * @returns {HTMLElement} Tooltip element.
     */
    #tooltip = (buttonId, label) => {
        const tooltip = createElement('wa-tooltip', '', {
            for: buttonId,
            placement: 'bottom',
        })
        tooltip.append(document.createTextNode(label))
        return tooltip
    }

    /**
     * Create the icon-only timeline view controls.
     *
     * @returns {HTMLElement} Timeline view controls.
     */
    #timelineTools = () => {
        const tools = createElement('span', 'lgs1920-wa-timeline__timeline-tools lgs-widget-no-drag', {
            part: 'timeline-tools',
            'aria-label': 'Timeline view tools',
        })
        const horizontalLabel = this.#horizontalFitActive
            ? 'Restore normal horizontal view'
            : 'Fit entire timeline horizontally'
        const horizontalIcon = createIcon(
            this.#horizontalFitActive
                ? 'arrow-up-right-and-arrow-down-left-from-center'
                : 'arrow-down-left-and-arrow-up-right-to-center',
            'solid',
        )
        horizontalIcon.style.transform = 'rotate(45deg)'
        const horizontal = this.#button({
            label: horizontalLabel,
            testId: 'tools-horizontal-fit',
            iconSlotElement: horizontalIcon,
            variant: 'brand',
        })
        horizontal.id = 'lgs1920-timeline-tools-horizontal-fit'
        horizontal.classList.add('lgs1920-wa-timeline__timeline-tool')
        horizontal.addEventListener('click', () => {
            this.#horizontalFitActive = !this.#horizontalFitActive
            this.#zoom = this.#horizontalFitActive
                ? this.#minimumHorizontalZoom()
                : this.#clampHorizontalZoom(0)
            this.#render()
        })

        const minimumRowHeight = this.#numericToken('row-height', MIN_ROW_HEIGHT)
        const verticalAtMinimum = this.#rowHeight <= minimumRowHeight
        const verticalLabel = verticalAtMinimum ? 'Maximize track size' : 'Show maximum tracks'
        const verticalIcon = createIcon(
            verticalAtMinimum
                ? 'arrow-up-right-and-arrow-down-left-from-center'
                : 'arrow-down-left-and-arrow-up-right-to-center',
            'solid',
        )
        verticalIcon.style.transform = 'rotate(-45deg)'
        const vertical = this.#button({
            label: verticalLabel,
            testId: 'tools-vertical-zoom',
            iconSlotElement: verticalIcon,
            variant: 'brand',
        })
        vertical.id = 'lgs1920-timeline-tools-vertical-zoom'
        vertical.classList.add('lgs1920-wa-timeline__timeline-tool')
        vertical.addEventListener('click', () => {
            this.#verticalZoomRowHeight = verticalAtMinimum ? MAX_ROW_HEIGHT : minimumRowHeight
            this.#render()
        })

        tools.append(
            horizontal,
            this.#tooltip(horizontal.id, horizontalLabel),
            vertical,
            this.#tooltip(vertical.id, verticalLabel),
        )
        return tools
    }

    /**
     * Resolve the frame rate configured by the application.
     *
     * @returns {number} Positive frame rate.
     */
    #resolveFps = () => {
        const fps = Number(this.#timelineConfig.fps)
        return Number.isFinite(fps) && fps > 0 ? fps : 30
    }

    /**
     * Check whether the playhead is at the selected range start.
     *
     * @returns {boolean} Whether the start boundary is active.
     */
    #isAtRangeStart = () => this.#currentTimeMillis <= this.#rangeStartMillis

    /**
     * Check whether the playhead is at the selected range end.
     *
     * @returns {boolean} Whether the end boundary is active.
     */
    #isAtRangeEnd = () => this.#currentTimeMillis >= this.#rangeEndMillis

    /**
     * Build a controlled seek detail payload.
     *
     * @param {Object} options - Seek detail options.
     * @returns {Object} Seek event detail.
     */
    #positionDetail = ({source, timeMillis, event}) => {
        const duration = this.#durationMillis()
        const normalizedTime = this.#normalizeTime(timeMillis)
        return {
            timeMillis: normalizedTime,
            progress: duration > 0 ? normalizedTime / duration : 0,
            settled: true,
            source,
            event,
        }
    }

    /**
     * Build a frame-step seek detail from the controlled frame clock.
     *
     * @param {number} direction - -1 for previous, 1 for next.
     * @param {Event} event - Triggering event.
     * @returns {Object} Frame-step seek detail.
     */
    #frameStepDetail = (direction, event) => {
        const configuredInterval = Number(this.#timelineConfig.frameIntervalMillis)
        const interval = Number.isFinite(configuredInterval) && configuredInterval > 0
            ? configuredInterval
            : 1000 / this.#resolveFps()
        const configuredIndex = Number(this.#timelineConfig.currentFrameIndex)
        const currentFrameIndex = Number.isFinite(configuredIndex)
            ? Math.trunc(configuredIndex)
            : Math.round(this.#currentTimeMillis / interval)
        const configuredCount = Number(this.#timelineConfig.frameCount)
        const frameCount = Number.isFinite(configuredCount) && configuredCount > 0
            ? Math.trunc(configuredCount)
            : Math.max(1, Math.ceil(this.#durationMillis() / interval) + 1)
        const targetFrameIndex = clamp(currentFrameIndex + direction, 0, frameCount - 1)
        const timeMillis = this.#normalizeTime(targetFrameIndex * interval)
        return Object.assign(this.#positionDetail({
            source: direction < 0 ? 'step-backward' : 'step-forward',
            timeMillis,
            event,
        }), {
            frameIndex: targetFrameIndex,
            frameCount,
            frameIntervalMillis: interval,
            direction,
        })
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
     * repeated track contexts.
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
     * Create the track legend and its insertion actions.
     *
     * @returns {HTMLElement} Legend element.
     */
    #legend = () => {
        const legend = createElement('wa-card', 'lgs1920-wa-timeline__legend', {part: 'legend', appearance: 'plain'})
        const ruler = createElement('div', 'lgs1920-wa-timeline__legend-ruler')
        ruler.append(createElement('slot', '', {name: 'timeline-toolbar'}))
        const editable = this.#timelineConfig.editable !== false
        const trackAdd = this.#button({
            iconName: this.#timelineConfig.addTrackIcon ?? 'plus',
            label: this.#timelineConfig.addTrackLabel ?? 'Add track',
            testId: 'add-track',
            iconSlot: 'add-track-icon',
            labelSlot: 'add-track-label',
            variant: 'brand',
            appearance: 'filled',
            disabled: this.#trackInsertionIndex(this.#rows) === null,
        })
        trackAdd.addEventListener('click', event => {
            event.stopPropagation()
            this.#insertTrack(event)
        })
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
        if (this.#timelineConfig.interactive !== false && editable) {
            ruler.append(trackAdd)
            if (this.#timelineConfig.showClipMenu === true) ruler.append(add)
        }
        const rulerSlot = createElement('slot', '', {name: 'legend-ruler'})
        rulerSlot.append(ruler)
        legend.append(rulerSlot)
        if (this.#menuOpen && this.#timelineConfig.interactive !== false && editable && this.#timelineConfig.showClipMenu === true) {
            legend.append(this.#menu())
        }
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
        const popup = createElement('wa-popup', 'lgs1920-wa-timeline__popup lgs-widget-no-drag', {
            placement: 'right-start',
            distance: 4,
            active: true,
            anchor: 'lgs1920-timeline-clip-menu-trigger',
            part: 'popup',
        })
        const menu = createElement('div', 'lgs1920-wa-timeline__menu', {role: 'menu', part: 'menu'})
        this.#resolvedClipOptions().forEach(option => {
            const item = createElement('wa-button', 'lgs1920-wa-timeline__menu-item', {
                appearance: 'plain',
                variant: 'brand',
                size: 's',
                role: 'menuitem',
                draggable: 'true',
            })
            item.append(...this.#globalSlotContent('clip-option-icon', createIcon(option.icon ?? 'film')))
            item.append(...this.#globalSlotContent('clip-option-label', document.createTextNode(option.label ?? option.key ?? 'Clip')))
            item.addEventListener('dragstart', event => this.#startClipOptionDrag(option, event))
            item.addEventListener('dragend', event => this.#endClipOptionDrag(event))
            item.addEventListener('click', event => {
                this.#menuOpen = false
                this.#insertClip(option, event)
            })
            menu.append(item)
        })
        if (this.#resolvedClipOptions().length === 0) menu.append(createElement('slot', '', {name: 'empty-state'}))
        popup.append(menu)
        return popup
    }

    /**
     * Create the context menu for the currently selected clip.
     *
     * @returns {HTMLElement|null} Clip menu, or null when no clip is selected.
     */
    #clipContextMenu = () => {
        const clipId = this.#clipContextMenuClipId
        if (clipId === null || clipId === undefined) return null
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || entry.clip.editable === false || !this.#isTrackEditable(entry.row)) return null
        const popup = createElement('wa-popup', 'lgs1920-wa-timeline__popup lgs1920-wa-timeline__clip-context-menu lgs-widget-no-drag', {
            placement: 'bottom-start',
            distance: 6,
            active: true,
            boundary: 'viewport',
            'data-testid': 'lgs1920-timeline-clip-context-menu',
            flip: true,
            shift: true,
            'flip-fallback-placements': 'top-start right-start left-start',
            'shift-padding': 8,
            part: 'clip-context-menu',
        })
        if (this.#clipContextMenuAnchor) popup.anchor = this.#clipContextMenuAnchor
        const menu = createElement('div', 'lgs1920-wa-timeline__menu', {
            role: 'menu',
            part: 'clip-menu',
        })
        const menuIcon = iconName => {
            const icon = createElement('span', 'lgs1920-wa-timeline__menu-icon', {
                slot: 'start',
                'aria-hidden': 'true',
            })
            icon.append(createIcon(iconName, 'solid'))
            return icon
        }
        const addAction = ({key, testId = key, iconName, label, variant = 'neutral', disabled = false, action}) => {
            const item = this.#button({
                iconName,
                label,
                testId: `clip-menu-${testId}`,
                iconSlotElement: menuIcon(iconName),
                variant,
                appearance: 'plain',
                disabled,
            })
            item.classList.add('lgs1920-wa-timeline__menu-item')
            const labelElement = createElement('span', 'lgs1920-wa-timeline__menu-label')
            labelElement.append(document.createTextNode(label))
            item.append(labelElement)
            item.setAttribute('role', 'menuitem')
            item.setAttribute('data-clip-action', key)
            item.addEventListener('click', event => {
                if (disabled) return
                event.stopPropagation()
                this.#closeClipContextMenu()
                action(event)
            })
            menu.append(item)
        }

        addAction({
            key: 'remove',
            iconName: 'trash-can',
            label: 'Delete',
            variant: 'danger',
            action: event => this.#removeClip(clipId, event),
        })
        addAction({
            key: 'copy',
            testId: 'duplicate',
            iconName: 'clone',
            label: 'Copy',
            action: event => this.#duplicateClip(clipId, event),
        })
        addAction({
            key: 'enabled',
            iconName: entry.clip.enabled === false ? 'toggle-off' : 'toggle-on',
            label: entry.clip.enabled === false ? 'Enable' : 'Disable',
            action: event => this.#toggleClipEnabled(clipId, event),
        })
        addAction({
            key: 'visibility',
            iconName: entry.clip.visible === false ? 'eye' : 'eye-slash',
            label: entry.clip.visible === false ? 'Show' : 'Mask',
            action: event => this.#toggleClipVisibility(clipId, event),
        })
        if (entry.clip.resizable !== false) {
            addAction({
                key: 'extend',
                iconName: 'arrows-left-right',
                label: 'Extend max',
                action: event => this.#extendClip(clipId, event),
            })
        }

        this.#resolvedClipActions().forEach(action => addAction({
            key: action.key,
            testId: `clip-custom-${this.#clipActionKey(action.key)}`,
            iconName: action.icon ?? 'bolt',
            label: action.label,
            variant: action.variant ?? 'neutral',
            disabled: action.disabled === true,
            action: event => this.#runClipAction(clipId, action, event),
        }))

        const colorSwatches = normalizeTimelineColorSwatches(this.#timelineConfig.swatches)
        if (colorSwatches.length === 0) {
            popup.append(menu)
            return popup
        }

        const colorPicker = createElement('wa-color-picker', 'lgs1920-wa-timeline__clip-color-picker lgs1920-wa-timeline__clip-color-picker--menu-trigger', {
            size: 's',
            label: 'Color',
            'without-format-toggle': '',
            value: resolveTimelineColorValue(entry.clip.colorClasses, colorSwatches) ?? colorSwatches[0].color,
            'data-testid': 'lgs1920-timeline-clip-menu-color',
        })
        colorPicker.swatches = colorSwatches
        colorPicker.value = resolveTimelineColorValue(entry.clip.colorClasses, colorSwatches) ?? colorSwatches[0].color

        const colorItem = this.#button({
            iconName: 'palette',
            label: 'Color',
            testId: 'clip-menu-color',
            iconSlotElement: menuIcon('palette'),
            appearance: 'plain',
        })
        colorItem.classList.add('lgs1920-wa-timeline__menu-item')
        const colorLabel = createElement('span', 'lgs1920-wa-timeline__menu-label')
        colorLabel.append(document.createTextNode('Color'))
        colorItem.append(colorLabel)
        colorItem.setAttribute('role', 'menuitem')
        colorItem.setAttribute('aria-haspopup', 'dialog')
        colorItem.setAttribute('aria-expanded', 'false')
        colorItem.addEventListener('click', event => {
            event.stopPropagation()
            colorPicker.open = true
            colorPicker.show?.()
        })
        let colorCommitted = false
        const commitColor = event => {
            if (colorCommitted) return
            const value = event.detail?.value
                ?? event.currentTarget?.value
                ?? event.target?.value
                ?? colorPicker.value
            if (!this.#changeClipColor(clipId, value, event)) return
            colorCommitted = true
            event.stopPropagation()
            this.#closeClipContextMenu({render: false})
        }
        colorPicker.addEventListener('input', commitColor)
        colorPicker.addEventListener('change', commitColor)
        menu.append(colorItem, colorPicker)
        popup.append(menu)
        return popup
    }

    /**
     * Resolve the options shown by the clip insertion menu.
     *
     * @returns {Array} Clip insertion options.
     */
    #resolvedClipOptions = () => this.#clipOptions ?? [{
        key: 'clip',
        label: 'Clip',
        icon: 'film',
    }]

    /**
     * Add a numbered generic track and emit the controlled change.
     *
     * @param {Event} event - Triggering click event.
     */
    #insertTrack = event => {
        if (this.#timelineConfig.editable === false) return
        const insertionIndex = this.#trackInsertionIndex(this.#rows)
        if (insertionIndex === null) return
        const numberedTracks = this.#rows.filter(row => row.autoNumbered === true
            && /^Track \d+$/.test(String(row.label ?? '')))
        let nextTrackNumber = this.#trackNumber
        if (numberedTracks.length === 0) {
            nextTrackNumber = 1
        } else {
            const largestNumber = numberedTracks.reduce((largest, row) => {
                const number = Number.parseInt(String(row.label).slice('Track '.length), 10)
                return Number.isNaN(number) ? largest : Math.max(largest, number)
            }, 0)
            nextTrackNumber = Math.max(this.#trackNumber, largestNumber) + 1
        }
        const baseId = `track-${nextTrackNumber}`
        let id = baseId
        let suffix = 2
        while (this.#rows.some(row => row.id === id)) {
            id = `${baseId}-${suffix}`
            suffix += 1
        }
        const track = {
            id,
            label: `Track ${nextTrackNumber}`,
            kind: 'track',
            autoNumbered: true,
            clips: [],
        }
        const nextRows = [...this.#rows.slice(0, insertionIndex), track, ...this.#rows.slice(insertionIndex)]
        const detail = {
            group: null,
            key: 'track',
            option: null,
            track: this.#publicTrack(track),
            trackId: id,
            tracks: nextRows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('add-track', detail).defaultPrevented) return
        this.#trackNumber = nextTrackNumber
        this.#rows = nextRows
        this.#localRowsDirty = true
        this.#emit('add-track', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('add-track', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Remove a track and emit the complete controlled snapshot.
     *
     * @param {Object} row - Track row to remove.
     * @param {Event} event - Triggering interaction event.
     */
    #removeTrack = (row, event) => {
        const current = this.#rows.find(value => value.id === row?.id)
        if (!this.#isTrackEditable(current)) return
        if ((current.actions ?? current.clips ?? []).length > 0) return
        const nextRows = this.#rows.filter(value => value.id !== current.id)
        const detail = {
            trackId: current.id,
            track: this.#publicTrack(current),
            tracks: nextRows.map(value => this.#publicTrack(value)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('remove-track', detail).defaultPrevented) return
        this.#rows = nextRows
        this.#localRowsDirty = true
        if (this.#editingRowId === current.id) {
            this.#editingRowId = null
            this.#editingLabelValue = ''
        }
        this.#emit('remove-track', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('remove-track', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Request and remove an editable clip through the controlled event flow.
     *
     * @param {string} clipId - Clip identifier.
     * @param {KeyboardEvent} event - Triggering keyboard event.
     */
    #removeClip = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        event?.preventDefault?.()
        event?.stopPropagation?.()
        const clip = Object.assign({}, entry.clip, {trackId: entry.row.id})
        const nextRows = this.#rows.map(row => row.id === entry.row.id
            ? {...row, actions: (row.actions ?? []).filter(value => value.id !== clipId)}
            : row)
        const detail = {
            clipId,
            trackId: entry.row.id,
            clip,
            tracks: nextRows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        const request = this.#emit('before-remove-clip', detail, {cancelable: true})
        if (request.defaultPrevented) return
        this.#rows = nextRows
        this.#localRowsDirty = true
        if (this.#isClipSelected(clip)) this.#selectedClipKey = null
        if (this.#clipContextMenuClipId === clipId) {
            this.#clipContextMenuClipId = null
            this.#clipContextMenuAnchor = null
            window.removeEventListener('pointerdown', this.#handleClipContextMenuOutsidePointerDown, true)
        }
        this.#emit('remove-clip', {
            ...detail,
            tracks: this.tracks,
            data: this.#publicSnapshot(),
        })
        this.#render()
        this.#emit('after-remove-clip', {
            ...detail,
            tracks: this.tracks,
            data: this.#publicSnapshot(),
        })
    }

    /**
     * Generate an unused identifier for a duplicated clip.
     *
     * @param {string|number} identifier - Original clip identifier.
     * @returns {string} New clip identifier.
     */
    #duplicateClipIdentifier = identifier => {
        const identifiers = new Set([
            ...this.#rows.flatMap(row => (row.actions ?? []).map(clip => String(clip.id))),
            ...this.#generatedClipIdentifiers,
        ])
        const base = `${String(identifier)}-copy`
        let candidate = base
        let suffix = 2
        while (identifiers.has(candidate)) {
            candidate = `${base}-${suffix}`
            suffix += 1
        }
        return candidate
    }

    /**
     * Generate an identifier that is not used by any current clip.
     *
     * @param {string|number} identifier - Preferred clip identifier.
     * @returns {string} Unused clip identifier.
     */
    #uniqueClipIdentifier = identifier => {
        const identifiers = new Set([
            ...this.#rows.flatMap(row => (row.actions ?? []).map(clip => String(clip.id))),
            ...this.#generatedClipIdentifiers,
        ])
        const base = String(identifier ?? 'clip').trim() || 'clip'
        let candidate = base
        let suffix = 2
        while (identifiers.has(candidate)) {
            candidate = `${base}-${suffix}`
            suffix += 1
        }
        return candidate
    }

    /**
     * Remove the transient copy-placement ghost from the timeline surface.
     */
    #removeClipCopyPresentation = () => {
        this.#root.querySelectorAll('[data-clip-copy-ghost]').forEach(element => element.remove())
    }

    /**
     * Remove the listeners and state used by a pending clip copy.
     */
    #cancelClipCopy = () => {
        window.removeEventListener('pointermove', this.#handleClipCopyPointerMove, true)
        window.removeEventListener('pointerdown', this.#handleClipCopyPointerDown, true)
        window.removeEventListener('contextmenu', this.#handleClipCopyContextMenu, true)
        if (this.#clipCopyPresentationFrame !== null) {
            cancelAnimationFrame(this.#clipCopyPresentationFrame)
            this.#clipCopyPresentationFrame = null
        }
        this.#clipCopyState = null
        this.#removeClipCopyPresentation()
    }

    /**
     * Preview a copied clip under the current pointer position.
     *
     * @param {PointerEvent} event - Pointer movement event.
     */
    #previewClipCopy = event => {
        const state = this.#clipCopyState
        if (!state) return
        const targetTrack = this.#trackAtClientY(event.clientY)
        const duration = state.originalEnd - state.originalStart
        const targetTime = this.#timeAtClientX(event.clientX)
        const start = Math.max(0, targetTime - (duration / 2))
        const proposedClip = Object.assign({}, state.clip, {
            start,
            end: start + duration,
            trackId: targetTrack?.id ?? state.targetTrackId,
        })
        const result = targetTrack
            ? this.#clipEditor.place({
                baseRows: state.baseRows,
                clip: proposedClip,
                targetTrackId: targetTrack.id,
                mode: 'move',
            })
            : null
        const placedEntry = result ? this.#clipEditor.findClipEntry(result.rows, state.clip.id) : null
        state.previewClientX = event.clientX
        state.previewClientY = event.clientY
        state.targetTrackId = targetTrack?.id ?? state.targetTrackId
        state.previewClip = placedEntry
            ? Object.assign({}, placedEntry.clip, {trackId: placedEntry.row.id})
            : proposedClip
        state.lastResult = result
        state.dropRejected = !result
        this.#updateClipCopyPresentation()
    }

    /**
     * Render the transient copied clip without adding it to controlled rows.
     */
    #updateClipCopyPresentation = () => {
        this.#removeClipCopyPresentation()
        const state = this.#clipCopyState
        if (!state) return
        const sourceElement = [...this.#root.querySelectorAll('[data-clip-id]')]
            .find(element => String(element.getAttribute('data-clip-id')) === String(state.sourceClipId))
        if (!sourceElement) return
        const ghost = sourceElement.cloneNode(true)
        const clip = state.previewClip ?? state.clip
        const {start, end} = resolveClipInterval(clip)
        const isInitialCopy = state.previewClientX === null
        const presentationStart = isInitialCopy ? state.originalStart : start
        const presentationEnd = presentationStart + (end - start)
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#scaleWidth()
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const copyOffset = isInitialCopy
            ? Math.max(MIN_ROW_HEIGHT, this.#rowHeight) / 2
            : 0
        ghost.removeAttribute('id')
        ghost.removeAttribute('data-clip-id')
        ghost.setAttribute('data-clip-copy-ghost', '')
        ghost.setAttribute('aria-hidden', 'true')
        ghost.setAttribute('tabindex', '-1')
        ghost.classList.remove(
            'lgs1920-wa-timeline__clip--selected',
            'lgs1920-wa-timeline__clip--dragging',
            'lgs1920-wa-timeline__clip--resizing',
            'lgs1920-wa-timeline__clip--drop-rejected',
        )
        ghost.classList.add(
            'lgs1920-wa-timeline__clip--drag-ghost',
            'lgs1920-wa-timeline__clip--copy-ghost',
        )
        if (state.dropRejected) ghost.classList.add('lgs1920-wa-timeline__clip--drop-rejected')
        ghost.style.left = `${scaleOffset + ((presentationStart / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
        ghost.style.width = `${Math.max(this.#numericToken('clip-min-width', 8), ((presentationEnd - presentationStart) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
        ghost.style.transform = copyOffset > 0
            ? `translate(${-copyOffset}px, ${copyOffset}px)`
            : ''
        const surfaceRect = this.#surface?.getBoundingClientRect?.()
        const overlay = this.#root.querySelector('[data-overlay]')
        const track = [...this.#root.querySelectorAll('[part="track"]')]
            .find(element => String(element.dataset.rowId) === String(state.targetTrackId))
        const trackRect = track?.getBoundingClientRect?.()
        const sourceRect = sourceElement.getBoundingClientRect?.()
        const previewClientY = Number.isFinite(state.previewClientY)
            ? state.previewClientY
            : trackRect?.height > 0
                ? trackRect.top + (trackRect.height / 2)
                : sourceRect?.height > 0
                    ? sourceRect.top + (sourceRect.height / 2)
                    : null
        if (overlay && surfaceRect && Number.isFinite(previewClientY)) {
            const rowHeight = Math.max(MIN_ROW_HEIGHT, this.#rowHeight)
            ghost.style.top = `${previewClientY - surfaceRect.top - (rowHeight / 2)}px`
            ghost.style.bottom = 'auto'
            ghost.style.height = `${rowHeight}px`
            ghost.style.zIndex = '8'
            overlay.append(ghost)
            return
        }
        if (track) track.append(ghost)
    }

    /**
     * Scroll the horizontal surface just enough to reveal the initial copy ghost.
     */
    #revealInitialClipCopy = () => {
        const state = this.#clipCopyState
        const surface = this.#surface
        const ghost = this.#root.querySelector('[data-clip-copy-ghost]')
        if (!state || state.previewClientX !== null || !surface || !ghost) return
        const left = Number.parseFloat(ghost.style.left)
        const width = Number.parseFloat(ghost.style.width)
        const viewportWidth = surface.clientWidth
        if (!Number.isFinite(left) || !Number.isFinite(width) || viewportWidth <= 0) return
        const right = left + width
        const padding = 8
        const viewportLeft = surface.scrollLeft
        const viewportRight = viewportLeft + viewportWidth
        if (left < viewportLeft + padding) {
            surface.scrollLeft = Math.max(0, left - padding)
        } else if (right > viewportRight - padding) {
            surface.scrollLeft = Math.min(
                Math.max(0, surface.scrollWidth - viewportWidth),
                right - viewportWidth + padding,
            )
        }
    }

    /**
     * Reapply the initial copy presentation after the layout has measured the surface.
     */
    #scheduleClipCopyPresentation = () => {
        if (!this.#clipCopyState) return
        if (typeof requestAnimationFrame !== 'function') {
            this.#revealInitialClipCopy()
            return
        }
        if (this.#clipCopyPresentationFrame !== null) {
            cancelAnimationFrame(this.#clipCopyPresentationFrame)
        }
        this.#clipCopyPresentationFrame = requestAnimationFrame(() => {
            this.#clipCopyPresentationFrame = requestAnimationFrame(() => {
                this.#clipCopyPresentationFrame = null
                if (!this.#clipCopyState) return
                this.#updateClipCopyPresentation()
                this.#revealInitialClipCopy()
            })
        })
    }

    /**
     * Track pointer movement while a copied clip awaits placement.
     *
     * @param {PointerEvent} event - Pointer movement event.
     */
    #handleClipCopyPointerMove = event => {
        const eventBelongsToTimeline = event.composedPath?.().includes(this)
            || event.target === this
            || this.#root.contains(event.target)
        if (!this.#clipCopyState || !eventBelongsToTimeline) return
        event.preventDefault()
        event.stopPropagation()
        this.#previewClipCopy(event)
    }

    /**
     * Commit a pending copy when the user clicks a timeline track.
     *
     * @param {PointerEvent} event - Pointer press event.
     */
    #handleClipCopyPointerDown = event => {
        const eventBelongsToTimeline = event.composedPath?.().includes(this)
            || event.target === this
            || this.#root.contains(event.target)
        if (!this.#clipCopyState) return
        if (!eventBelongsToTimeline) {
            this.#cancelClipCopy()
            return
        }
        if (event.button !== 0) {
            event.preventDefault()
            event.stopImmediatePropagation()
            return
        }
        event.preventDefault()
        event.stopImmediatePropagation()
        this.#previewClipCopy(event)
        const state = this.#clipCopyState
        if (!state || state.dropRejected || !state.lastResult || !state.previewClip) return
        const option = {
            key: 'copy',
            label: state.clip.label ? `Copy of ${state.clip.label}` : 'Copy',
            trackId: state.targetTrackId,
            duration: state.originalEnd - state.originalStart,
            end: state.previewClip.end,
            clip: Object.assign({}, state.clip, {
                start: state.previewClip.start,
                end: state.previewClip.end,
            }),
        }
        const placement = {
            trackId: state.targetTrackId,
            start: state.previewClip.start,
        }
        this.#cancelClipCopy()
        this.#insertClip(option, event, placement)
    }

    /**
     * Cancel a pending copy when the mouse context menu is requested.
     *
     * @param {MouseEvent|PointerEvent} event - Context-menu event.
     */
    #handleClipCopyContextMenu = event => {
        if (!this.#clipCopyState) return
        event.preventDefault()
        event.stopImmediatePropagation()
        this.#cancelClipCopy()
    }

    /**
     * Start placing a copied clip as a transient ghost.
     *
     * @param {string} clipId - Source clip identifier.
     * @param {KeyboardEvent|MouseEvent} event - Triggering interaction event.
     */
    #startClipCopy = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        const {start, end} = resolveClipInterval(entry.clip)
        if (end <= start) return
        const copyId = this.#duplicateClipIdentifier(entry.clip.id)
        const duration = end - start
        const copyClip = Object.assign({}, entry.clip, {
            id: copyId,
            start: end,
            end: end + duration,
        })
        event?.preventDefault?.()
        event?.stopPropagation?.()
        this.#cancelClipCopy()
        this.#clipCopyState = {
            baseRows: cloneRows(this.#rows),
            clip: copyClip,
            sourceClipId: entry.clip.id,
            originalStart: start,
            originalEnd: end,
            targetTrackId: entry.row.id,
            previewClip: Object.assign({}, copyClip, {trackId: entry.row.id}),
            previewClientX: null,
            previewClientY: null,
            lastResult: this.#clipEditor.place({
                baseRows: cloneRows(this.#rows),
                clip: copyClip,
                targetTrackId: entry.row.id,
                mode: 'move',
            }),
            dropRejected: false,
        }
        window.addEventListener('pointermove', this.#handleClipCopyPointerMove, true)
        window.addEventListener('pointerdown', this.#handleClipCopyPointerDown, true)
        window.addEventListener('contextmenu', this.#handleClipCopyContextMenu, true)
        this.#render()
        this.#revealInitialClipCopy()
    }

    /**
     * Copy a clip into a transient placement ghost, or keep the legacy
     * immediate duplicate shortcut for Mod+D.
     *
     * @param {string} clipId - Clip identifier.
     * @param {KeyboardEvent|MouseEvent} event - Triggering interaction event.
     */
    #duplicateClip = (clipId, event) => {
        if (event?.key?.toLowerCase?.() === 'd') {
            this.#duplicateClipImmediately(clipId, event)
            return
        }
        this.#startClipCopy(clipId, event)
    }

    /**
     * Duplicate an editable clip immediately after its current interval.
     *
     * @param {string} clipId - Clip identifier.
     * @param {KeyboardEvent} event - Triggering keyboard event.
     */
    #duplicateClipImmediately = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        const {end, duration} = resolveClipInterval(entry.clip)
        if (duration <= 0) return
        event?.preventDefault?.()
        event?.stopPropagation?.()
        this.#insertClip({
            key: 'duplicate',
            label: entry.clip.label ? `Copy of ${entry.clip.label}` : 'Copy',
            trackId: entry.row.id,
            start: end,
            end: end + duration,
            duration,
            clip: {
                ...entry.clip,
                id: this.#duplicateClipIdentifier(entry.clip.id),
                start: end,
                end: end + duration,
            },
        }, event)
    }

    /**
     * Toggle one clip's visibility and emit the controlled change event.
     *
     * @param {string} clipId - Clip identifier.
     * @param {Event} event - Triggering interaction event.
     */
    #toggleClipVisibility = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        const visible = entry.clip.visible === false
        const clip = {...entry.clip, visible, trackId: entry.row.id}
        const nextRows = this.#rows.map(row => row.id === entry.row.id
            ? {...row, actions: (row.actions ?? []).map(value => value.id === clipId ? {...value, visible} : value)}
            : row)
        const detail = {
            clipId,
            trackId: entry.row.id,
            visible,
            clip,
            tracks: nextRows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('clip-visibility-change', detail).defaultPrevented) return
        this.#rows = nextRows
        this.#localRowsDirty = true
        this.#emit('clip-visibility-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('clip-visibility-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Toggle whether an editable clip participates in timeline playback.
     *
     * @param {string} clipId - Clip identifier.
     * @param {KeyboardEvent|MouseEvent} event - Triggering interaction event.
     */
    #toggleClipEnabled = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        const enabled = entry.clip.enabled === false
        const clip = {...entry.clip, enabled, trackId: entry.row.id}
        const nextRows = this.#rows.map(row => row.id === entry.row.id
            ? {...row, actions: (row.actions ?? []).map(value => value.id === clipId ? {...value, enabled} : value)}
            : row)
        const detail = {
            clipId,
            trackId: entry.row.id,
            enabled,
            clip,
            tracks: nextRows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('clip-enabled-change', detail).defaultPrevented) return
        this.#rows = nextRows
        this.#localRowsDirty = true
        this.#emit('clip-enabled-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('clip-enabled-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Extend one clip to the available interval on both sides.
     *
     * @param {string} clipId - Clip identifier.
     * @param {Event} event - Triggering interaction event.
     */
    #extendClip = (clipId, event) => {
        if (this.#timelineConfig.editable === false) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false || entry.clip.resizable === false) return
        const result = this.#clipEditor.extend(clipId)
        if (!result) return
        const updatedEntry = this.#clipEditor.findClipEntry(result.rows, clipId)
        const clip = updatedEntry ? {...updatedEntry.clip, trackId: updatedEntry.row.id} : null
        const detail = {
            clipId,
            trackId: entry.row.id,
            clip,
            oldClip: {...entry.clip, trackId: entry.row.id},
            start: clip?.start ?? null,
            end: clip?.end ?? null,
            durationMillis: result.durationMillis,
            rangeEndMillis: result.rangeEndMillis,
            tracks: result.rows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('clip-extend', detail).defaultPrevented) return
        this.#rows = result.rows
        this.#localRowsDirty = true
        this.#localDurationDirty = true
        this.#interactionDurationMillis = result.durationMillis
        this.#rangeEndMillis = result.rangeEndMillis
        this.#emit('clip-extend', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('clip-extend', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Update the rendered clip color without rebuilding the timeline structure.
     *
     * @param {string} clipId - Clip identifier.
     * @param {Array} colorClasses - Web Awesome color classes.
     */
    #updateClipColorPresentation = (clipId, colorClasses) => {
        const element = [...this.#root.querySelectorAll('[data-clip-id]')]
            .find(value => String(value.getAttribute('data-clip-id')) === String(clipId))
        if (!element) return
        const paletteClasses = [...element.classList]
            .filter(value => value === 'wa-neutral' || value.startsWith('wa-neutral-'))
        element.classList.remove(...paletteClasses)
        element.classList.add(...colorClasses)
        applyTimelinePaletteStyles(element, colorClasses)
    }

    /**
     * Apply a Web Awesome palette color to one clip.
     *
     * @param {string} clipId - Clip identifier.
     * @param {string} value - Selected color value.
     * @param {Event} event - Triggering color-picker event.
     */
    #changeClipColor = (clipId, value, event) => {
        if (this.#timelineConfig.editable === false) return false
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return false
        const colorSwatches = normalizeTimelineColorSwatches(this.#timelineConfig.swatches)
        const normalizedValue = String(value ?? '').trim().toLowerCase()
        const selectedSwatch = colorSwatches.find(swatch => swatch.color === normalizedValue || swatch.palette === normalizedValue)
        if (!selectedSwatch) return false
        const selectedValue = selectedSwatch.color
        const timelineColor = selectedSwatch.palette ?? resolveTimelinePaletteFromValue(selectedValue, colorSwatches)
        const colorClasses = Array.isArray(selectedSwatch.colorClasses)
            ? selectedSwatch.colorClasses
            : ['wa-neutral', `wa-neutral-${timelineColor}`]
        const clip = {...entry.clip, colorClasses, timelineColor, trackId: entry.row.id}
        const nextRows = this.#rows.map(row => row.id === entry.row.id
            ? {...row, actions: (row.actions ?? []).map(item => item.id === clipId ? {...item, colorClasses, timelineColor} : item)}
            : row)
        const detail = {
            clipId,
            trackId: entry.row.id,
            color: selectedValue,
            colorClasses,
            timelineColor,
            clip,
            tracks: nextRows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('clip-color-change', detail).defaultPrevented) return false
        this.#rows = nextRows
        this.#localRowsDirty = true
        this.#emit('clip-color-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#updateClipColorPresentation(clipId, colorClasses)
        this.#emitAfter('clip-color-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        return true
    }

    /**
     * Insert a clip from a clip-menu option at the current playhead.
     *
     * @param {Object} option - Clip insertion option.
     * @param {Event} event - Triggering click or drop event.
     * @param {{trackId?: string, start?: number}} [placement] - Optional drop placement.
     */
    #insertClip = (option, event, placement = {}) => {
        if (this.#timelineConfig.editable === false) return
        const requestedTrackId = placement.trackId ?? option?.trackId ?? this.#timelineConfig.defaultTrackId
        const target = this.#rows.find(row => row.id === requestedTrackId && this.#isTrackEditable(row))
            ?? this.#rows.find(row => this.#isTrackEditable(row) && trackAcceptsClip(row, {kind: option?.kind ?? option?.key}))
        const start = Math.max(0, Number(placement.start ?? option?.start ?? (this.#currentTimeMillis / 1000)) || 0)
        const duration = Math.max(0, Number(option?.duration ?? this.#timelineConfig.defaultClipDuration ?? 1) || 0)
        const requestedId = option?.clip?.id
            ?? option?.id
            ?? `${option?.key ?? 'clip'}-${Date.now()}`
        const id = this.#uniqueClipIdentifier(requestedId)
        const clip = {
            ...(option?.clip ?? {}),
            id,
            kind: option?.clip?.kind ?? option?.kind ?? option?.key ?? 'clip',
            label: option?.clip?.label ?? option?.label ?? option?.key ?? 'Clip',
            start,
            end: Number(option?.end) > start ? Number(option.end) : start + duration,
        }
        if (!target || !this.#isTrackEditable(target) || !trackAcceptsClip(target, clip)) {
            const detail = {group: option?.group, key: option?.key, option, clip: null, trackId: null, tracks: this.tracks, previousTracks: this.tracks, event, data: this.#publicSnapshot()}
            if (this.#emitBefore('add-clip', detail).defaultPrevented) return
            this.#emit('add-clip', detail)
            this.#emitAfter('add-clip', detail)
            return
        }
        const result = this.#clipEditor.place({
            baseRows: cloneRows(this.#rows),
            clip,
            targetTrackId: target.id,
        })
        if (!result) {
            const detail = {group: option?.group, key: option?.key, option, clip: null, trackId: target.id, tracks: this.tracks, previousTracks: this.tracks, event, data: this.#publicSnapshot()}
            if (this.#emitBefore('add-clip', detail).defaultPrevented) return
            this.#emit('add-clip', detail)
            this.#emitAfter('add-clip', detail)
            return
        }
        const entry = this.#clipEditor.findClipEntry(result.rows, id)
        const addedClip = entry ? Object.assign({}, entry.clip, {trackId: entry.row.id}) : null
        const detail = {
            group: option?.group,
            key: option?.key,
            option,
            clip: addedClip,
            trackId: target.id,
            durationMillis: result.durationMillis,
            tracks: result.rows.map(row => this.#publicTrack(row)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('add-clip', detail).defaultPrevented) return
        this.#generatedClipIdentifiers.add(id)
        this.#rows = result.rows
        this.#localRowsDirty = true
        this.#localDurationDirty = true
        if (addedClip) this.#selectedClipKey = this.#clipSelectionKey(addedClip.trackId, addedClip.id)
        this.#interactionDurationMillis = result.durationMillis
        this.#rangeEndMillis = result.rangeEndMillis
        this.#emit('add-clip', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('add-clip', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
    }

    /**
     * Store a clip option in the native drag payload.
     *
     * @param {Object} option - Clip insertion option.
     * @param {DragEvent} event - Native drag event.
     */
    #startClipOptionDrag = (option, event) => {
        this.#draggedClipOption = option
        const transfer = event.dataTransfer
        if (!transfer) return
        transfer.effectAllowed = 'copy'
        try {
            transfer.setData(CLIP_OPTION_DRAG_MIME, JSON.stringify(option))
        } catch {
            transfer.setData('text/plain', String(option?.label ?? option?.key ?? 'Clip'))
        }
    }

    /**
     * Clear the internal clip option drag state after a native drag ends.
     *
     * @param {DragEvent} event - Native drag event.
     */
    #endClipOptionDrag = event => {
        event.stopPropagation()
        this.#draggedClipOption = null
        this.#root.querySelectorAll('[part="track"].lgs1920-wa-timeline__track--clip-drop-target')
            .forEach(track => track.classList.remove('lgs1920-wa-timeline__track--clip-drop-target'))
    }

    /**
     * Read a clip option from a native drag payload.
     *
     * @param {DragEvent} event - Native drag event.
     * @returns {Object|null} Dragged clip option.
     */
    #clipOptionFromDragEvent = event => {
        const raw = event.dataTransfer?.getData?.(CLIP_OPTION_DRAG_MIME)
        if (raw) {
            try {
                return JSON.parse(raw)
            } catch {
                return this.#draggedClipOption
            }
        }
        return this.#draggedClipOption
    }

    /**
     * Check whether a new clip option can be inserted on a track.
     *
     * @param {Object|null} option - Clip insertion option.
     * @param {string} rowId - Target track identifier.
     * @returns {boolean} Whether the drop is accepted.
     */
    #canDropClipOption = (option, rowId) => {
        if (!option || this.#timelineConfig.editable === false) return false
        const row = this.#rows.find(value => value.id === rowId)
        if (!row || !this.#isTrackEditable(row)) return false
        return trackAcceptsClip(row, {kind: option?.clip?.kind ?? option?.kind ?? option?.key})
    }

    /**
     * Accept drag-over events for new clip insertion.
     *
     * @param {DragEvent} event - Native drag event.
     * @param {string} rowId - Target track identifier.
     * @param {HTMLElement} track - Target track element.
     */
    #handleClipDragOver = (event, rowId, track) => {
        const option = this.#clipOptionFromDragEvent(event)
        if (!this.#canDropClipOption(option, rowId)) return
        event.preventDefault()
        event.stopPropagation()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        track.classList.add('lgs1920-wa-timeline__track--clip-drop-target')
    }

    /**
     * Remove the insertion target state when a dragged option leaves a track.
     *
     * @param {DragEvent} event - Native drag event.
     * @param {HTMLElement} track - Target track element.
     */
    #handleClipDragLeave = (event, track) => {
        if (event.relatedTarget && track.contains(event.relatedTarget)) return
        track.classList.remove('lgs1920-wa-timeline__track--clip-drop-target')
    }

    /**
     * Insert a new clip at the horizontal drop position.
     *
     * @param {DragEvent} event - Native drop event.
     * @param {string} rowId - Target track identifier.
     * @param {HTMLElement} track - Target track element.
     */
    #handleClipDrop = (event, rowId, track) => {
        const option = this.#clipOptionFromDragEvent(event)
        track.classList.remove('lgs1920-wa-timeline__track--clip-drop-target')
        if (!this.#canDropClipOption(option, rowId)) return
        event.preventDefault()
        event.stopPropagation()
        this.#insertClip(option, event, {
            trackId: rowId,
            start: this.#timeAtClientX(event.clientX),
        })
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
        const scaleWidth = this.#scaleWidth()
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
     * @param {boolean} wasSelected - Whether the clip was selected before the pointer down.
     */
    #startClipInteraction = (event, clipId, mode, edge = null, wasSelected = false) => {
        if (event.button !== 0) return
        const entry = this.#clipEditor.findClipEntry(this.#rows, clipId)
        if (!entry || !this.#isTrackEditable(entry.row) || entry.clip.editable === false) return
        const interval = resolveClipInterval(entry.clip)
        const startTime = this.#timeAtClientX(event.clientX)
        const initialDurationMillis = this.#durationMillis()
        this.#dragState = {
            type: 'clip',
            pending: mode === 'move',
            mode,
            edge,
            clipId,
            sourceTrackId: entry.row.id,
            targetTrackId: entry.row.id,
            startX: event.clientX,
            startY: event.clientY,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            sourceElement: event.currentTarget instanceof Element ? event.currentTarget : event.target,
            startTime,
            targetTime: startTime,
            originalStart: interval.start,
            originalEnd: interval.end,
            initialDurationMillis,
            initialRangeEndMillis: this.#rangeEndMillis,
            wasSelected: wasSelected === true,
            baseRows: cloneRows(this.#rows),
            lastResult: null,
            dragStart: {
                clientX: Number(event.clientX) || 0,
                clientY: Number(event.clientY) || 0,
                time: startTime,
                timeMillis: startTime * 1000,
                trackId: entry.row.id,
            },
        }
        if (mode === 'move') {
            this.#addPointerListeners()
            return
        }
        this.#activateClipInteraction(event)
        if (this.#dragState?.type !== 'clip' || this.#dragState.pending === true) return
        this.#addPointerListeners()
    }

    /**
     * Activate a pending clip gesture after the pointer moves far enough.
     *
     * @param {PointerEvent} event - Pointer movement that activates the drag.
     */
    #activateClipInteraction = event => {
        const state = this.#dragState
        if (state?.type !== 'clip' || state.activated === true) return
        state.pending = false
        state.activated = true
        event.preventDefault()
        event.stopPropagation()
        this.#capturePointer({
            currentTarget: state.sourceElement,
            target: state.sourceElement,
            pointerId: state.pointerId,
        })
        const changeDetail = this.#clipEditor.changeDetail(this.#dragState, {
            rows: this.#dragState.baseRows,
            durationMillis: state.initialDurationMillis,
        }, event)
        const dragDetail = {
            context: this.#dragContext(this.#dragState),
            ...changeDetail,
            event,
            data: this.#publicSnapshot(),
        }
        const beforeClipChange = this.#emitBefore('clip-change', changeDetail)
        if (beforeClipChange.defaultPrevented) {
            this.#dragState = null
            this.#interactionDurationMillis = state.initialDurationMillis
            this.#releasePointerCapture()
            return
        }
        const beforeDrag = this.#emitBefore('drag', dragDetail)
        if (beforeDrag.defaultPrevented) {
            this.#dragState = null
            this.#interactionDurationMillis = state.initialDurationMillis
            this.#releasePointerCapture()
            return
        }
        this.#emit('clip-change-start', changeDetail)
        this.#handleEdgeAutoScroll(event)
        this.#updateClipInteractionPresentation()
    }
    /**
     * Toggle a track visibility state and emit its controlled change event.
     *
     * @param {Object} row - Track row.
     * @param {Event} event - Triggering event.
     */
    #toggleTrackVisibility = (row, event) => {
        if (!this.#isTrackEditable(row) || !row?.canHide) return
        event?.stopPropagation?.()
        const visible = row.visible === false
        const nextRows = this.#rows.map(value => value.id === row.id ? {...value, visible} : value)
        const detail = {
            trackId: row.id,
            visible,
            track: this.#publicTrack(Object.assign({}, row, {visible})),
            tracks: nextRows.map(value => this.#publicTrack(value)),
            previousTracks: this.tracks,
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('track-visibility-change', detail).defaultPrevented) return
        if (this.#editingRowId === row.id) {
            window.removeEventListener('pointerdown', this.#handleTrackLabelOutsidePointerDown, true)
            this.#editingRowId = null
            this.#editingLabelValue = ''
        }
        this.#rows = nextRows
        this.#localRowsDirty = true
        this.#emit('track-visibility-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
        this.#render()
        this.#emitAfter('track-visibility-change', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
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
        const shell = createElement('div', `lgs-scrollbars lgs1920-wa-timeline__scroll-shell lgs1920-wa-timeline__scroll-shell--${role} lgs-widget-no-drag`, {
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
            if (viewRole === 'surface') this.#updateTimelineViewportMargins(view)
            if (viewRole === 'legend') this.#syncTracksScroll()
            if (viewRole === 'tracks') this.#updateLegendScroll()
            else this.#updateScrollbars()
        })
        track.addEventListener('pointerdown', event => this.#startScrollbarDrag(event, view, axis, track, thumb))
        track.addEventListener('keydown', event => this.#handleScrollbarKeyDown(event, view, axis))
        return track
    }

    /**
     * Keep viewport edge margins visible only while horizontal content overflows.
     *
     * @param {HTMLElement|null} view - Horizontal timeline surface.
     */
    #updateTimelineViewportMargins = view => {
        if (!view || view.getAttribute('data-scroll-view') !== 'surface') return
        const maximumScrollLeft = Math.max(0, view.scrollWidth - view.clientWidth)
        view.toggleAttribute('data-viewport-margin-left', view.scrollLeft > 0.5)
        view.toggleAttribute('data-viewport-margin-right', view.scrollLeft < maximumScrollLeft - 0.5)
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
     * Remember a title-panel width chosen through the native split panel.
     *
     * Reposition events emitted while the construction overlay is active can
     * reflect Web Awesome's temporary minimum width before layout has settled.
     * Only a real pointer gesture may update the preferred width at that time.
     *
     * @param {Event} event - Native Web Awesome reposition event.
     */
    #handleSplitPanelReposition = event => {
        if (this.#building && !this.#nativeSplitPanelInteractionActive) return
        const width = Number(event.currentTarget?.positionInPixels)
        if (!Number.isFinite(width) || width <= 0) return
        const {minimum, maximum} = resolveLegendBounds(this.#timelineConfig)
        this.#legendWidth = clamp(width, minimum, maximum)
    }

    /**
     * Allow the native split-panel document listeners to receive a divider gesture.
     *
     * @param {MouseEvent|TouchEvent} event - Native divider press event.
     */
    #startNativeSplitPanelInteraction = event => {
        if (event.type === 'mousedown' && event.button !== 0) return
        if (!this.#isSplitPanelDividerEvent(event)) return
        this.#finishNativeSplitPanelInteraction()
        this.#nativeSplitPanelInteractionActive = true
        window.addEventListener('pointerup', this.#finishNativeSplitPanelInteraction)
        window.addEventListener('pointercancel', this.#finishNativeSplitPanelInteraction)
    }

    /**
     * Close the event pass-through used by the native split-panel gesture.
     */
    #finishNativeSplitPanelInteraction = () => {
        this.#nativeSplitPanelInteractionActive = false
        window.removeEventListener('pointerup', this.#finishNativeSplitPanelInteraction)
        window.removeEventListener('pointercancel', this.#finishNativeSplitPanelInteraction)
    }

    /**
     * Reuse the native split panel while replacing the timeline contents.
     *
     * @param {HTMLElement} structure - Next timeline structure.
     */
    #reuseSplitPanel = structure => {
        const currentSplitPanel = this.#root.querySelector('[part="split-panel"]')
        const nextSplitPanel = structure.querySelector('[part="split-panel"]')
        if (!currentSplitPanel || !nextSplitPanel) return
        ['--min', '--max', '--divider-width', '--divider-hit-area'].forEach(property => {
            currentSplitPanel.style.setProperty(property, nextSplitPanel.style.getPropertyValue(property))
        })
        currentSplitPanel.replaceChildren(...nextSplitPanel.children)
        nextSplitPanel.replaceWith(currentSplitPanel)
    }

    /**
     * Refresh dimensions in place without rebuilding the timeline DOM.
     */
    #refreshLayoutMetrics = () => {
        const surfaceWidth = this.#surface?.clientWidth ?? 0
        if (Number.isFinite(surfaceWidth) && surfaceWidth > 0 && surfaceWidth !== this.#surfaceWidth) {
            this.#surfaceWidth = surfaceWidth
            this.#render()
            return
        }
        const nextRowHeight = this.#resolveRowHeight()
        if (nextRowHeight !== this.#rowHeight) {
            this.#rowHeight = nextRowHeight
            const layout = this.#root.querySelector('[data-layout]')
            layout?.style.setProperty('--lgs-timeline-row-height', `${this.#rowHeight}px`)
        }
        this.#updateScrollbars()
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
        this.#suppressRangeClick = true
        this.#capturePointer(event)
        this.#dragState = {
            type: 'range',
            edge,
            startX: event.clientX,
            pointerId: event.pointerId,
            initialStartMillis: this.#rangeStartMillis,
            initialEndMillis: this.#rangeEndMillis,
            initialRangeEndFollowsDuration: this.#rangeEndFollowsDuration,
        }
        this.#rangeEndFollowsDuration = false
        const detail = this.#rangeChangeDetail(event)
        if (this.#emitBefore('range-change', detail).defaultPrevented) {
            this.#suppressRangeClick = false
            this.#rangeEndFollowsDuration = this.#dragState.initialRangeEndFollowsDuration
            this.#dragState = null
            this.#releasePointerCapture()
            return
        }
        this.#addPointerListeners()
        this.#emit('range-change-start', detail)
        this.#handleEdgeAutoScroll(event)
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
        this.#clampCurrentTimeToRange()
        this.#emit('range-changing', this.#rangeChangeDetail(event))
        this.#updateDynamicState()
    }

    /**
     * Move a range boundary to the beginning or end of the timeline.
     *
     * @param {'start'|'end'} edge - Range boundary.
     * @param {MouseEvent} event - Triggering double-click event.
     */
    #setRangeBoundaryToLimit = (edge, event) => {
        if (this.#timelineConfig.editable === false) return
        event.preventDefault()
        event.stopPropagation()
        const rangeStartMillis = edge === 'start' ? 0 : this.#rangeStartMillis
        const rangeEndMillis = edge === 'end' ? this.#durationMillis() : this.#rangeEndMillis
        const detail = this.#rangeChangeDetail(event, rangeStartMillis, rangeEndMillis)
        if (this.#emitBefore('range-change', detail).defaultPrevented) return
        this.#rangeEndFollowsDuration = false
        this.#rangeStartMillis = rangeStartMillis
        this.#rangeEndMillis = rangeEndMillis
        this.#clampCurrentTimeToRange()
        const committedDetail = this.#rangeChangeDetail(event)
        this.#emit('range-change', committedDetail)
        this.#updateDynamicState()
        this.#emitAfter('range-change', committedDetail)
    }

    /**
     * Move a video range boundary with the keyboard.
     *
     * @param {'start'|'end'} edge - Range boundary.
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #moveRangeByKeyboard = (edge, event) => {
        if (!TIMELINE_HORIZONTAL_ARROW_KEYS.includes(event.key)) return
        if (this.#timelineConfig.editable === false) return
        event.preventDefault()
        event.stopPropagation()
        const step = Number(this.#timelineConfig.keyboardStepSeconds) > 0
            ? Number(this.#timelineConfig.keyboardStepSeconds) * 1000
            : 100
        const delta = (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
        const rangeStartMillis = edge === 'start'
            ? clamp(this.#rangeStartMillis + delta, 0, this.#rangeEndMillis)
            : this.#rangeStartMillis
        const rangeEndMillis = edge === 'end'
            ? clamp(this.#rangeEndMillis + delta, this.#rangeStartMillis, this.#durationMillis())
            : this.#rangeEndMillis
        const detail = this.#rangeChangeDetail(event, rangeStartMillis, rangeEndMillis)
        if (this.#emitBefore('range-change', detail).defaultPrevented) return
        this.#rangeEndFollowsDuration = false
        if (edge === 'start') {
            this.#rangeStartMillis = rangeStartMillis
        } else {
            this.#rangeEndMillis = rangeEndMillis
        }
        this.#clampCurrentTimeToRange()
        const committedDetail = this.#rangeChangeDetail(event)
        this.#emit('range-change', committedDetail)
        this.#updateDynamicState()
        this.#emitAfter('range-change', committedDetail)
    }

    /**
     * Start dragging the current playhead.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #startPlayheadInteraction = event => {
        if (event.button !== 0 || this.#timelineConfig.interactive === false) return
        event.preventDefault()
        event.stopPropagation()
        this.#capturePointer(event)
        this.#dragState = {
            type: 'playhead',
            pointerId: event.pointerId,
            initialTimeMillis: this.#currentTimeMillis,
        }
        this.#addPointerListeners()
        this.#seek(event.clientX, false)
        this.#handleEdgeAutoScroll(event)
    }

    /**
     * Move the playhead with the keyboard inside the selected range.
     *
     * Alt+ArrowRight goes to the range minimum and Alt+ArrowLeft goes to its
     * maximum, matching the timeline's direction-specific shortcut contract.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #movePlayheadByKeyboard = event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const minimum = this.#rangeStartMillis
        const maximum = Math.max(minimum, this.#rangeEndMillis)
        let timeMillis
        if (event.altKey) {
            timeMillis = event.key === 'ArrowRight' ? minimum : maximum
        } else {
            const step = Number(this.#timelineConfig.keyboardStepSeconds) > 0
                ? Number(this.#timelineConfig.keyboardStepSeconds) * 1000
                : 100
            const delta = (event.key === 'ArrowRight' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
            timeMillis = clamp(this.#currentTimeMillis + delta, minimum, maximum)
        }
        const detail = {
            timeMillis,
            progress: this.#durationMillis() > 0 ? timeMillis / this.#durationMillis() : 0,
            settled: true,
            event,
        }
        if (this.#emitBefore('seek', detail).defaultPrevented) return
        this.#currentTimeMillis = timeMillis
        this.#emit('seek', detail)
        this.#updateDynamicState()
        this.#emitAfter('seek', detail)
    }

    /**
     * Set one video range boundary from a ruler interaction.
     *
     * @param {'start'|'end'} edge - Range boundary to update.
     * @param {number} timeMillis - Requested boundary position.
     * @param {MouseEvent} event - Triggering mouse event.
     */
    #setRangeBoundaryAtTime = (edge, timeMillis, event) => {
        if (this.#timelineConfig.editable === false) return
        const nextStart = edge === 'start'
            ? Math.min(timeMillis, this.#rangeEndMillis)
            : this.#rangeStartMillis
        const nextEnd = edge === 'end'
            ? Math.max(timeMillis, this.#rangeStartMillis)
            : this.#rangeEndMillis
        const detail = this.#rangeChangeDetail(event, nextStart, nextEnd)
        if (this.#emitBefore('range-change', detail).defaultPrevented) return
        this.#rangeEndFollowsDuration = false
        this.#rangeStartMillis = nextStart
        this.#rangeEndMillis = nextEnd
        this.#clampCurrentTimeToRange()
        const committedDetail = this.#rangeChangeDetail(event)
        this.#emit('range-change', committedDetail)
        this.#updateDynamicState()
        this.#emitAfter('range-change', committedDetail)
    }

    /**
     * Apply the ruler-only click shortcuts.
     *
     * @param {MouseEvent} event - Ruler click event.
     */
    #handleRulerClick = event => {
        if (this.#timelineConfig.interactive === false || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const durationMillis = this.#durationMillis()
        const timeMillis = clamp(this.#timeAtClientX(event.clientX) * 1000, 0, durationMillis)
        if (event.altKey && !event.ctrlKey) {
            if (timeMillis <= this.#rangeEndMillis) this.#setRangeBoundaryAtTime('start', timeMillis, event)
            return
        }
        if (event.ctrlKey && !event.altKey) {
            if (timeMillis >= this.#rangeStartMillis) this.#setRangeBoundaryAtTime('end', timeMillis, event)
            return
        }
        if (!event.altKey && !event.ctrlKey) this.#seek(event.clientX, true)
    }

    /**
     * Build a public detail payload for a video range edit.
     *
     * @param {Event} event - Triggering event.
     * @returns {Object} Range event detail.
     */
    #rangeChangeDetail = (event, rangeStartMillis = this.#rangeStartMillis, rangeEndMillis = this.#rangeEndMillis) => ({
        rangeStartMillis,
        rangeEndMillis,
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
        if (this.#suppressRangeClick) return
        const rect = this.#surface?.getBoundingClientRect()
        const duration = this.#durationMillis()
        if (!rect || duration <= 0) return
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#scaleWidth()
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const x = clamp(clientX - rect.left + (this.#surface?.scrollLeft ?? 0), scaleOffset, this.#contentWidth)
        const timeMillis = this.#normalizeTime(((x - scaleOffset) / scaleWidth) * majorSeconds * 1000)
        const detail = {timeMillis, progress: duration > 0 ? timeMillis / duration : 0, settled}
        if (this.#emitBefore('seek', detail).defaultPrevented) return
        this.#currentTimeMillis = timeMillis
        this.#emit('seek', detail)
        this.#updateDynamicState()
        if (settled) this.#emitAfter('seek', detail)
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
            || !this.#isTrackEditable(row)) return
        const sourceElement = event.currentTarget instanceof Element ? event.currentTarget : event.target
        if (sourceElement?.getAttribute?.('part') === 'legend-content') {
            this.#dragState = {
                type: 'row-pending',
                rowId,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                sourceElement,
            }
            this.#addPointerListeners()
            return
        }
        this.#activateRowDrag(event, rowId, sourceElement)
    }

    /**
     * Activate a row drag after a pointer movement has exceeded the click threshold.
     *
     * @param {PointerEvent} event - Pointer event that activates the drag.
     * @param {string} rowId - Dragged row identifier.
     * @param {Element|null} sourceElement - Element that received the pointer down.
     */
    #activateRowDrag = (event, rowId, sourceElement = null) => {
        event.preventDefault()
        event.stopPropagation()
        this.#capturePointer({
            currentTarget: sourceElement,
            target: sourceElement ?? event.target,
            pointerId: event.pointerId,
        })
        const layout = this.#root.querySelector('[data-layout]')
        const layoutRect = layout?.getBoundingClientRect()
        const rowGhostGeometry = Object.fromEntries(
            [...this.#root.querySelectorAll('[part="legend-row"], [part="track"]')]
                .filter(element => element.dataset.rowId === String(rowId))
                .map(element => {
                    const parent = element.parentElement
                    const rect = element.getBoundingClientRect()
                    const parentRect = parent?.getBoundingClientRect()
                    const part = element.getAttribute('part')
                    const fallbackLeft = parent && parentRect
                        ? rect.left - parentRect.left + (parent.scrollLeft ?? 0)
                        : 0
                    return [part, {
                        left: layoutRect
                            ? rect.left - layoutRect.left
                            : fallbackLeft,
                        width: rect.width,
                    }]
                }),
        )
        this.#dragState = {
            type: 'row',
            rowId,
            pointerId: event.pointerId,
            pointerY: event.clientY,
            dropIndex: this.#rows.findIndex(row => row.id === rowId),
            lastValidDropIndex: this.#rows.findIndex(row => row.id === rowId),
            dropRejected: false,
            initialTimeMillis: this.#currentTimeMillis,
            baseRows: cloneRows(this.#rows),
            rowGhostGeometry,
        }
        const detail = {
            context: this.#dragContext(this.#dragState),
            event,
            data: this.#publicSnapshot(),
        }
        if (this.#emitBefore('drag', detail).defaultPrevented) {
            this.#dragState = null
            this.#releasePointerCapture()
            return
        }
        this.#addPointerListeners()
        this.#updateRowDragPresentation()
    }

    /**
     * Position synchronized row ghosts under the pointer and keep the
     * insertion marker at the proposed logical slot.
     *
     * @returns {void}
     */
    #positionRowDragGhost = () => {
        const state = this.#dragState
        if (state?.type !== 'row') return
        this.#removeRejectedRowSilhouettes()
        const rejected = state.dropRejected === true
        const rowHeight = Math.max(MIN_ROW_HEIGHT, this.#rowHeight)
        const remainingRows = this.#rows.filter(row => row.id !== state.rowId)
        const tracksRect = this.#tracksViewport?.getBoundingClientRect()
        const tracksScrollTop = this.#tracksViewport?.scrollTop ?? 0
        const pointerContentY = tracksRect
            ? state.pointerY - tracksRect.top + tracksScrollTop
            : state.pointerY
        const ghostTop = pointerContentY - (rowHeight / 2)
        const markerIndex = remainingRows
            .slice(1)
            .findIndex((_, index) => {
                const boundary = (index + 1) * rowHeight
                return ghostTop <= boundary && ghostTop + rowHeight >= boundary
            })
        const resolvedMarkerIndex = markerIndex < 0 ? null : markerIndex + 1
        const layout = this.#root.querySelector('[data-layout]')
        const layoutRect = layout?.getBoundingClientRect()
        if (!layout || !layoutRect) return
        const ghostLayer = createElement('div', 'lgs1920-wa-timeline__row-drag-ghost-layer', {
            'data-row-drag-ghost-layer': '',
            'aria-hidden': 'true',
        })
        const ghostTopInLayout = state.pointerY - layoutRect.top - (rowHeight / 2)
        const rowElements = [...this.#root.querySelectorAll('[part="legend-row"], [part="track"]')]
            .filter(element => element.dataset.rowId === String(state.rowId))
        rowElements.forEach(element => {
            const geometry = state.rowGhostGeometry?.[element.getAttribute('part')]
            if (!geometry) return
            const height = rowHeight
            const silhouette = element.cloneNode(true)
            silhouette.removeAttribute('id')
            silhouette.setAttribute('data-row-drag-ghost', '')
            silhouette.setAttribute('aria-hidden', 'true')
            silhouette.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
            silhouette.classList.remove(
                'lgs1920-wa-timeline__legend-row--dragging',
                'lgs1920-wa-timeline__track--dragging',
                'lgs1920-wa-timeline__legend-row--drop-rejected',
                'lgs1920-wa-timeline__track--drop-rejected',
                'lgs1920-wa-timeline__legend-row--drag-placeholder',
                'lgs1920-wa-timeline__track--drag-placeholder',
            )
            silhouette.classList.add(
                'lgs1920-wa-timeline__row-drag-ghost',
                rejected
                    ? 'lgs1920-wa-timeline__row-drag-ghost--rejected'
                    : 'lgs1920-wa-timeline__row-drag-ghost--valid',
            )
            silhouette.style.top = `${ghostTopInLayout}px`
            silhouette.style.left = `${geometry.left}px`
            silhouette.style.width = geometry.width > 0 ? `${geometry.width}px` : '100%'
            silhouette.style.height = `${height}px`
            ghostLayer.append(silhouette)
        })
        layout.append(ghostLayer)
        this.#root.querySelectorAll('[data-scroll-view="legend"], [data-scroll-view="tracks"]').forEach(view => {
            const container = view.querySelector('[part="legend-rows"], [part="tracks"]')
            if (!container || resolvedMarkerIndex === null) return
            const marker = document.createElement('div')
            const markerRejected = !this.#isTrackInsertionAllowed(remainingRows, resolvedMarkerIndex)
            marker.className = `lgs1920-wa-timeline__row-drag-marker${markerRejected || rejected ? ' lgs1920-wa-timeline__row-drag-marker--rejected' : ''}`
            marker.setAttribute('data-row-drag-marker', '')
            marker.setAttribute('aria-hidden', 'true')
            marker.style.top = `${resolvedMarkerIndex * rowHeight - 1}px`
            container.append(marker)
        })
    }

    /**
     * Remove transient row drag silhouettes before updating the live rows.
     */
    #removeRejectedRowSilhouettes = () => {
        this.#root.querySelectorAll('[data-row-drag-ghost-layer]').forEach(element => element.remove())
        this.#root.querySelectorAll('[data-row-drag-ghost]').forEach(element => element.remove())
        this.#root.querySelectorAll('[data-row-drag-marker]').forEach(element => element.remove())
    }

    /**
     * Update row drag feedback without rebuilding either scroll view.
     */
    #updateRowDragPresentation = () => {
        const state = this.#dragState
        if (state?.type !== 'row') return
        this.#removeRejectedRowSilhouettes()
        const rejected = state.dropRejected === true
        this.#root.querySelectorAll('[part="legend-row"], [part="track"]').forEach(element => {
            const rowId = element.dataset.rowId
            const isDragged = rowId === String(state.rowId)
            const isLegendRow = element.getAttribute('part') === 'legend-row'
            element.classList.toggle(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--dragging'
                : 'lgs1920-wa-timeline__track--dragging', isDragged)
            element.classList.toggle(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--drop-rejected'
                : 'lgs1920-wa-timeline__track--drop-rejected', isDragged && rejected)
            element.classList.toggle(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--drag-placeholder'
                : 'lgs1920-wa-timeline__track--drag-placeholder', isDragged && rejected)
        })
        this.#positionRowDragGhost()
    }

    /**
     * Clear row drag feedback after the interaction ends.
     */
    #clearRowDragPresentation = () => {
        this.#removeRejectedRowSilhouettes()
        this.#root.querySelectorAll('[part="legend-row"], [part="track"]').forEach(element => {
            const isLegendRow = element.getAttribute('part') === 'legend-row'
            element.classList.remove(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--dragging'
                : 'lgs1920-wa-timeline__track--dragging')
            element.classList.remove(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--drop-rejected'
                : 'lgs1920-wa-timeline__track--drop-rejected')
            element.classList.remove(isLegendRow
                ? 'lgs1920-wa-timeline__legend-row--drag-placeholder'
                : 'lgs1920-wa-timeline__track--drag-placeholder')
        })
    }

    /**
     * Reorder the existing legend and track rows in place.
     */
    #reorderRenderedRows = () => {
        const rowContainers = [
            this.#root.querySelector('.lgs1920-wa-timeline__legend-rows'),
            this.#root.querySelector('.lgs1920-wa-timeline__tracks'),
        ]
        rowContainers.forEach(container => {
            if (!container) return
            const rowsById = new Map([...container.children]
                .filter(element => element.dataset.rowId && !element.hasAttribute('data-row-drag-ghost'))
                .map(element => [String(element.dataset.rowId), element]))
            this.#rows.forEach(row => {
                const element = rowsById.get(String(row.id))
                if (element) container.append(element)
            })
        })
    }

    /**
     * Resolve a row insertion position after removing the dragged row.
     *
     * @param {Array} rows - Current row order.
     * @param {string} rowId - Dragged row identifier.
     * @param {number} dropIndex - Raw insertion index in the current row order.
     * @returns {{allowed: boolean, targetIndex: number}|null} Drop resolution.
     */
    #resolveRowDrop = (rows, rowId, dropIndex) => {
        const currentIndex = rows.findIndex(row => row.id === rowId)
        if (currentIndex < 0) return null
        const remainingRows = rows.filter(row => row.id !== rowId)
        const targetIndex = clamp(
            dropIndex > currentIndex ? dropIndex - 1 : dropIndex,
            0,
            remainingRows.length,
        )
        const bounds = this.#trackInsertionBounds(remainingRows)
        if (!bounds || !this.#isTrackInsertionAllowed(remainingRows, targetIndex)) return {allowed: false, targetIndex}
        return {allowed: true, targetIndex}
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
                type: 'track',
                trackId: state.rowId,
            }
        }
        const entry = state?.type === 'clip'
            ? this.#clipEditor.findClipEntry(this.#rows, state.clipId)
            : null
        const trackId = entry?.row.id ?? state?.targetTrackId ?? state?.sourceTrackId ?? null
        return {
            type: 'clip',
            trackId,
            clipId: state?.clipId ?? null,
        }
    }

    /**
     * Cancel the timer used to hide the last clip snap guide.
     */
    #clearClipSnapGuideTimer = () => {
        if (this.#clipSnapGuideTimer !== null) clearTimeout(this.#clipSnapGuideTimer)
        this.#clipSnapGuideTimer = null
    }

    /**
     * Hide the clip snap guide and cancel its delayed cleanup.
     */
    #clearClipSnapGuide = () => {
        this.#clearClipSnapGuideTimer()
        this.#clipSnapGuide = null
    }

    /**
     * Keep a clip snap guide visible for a short period after a drag ends.
     *
     * @param {Object} guide - Snap guide metadata.
     */
    #showClipSnapGuide = guide => {
        this.#clearClipSnapGuideTimer()
        this.#clipSnapGuide = guide
        this.#clipSnapGuideTimer = setTimeout(() => {
            this.#clipSnapGuide = null
            this.#clipSnapGuideTimer = null
            this.#updateClipSnapGuidePresentation()
        }, 2000)
    }

    /**
     * Update the vertical clip alignment guide in the current timeline surface.
     *
     * @param {Object|null} [activeGuide=null] - Guide shown during an active drag.
     */
    #updateClipSnapGuidePresentation = (activeGuide = null) => {
        const element = this.#root.querySelector('[data-clip-snap-guide]')
        if (!element) return
        const guide = activeGuide ?? this.#clipSnapGuide
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#scaleWidth()
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const time = Number(guide?.time)
        const visible = Number.isFinite(time) && time >= 0
        element.hidden = !visible
        element.style.display = visible ? 'block' : 'none'
        if (!visible) return
        element.style.left = `${scaleOffset + ((time / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
        element.dataset.clipSnapTargetId = String(guide.clipId ?? '')
        element.dataset.clipSnapTargetEdge = String(guide.edge ?? '')
        element.setAttribute('aria-label', guide.clipId === null || guide.clipId === undefined
            ? 'Snap alignment'
            : `Snap alignment with clip ${String(guide.clipId)}`)
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
        this.#clipScroll?.stop()
        this.#clipWorkspaceWidth = 0
        window.removeEventListener('pointermove', this.#pointerMove, true)
        window.removeEventListener('pointerup', this.#pointerUp, true)
        window.removeEventListener('pointercancel', this.#pointerUp, true)
        this.removeAttribute('data-row-drop-rejected')
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
        if (this.#dragState?.type === 'playhead') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            this.#seek(event.clientX, false)
            this.#handleEdgeAutoScroll(event)
            this.#pinActiveTimeHandle(event)
            return
        }
        if (this.#dragState?.type === 'clip') {
            if (event.pointerId !== this.#dragState.pointerId) return
            if (this.#dragState.pending === true) {
                const distance = Math.hypot(
                    event.clientX - this.#dragState.startX,
                    event.clientY - this.#dragState.startY,
                )
                const threshold = this.#dragState.pointerType === 'touch'
                    ? TOUCH_CLIP_DRAG_THRESHOLD
                    : CLIP_DRAG_THRESHOLD
                if (distance < threshold) return
                this.#activateClipInteraction(event)
                if (this.#dragState?.type !== 'clip' || this.#dragState.pending === true) return
            }
            event.preventDefault()
            this.#handleEdgeAutoScroll(event)
            this.#clipEditor.preview(this.#dragState, event)
            const result = this.#dragState.lastResult ?? {
                rows: this.#rows,
                durationMillis: this.#durationMillis(),
            }
            this.#emit('drag', {
                context: this.#dragContext(this.#dragState),
                ...this.#clipEditor.changeDetail(this.#dragState, result, event),
                accepted: this.#dragState.dropRejected !== true,
                event,
                data: this.#publicSnapshot(),
            })
            return
        }
        if (this.#dragState?.type === 'range') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            this.#previewRangeInteraction(event)
            this.#handleEdgeAutoScroll(event)
            this.#pinActiveTimeHandle(event)
            return
        }
        if (this.#dragState?.type === 'row-pending') {
            if (event.pointerId !== this.#dragState.pointerId) return
            const distance = Math.hypot(
                event.clientX - this.#dragState.startX,
                event.clientY - this.#dragState.startY,
            )
            if (distance < ROW_DRAG_THRESHOLD) return
            this.#activateRowDrag(event, this.#dragState.rowId, this.#dragState.sourceElement)
        }
        if (this.#dragState?.type === 'row') {
            if (event.pointerId !== this.#dragState.pointerId) return
            event.preventDefault()
            this.#handleEdgeAutoScroll(event)
            this.#currentTimeMillis = this.#normalizeTime(this.#dragState.initialTimeMillis)
            this.#dragState.pointerY = event.clientY
            const viewport = this.#root.querySelector('.lgs1920-wa-timeline__legend-viewport')
            const rect = viewport?.getBoundingClientRect()
            if (!rect) return
            const rowHeight = Math.max(MIN_ROW_HEIGHT, this.#rowHeight)
            const currentIndex = this.#rows.findIndex(row => row.id === this.#dragState.rowId)
            const remainingRows = this.#rows.filter(row => row.id !== this.#dragState.rowId)
            const visibleDropIndex = clamp(
                Math.floor((event.clientY - rect.top + (viewport.scrollTop ?? 0) + (rowHeight / 2)) / rowHeight),
                0,
                remainingRows.length,
            )
            const dropIndex = visibleDropIndex >= currentIndex
                ? visibleDropIndex + 1
                : visibleDropIndex
            const resolution = this.#resolveRowDrop(this.#rows, this.#dragState.rowId, dropIndex)
            if (!resolution?.allowed) {
                this.#dragState.dropIndex = dropIndex
                this.#dragState.dropRejected = true
                this.setAttribute('data-row-drop-rejected', '')
                this.#updateRowDragPresentation()
                return
            }
            this.#dragState.dropIndex = dropIndex
            this.#dragState.lastValidDropIndex = dropIndex
            this.#dragState.dropRejected = false
            this.removeAttribute('data-row-drop-rejected')
            this.#emit('drag', {
                context: this.#dragContext(this.#dragState),
                event,
                data: this.#publicSnapshot(),
            })
            this.#updateRowDragPresentation()
        }
    }

    /**
     * Complete the active pointer interaction and emit a reorder event when
     * a row was moved.
     *
     * @param {PointerEvent} event - Pointer event.
     */
    #pointerUp = event => {
        const activePointerId = this.#dragState?.pointerId ?? this.#scrubPointerId
        if (activePointerId !== null && activePointerId !== undefined && event.pointerId !== activePointerId) return
        if (this.#scrubPointerId !== null && event.type === 'pointerup') this.#seek(event.clientX, true)
        const state = this.#dragState
        const wasSimpleClick = state?.type === 'clip'
            && state.mode === 'move'
            && state.wasSelected === true
            && event.type === 'pointerup'
            && event.clientX === state.startX
            && event.clientY === state.startY
        if (state?.type === 'row-pending') {
            this.#removePointerListeners()
            return
        }
        if (state?.type === 'clip' && state.pending === true) {
            const distance = Math.hypot(
                event.clientX - state.startX,
                event.clientY - state.startY,
            )
            const threshold = state.pointerType === 'touch'
                ? TOUCH_CLIP_DRAG_THRESHOLD
                : CLIP_DRAG_THRESHOLD
            if (distance < threshold || event.type !== 'pointerup') {
                this.#removePointerListeners()
                if (wasSimpleClick) this.#clearClipSelection(event)
                return
            }
            this.#activateClipInteraction(event)
            if (this.#dragState?.type !== 'clip' || this.#dragState.pending === true) return
        }
        if (state?.type === 'range' && event.type === 'pointercancel') {
            this.#rangeStartMillis = state.initialStartMillis
            this.#rangeEndMillis = state.initialEndMillis
            this.#rangeEndFollowsDuration = state.initialRangeEndFollowsDuration
            this.#suppressRangeClick = false
        }
        if (state?.type === 'range' && event.type === 'pointerup') {
            const detail = this.#rangeChangeDetail(event)
            this.#emit('range-change', detail)
            this.#updateDynamicState()
            this.#emitAfter('range-change', detail)
        } else if (state?.type === 'range' && event.type === 'pointercancel') {
            this.#emitAfter('range-change', this.#rangeChangeDetail(event))
        }
        if (state?.type === 'playhead' && event.type === 'pointercancel') {
            this.#currentTimeMillis = this.#normalizeTime(state.initialTimeMillis)
            this.#updateDynamicState()
        }
        if (state?.type === 'playhead' && event.type === 'pointerup') {
            this.#seek(event.clientX, true)
        }
        if (state?.type === 'clip' && event.type === 'pointerup') {
            // Resolve the actual release coordinates, including a final move omitted by the browser.
            if (state.lastResult || state.dropRejected || event.clientX !== state.startX || event.clientY !== state.startY) {
                this.#clipEditor.preview(state, event)
            }
            const result = state.dropRejected ? null : state.lastResult
            if (result && state.mode === 'resize') {
                this.#clipEditor.recordResizeResult({
                    baseRows: state.baseRows,
                    result,
                    clipId: state.clipId,
                    edge: state.edge,
                })
            }
            this.#rows = result?.rows ?? state.baseRows
            if (result) this.#localRowsDirty = true
            if (result) this.#localDurationDirty = true
            this.#interactionDurationMillis = result?.durationMillis ?? state.initialDurationMillis
            this.#rangeEndMillis = result?.rangeEndMillis ?? state.initialRangeEndMillis
            const detail = this.#clipEditor.changeDetail(state, result ?? {
                rows: this.#rows,
                durationMillis: this.#durationMillis(),
            }, event)
            if (result) this.#emit('clip-change', detail)
            this.#emitAfter('clip-change', {...detail, committed: Boolean(result)})
        } else if (state?.type === 'clip') {
            this.#rows = state.baseRows
            this.#interactionDurationMillis = state.initialDurationMillis
            this.#rangeEndMillis = state.initialRangeEndMillis
            this.#emitAfter('clip-change', {
                ...this.#clipEditor.changeDetail(state, {
                    rows: this.#rows,
                    durationMillis: this.#durationMillis(),
                }, event),
                committed: false,
            })
        }
        if (state?.type === 'row' && event.type === 'pointercancel') this.#rows = state.baseRows
        if (state?.type === 'row' && event.type === 'pointerup' && state.dropRejected !== true) {
            const resolution = this.#resolveRowDrop(this.#rows, state.rowId, state.lastValidDropIndex)
            const currentIndex = this.#rows.findIndex(row => row.id === state.rowId)
            if (resolution?.allowed && currentIndex >= 0 && currentIndex !== resolution.targetIndex) {
                const rows = [...this.#rows]
                const [row] = rows.splice(currentIndex, 1)
                rows.splice(resolution.targetIndex, 0, row)
                const detail = {
                    trackIds: rows.map(row => row.id),
                    tracks: rows.map(row => this.#publicTrack(row)),
                    previousTracks: this.tracks,
                    dropIndex: state.lastValidDropIndex,
                    event,
                    data: this.#publicSnapshot(),
                }
                if (this.#emitBefore('reorder', detail).defaultPrevented) {
                    state.reorderCanceled = true
                } else {
                    this.#rows = rows
                    this.#localRowsDirty = true
                    this.#emit('reorder', {...detail, tracks: this.tracks, data: this.#publicSnapshot()})
                    state.reorderDetail = detail
                }
            }
        }
        if (state?.type === 'row') {
            this.#currentTimeMillis = this.#normalizeTime(state.initialTimeMillis)
            this.#updateDynamicState()
        }
        const rowOrderChanged = state?.type === 'row'
            && this.#rows.some((row, index) => row.id !== state.baseRows[index]?.id)
        if (state?.type === 'row') {
            this.#reorderRenderedRows()
            this.#clearRowDragPresentation()
        }
        if (state?.type === 'row' && event.type === 'pointerup') {
            if (rowOrderChanged || state.reorderDetail || state.reorderCanceled) {
                this.#emitAfter('reorder', {
                    ...(state.reorderDetail ?? {
                        trackIds: this.#rows.map(row => row.id),
                        tracks: this.#rows.map(row => this.#publicTrack(row)),
                        previousTracks: state.baseRows.map(row => this.#publicTrack(row)),
                        dropIndex: state.lastValidDropIndex,
                        event,
                        data: this.#publicSnapshot(),
                    }),
                    tracks: this.tracks,
                    data: this.#publicSnapshot(),
                    committed: rowOrderChanged && state.reorderCanceled !== true,
                })
            }
        }
        if (state?.type === 'row' || state?.type === 'clip') {
            const clipDetail = state.type === 'clip'
                ? this.#clipEditor.changeDetail(state, {
                    rows: this.#rows,
                    durationMillis: this.#durationMillis(),
                }, event)
                : {}
            this.#emit('after-drag', {
                context: this.#dragContext(state),
                ...clipDetail,
                committed: event.type === 'pointerup' && (state.type === 'clip' ? Boolean(state.lastResult) : rowOrderChanged),
                event,
                data: this.#publicSnapshot(),
            })
            if (wasSimpleClick) this.#clearClipSelection(event)
        }
        if (state?.type === 'clip' && event.type === 'pointerup') {
            if (state.snapTargetTime !== null
                && state.snapTargetTime !== undefined
                && Number.isFinite(Number(state.snapTargetTime))) {
                this.#showClipSnapGuide({
                    time: state.snapTargetTime,
                    clipId: state.snapTargetClipId,
                    edge: state.snapTargetEdge,
                })
            } else {
                this.#clearClipSnapGuide()
            }
        }
        const pendingControlledState = this.#pendingControlledState
        this.#pendingControlledState = null
        this.#removePointerListeners()
        if (state?.type === 'clip') {
            this.#refreshDurationGeometry()
            this.#updateClipInteractionPresentation()
        }
        if (state?.type === 'range') this.#updateDynamicState()
        if (pendingControlledState) this.#applyState(pendingControlledState)
    }

    /**
     * Resolve and start horizontal edge auto-scroll for an active drag.
     *
     * The dragged time handle remains under the pointer while the surface
     * scrolls. Once the drag reaches its logical limit, the animation stops
     * even if more content remains outside the viewport.
     *
     * @param {PointerEvent} event - Latest pointer event.
     */
    #handleEdgeAutoScroll = event => {
        if (['clip', 'row'].includes(this.#dragState?.type)) {
            this.#clipScroll.update(event)
            return
        }
        const rect = this.#surface?.getBoundingClientRect()
        if (!rect) return
        this.#edgePointerEvent = event
        const rightEdge = rect.right - EDGE_TRIGGER_SIZE
        const leftEdge = rect.left + EDGE_TRIGGER_SIZE
        const direction = event.clientX >= rightEdge ? 1 : event.clientX <= leftEdge ? -1 : null
        if (direction === null) {
            this.#stopAutoScroll()
            return
        }
        if (this.#edgeDirection !== direction || this.#edgeStartedAt === null) {
            const now = Date.now()
            this.#edgeDirection = direction
            this.#edgeStartedAt = now
            this.#edgeLastStepAt = now
        }
        if (this.#isEdgeDragLimitReached(direction)) {
            this.#stopAutoScroll()
            return
        }
        if (this.#autoScrollFrame !== null) return
        const loop = () => {
            const state = this.#dragState
            const pointerEvent = this.#edgePointerEvent
            if (!this.#surface || !pointerEvent || !['clip', 'playhead', 'range', 'row'].includes(state?.type)) {
                this.#stopAutoScroll()
                return
            }
            if (this.#isEdgeDragLimitReached(this.#edgeDirection)) {
                this.#stopAutoScroll()
                return
            }
            const now = Date.now()
            const heldMillis = Math.max(0, now - (this.#edgeStartedAt ?? now))
            const previousScrollLeft = this.#surface.scrollLeft
            if (state.type === 'row') {
                const speedIndex = Math.min(EDGE_SCROLL_SPEEDS.length - 1, Math.floor(heldMillis / ACCELERATION_INTERVAL))
                this.#surface.scrollLeft += this.#edgeDirection * EDGE_SCROLL_SPEEDS[speedIndex]
            } else {
                if (this.#edgeLastStepAt === null) this.#edgeLastStepAt = now
                const elapsedSinceStep = Math.max(0, now - this.#edgeLastStepAt)
                if (elapsedSinceStep < EDGE_TIME_ACCELERATION_INTERVAL) {
                    this.#autoScrollFrame = requestAnimationFrame(loop)
                    return
                }
                const {majorSeconds} = resolveScale(this.#zoom)
                const scaleWidth = this.#scaleWidth()
                const stepCount = Math.max(1, Math.floor(elapsedSinceStep / EDGE_TIME_ACCELERATION_INTERVAL))
                const firstStepAt = this.#edgeLastStepAt
                const totalStepMillis = Array.from({length: stepCount}, (_, index) => {
                    const stepHeldMillis = Math.max(0, firstStepAt + ((index + 1) * EDGE_TIME_ACCELERATION_INTERVAL) - (this.#edgeStartedAt ?? firstStepAt))
                    const speedIndex = Math.min(EDGE_SCROLL_TIME_STEPS.length - 1, Math.floor(stepHeldMillis / EDGE_TIME_ACCELERATION_INTERVAL))
                    return EDGE_SCROLL_TIME_STEPS[speedIndex]
                }).reduce((total, stepMillis) => total + stepMillis, 0)
                const pixelStep = (totalStepMillis / 1000 / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth
                this.#surface.scrollLeft += this.#edgeDirection * pixelStep
                this.#edgeLastStepAt += stepCount * EDGE_TIME_ACCELERATION_INTERVAL
            }
            if (this.#surface.scrollLeft === previousScrollLeft) {
                this.#stopAutoScroll()
                return
            }
            if (state.type === 'range') this.#previewRangeInteraction(pointerEvent)
            else if (state.type === 'playhead') this.#seek(pointerEvent.clientX, false)
            else if (state.type === 'clip') {
                this.#clipEditor.preview(state, pointerEvent)
                const result = state.lastResult ?? {
                    rows: this.#rows,
                    durationMillis: this.#durationMillis(),
                }
                this.#emit('drag', {
                    context: this.#dragContext(state),
                    ...this.#clipEditor.changeDetail(state, result, pointerEvent),
                    accepted: state.dropRejected !== true,
                    event: pointerEvent,
                    data: this.#publicSnapshot(),
                })
            }
            this.#pinActiveTimeHandle(pointerEvent)
            if (this.#isEdgeDragLimitReached(this.#edgeDirection)) {
                this.#stopAutoScroll()
                return
            }
            this.#autoScrollFrame = requestAnimationFrame(loop)
        }
        this.#autoScrollFrame = requestAnimationFrame(loop)
    }

    /**
     * Check whether a time drag has reached the boundary in its scroll direction.
     *
     * @param {number} direction - Horizontal direction, either -1 or 1.
     * @returns {boolean} Whether the active time handle is at its limit.
     */
    #isEdgeDragLimitReached = direction => {
        const state = this.#dragState
        if (state?.type === 'range') {
            if (state.edge === 'start') return direction < 0 ? this.#rangeStartMillis <= 0 : this.#rangeStartMillis >= this.#rangeEndMillis
            return direction < 0 ? this.#rangeEndMillis <= this.#rangeStartMillis : this.#rangeEndMillis >= this.#durationMillis()
        }
        if (state?.type === 'playhead') {
            return direction < 0 ? this.#currentTimeMillis <= this.#rangeStartMillis : this.#currentTimeMillis >= this.#rangeEndMillis
        }
        return false
    }

    /**
     * Stop the edge auto-scroll animation and reset acceleration.
     */
    #stopAutoScroll = () => {
        this.#clipScroll?.stop()
        if (this.#autoScrollFrame !== null) cancelAnimationFrame(this.#autoScrollFrame)
        this.#autoScrollFrame = null
        this.#edgeDirection = null
        this.#edgeStartedAt = null
        this.#edgeLastStepAt = null
        this.#edgePointerEvent = null
    }

    /**
     * Keep the active time handle visually attached to the pointer.
     *
     * The handle is pinned only while it can still move in the current edge
     * direction. At a logical boundary, the rendered boundary position wins.
     *
     * @param {PointerEvent} event - Latest pointer event.
     */
    #pinActiveTimeHandle = event => {
        const state = this.#dragState
        if (!['playhead', 'range'].includes(state?.type)) return
        const rect = this.#surface?.getBoundingClientRect()
        if (!rect) return
        const handle = state.type === 'playhead'
            ? this.#root.querySelector('[data-playhead]')
            : this.#root.querySelector(`[data-range-handle="${state.edge}"]`)
        if (!handle) return
        if (this.#edgeDirection && this.#isEdgeDragLimitReached(this.#edgeDirection)) return
        const pinnedClientX = this.#edgeDirection === 1
            ? rect.right - 1
            : this.#edgeDirection === -1
                ? rect.left + 1
                : event.clientX
        handle.style.left = `${pinnedClientX - rect.left + (this.#surface.scrollLeft ?? 0)}px`
    }

    /**
     * Install the host resize observer without coupling it to split-panel movement.
     *
     * The split panel changes the surface width while its divider is dragged.
     * Observing that surface would rebuild the component during the native
     * gesture and invalidate the scroll views. The host size changes only when
     * the timeline container itself is resized.
     */
    #installResizeObserver = () => {
        this.#resizeObserver?.disconnect()
        if (typeof ResizeObserver === 'undefined') return
        this.#resizeObserver = new ResizeObserver(() => {
            const width = this.#surface?.clientWidth ?? 0
            if (Number.isFinite(width) && width > 0 && width !== this.#surfaceWidth) {
                this.#surfaceWidth = width
            }
            this.#refreshLayoutMetrics()
        })
        this.#resizeObserver.observe(this)
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
     * Handle modifier-based zoom gestures from the timeline surface.
     *
     * @param {WheelEvent} event - Wheel event.
     */
    #handleWheel = event => {
        if (event.ctrlKey || !event.deltaY) return
        if (!event.metaKey && !event.shiftKey && !event.altKey) return
        event.preventDefault()
        const direction = event.deltaY < 0 ? 1 : -1
        if (event.metaKey) {
            this.#zoomHorizontal(direction, event.clientX)
            return
        }
        this.#stepVerticalZoom(direction)
    }

    /**
     * Toggle local playback from the canonical Space shortcut.
     *
     * @param {KeyboardEvent} event - Triggering keyboard event.
     * @returns {boolean} Whether the shortcut was handled.
     */
    #togglePlayback = event => {
        if (this.#timelineConfig.interactive === false) return false
        event.preventDefault()
        event.stopPropagation()
        const playing = !this.#playing
        const action = playing ? 'play' : 'pause'
        const detail = {
            source: playing ? 'timeline-keyboard-play' : 'timeline-keyboard-pause',
            timeMillis: this.#currentTimeMillis,
            event,
        }
        if (!this.#emitAction(action, detail)) return true
        this.#playing = playing
        this.#updatePlaybackButton()
        return true
    }

    /**
     * Move the local playhead to one of the selected range boundaries.
     *
     * @param {'start'|'end'} boundary - Boundary to select.
     * @param {KeyboardEvent} event - Triggering keyboard event.
     * @returns {boolean} Whether the shortcut was handled.
     */
    #seekToBoundary = (boundary, event) => {
        if (this.#timelineConfig.interactive === false) return false
        event.preventDefault()
        event.stopPropagation()
        const timeMillis = boundary === 'start' ? this.#rangeStartMillis : this.#rangeEndMillis
        const detail = this.#positionDetail({
            source: boundary === 'start' ? 'timeline-keyboard-home' : 'timeline-keyboard-end',
            timeMillis,
            event,
        })
        if (this.#emitBefore('seek', detail).defaultPrevented) return true
        this.#currentTimeMillis = detail.timeMillis
        this.#emit('seek', detail)
        this.#updateDynamicState()
        this.#emitAfter('seek', detail)
        return true
    }

    /**
     * Handle keyboard zoom gestures from the timeline surface or window.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     * @param {boolean} fromSurface - Whether the event came from the focused surface.
     */
    #handleKeyDown = (event, fromSurface = false) => {
        if (event.target?.closest?.(TIMELINE_KEYBOARD_EDITABLE_SELECTOR)) return
        if (fromSurface && event.target !== event.currentTarget) return
        if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            if (event.key === ' ' || event.key === 'Spacebar') {
                this.#togglePlayback(event)
                return
            }
            if (event.key === 'Home' || event.key === 'End') {
                this.#seekToBoundary(event.key === 'Home' ? 'start' : 'end', event)
                return
            }
        }
        if (!TIMELINE_ARROW_KEYS.includes(event.key)) return
        if (this.#handleShiftNavigation(event)) return
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            this.#stepVerticalZoom(event.key === 'ArrowUp' ? 1 : -1)
            return
        }
        this.#zoomHorizontal(event.key === 'ArrowRight' ? 1 : -1)
    }

    /**
     * Handle arrow-key zoom when the selected timeline widget owns the focus
     * outside its internal surface.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     */
    #handleWindowKeyDown = event => {
        if (event.key === 'Escape' && this.#clipCopyState) {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.#cancelClipCopy()
            return
        }
        if (event.key === 'Escape' && this.#dragState) {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.#pointerUp({type: 'pointercancel', pointerId: this.#dragState.pointerId})
            return
        }
        if (event.key === 'Escape' && this.#clipContextMenuClipId !== null) {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.#closeClipContextMenu()
            return
        }
        if (event.key === 'Escape'
            && this.#selectedClipKey !== null
            && !event.target?.closest?.(TIMELINE_KEYBOARD_EDITABLE_SELECTOR)) {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.#clearClipSelection(event)
            return
        }
        if (event.composedPath?.().includes(this)) return
        if (event.target?.closest?.(TIMELINE_KEYBOARD_EDITABLE_SELECTOR)) return
        if (this.#timelineConfig.keyboardZoomActive !== true) return
        if (this.#handleShiftNavigation(event)) return
        this.#handleKeyDown(event)
    }

    /**
     * Apply Shift-based navigation shortcuts while the timeline owns focus.
     *
     * @param {KeyboardEvent} event - Keyboard event.
     * @returns {boolean} Whether the event was handled.
     */
    #handleShiftNavigation = event => {
        if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false
        if (!TIMELINE_ARROW_KEYS.includes(event.key)) return false
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const timeMillis = event.key === 'ArrowLeft' ? this.#rangeStartMillis : this.#rangeEndMillis
            const detail = {
                timeMillis,
                progress: this.#durationMillis() > 0 ? timeMillis / this.#durationMillis() : 0,
                settled: true,
                event,
            }
            if (this.#emitBefore('seek', detail).defaultPrevented) return true
            this.#currentTimeMillis = timeMillis
            this.#emit('seek', detail)
            this.#updateDynamicState()
            this.#emitAfter('seek', detail)
            return true
        }
        if (this.#tracksViewport) {
            this.#tracksViewport.scrollTop = event.key === 'ArrowUp'
                ? 0
                : Math.max(0, this.#tracksViewport.scrollHeight - this.#tracksViewport.clientHeight)
            this.#updateLegendScroll()
        }
        return true
    }

    /**
     * Move the vertical zoom by one configured increment.
     *
     * @param {number} direction - Positive to enlarge rows, negative to reduce them.
     */
    #stepVerticalZoom = direction => {
        const minimumRowHeight = this.#numericToken('row-height', MIN_ROW_HEIGHT)
        const currentRowHeight = Number.isFinite(this.#verticalZoomRowHeight)
            ? this.#verticalZoomRowHeight
            : this.#rowHeight
        this.#verticalZoomRowHeight = clamp(currentRowHeight + (direction * ROW_ZOOM_STEP), minimumRowHeight, MAX_ROW_HEIGHT)
        this.#render()
    }

    /**
     * Change the horizontal zoom while preserving the time under an anchor.
     *
     * @param {number} direction - Positive to zoom in, negative to zoom out.
     * @param {number} [clientX] - Optional pointer anchor in viewport coordinates.
     */
    #zoomHorizontal = (direction, clientX = null) => {
        const surface = this.#surface
        const rect = surface?.getBoundingClientRect?.()
        const hasPointerAnchor = rect && Number.isFinite(Number(clientX))
        const viewportX = hasPointerAnchor
            ? Number(clientX) - rect.left
            : (surface?.clientWidth ?? 0) / 2
        const anchorTimeSeconds = rect
            ? this.#timeAtClientX(rect.left + viewportX)
            : null

        this.#horizontalFitActive = false
        this.#zoom = this.#clampHorizontalZoom(this.#zoom + (direction * ZOOM_STEP))
        this.#render()

        if (anchorTimeSeconds === null || !this.#surface) return
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const anchorX = scaleOffset + ((anchorTimeSeconds / majorSeconds) * this.#scaleWidth())
        const maximumScrollLeft = Math.max(
            0,
            Math.max(this.#surface.scrollWidth, this.#contentWidth) - (this.#surface.clientWidth || 0),
        )
        this.#surface.scrollLeft = clamp(anchorX - viewportX, 0, maximumScrollLeft)
        this.#updateScrollbars()
    }

    /**
     * Update playback labels and controlled cursor geometry.
     */
    #updateDynamicState = () => {
        const current = this.#root.querySelector('[data-current-time]')
        const total = this.#root.querySelector('[data-total-time]')
        if (current) current.textContent = formatTime(this.#currentTimeMillis / 1000)
        if (total) total.textContent = formatTime(this.#durationSeconds())
        const duration = this.#durationMillis()
        const ratio = duration > 0 ? clamp(this.#currentTimeMillis / duration, 0, 1) : 0
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#scaleWidth()
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const position = scaleOffset + ((ratio * this.#durationSeconds()) / majorSeconds * scaleWidth)
        const playhead = this.#root.querySelector('[data-playhead]')
        const end = this.#root.querySelector('[data-end-marker]')
        const rangeStart = this.#root.querySelector('[data-range-handle="start"]')
        const rangeEnd = this.#root.querySelector('[data-range-handle="end"]')
        const startButton = this.#root.querySelector('[data-testid="lgs1920-wa-timeline-restart"]')
        const previousButton = this.#root.querySelector('[data-testid="lgs1920-wa-timeline-previous-frame"]')
        const nextButton = this.#root.querySelector('[data-testid="lgs1920-wa-timeline-next-frame"]')
        const endButton = this.#root.querySelector('[data-testid="lgs1920-wa-timeline-end"]')
        const transportButtons = [
            [startButton, this.#isAtRangeStart()],
            [previousButton, this.#isAtRangeStart()],
            [nextButton, this.#isAtRangeEnd()],
            [endButton, this.#isAtRangeEnd()],
        ]
        transportButtons.forEach(([button, disabled]) => {
            if (!button) return
            button.toggleAttribute('disabled', disabled)
        })
        if (playhead) {
            playhead.style.left = `${position}px`
            playhead.setAttribute('aria-valuemin', `${this.#rangeStartMillis}`)
            playhead.setAttribute('aria-valuemax', `${this.#rangeEndMillis}`)
            playhead.setAttribute('aria-valuenow', `${this.#currentTimeMillis}`)
        }
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
     * Update clip previews in the existing track surface.
     *
     * @remarks
     * Clip drag and resize previews must not rebuild either scroll view.
     */
    #updateClipInteractionPresentation = () => {
        this.#reconcileClipSelection()
        this.#updateClipSelectionPresentation()
        const {majorSeconds} = resolveScale(this.#zoom)
        const scaleWidth = this.#scaleWidth()
        const scaleOffset = this.#numericToken('scale-offset', START_LEFT)
        const dragState = this.#dragState
        const activeSnapGuide = dragState?.type === 'clip'
            && dragState.snapTargetTime !== null
            && dragState.snapTargetTime !== undefined
            && Number.isFinite(Number(dragState.snapTargetTime))
            ? {
                time: dragState.snapTargetTime,
                clipId: dragState.snapTargetClipId,
                edge: dragState.snapTargetEdge,
            }
            : null
        if (dragState?.type === 'clip' && !activeSnapGuide) this.#clearClipSnapGuide()
        this.#updateClipSnapGuidePresentation(activeSnapGuide)
        this.#root.querySelectorAll('[data-clip-drag-ghost], [data-clip-drag-source]')
            .forEach(element => element.remove())
        this.toggleAttribute('data-clip-drop-rejected', dragState?.type === 'clip' && dragState.dropRejected === true)
        const clipEdgeIndicator = this.#root.querySelector('[data-clip-edge-indicator]')
        const clipMoveEndpoints = [...this.#root.querySelectorAll('[data-clip-move-endpoint]')]
        const clips = new Map([...this.#root.querySelectorAll('[data-clip-id]')]
            .map(element => [String(element.getAttribute('data-clip-id')), element]))
        const resizingClip = dragState?.type === 'clip' && dragState.mode === 'resize'
            ? this.#clipEditor.findClipEntry(this.#rows, dragState.clipId)?.clip
            : null
        const placementClip = dragState?.type === 'clip' && dragState.mode === 'move'
            ? this.#clipEditor.findClipEntry(this.#rows, dragState.clipId)?.clip ?? dragState.previewClip
            : null
        const movingClip = dragState?.type === 'clip' && dragState.mode === 'move'
            ? dragState.previewClip ?? placementClip
            : null
        const markerClip = dragState?.type === 'clip'
            ? dragState.mode === 'move'
                ? movingClip
                : dragState.previewClip ?? resizingClip
            : null
        const markerSource = clips.get(String(dragState?.clipId))
        const markerColor = markerSource?.style.borderColor ?? ''
        const markerElements = [clipEdgeIndicator, ...clipMoveEndpoints].filter(Boolean)
        markerElements.forEach(element => element.style.setProperty('--lgs-timeline-clip-edge-indicator-color', markerColor))
        if (clipEdgeIndicator) {
            clipEdgeIndicator.hidden = true
        }
        clipMoveEndpoints.forEach(endpoint => {
            const edge = endpoint.getAttribute('data-clip-move-endpoint')
            const endpointTime = markerClip && edge === 'start'
                ? resolveClipInterval(markerClip).start
                : markerClip && edge === 'end'
                    ? resolveClipInterval(markerClip).end
                    : null
            const hasEndpointTime = Number.isFinite(endpointTime)
            endpoint.hidden = !hasEndpointTime
            if (hasEndpointTime) {
                endpoint.style.left = `${scaleOffset + ((endpointTime / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
            }
        })
        const tracks = new Map([...this.#root.querySelectorAll('[part="track"]')]
            .map(element => [String(element.dataset.rowId), element]))
        const legends = new Map([...this.#root.querySelectorAll('[part="legend-row"]')]
            .map(element => [String(element.dataset.rowId), element]))
        this.#rows.forEach(row => {
            const track = tracks.get(String(row.id))
            const legend = legends.get(String(row.id))
            const actions = row.actions ?? []
            actions.forEach(value => {
                const element = clips.get(String(value.id))
                if (!element) return
                const {start, end} = resolveClipInterval(value)
                element.style.left = `${scaleOffset + ((start / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                element.style.width = `${Math.max(this.#numericToken('clip-min-width', 8), ((end - start) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                element.style.top = ''
                element.style.bottom = ''
                element.style.height = ''
                element.classList.toggle('lgs1920-wa-timeline__clip--hidden', value.visible === false)
                element.classList.toggle('lgs1920-wa-timeline__clip--track-hidden', row.visible === false)
                const isDragging = dragState?.type === 'clip' && dragState.pending !== true && dragState.clipId === value.id
                element.classList.toggle('lgs1920-wa-timeline__clip--dragging', isDragging)
                element.classList.toggle('lgs1920-wa-timeline__clip--resizing', isDragging && dragState.mode === 'resize')
                element.classList.remove(
                    'lgs1920-wa-timeline__clip--drag-ghost',
                    'lgs1920-wa-timeline__clip--drag-source',
                    'lgs1920-wa-timeline__clip--drag-source-rejected',
                )
                const durationOverlay = element.querySelector('[data-clip-duration-overlay]')
                const isResizing = isDragging && dragState.mode === 'resize'
                if (durationOverlay) {
                    durationOverlay.hidden = !isResizing
                    if (isResizing) {
                        durationOverlay.textContent = `${formatTime(end - start)} / ${formatTime(this.#durationMillis() / 1000)}`
                    }
                }
                element.classList.toggle('lgs1920-wa-timeline__clip--drop-rejected', dragState?.type === 'clip'
                    && dragState.clipId === value.id
                    && dragState.dropRejected === true)
                element.classList.toggle('lgs1920-wa-timeline__clip--drag-source-rejected', isDragging
                    && dragState.dropRejected === true)
                if (track && element.parentElement !== track) track.append(element)
            })
            if (track) {
                const isClipDropTarget = dragState?.type === 'clip'
                    && dragState.targetTrackId === row.id
                const isClipDropRejected = dragState?.type === 'clip'
                    && dragState.targetTrackId === row.id
                    && dragState.dropRejected === true
                const trackBackground = track.querySelector('[part="track-background"]')
                track.classList.toggle('lgs1920-wa-timeline__track--clip-drop-target', isClipDropTarget)
                track.classList.toggle('lgs1920-wa-timeline__track--clip-drop-rejected', isClipDropRejected)
                trackBackground?.classList.toggle('lgs1920-wa-timeline__track-background--clip-drop-rejected', isClipDropRejected)
                legend?.classList.toggle('lgs1920-wa-timeline__legend-row--clip-drop-target', isClipDropTarget)
                legend?.classList.toggle('lgs1920-wa-timeline__legend-row--clip-drop-rejected', isClipDropRejected)
            }
        })
        if (dragState?.type === 'clip' && dragState.mode === 'move' && movingClip) {
            const sourceElement = clips.get(String(dragState.clipId))
            const overlay = this.#root.querySelector('[data-overlay]')
            if (sourceElement && overlay) {
                const accepted = dragState.lastResult !== null && dragState.lastResult !== undefined
                const ghostClip = movingClip
                if (ghostClip) {
                    const {start, end} = resolveClipInterval(ghostClip)
                    const positionGhost = element => {
                        const surfaceRect = this.#surface?.getBoundingClientRect?.()
                        const pointerY = Number(dragState.previewClientY)
                        const rowHeight = Math.max(MIN_ROW_HEIGHT, this.#rowHeight)
                        element.style.left = `${scaleOffset + ((start / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                        element.style.width = `${Math.max(this.#numericToken('clip-min-width', 8), ((end - start) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                        if (!surfaceRect || !Number.isFinite(pointerY)) return
                        element.style.top = `${pointerY - surfaceRect.top - (rowHeight / 2)}px`
                        element.style.bottom = 'auto'
                        element.style.height = `${rowHeight}px`
                    }
                    const configureClone = (clone, kind, clipStart, clipEnd) => {
                        clone.removeAttribute('id')
                        clone.removeAttribute('data-clip-id')
                        clone.setAttribute(`data-clip-drag-${kind}`, '')
                        clone.setAttribute('aria-hidden', 'true')
                        clone.setAttribute('tabindex', '-1')
                        clone.classList.remove(
                            'lgs1920-wa-timeline__clip--dragging',
                            'lgs1920-wa-timeline__clip--resizing',
                            'lgs1920-wa-timeline__clip--drag-ghost',
                            'lgs1920-wa-timeline__clip--drop-rejected',
                        )
                        clone.classList.add(`lgs1920-wa-timeline__clip--drag-${kind}`)
                        if (!accepted) clone.classList.add('lgs1920-wa-timeline__clip--drop-rejected')
                        clone.style.left = `${scaleOffset + ((clipStart / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                        clone.style.width = `${Math.max(this.#numericToken('clip-min-width', 8), ((clipEnd - clipStart) / Math.max(Number.EPSILON, majorSeconds)) * scaleWidth)}px`
                    }

                    if (accepted) {
                        sourceElement.classList.remove('lgs1920-wa-timeline__clip--dragging')
                        sourceElement.classList.add('lgs1920-wa-timeline__clip--drag-ghost')
                        positionGhost(sourceElement)
                        overlay.append(sourceElement)
                        const sourceEntry = this.#clipEditor.findClipEntry(dragState.baseRows, dragState.clipId)
                        const sourceTrack = tracks.get(String(sourceEntry?.row.id))
                        if (sourceEntry && sourceTrack) {
                            const sourceClone = sourceElement.cloneNode(true)
                            const original = resolveClipInterval(sourceEntry.clip)
                            configureClone(sourceClone, 'source', original.start, original.end)
                            sourceTrack.append(sourceClone)
                        }
                    } else {
                        const ghost = sourceElement.cloneNode(true)
                        configureClone(ghost, 'ghost', start, end)
                        positionGhost(ghost)
                        overlay.append(ghost)
                    }
                }
            }
        }
        this.#updateDynamicState()
        this.#updateClipCopyPresentation()
    }

    /**
     * Update the existing play/pause control without rebuilding the timeline.
     */
    #updatePlaybackButton = () => {
        const button = this.#root.querySelector('[data-testid="lgs1920-wa-timeline-play"]')
        if (!button) return
        const label = this.#playing ? 'Pause timeline' : 'Play timeline'
        button.setAttribute('aria-label', label)
        button.setAttribute('title', label)
        button.replaceChildren(this.#slotWithFallback(
            this.#playing ? 'pause-icon' : 'play-icon',
            createIcon(this.#playing ? 'pause' : 'play', 'solid'),
        ))
    }

    /**
     * Emit the canonical component event.
     *
     * @param {string} name - Event suffix.
     * @param {Object} detail - Event detail payload.
     */
    #emit = (name, detail, options) => {
        const event = createEvent(`lgs1920-timeline-${name}`, detail, options)
        this.dispatchEvent(event)
        return event
    }

    /**
     * Emit a cancelable lifecycle start event for a timeline action.
     *
     * @param {string} name - Action name.
     * @param {Object} detail - Action detail.
     * @returns {CustomEvent} Lifecycle start event.
     */
    #emitBefore = (name, detail) => this.#emit(`before-${name}`, detail, {cancelable: true})

    /**
     * Emit a lifecycle completion event for a timeline action.
     *
     * @param {string} name - Action name.
     * @param {Object} detail - Action detail.
     * @returns {CustomEvent} Lifecycle completion event.
     */
    #emitAfter = (name, detail) => this.#emit(`after-${name}`, detail)

    /**
     * Emit a complete lifecycle for an action that has no internal state step.
     *
     * @param {string} name - Action name.
     * @param {Object} detail - Action detail.
     * @returns {boolean} Whether the action was accepted.
     */
    #emitAction = (name, detail) => {
        const before = this.#emitBefore(name, detail)
        if (before.defaultPrevented) return false
        this.#emit(name, detail)
        this.#emitAfter(name, detail)
        return true
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, LGS1920Timeline)
}
