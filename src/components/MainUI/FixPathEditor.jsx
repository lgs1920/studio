/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditor.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {DRAWING_FROM_UI, FIX_PATH_EDITOR_WIDGET, NO_FOCUS, UPDATE_JOURNEY_SILENTLY} from '@Core/constants'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { Utils } from '@Editor/Utils'
import {
    applyFixPathCorrections,
    getFixPathSourcePosition,
    getFixPathSourceFingerprint,
    getChangedFixPathTrackSlugs,
    hasFixPathRouteEdits,
    normalizeFixPathActiveSection,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'
import {
    buildFixPathSectionsFromSourceIndexes,
    buildFixPathControlPointAddition,
    buildDraggedPointCorrections,
    buildFixPathSection,
    removeFixPathControlPointsFromSection,
    translateFixPathControlPoints,
} from '@Utils/cesium/fixPathCorrectionEditing'
import {
    appendScreenSelectionVertex,
    buildSmoothClosedScreenSelectionGeometry,
    createScreenPolygonTester,
    createScreenScanYieldClock,
    groupScreenSelectionPointsByRoute,
    normalizeScreenSelectionArea,
} from '@Utils/cesium/fixPathScreenSelection'
import {ELEVATION_UNITS, INTERNATIONAL, UnitUtils} from '@Utils/UnitUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import { WaIcon } from '@awesome.me/webawesome/dist/react'
import {Cartesian2, Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {FixPathEditorHelp} from './FixPathEditorHelp'
import {buildDisplayedCorrectionPointSelection} from './FixPathEditorSelection'
import {FixPathCallout, FixPathEditorPanel} from './FixPathEditorPanel'
import {
    EMPTY_CORRECTION_TRACKS,
    FIX_PATH_WIDGET_CONFIG,
    SCAN_TIME_BUDGET_MS,
    SOURCE_SCAN_YIELD_CHECK_INTERVAL,
    SOURCE_VISIBILITY_CELL_SIZE,
} from './FixPathEditorConfig'
import {
    cloneCorrectionList,
    correctionAtPoint,
    findClosestProjectedControlPoint,
    findClosestRoutePosition,
    getControlPointCoordinate,
    getGeometrySegments,
    isRouteCoordinateScreenHit,
    isWorldPositionVisible,
    makeId,
    nextAnimationFrame,
    projectCoordinate,
    projectEditOverlay,
    resolveFixPathWidgetZIndex,
    updateControlCoordinate,
    updateControlPointCoordinates,
    worldPositionForCoordinate,
} from './FixPathEditorGeometry'

import './FixPathEditor.css'

/** Close the Fix Path editor through its canonical application store. */
const closeFixPathEditor = () => {
    lgs.stores.journeyEditor.fixPathEditorOpen = false
}

const MAX_HISTORY_ENTRIES = 100
const FIX_PATH_CONTROL_MARKER_RADIUS = 7

/** Return comparable correction data while ignoring fields derived during draft hydration. */
const stableCorrectionSnapshot = correction => ({
    id: correction?.id,
    segmentIndex: correction?.segmentIndex,
    startIndex: correction?.startIndex,
    endIndex: correction?.endIndex,
    sourceFingerprint: correction?.sourceFingerprint,
    controlPoints: (correction?.controlPoints ?? []).map(point => {
        const coordinate = (point.coordinate ?? []).map((value, index) => (
            index >= 2 && Number.isFinite(Number(value)) ? Math.round(Number(value)) : Number(value)
        ))
        return {
            id: point.id,
            coordinate,
            fixed: typeof point.fixed === 'boolean' ? point.fixed : true,
            removed: point.removed === true,
            erased: point.erased === true,
            inserted: point.inserted === true,
        }
    }).sort((first, second) => String(first.id).localeCompare(String(second.id))),
})

/** Check whether a correction is unchanged from its persisted snapshot. */
const isSameCorrectionSnapshot = (correction, persistedCorrection) => Boolean(persistedCorrection)
    && JSON.stringify(stableCorrectionSnapshot(correction))
        === JSON.stringify(stableCorrectionSnapshot(persistedCorrection))

/** Resolve the selection mode and shape modifier from a pointer event. */
const selectionGestureModifier = event => {
    if (event.metaKey) return null
    if (event.ctrlKey && (event.shiftKey || event.altKey)) return 'ctrl'
    if (event.shiftKey) return 'shift'
    if (event.altKey) return 'alt'
    return null
}

/** Return whether a selection modifier requests a freehand lasso. */
const isLassoModifier = modifier => modifier === 'shift' || modifier === 'alt'

/** Resolve the Font Awesome cursor icon for the active selection gesture. */
const selectionCursorIcon = event => {
    const modifier = selectionGestureModifier(event)
    if (modifier === 'ctrl') return 'square-dashed'
    if (isLassoModifier(modifier)) return 'lasso'
    return 'circle-plus'
}

/** Interactive, draft-only path correction editor for all tracks in the current Journey. */
export const FixPathEditor = () => {
    const $editor = lgs.stores.journeyEditor
    const editorRevision = useProxyValue($editor, editor => [
        editor?.fixPathEditorOpen === true,
        editor?.journey?.slug ?? '',
        editor?.track?.slug ?? '',
        editor?.journey?.tracks?.size ?? 0,
        editor?.journey?.fixPathCorrectionData?.revision ?? 0,
        editor?.journey?.fixPathEnabled === true,
    ].join('|'), '')
    void editorRevision

    const journey = lgs.theJourneyEditorProxy?.journey
    const journeySlug = journey?.slug ?? null
    const open = $editor?.fixPathEditorOpen === true && Boolean(journeySlug)
    const widgetListSnapshot = useOptionalSnapshot(lgs.stores.ui?.widget?.list)
    const fixPathZIndex = useMemo(
        () => resolveFixPathWidgetZIndex(widgetListSnapshot),
        [widgetListSnapshot],
    )
    const fixPathWidgetConfig = useMemo(
        () => ({...FIX_PATH_WIDGET_CONFIG, zIndex: fixPathZIndex}),
        [fixPathZIndex],
    )
    const availableTracks = useMemo(
        () => Array.from(journey?.tracks?.values?.() ?? []),
        [journey, editorRevision], // oxlint-disable-line react-hooks/exhaustive-deps -- The editor revision invalidates this cache when the proxied track collection changes.
    )
    const trackBySlug = useMemo(
        () => new Map(availableTracks.map(track => [track.slug, track])),
        [availableTracks],
    )
    const trackByPickedEntityId = useMemo(() => {
        const byEntityId = new Map(availableTracks.map(track => [track.slug, track]))
        const dataSources = lgs.viewer?.dataSources
        const sourceCount = Number(dataSources?.length) || 0
        for (let index = 0; index < sourceCount; index += 1) {
            const source = dataSources.get?.(index)
            const track = trackBySlug.get(source?.name)
            if (!track) continue
            source.entities?.values?.forEach(entity => {
                if (entity.polyline) byEntityId.set(entity.id, track)
            })
        }
        return byEntityId
    }, [availableTracks, trackBySlug])
    const correctionRevision = journey?.fixPathCorrectionData?.revision ?? 0
    const savedCorrectionTracks = useMemo(
        () => journey?.fixPathCorrectionData?.tracks ?? EMPTY_CORRECTION_TRACKS,
        [journey, correctionRevision], // oxlint-disable-line react-hooks/exhaustive-deps -- The persisted revision invalidates this cache when nested correction data changes.
    )
    const originalCorrectionTracks = useMemo(() => Object.fromEntries(availableTracks.map(track => [
        track.slug,
        cloneCorrectionList(savedCorrectionTracks?.[track.slug], track.content),
    ])), [availableTracks, savedCorrectionTracks])
    const [draftCorrectionsByTrack, setDraftCorrectionsByTrack] = useState({})
    const [selection, setSelection] = useState({phase: 'choose-start', startPoint: null, controlPoints: []})
    const [activeCorrection, setActiveCorrection] = useState(null)
    const [selectedControlPoints, setSelectedControlPoints] = useState([])
    const [projected, setProjected] = useState({width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: []})
    const [areaMode, setAreaMode] = useState(true)
    const [areaDrag, setAreaDrag] = useState(null)
    const [journeyCursorIcon, setJourneyCursorIcon] = useState('circle-plus')
    const [journeyCursorSelectionColor, setJourneyCursorSelectionColor] = useState(null)
    const [journeyCursorVisible, setJourneyCursorVisible] = useState(false)
    const [scanProgress, setScanProgress] = useState(null)
    const [helpOpen, setHelpOpen] = useState(false)
    const [widgetResized, setWidgetResized] = useState(false)
    const [dragPreview, setDragPreview] = useState(null)
    const [contextMenu, setContextMenu] = useState(null)
    const [saving, setSaving] = useState(false)
    const [panelFeedback, setPanelFeedback] = useState(null)
    const [eraseMode, setEraseMode] = useState(false)
    const [hiddenCorrectionKeys, setHiddenCorrectionKeys] = useState(() => new Set())
    const [historyAvailability, setHistoryAvailability] = useState({canUndo: false, canRedo: false})
    const contextMenuRef = useRef(null)
    const contextMenuAnchorRef = useRef(null)
    const lastJourneyContextMenuRef = useRef(null)
    const journeyCursorRef = useRef(null)
    const draftCorrectionsRef = useRef({})
    const validationInProgressRef = useRef(false)
    const draftNeedsPersistenceRef = useRef(false)
    const persistDraftCorrectionsRef = useRef(null)
    const mapOverlayRef = useRef(null)
    const scanGenerationRef = useRef(0)
    const dragRef = useRef(null)
    const lassoDraftRef = useRef(null)
    const activeSectionWriteRef = useRef(Promise.resolve())
    const selectionAnchorRef = useRef(null)
    const suppressControlClickRef = useRef(false)
    const lastCenteredSectionRef = useRef(null)
    const editorWasOpenRef = useRef(false)
    const preserveDraftAfterValidationRef = useRef(false)
    const previousCorrectionKeyRef = useRef(null)
    const _history = useRef({undo: [], redo: []})
    const _activeSection = useRef(null)
    const _heightInputSnapshot = useRef(null)
    const _displayContentOverrides = useRef(new Map())
    const lastJourneyHoverHitAtRef = useRef(0)
    const unitSystemSnapshot = useOptionalSnapshot(lgs.settings.unitSystem)
    const unitSystem = Number(unitSystemSnapshot.current ?? INTERNATIONAL)
    const heightUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[INTERNATIONAL]
    const fixPathWidgetCallbacks = useMemo(() => ({
        current: {onResizeStart: () => setWidgetResized(true)},
    }), [])

    /** Clear the active area-selection preview. */
    const clearSelectionLasso = useCallback(() => {
        lassoDraftRef.current = null
        setAreaDrag(null)
    }, [])

    useEffect(() => {
        if (!contextMenu) return undefined
        const menuElement = contextMenuRef.current
        menuElement?.querySelector('[role="menuitem"]')?.focus({preventScroll: true})

        const dismissOnOutsidePointerDown = event => {
            if (!menuElement?.contains(event.target)) {
                setContextMenu(null)
            }
        }
        const dismissOnEscape = event => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setContextMenu(null)
            contextMenuAnchorRef.current?.focus?.({preventScroll: true})
        }

        document.addEventListener('pointerdown', dismissOnOutsidePointerDown, true)
        document.addEventListener('keydown', dismissOnEscape, true)
        return () => {
            document.removeEventListener('pointerdown', dismissOnOutsidePointerDown, true)
            document.removeEventListener('keydown', dismissOnEscape, true)
        }
    }, [contextMenu])

    useEffect(() => {
        if (!contextMenu) lastJourneyContextMenuRef.current = null
    }, [contextMenu])

    /** Keep Undo and Redo controls synchronized with the correction-history stacks. */
    const syncHistoryAvailability = useCallback(() => {
        setHistoryAvailability({
            canUndo: _history.current.undo.length > 0,
            canRedo: _history.current.redo.length > 0,
        })
    }, [])

    /** Keep the active section on the Journey and serialize these preference writes in order. */
    const setPersistedActiveCorrection = useCallback((section, persist = true) => {
        const currentSection = normalizeFixPathActiveSection(section)
        const currentSectionKey = currentSection
            ? currentSection.trackSlug + ':' + currentSection.correctionId
            : null
        if (previousCorrectionKeyRef.current && previousCorrectionKeyRef.current !== currentSectionKey) {
            setWidgetResized(true)
        }
        _activeSection.current = currentSection
        setActiveCorrection(current => (
            current?.trackSlug === currentSection?.trackSlug
            && current?.correctionId === currentSection?.correctionId
                ? current
                : currentSection
        ))
        if (!open || !journey) return

        const savedSection = normalizeFixPathActiveSection(journey.fixPathCorrectionData?.currentSection)
        if (savedSection?.trackSlug === currentSection?.trackSlug
            && savedSection?.correctionId === currentSection?.correctionId) {
            return
        }

        const updateCurrentSection = targetJourney => {
            if (!targetJourney?.fixPathCorrectionData) return
            const nextData = {...targetJourney.fixPathCorrectionData}
            if (currentSection) {
                nextData.currentSection = currentSection
            }
            else {
                delete nextData.currentSection
            }
            targetJourney.fixPathCorrectionData = nextData
        }

        updateCurrentSection(journey)
        const contextualJourney = lgs.getJourneyBySlug?.(journeySlug)
        if (contextualJourney && contextualJourney !== journey) {
            updateCurrentSection(contextualJourney)
        }

        if (!persist) return

        const nextWrite = activeSectionWriteRef.current
            .catch(() => {})
            .then(() => journey.persistToDatabase?.())
        activeSectionWriteRef.current = nextWrite.catch(error => {
            console.error('[FixPathEditor] Could not persist the active section:', error)
        })
    }, [journey, journeySlug, open])

    /** Publish a completed edit locally and optionally validate, persist, and redraw it. */
    const commitDraftCorrections = useCallback((nextDraft, persist = true, options = {}) => {
        if (validationInProgressRef.current) return false
        const previousDraft = draftCorrectionsRef.current
        let historyChanged = false
        if (options.recordHistory !== false && _heightInputSnapshot.current) {
            const pendingHeightEdit = _heightInputSnapshot.current
            _heightInputSnapshot.current = null
            if (pendingHeightEdit.draft !== previousDraft) {
                _history.current.undo.push(pendingHeightEdit)
                if (_history.current.undo.length > MAX_HISTORY_ENTRIES) _history.current.undo.shift()
                _history.current.redo = []
                historyChanged = true
            }
        }
        if (options.recordHistory !== false && nextDraft !== previousDraft) {
            _history.current.undo.push({
                draft: previousDraft,
                section: Object.hasOwn(options, 'historySection') ? options.historySection : _activeSection.current,
            })
            if (_history.current.undo.length > MAX_HISTORY_ENTRIES) _history.current.undo.shift()
            _history.current.redo = []
            historyChanged = true
        }
        if (historyChanged) syncHistoryAvailability()
        draftCorrectionsRef.current = nextDraft
        draftNeedsPersistenceRef.current = true
        setDraftCorrectionsByTrack(nextDraft)
        if (persist) void persistDraftCorrectionsRef.current?.(nextDraft)
        return true
    }, [syncHistoryAvailability])

    /** Persist the current numeric-field draft after Web Awesome commits its value. */
    const persistCurrentDraftCorrections = useCallback(() => {
        if (validationInProgressRef.current) return
        const snapshot = _heightInputSnapshot.current
        if (snapshot && snapshot.draft !== draftCorrectionsRef.current) {
            _history.current.undo.push(snapshot)
            if (_history.current.undo.length > MAX_HISTORY_ENTRIES) _history.current.undo.shift()
            _history.current.redo = []
            syncHistoryAvailability()
        }
        _heightInputSnapshot.current = null
        void persistDraftCorrectionsRef.current?.(draftCorrectionsRef.current)
    }, [syncHistoryAvailability])

    const allDraftCorrections = useMemo(() => Object.entries(draftCorrectionsByTrack)
        .flatMap(([trackSlug, corrections]) => corrections.map(correction => ({...correction, trackSlug}))),
    [draftCorrectionsByTrack])
    const orderedCorrections = useMemo(() => {
        const trackOrder = new Map(availableTracks.map((track, index) => [track.slug, index]))
        return [...allDraftCorrections].sort((first, second) => (
            (trackOrder.get(first.trackSlug) ?? Number.MAX_SAFE_INTEGER)
            - (trackOrder.get(second.trackSlug) ?? Number.MAX_SAFE_INTEGER)
            || first.segmentIndex - second.segmentIndex
            || first.startIndex - second.startIndex
        ))
    }, [allDraftCorrections, availableTracks])
    const orderedControlPoints = useMemo(() => orderedCorrections.flatMap(correction => (
        correction.controlPoints.filter(point => point.removed !== true).map(point => ({
            trackSlug: correction.trackSlug,
            correctionId: correction.id,
            controlPointId: point.id,
        }))
    )), [orderedCorrections])
    const displayedCorrection = orderedCorrections.find(correction => (
        correction.id === activeCorrection?.correctionId && correction.trackSlug === activeCorrection?.trackSlug
    ))
        ?? orderedCorrections[0]
    const contextMenuCorrection = contextMenu?.type !== 'journey' && contextMenu
        ? (draftCorrectionsByTrack[contextMenu.trackSlug] ?? []).find(correction => (
            correction.id === contextMenu.correctionId
        ))
        : null
    const contextMenuPoint = contextMenuCorrection?.controlPoints.find(point => (
        point.id === contextMenu?.controlPointId
    ))
    const contextMenuPointRemoved = contextMenuPoint?.removed === true
    const contextMenuCanReset = Boolean(contextMenuPoint && (contextMenuPointRemoved || contextMenuPoint.fixed === true))
    const contextMenuCanRemove = Boolean(contextMenuPoint && !contextMenuPointRemoved)
    const activeCorrectionIndex = orderedCorrections.indexOf(displayedCorrection)
    const currentCorrectionKey = displayedCorrection
        ? displayedCorrection.trackSlug + ':' + displayedCorrection.id
        : null
    useLayoutEffect(() => {
        const previousCorrectionKey = previousCorrectionKeyRef.current
        previousCorrectionKeyRef.current = currentCorrectionKey
        if (!widgetResized || !previousCorrectionKey || previousCorrectionKey === currentCorrectionKey) {
            return undefined
        }

        const widgetManager = globalThis.__?.ui?.widgetManager
        const widgetElement = widgetManager?.getElementById?.(FIX_PATH_EDITOR_WIDGET)
        if (!widgetElement) {
            return undefined
        }

        const widgetConfig = widgetManager.getWidgetConfig?.(FIX_PATH_EDITOR_WIDGET)
        const scaleY = Number(widgetConfig?.scale?.y) > 0 ? Number(widgetConfig.scale.y) : 1
        const previousHeight = Number(widgetConfig?.dimensions?.height) || 0
        const currentHeight = Number(widgetElement.getBoundingClientRect().height) / scaleY
        const retainedHeight = Math.max(previousHeight, currentHeight)
        if (retainedHeight > 0) {
            widgetElement.style.height = `${retainedHeight}px`
        }

        requestAnimationFrame(() => {
            if (!widgetElement.isConnected) {
                return
            }

            const bounds = widgetElement.getBoundingClientRect()
            if (widgetConfig) {
                const scaleX = Number(widgetConfig.scale?.x) > 0 ? Number(widgetConfig.scale.x) : 1
                widgetConfig.dimensions = {width: bounds.width / scaleX, height: bounds.height / scaleY}
            }
            widgetManager.getMoveable?.(FIX_PATH_EDITOR_WIDGET)?.current?.updateRect?.()
        })

    }, [currentCorrectionKey, widgetResized])
    const currentCorrectionVisible = !currentCorrectionKey || !hiddenCorrectionKeys.has(currentCorrectionKey)
    const onCorrectionVisibilityChange = visible => {
        if (!currentCorrectionKey) return
        setHiddenCorrectionKeys(current => {
            const next = new Set(current)
            if (visible) next.delete(currentCorrectionKey)
            else next.add(currentCorrectionKey)
            return next
        })
    }
    const hasVisibleSectionFixes = orderedCorrections.some(correction => (
        !hiddenCorrectionKeys.has(correction.trackSlug + ':' + correction.id)
    ))
    const toggleSectionFixes = useCallback(() => {
        setHiddenCorrectionKeys(() => hasVisibleSectionFixes
            ? new Set(orderedCorrections.map(correction => correction.trackSlug + ':' + correction.id))
            : new Set())
    }, [hasVisibleSectionFixes, orderedCorrections])
    const displayedTrack = displayedCorrection ? trackBySlug.get(displayedCorrection.trackSlug) : null
    const displayedCorrectionPreview = useMemo(() => displayedCorrection && displayedTrack?.content
        ? applyFixPathCorrections(displayedTrack.content, [displayedCorrection]).content
        : null, [displayedCorrection, displayedTrack])

    /** Restore one correction-history snapshot and persist its active section with the draft. */
    const restoreCorrectionHistory = useCallback(direction => {
        if (validationInProgressRef.current) return
        const sourceStack = direction === 'undo' ? _history.current.undo : _history.current.redo
        const targetStack = direction === 'undo' ? _history.current.redo : _history.current.undo
        const snapshot = sourceStack.pop()
        if (!snapshot) return

        targetStack.push({draft: draftCorrectionsRef.current, section: _activeSection.current})
        if (targetStack === _history.current.undo && targetStack.length > MAX_HISTORY_ENTRIES) {
            targetStack.shift()
        }

        const availableCorrections = availableTracks.flatMap(track => (
            (snapshot.draft[track.slug] ?? []).map(correction => ({...correction, trackSlug: track.slug}))
        )).sort((first, second) => (
            availableTracks.findIndex(track => track.slug === first.trackSlug)
            - availableTracks.findIndex(track => track.slug === second.trackSlug)
            || first.segmentIndex - second.segmentIndex
            || first.startIndex - second.startIndex
        ))
        const restoredSection = snapshot.section && availableCorrections.find(correction => (
            correction.trackSlug === snapshot.section.trackSlug && correction.id === snapshot.section.correctionId
        ))
        const nextSection = restoredSection ?? availableCorrections[0]
        setPersistedActiveCorrection(nextSection
            ? {trackSlug: nextSection.trackSlug, correctionId: nextSection.id}
            : null, false)
        draftCorrectionsRef.current = snapshot.draft
        draftNeedsPersistenceRef.current = true
        setDraftCorrectionsByTrack(snapshot.draft)
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setAreaDrag(null)
        setDragPreview(null)
        setContextMenu(null)
        syncHistoryAvailability()
        void persistDraftCorrectionsRef.current?.(snapshot.draft)
    }, [availableTracks, setPersistedActiveCorrection, syncHistoryAvailability])

    /** Undo the most recent correction edit affecting the Journey. */
    const undoCorrectionEdit = useCallback(() => restoreCorrectionHistory('undo'), [restoreCorrectionHistory])

    /** Redo the most recently undone correction edit affecting the Journey. */
    const redoCorrectionEdit = useCallback(() => restoreCorrectionHistory('redo'), [restoreCorrectionHistory])

    /** Pan the map so the selected section is centered while preserving the camera pose and scale. */
    const recenterCorrectionSection = useCallback(correction => {
        if (!correction) return
        const sectionKey = correction.trackSlug + ':' + correction.id
        if (lastCenteredSectionRef.current === sectionKey) return

        const viewer = lgs.viewer
        const scene = viewer?.scene
        const canvas = viewer?.canvas
        const camera = viewer?.camera
        const content = trackBySlug.get(correction.trackSlug)?.content
        if (!scene || !canvas || !camera?.setView || !content) return

        const sectionPoints = correction.controlPoints.filter(point => point.removed !== true)
        const centerPoint = sectionPoints.reduce((closest, point) => (
            !closest || Math.abs(point.progress - 0.5) < Math.abs(closest.progress - 0.5) ? point : closest
        ), null)
        const preview = applyFixPathCorrections(content, [correction]).content
        const sourceSegment = getGeometrySegments(content.geometry)[correction.segmentIndex]
        const sourceMidpoint = sourceSegment?.[Math.round((correction.startIndex + correction.endIndex) / 2)]
        const targetCoordinate = centerPoint
            ? getControlPointCoordinate(content, correction, centerPoint, preview)
            : sourceMidpoint
        const targetPosition = worldPositionForCoordinate(scene, targetCoordinate)
        if (!targetPosition) return

        const viewportCenter = new Cartesian2(
            Math.round(canvas.clientWidth / 2),
            Math.round(canvas.clientHeight / 2),
        )
        const centerRay = camera.getPickRay?.(viewportCenter)
        const currentCenter = centerRay ? scene.globe?.pick?.(centerRay, scene) : null
        const storedTarget = lgs.stores?.main?.components?.camera?.target
        const storedTargetPosition = Number.isFinite(Number(storedTarget?.longitude))
            && Number.isFinite(Number(storedTarget?.latitude))
            ? Cartesian3.fromDegrees(
                Number(storedTarget.longitude),
                Number(storedTarget.latitude),
                Number(storedTarget.simulatedHeight ?? storedTarget.height ?? 0),
            )
            : null
        const currentSurface = currentCenter
            ?? camera.pickEllipsoid?.(viewportCenter, scene.globe?.ellipsoid)
            ?? storedTargetPosition
        const cameraPosition = camera.positionWC
        const direction = camera.directionWC
        const up = camera.upWC
        if (!currentSurface || !cameraPosition || !direction || !up) return

        const translation = Cartesian3.subtract(targetPosition, currentSurface, new Cartesian3())
        const destination = Cartesian3.add(cameraPosition, translation, new Cartesian3())
        const cameraFrustum = camera.frustum
        const frustumSnapshot = cameraFrustum?.clone?.()
        camera.setView({
            destination,
            orientation: {
                direction: Cartesian3.clone(direction),
                up: Cartesian3.clone(up),
            },
        })
        frustumSnapshot?.clone?.(cameraFrustum)
        lastCenteredSectionRef.current = sectionKey
    }, [trackBySlug])

    // Reset editable drafts when the persisted Journey editing session changes.
    useEffect(() => {
        const isOpening = open && !editorWasOpenRef.current
        editorWasOpenRef.current = open
        if (open && preserveDraftAfterValidationRef.current) {
            preserveDraftAfterValidationRef.current = false
            return
        }
        const nextDraft = Object.fromEntries(availableTracks.map(track => [
            track.slug,
            cloneCorrectionList(savedCorrectionTracks?.[track.slug], track.content),
        ]))
        _history.current = {undo: [], redo: []}
        _heightInputSnapshot.current = null
        setHistoryAvailability({canUndo: false, canRedo: false})
        draftCorrectionsRef.current = nextDraft
        draftNeedsPersistenceRef.current = false
        setDraftCorrectionsByTrack(nextDraft)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        const savedSection = normalizeFixPathActiveSection(journey?.fixPathCorrectionData?.currentSection)
        const savedSectionExists = savedSection
            && nextDraft[savedSection.trackSlug]?.some(correction => correction.id === savedSection.correctionId)
        const trackOrder = new Map(availableTracks.map((track, index) => [track.slug, index]))
        const nextCorrections = availableTracks.flatMap(track => (
            nextDraft[track.slug].map(correction => ({...correction, trackSlug: track.slug}))
        )).sort((first, second) => (
            (trackOrder.get(first.trackSlug) ?? Number.MAX_SAFE_INTEGER)
            - (trackOrder.get(second.trackSlug) ?? Number.MAX_SAFE_INTEGER)
            || first.segmentIndex - second.segmentIndex
            || first.startIndex - second.startIndex
        ))
        const sectionToFocus = (savedSectionExists
            ? nextCorrections.find(correction => (
                correction.trackSlug === savedSection.trackSlug && correction.id === savedSection.correctionId
            ))
            : null) ?? nextCorrections[0]
        const restoredActiveSection = savedSectionExists ? savedSection : null
        _activeSection.current = restoredActiveSection
        setActiveCorrection(restoredActiveSection)
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setAreaMode(true)
        setAreaDrag(null)
        setScanProgress(null)
        setDragPreview(null)
        lastCenteredSectionRef.current = null
        if (isOpening) {
            setEraseMode(false)
            setHiddenCorrectionKeys(new Set())
            recenterCorrectionSection(sectionToFocus)
        }
    }, [open, journeySlug, correctionRevision, savedCorrectionTracks, availableTracks, recenterCorrectionSection]) // oxlint-disable-line react-hooks/exhaustive-deps -- Navigation reads the saved section during draft hydration but must not reset the draft on every section change.

    // Keep Cesium navigation available while the editor is open; selection handlers own only their active gestures.
    useLayoutEffect(() => {
        const viewer = lgs.viewer
        const controller = viewer?.scene?.screenSpaceCameraController
        if (!open || !controller) {
            return undefined
        }
        const movementProperties = ['enableInputs', 'enableTranslate']
        const previousMovement = Object.fromEntries(movementProperties.map(property => [property, controller[property]]))
        movementProperties.forEach(property => {
            if (typeof controller[property] === 'boolean') {
                controller[property] = true
            }
        })
        return () => {
            movementProperties.forEach(property => {
                if (controller[property] === true) {
                    controller[property] = previousMovement[property]
                }
            })
        }
    }, [open])

    useEffect(() => {
        if (!open) {
            return undefined
        }
        return () => { scanGenerationRef.current += 1 }
    }, [open])

    // Stop camera modes through their shared owner before Fix Path takes over map input.
    useEffect(() => {
        if (!open) {
            return
        }
        const cameraModes = lgs.stores?.ui?.mainUI
        if (!cameraModes?.rotate?.running && !cameraModes?.panorama?.active) {
            return
        }
        const poiManager = globalThis.__?.ui?.poiManager
        if (typeof poiManager?.stopRotationAndSync === 'function') {
            void poiManager.stopRotationAndSync().catch(error => {
                console.error('[FixPathEditor] Could not stop orbit or panorama:', error)
            })
        }
    }, [open])

    const close = useCallback(() => {
        if (validationInProgressRef.current) return
        if (draftNeedsPersistenceRef.current) {
            void persistDraftCorrectionsRef.current?.(draftCorrectionsRef.current)
            return
        }
        scanGenerationRef.current += 1
        dragRef.current = null
        preserveDraftAfterValidationRef.current = false
        setHelpOpen(false)
        setPanelFeedback(null)
        closeFixPathEditor()
        setContextMenu(null)
        setDragPreview(null)
        setAreaDrag(null)
        setScanProgress(null)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        selectionAnchorRef.current = null
    }, [])

    const focusJourney = useCallback(async () => {
        const currentJourney = lgs.theJourney ?? journey
        if (!currentJourney) {
            return
        }

        await currentJourney.focus({resetCamera: true, rotate: false})
    }, [journey])

    const displayCorrectionsByTrack = useMemo(() => {
        if (!dragPreview) {
            return draftCorrectionsByTrack
        }
        if (dragPreview.kind === 'control') {
            return updateControlPointCoordinates(
                draftCorrectionsByTrack,
                dragPreview.translatedControlPoints ?? [],
            )
        }
        const trackContent = trackBySlug.get(dragPreview.trackSlug)?.content
        const corrections = draftCorrectionsByTrack[dragPreview.trackSlug] ?? []
        return {
            ...draftCorrectionsByTrack,
            [dragPreview.trackSlug]: buildDraggedPointCorrections(
                trackContent,
                corrections,
                dragPreview.segmentIndex,
                dragPreview.index,
                dragPreview.coordinate,
            ).corrections,
        }
    }, [draftCorrectionsByTrack, dragPreview, trackBySlug])

    // Keep the editor's corrected and uncorrected views confined to Cesium map drawing.
    useEffect(() => {
        const previousOverrides = _displayContentOverrides.current
        const nextOverrides = new Map()
        if (open) {
            availableTracks.forEach(track => {
                const corrections = displayCorrectionsByTrack[track.slug] ?? []
                if (!track.content || corrections.length === 0) return
                const visibleCorrections = corrections.filter(correction => (
                    !hiddenCorrectionKeys.has(track.slug + ':' + correction.id)
                ))
                nextOverrides.set(track, applyFixPathCorrections(track.content, visibleCorrections).content)
            })
        }

        const affectedTracks = new Set([...previousOverrides.keys(), ...nextOverrides.keys()])
        affectedTracks.forEach(track => {
            const hadOverride = previousOverrides.has(track)
            const hasOverride = nextOverrides.has(track)
            const previousContent = previousOverrides.get(track)
            const nextContent = nextOverrides.get(track)
            if (hadOverride === hasOverride && previousContent === nextContent) return
            TrackUtils.setDisplayContentOverride(track, nextContent ?? null)
            void Promise.resolve(TrackUtils.draw(track, {action: DRAWING_FROM_UI})).catch(error => {
                console.error('[FixPathEditor] Could not redraw correction visibility:', error)
            })
        })
        _displayContentOverrides.current = nextOverrides
    }, [open, availableTracks, displayCorrectionsByTrack, hiddenCorrectionKeys])

    useEffect(() => () => {
        Array.from(_displayContentOverrides.current.keys()).forEach(track => {
            TrackUtils.setDisplayContentOverride(track, null)
            void Promise.resolve(TrackUtils.draw(track, {action: DRAWING_FROM_UI})).catch(error => {
                console.error('[FixPathEditor] Could not restore the Journey route after closing Fix Path:', error)
            })
        })
        _displayContentOverrides.current.clear()
    }, [])

    // Reproject only selected Journey points and corrected geometry without walking every source vertex per render.
    useEffect(() => {
        const viewer = lgs.viewer
        const overlay = mapOverlayRef.current
        const scene = viewer?.scene
        if (!open || !viewer || !scene || !overlay) {
            setProjected({width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: []})
            return undefined
        }
        let lastProjectionTime = 0
        const update = () => {
            const now = Date.now()
            if (now - lastProjectionTime < 80) {
                return
            }
            lastProjectionTime = now
            setProjected(projectEditOverlay(
                viewer,
                overlay,
                [],
                availableTracks,
                displayCorrectionsByTrack,
                selection,
                displayedCorrection,
                hiddenCorrectionKeys,
            ))
        }
        const removePostRender = scene.postRender?.addEventListener?.(update)
        update()
        return () => removePostRender?.()
    }, [open, availableTracks, displayCorrectionsByTrack, selection, displayedCorrection, hiddenCorrectionKeys])

    const pointAtScreenPosition = useCallback((clientX, clientY) => {
        const canvas = lgs.viewer?.canvas
        const scene = lgs.viewer?.scene
        const camera = lgs.viewer?.camera
        if (!canvas || !scene || !camera) {
            return null
        }
        const rect = canvas.getBoundingClientRect()
        const position = new Cartesian2(
            (clientX - rect.left) * canvas.width / rect.width,
            (clientY - rect.top) * canvas.height / rect.height,
        )
        let worldPosition = null
        if (scene.pickPositionSupported === true) {
            try {
                worldPosition = scene.pickPosition(position)
            }
            catch {
                worldPosition = null
            }
        }
        if (!worldPosition) {
            const ray = camera.getPickRay?.(position)
            worldPosition = ray ? scene.globe?.pick?.(ray, scene) : null
        }
        if (!worldPosition) {
            worldPosition = camera.pickEllipsoid?.(position, scene.globe?.ellipsoid)
        }
        if (!worldPosition) {
            return null
        }
        const cartographic = Cartographic.fromCartesian(worldPosition)
        const terrainHeight = scene.globe?.getHeight?.(cartographic)
        const height = Number.isFinite(terrainHeight)
            ? terrainHeight
            : Number.isFinite(cartographic.height) ? cartographic.height : 0
        return [CesiumMath.toDegrees(cartographic.longitude), CesiumMath.toDegrees(cartographic.latitude), Math.round(height)]
    }, [])

    const pickedTrackAtPosition = useCallback(position => {
        const picked = lgs.viewer?.scene?.pick?.(position)
        const pickedId = typeof picked?.id === 'string' ? picked.id : picked?.id?.id
        const dataSourceName = picked?.id?.entityCollection?.owner?.name
        return trackByPickedEntityId.get(pickedId)
            ?? trackByPickedEntityId.get(dataSourceName)
            ?? trackByPickedEntityId.get(picked?.primitive?.id)
            ?? null
    }, [trackByPickedEntityId])

    const canvasPositionFromClient = useCallback((clientX, clientY) => {
        const canvas = lgs.viewer?.canvas
        const rect = canvas?.getBoundingClientRect?.()
        if (!canvas || !rect || rect.width <= 0 || rect.height <= 0) return null
        return new Cartesian2(
            (clientX - rect.left) * canvas.width / rect.width,
            (clientY - rect.top) * canvas.height / rect.height,
        )
    }, [])

    /** Resolve a visible route hit and map its interval back to original GPX indices. */
    const journeyMapHit = useCallback((clientX, clientY, pickedTrack = null) => {
        const scene = lgs.viewer?.scene
        const camera = lgs.viewer?.camera
        const canvasPosition = canvasPositionFromClient(clientX, clientY)
        const scenePickedTrack = pickedTrack ?? (canvasPosition ? pickedTrackAtPosition(canvasPosition) : null)
        const coordinate = pointAtScreenPosition(clientX, clientY)
        if (!coordinate) return null

        /** Find the nearest corrected route without terrain queries for every vertex. */
        const findNearestRoute = tracks => {
            let closest = null
            tracks.forEach(track => {
                if (!track?.content) return
                const visibleCorrections = (displayCorrectionsByTrack[track.slug] ?? []).filter(correction => (
                    !hiddenCorrectionKeys.has(track.slug + ':' + correction.id)
                ))
                const displayedContent = applyFixPathCorrections(track.content, visibleCorrections).content
                const routePosition = findClosestRoutePosition(displayedContent?.geometry, coordinate)
                if (routePosition && (!closest || routePosition.distanceMeters < closest.routePosition.distanceMeters)) {
                    closest = {track, displayedContent, routePosition}
                }
            })
            return closest
        }

        let closestRoute = findNearestRoute(scenePickedTrack ? [scenePickedTrack] : availableTracks)
        /** Validate one nearest route candidate without projecting the whole track. */
        const isScreenHit = candidate => Boolean(candidate && isRouteCoordinateScreenHit(
            scene,
            camera,
            canvasPosition,
            candidate.routePosition.coordinate,
        ))

        if (!isScreenHit(closestRoute)) {
            if (!scenePickedTrack) return null
            closestRoute = findNearestRoute(availableTracks.filter(track => track !== scenePickedTrack))
            if (!isScreenHit(closestRoute)) return null
        }

        const {track, displayedContent, routePosition} = closestRoute
        const snappedCoordinate = routePosition.coordinate ?? coordinate
        const sourcePosition = getFixPathSourcePosition(
            displayedContent,
            routePosition.segmentIndex,
            routePosition.index,
            routePosition.progress,
        )
        if (!Number.isFinite(sourcePosition)) {
            return {trackSlug: track.slug, ...routePosition, coordinate: snappedCoordinate}
        }

        const sourceSegment = getGeometrySegments(track.content.geometry)[routePosition.segmentIndex]
        if (!Array.isArray(sourceSegment) || sourceSegment.length < 2) {
            return {trackSlug: track.slug, ...routePosition, coordinate: snappedCoordinate}
        }
        const sourceIndex = Math.min(sourceSegment.length - 2, Math.max(0, Math.floor(sourcePosition)))
        return {
            trackSlug: track.slug,
            ...routePosition,
            index: sourceIndex,
            progress: Math.min(1, Math.max(0, sourcePosition - sourceIndex)),
            coordinate: snappedCoordinate,
        }
    }, [availableTracks, canvasPositionFromClient, displayCorrectionsByTrack, hiddenCorrectionKeys, pickedTrackAtPosition, pointAtScreenPosition])

    const addJourneyControlPoint = useCallback(routeTarget => {
        if (validationInProgressRef.current || scanProgress || !routeTarget) return false
        if (selection.phase === 'add-points' && selection.startPoint) {
            const sameSection = routeTarget.trackSlug === selection.startPoint.trackSlug
                && routeTarget.segmentIndex === selection.startPoint.segmentIndex
            if (!sameSection) {
                setPanelFeedback({
                    type: 'warning',
                    caption: 'Choose a point on the current Journey section',
                    text: 'A section can only contain points from the same track segment.',
                })
                return false
            }
            const controlPoints = [...(selection.controlPoints ?? []), {
                id: makeId(),
                coordinate: routeTarget.coordinate,
                sourcePosition: routeTarget.index + routeTarget.progress,
            }]
            setSelection({...selection, controlPoints})
            setPanelFeedback(null)
            return true
        }
        const track = trackBySlug.get(routeTarget.trackSlug)
        if (!track?.content) return false
        const corrections = draftCorrectionsRef.current[routeTarget.trackSlug] ?? []
        const result = buildFixPathControlPointAddition(
            track.content,
            corrections,
            routeTarget.segmentIndex,
            routeTarget.index,
            routeTarget.progress,
            routeTarget.coordinate,
        )
        if (result.error || !result.correction || !result.controlPointId) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Fix Path point could not be added',
                text: result.error ?? 'The selected Journey position is no longer available.',
            })
            return false
        }

        const previousSection = _activeSection.current
        setPersistedActiveCorrection({trackSlug: routeTarget.trackSlug, correctionId: result.correction.id}, false)
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [routeTarget.trackSlug]: result.corrections,
        }, true, {historySection: previousSection})
        const selectedPoint = {
            trackSlug: routeTarget.trackSlug,
            correctionId: result.correction.id,
            controlPointId: result.controlPointId,
        }
        setSelectedControlPoints([selectedPoint])
        selectionAnchorRef.current = selectedPoint
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setAreaMode(false)
        setPanelFeedback(null)
        return true
    }, [commitDraftCorrections, scanProgress, selection, setPersistedActiveCorrection, trackBySlug])

    const openJourneyContextMenu = useCallback((routeTarget, x, y) => {
        if (!routeTarget) return
        const previous = lastJourneyContextMenuRef.current
        const isAlreadyOpen = previous && Date.now() - previous.at < 500
            && Math.abs(previous.x - x) < 2
            && Math.abs(previous.y - y) < 2
        if (isAlreadyOpen) return
        contextMenuAnchorRef.current = lgs.viewer?.canvas
        lastJourneyContextMenuRef.current = {x, y, at: Date.now()}
        setContextMenu({type: 'journey', routeTarget, x, y})
    }, [])

    const handleJourneyPointerMove = useCallback(event => {
        const canvas = lgs.viewer?.canvas
        if (!canvas) return
        setJourneyCursorIcon(selectionCursorIcon(event))
        setJourneyCursorSelectionColor(event.shiftKey ? 'journey' : event.altKey ? 'section' : null)
        const container = lgs.viewer?.container
        const drag = dragRef.current
        const isAreaSelectionDrag = drag?.kind === 'control-area' || drag?.kind === 'section-area'
        const isControlPointTarget = Boolean(event.target?.closest?.('.fix-path-control-point'))
        const isModifiedControlPointTarget = isControlPointTarget && selectionGestureModifier(event)
        const isClickLassoDraft = Boolean(lassoDraftRef.current && selectionGestureModifier(event))
        const canShowCursor = event.target === canvas || isAreaSelectionDrag
            || isModifiedControlPointTarget || isClickLassoDraft
        const cursor = journeyCursorRef.current
        /** Keep native cursor suppression synchronized with the overlay visibility. */
        const setCursorVisible = isVisible => {
            setJourneyCursorVisible(isVisible)
            canvas.classList.toggle('fix-path-journey-hover', isVisible)
            container?.classList.toggle('fix-path-custom-cursor', isVisible)
            cursor?.classList.toggle('is-visible', isVisible)
        }
        if (!canShowCursor || event.pointerType === 'touch') {
            setCursorVisible(false)
            return
        }
        const position = canvasPositionFromClient(event.clientX, event.clientY)
        const pickedTrack = position ? pickedTrackAtPosition(position) : null
        let isJourneyHovered = isAreaSelectionDrag || Boolean(isModifiedControlPointTarget)
            || isClickLassoDraft || (event.target === canvas && Boolean(selectionGestureModifier(event)))
            || Boolean(position && pickedTrack)
        const now = performance.now()
        if (!isJourneyHovered && position && now - lastJourneyHoverHitAtRef.current >= 80) {
            lastJourneyHoverHitAtRef.current = now
            isJourneyHovered = Boolean(journeyMapHit(event.clientX, event.clientY))
        }
        else if (!isJourneyHovered && position) {
            isJourneyHovered = canvas.classList.contains('fix-path-journey-hover')
        }
        const overlayRect = mapOverlayRef.current?.getBoundingClientRect()
        if (!isJourneyHovered || !cursor || !overlayRect) {
            setCursorVisible(false)
            return
        }
        setCursorVisible(true)
        cursor.style.left = `${event.clientX - overlayRect.left}px`
        cursor.style.top = `${event.clientY - overlayRect.top}px`
    }, [canvasPositionFromClient, journeyMapHit, pickedTrackAtPosition])

    /** Refresh the custom map cursor when a selection modifier changes. */
    const handleJourneyCursorModifierChange = useCallback(event => {
        setJourneyCursorIcon(selectionCursorIcon(event))
        setJourneyCursorSelectionColor(event.shiftKey ? 'journey' : event.altKey ? 'section' : null)
    }, [])

    /** Hide the custom cursor and restore the native cursor when leaving Cesium's canvas. */
    const handleJourneyPointerLeave = useCallback(() => {
        const drag = dragRef.current
        if (drag?.kind === 'control-area' || drag?.kind === 'section-area') return
        lgs.viewer?.canvas?.classList.remove('fix-path-journey-hover')
        lgs.viewer?.container?.classList.remove('fix-path-custom-cursor')
        journeyCursorRef.current?.classList.remove('is-visible')
        setJourneyCursorVisible(false)
        setJourneyCursorIcon('circle-plus')
        setJourneyCursorSelectionColor(null)
    }, [])

    const handleJourneyClick = useCallback(event => {
        if (validationInProgressRef.current || selection.phase === 'add-points'
            || eraseMode || scanProgress || event.target !== lgs.viewer?.canvas
            || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
            return
        }
        const routeTarget = journeyMapHit(event.clientX, event.clientY)
        if (!routeTarget) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        lgs.viewer.selectedEntity = undefined
        addJourneyControlPoint(routeTarget)
    }, [addJourneyControlPoint, eraseMode, journeyMapHit, scanProgress, selection.phase])

    const handleJourneyContextMenu = useCallback(event => {
        if (validationInProgressRef.current || scanProgress || event.target !== lgs.viewer?.canvas) return
        const routeTarget = journeyMapHit(event.clientX, event.clientY)
        if (!routeTarget) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        globalThis.__?.ui?.contextMenu?.hide?.()
        openJourneyContextMenu(routeTarget, event.clientX, event.clientY)
    }, [journeyMapHit, openJourneyContextMenu, scanProgress])

    const handleJourneyRightClick = useCallback(event => {
        if (validationInProgressRef.current || scanProgress) return false
        const position = event?.position
        const canvas = lgs.viewer?.canvas
        const rect = canvas?.getBoundingClientRect?.()
        if (!position || !rect) return false
        const clientX = rect.left + position.x * rect.width / (canvas.clientWidth || rect.width)
        const clientY = rect.top + position.y * rect.height / (canvas.clientHeight || rect.height)
        const routeTarget = journeyMapHit(clientX, clientY)
        if (!routeTarget) return false
        openJourneyContextMenu(routeTarget, clientX, clientY)
        return true
    }, [journeyMapHit, openJourneyContextMenu, scanProgress])

    useEffect(() => {
        const canvasEvents = globalThis.__?.canvasEvents
        if (!open || !canvasEvents?.onRightClick) return undefined
        canvasEvents.onRightClick(handleJourneyRightClick, {
            entity: false,
            priority: 100,
            preventLowerPriority: 'handled',
        })
        return () => canvasEvents.offRightClick?.(handleJourneyRightClick)
    }, [handleJourneyRightClick, open])

    const startCorrection = useCallback((point, extendExisting = false) => {
        if (validationInProgressRef.current) return
        setPanelFeedback(null)
        if (selection.phase === 'choose-start') {
            const existingCorrection = correctionAtPoint(
                draftCorrectionsRef.current[point.trackSlug] ?? [],
                point.segmentIndex,
                point.index,
            )
            if (existingCorrection && !extendExisting) {
                setPersistedActiveCorrection({trackSlug: point.trackSlug, correctionId: existingCorrection.id})
                return
            }
            if (existingCorrection) {
                setPersistedActiveCorrection({trackSlug: point.trackSlug, correctionId: existingCorrection.id}, false)
            }
            setSelection({
                phase: 'add-points',
                startPoint: {
                    trackSlug: point.trackSlug,
                    segmentIndex: point.segmentIndex,
                    index: point.index,
                },
                controlPoints: [],
            })
            return
        }
        if (selection.phase !== 'add-points' || !selection.startPoint) {
            return
        }
        if (point.trackSlug !== selection.startPoint.trackSlug
            || point.segmentIndex !== selection.startPoint.segmentIndex
            || point.index <= selection.startPoint.index) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Choose a nearby attachment point',
                text: 'A correction section must end later on the same track segment.',
            })
            return
        }
        const trackContent = trackBySlug.get(point.trackSlug)?.content
        const corrections = draftCorrectionsRef.current[point.trackSlug] ?? []
        const bridgesCorrection = corrections.some(correction => correction.segmentIndex === point.segmentIndex
            && correction.startIndex <= point.index
            && correction.endIndex >= selection.startPoint.index)
        if (!(selection.controlPoints?.length > 0) && !bridgesCorrection) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Add a correction point first',
                text: 'Click along the corrected route, then choose its nearby attachment point.',
            })
            return
        }
        const result = buildFixPathSection(
            trackContent,
            corrections,
            point.segmentIndex,
            selection.startPoint.index,
            point.index,
            selection.controlPoints,
        )
        if (result.error || !result.correction) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Fix Path section could not be created',
                text: result.error ?? 'Choose valid points on the same Journey segment.',
            })
            return
        }
        const historySection = _activeSection.current
        setPersistedActiveCorrection({trackSlug: point.trackSlug, correctionId: result.correction.id}, false)
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [point.trackSlug]: result.corrections,
        }, true, {historySection})
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }, [commitDraftCorrections, selection, setPersistedActiveCorrection, trackBySlug])

    const addControlPoint = useCallback((event, clientX, clientY) => {
        if (validationInProgressRef.current) return
        if (selection.phase !== 'add-points' || !selection.startPoint) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        setPanelFeedback(null)
        const startTrack = trackBySlug.get(selection.startPoint.trackSlug)
        const routeTarget = startTrack ? journeyMapHit(clientX, clientY, startTrack) : null
        if (!routeTarget
            || routeTarget.trackSlug !== selection.startPoint.trackSlug
            || routeTarget.segmentIndex !== selection.startPoint.segmentIndex) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Choose a point on the current Journey section',
                text: 'A section can only contain points from the same track segment.',
            })
            return
        }
        const controlPoints = [...(selection.controlPoints ?? []), {
            id: makeId(),
            coordinate: routeTarget.coordinate,
            sourcePosition: routeTarget.index + routeTarget.progress,
        }]
        setSelection({...selection, controlPoints})
    }, [journeyMapHit, selection, trackBySlug])

    /** Project the Journey and retain visible source points inside a screen polygon. */
    const scanSelectedPolygon = useCallback(async (polygon, sourceScope = {}) => {
        const viewer = lgs.viewer
        const scene = viewer?.scene
        const canvas = viewer?.canvas
        const overlay = mapOverlayRef.current
        if (!scene || !canvas || !overlay) {
            return []
        }
        const containsPoint = createScreenPolygonTester(polygon)
        if (!containsPoint) {
            return []
        }
        const generation = ++scanGenerationRef.current
        setPanelFeedback(null)
        const routeSegments = availableTracks
            .filter(track => !sourceScope.trackSlug || track.slug === sourceScope.trackSlug)
            .flatMap(track => getGeometrySegments(track.content?.geometry)
                .map((coordinates, segmentIndex) => ({trackSlug: track.slug, segmentIndex, coordinates})))
            .filter(segment => !Number.isInteger(sourceScope.segmentIndex)
                || segment.segmentIndex === sourceScope.segmentIndex)
        const total = routeSegments.reduce((sum, segment) => sum + segment.coordinates.length, 0)
        const overlayRect = overlay.getBoundingClientRect()
        const canvasRect = canvas.getBoundingClientRect()
        const candidates = []
        const yieldClock = createScreenScanYieldClock(SCAN_TIME_BUDGET_MS)
        let processed = 0
        setAreaMode(false)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        clearSelectionLasso()
        setScanProgress({phase: 'project', value: 0, processed: 0, total})

        for (const segment of routeSegments) {
            for (let index = 0; index < segment.coordinates.length; index += 1) {
                const coordinate = segment.coordinates[index]
                const worldPosition = worldPositionForCoordinate(scene, coordinate)
                const screen = projectCoordinate(scene, overlayRect, canvasRect, canvas, coordinate, worldPosition)
                if (screen && containsPoint({x: screen.x, y: screen.y})) {
                    candidates.push({
                        trackSlug: segment.trackSlug,
                        segmentIndex: segment.segmentIndex,
                        index,
                        coordinate,
                        worldPosition: screen.worldPosition,
                        x: screen.x,
                        y: screen.y,
                        canvasX: screen.canvasX,
                        canvasY: screen.canvasY,
                    })
                }
                processed += 1
                if (processed % SOURCE_SCAN_YIELD_CHECK_INTERVAL === 0) {
                    setScanProgress({
                        phase: 'project',
                        value: total > 0 ? Math.min(70, Math.round(processed / total * 70)) : 70,
                        processed,
                        total,
                    })
                    if (!yieldClock.shouldYield()) {
                        if (scanGenerationRef.current !== generation) {
                            return
                        }
                        continue
                    }
                    await nextAnimationFrame()
                    yieldClock.reset()
                    if (scanGenerationRef.current !== generation) {
                        return
                    }
                }
            }
        }

        const candidateZones = groupScreenSelectionPointsByRoute(candidates)
        const visibilityCells = new Map()
        candidateZones.forEach((zone, zoneIndex) => {
            const firstPoint = zone[0]
            const zoneId = firstPoint.trackSlug + ':' + firstPoint.segmentIndex + ':' + firstPoint.index + ':' + zoneIndex
            zone.forEach(point => {
                point.selectionZoneId = zoneId
                const cell = zoneId + ':' + Math.floor(point.x / SOURCE_VISIBILITY_CELL_SIZE) + ':' + Math.floor(point.y / SOURCE_VISIBILITY_CELL_SIZE)
                const group = visibilityCells.get(cell) ?? []
                group.push(point)
                visibilityCells.set(cell, group)
            })
        })
        const groups = [...visibilityCells.values()]
        const visiblePoints = []
        for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index]
            const point = group[0]
            const visible = isWorldPositionVisible(
                scene,
                scene.camera,
                new Cartesian2(point.canvasX, point.canvasY),
                point.worldPosition,
            )
            if (visible) {
                visiblePoints.push(...group)
            }
            if (yieldClock.shouldYield()) {
                setScanProgress({
                    phase: 'visibility',
                    value: 70 + Math.round((index + 1) / Math.max(1, groups.length) * 30),
                    processed: total,
                    total,
                })
                await nextAnimationFrame()
                yieldClock.reset()
                if (scanGenerationRef.current !== generation) {
                    return
                }
            }
        }

        if (scanGenerationRef.current !== generation) {
            return
        }
        setScanProgress(null)
        if (visiblePoints.length === 0) {
            setPanelFeedback({
                type: 'warning',
                caption: 'No Journey points in this area',
                text: 'Select a larger screen area that contains one or more visible route points.',
            })
        }
        return visiblePoints
    }, [availableTracks, clearSelectionLasso])

    /** Create or extend only the route intervals represented by selected Journey points. */
    const createCorrectionSectionsFromSourcePoints = useCallback(sourcePoints => {
        if (validationInProgressRef.current || sourcePoints.length === 0) {
            return false
        }
        setPanelFeedback(null)

        const selectedByZone = new Map()
        sourcePoints.forEach(point => {
            if (!trackBySlug.has(point.trackSlug) || !Number.isInteger(point.segmentIndex)
                || !Number.isInteger(point.index) || !point.selectionZoneId) return
            const selected = selectedByZone.get(point.selectionZoneId) ?? {
                trackSlug: point.trackSlug,
                segmentIndex: point.segmentIndex,
                sourceIndexes: new Set(),
            }
            selected.sourceIndexes.add(point.index)
            selectedByZone.set(point.selectionZoneId, selected)
        })

        const previousSection = _activeSection.current
        const previousDraft = draftCorrectionsRef.current
        const nextDraft = {...previousDraft}
        let activeSection = null
        const errors = []
        selectedByZone.forEach(({trackSlug, segmentIndex, sourceIndexes}) => {
            const trackContent = trackBySlug.get(trackSlug)?.content
            if (!trackContent) return
            const corrections = nextDraft[trackSlug] ?? []
            const result = buildFixPathSectionsFromSourceIndexes(
                trackContent,
                corrections,
                segmentIndex,
                sourceIndexes,
            )
            if (result.sections.length === 0) {
                errors.push(...result.errors)
                return
            }
            nextDraft[trackSlug] = result.corrections
            errors.push(...result.errors)
            activeSection ??= {trackSlug, correctionId: result.sections[0].id}
        })

        if (!activeSection) {
            if (errors.length > 0) {
                setPanelFeedback({
                    type: 'warning',
                    caption: 'Could not create a correction section',
                    text: errors[0],
                })
            }
            return false
        }

        setPersistedActiveCorrection(activeSection, false)
        if (JSON.stringify(nextDraft) !== JSON.stringify(previousDraft)) {
            commitDraftCorrections(nextDraft, true, {historySection: previousSection})
        }
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setAreaMode(false)
        if (errors.length > 0) {
            setPanelFeedback({
                type: 'warning',
                caption: 'Some selected Journey points were skipped',
                text: errors[0],
            })
        }
        return true
    }, [commitDraftCorrections, setPersistedActiveCorrection, trackBySlug])

    /** Complete a source-point or correction-point rectangle or lasso selection. */
    const finishSelectionLasso = useCallback((draft, vertices) => {
        const polygon = draft.shape === 'lasso'
            ? buildSmoothClosedScreenSelectionGeometry(vertices).polygon
            : vertices
        if (polygon.length < 3) {
            clearSelectionLasso()
            return false
        }

        clearSelectionLasso()
        if (draft.kind === 'source') {
            const selectionScope = orderedCorrections.find(correction => (
                correction.trackSlug === draft.trackSlug && correction.id === draft.correctionId
            ))
            void scanSelectedPolygon(polygon, selectionScope
                ? {trackSlug: selectionScope.trackSlug, segmentIndex: selectionScope.segmentIndex}
                : {}
            ).then(sourcePoints => {
                if (!Array.isArray(sourcePoints) || sourcePoints.length === 0) return
                createCorrectionSectionsFromSourcePoints(sourcePoints)
            })
            return true
        }

        const sameSection = point => point.trackSlug === draft.trackSlug
            && point.correctionId === draft.correctionId
        const containsPoint = createScreenPolygonTester(polygon)
        if (!containsPoint) return true
        const enclosedPoints = projected.controlPoints
            .filter(point => sameSection(point) && containsPoint(point))
            .map(point => ({
                trackSlug: point.trackSlug,
                correctionId: point.correctionId,
                controlPointId: point.controlPointId,
            }))
        if (enclosedPoints.length === 0) return true

        const currentSelection = draft.replaceSelection ? [] : selectedControlPoints.filter(sameSection)
        const nextSelection = [...new Map([...currentSelection, ...enclosedPoints]
            .map(point => [point.controlPointId, point])).values()]
        setSelectedControlPoints(nextSelection)
        const anchor = selectionAnchorRef.current
        selectionAnchorRef.current = anchor && sameSection(anchor)
            && nextSelection.some(point => point.controlPointId === anchor.controlPointId)
            ? anchor
            : nextSelection[0] ?? null
        setPersistedActiveCorrection({trackSlug: draft.trackSlug, correctionId: draft.correctionId})
        setAreaMode(false)
        return true
    }, [clearSelectionLasso, createCorrectionSectionsFromSourcePoints, orderedCorrections, projected.controlPoints, scanSelectedPolygon, selectedControlPoints, setPersistedActiveCorrection])

    /** Start a route-point or correction-point selection using its configured rectangle or lasso gesture. */
    const handleControlSelectionPointerDown = useCallback(event => {
        const marker = event.target?.closest?.('.fix-path-control-point')
        const markerPoint = marker
            ? projected.controlPoints.find(point => point.trackSlug === marker.dataset.trackSlug
                && point.correctionId === marker.dataset.correctionId
                && point.controlPointId === marker.dataset.controlPointId)
            : null
        const modifier = selectionGestureModifier(event)
        const lasso = isLassoModifier(modifier)
        const replaceSelection = event.altKey === true
        const sourceSelection = !replaceSelection && (modifier === 'shift' || modifier === 'ctrl')
        const previousLasso = lassoDraftRef.current
        const continuesLasso = lasso && previousLasso?.modifier === modifier
            && previousLasso.replaceSelection === replaceSelection
        const selectSourcePoints = continuesLasso
            ? previousLasso.kind === 'source'
            : sourceSelection
        if (scanProgress || (selection.phase === 'add-points' && !marker && !sourceSelection)
            || event.button !== 0 || !modifier
            || event.pointerType === 'touch'
            || event.target?.closest?.('.fix-path-panel, .fix-path-context-menu')) {
            return
        }

        const mode = continuesLasso ? previousLasso.kind : selectSourcePoints ? 'source' : 'control'
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) return
        const start = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const pointAtStart = markerPoint ?? findClosestProjectedControlPoint(projected.controlPoints, start)
        const lockedSection = selectedControlPoints[0] ?? selectionAnchorRef.current
        if (mode === 'control' && lockedSection && pointAtStart && (
            pointAtStart.trackSlug !== lockedSection.trackSlug
            || pointAtStart.correctionId !== lockedSection.correctionId
        )) {
            return
        }
        const section = continuesLasso
            ? {trackSlug: previousLasso.trackSlug, correctionId: previousLasso.correctionId}
            : mode === 'source'
                ? orderedCorrections.find(correction => (
                    correction.trackSlug === _activeSection.current?.trackSlug
                    && correction.id === _activeSection.current?.correctionId
                )) ?? displayedCorrection
            : lockedSection ?? pointAtStart ?? activeCorrection ?? displayedCorrection
        const correctionId = section?.correctionId ?? section?.id ?? null
        if (mode === 'control' && (!section?.trackSlug || !correctionId)) return

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        catch {
            // Keep the selection gesture alive if the browser invalidates capture.
        }
        if (previousLasso && !continuesLasso) clearSelectionLasso()
        const points = appendScreenSelectionVertex(continuesLasso ? previousLasso.points : [], start)
        dragRef.current = {
            kind: mode === 'source' ? 'section-area' : 'control-area',
            mode,
            shape: lasso ? 'lasso' : 'rectangle',
            start,
            current: start,
            points,
            moved: false,
            trackSlug: section?.trackSlug ?? null,
            correctionId,
            modifier,
            selectionColor: event.altKey ? 'section' : 'journey',
            replaceSelection,
            markerControlPointId: markerPoint?.controlPointId,
            previousLasso: continuesLasso ? previousLasso : null,
        }
        setAreaDrag(lasso
            ? {shape: 'lasso', kind: mode, modifier, selectionColor: dragRef.current.selectionColor, points}
            : {shape: 'rectangle', modifier, selectionColor: dragRef.current.selectionColor, start, current: start})
    }, [activeCorrection, clearSelectionLasso, displayedCorrection, orderedCorrections, projected.controlPoints, scanProgress, selectedControlPoints, selection.phase])

    /** Track rectangle bounds or freehand lasso vertices while suspending Cesium gestures. */
    const handleControlSelectionPointerMove = useCallback(event => {
        const drag = dragRef.current
        if (drag?.kind !== 'control-area' && drag?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) return
        const current = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const moved = drag.moved || Math.hypot(current.x - drag.start.x, current.y - drag.start.y) >= 4
        const points = drag.shape === 'lasso' && moved
            ? appendScreenSelectionVertex(drag.points, current, 4)
            : drag.points
        dragRef.current = {...drag, current, moved, points}
        setAreaDrag(drag.shape === 'lasso'
            ? {shape: 'lasso', kind: drag.mode, modifier: drag.modifier, selectionColor: drag.selectionColor, points}
            : {shape: 'rectangle', modifier: drag.modifier, selectionColor: drag.selectionColor, start: drag.start, current})
    }, [])

    /** Finish a rectangle or freehand lasso on pointer release. */
    const handleControlSelectionPointerUp = useCallback(event => {
        const drag = dragRef.current
        if (drag?.kind !== 'control-area' && drag?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        dragRef.current = null
        handleJourneyPointerMove(event)
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            clearSelectionLasso()
            return
        }
        const end = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const moved = drag.moved || Math.hypot(end.x - drag.start.x, end.y - drag.start.y) >= 4
        if (!moved && drag.mode === 'control' && drag.modifier === 'shift' && drag.markerControlPointId) {
            const sameSection = point => point.trackSlug === drag.trackSlug
                && point.correctionId === drag.correctionId
            const currentSelection = selectedControlPoints.filter(sameSection)
            const point = projected.controlPoints.find(item => (
                item.controlPointId === drag.markerControlPointId && sameSection(item)
            ))
            if (!point) {
                clearSelectionLasso()
                return
            }
            const target = {
                trackSlug: point.trackSlug,
                correctionId: point.correctionId,
                controlPointId: point.controlPointId,
            }
            const alreadySelected = currentSelection.some(item => item.controlPointId === target.controlPointId)
            const nextSelection = alreadySelected
                ? currentSelection.filter(item => item.controlPointId !== target.controlPointId)
                : [...currentSelection, target]
            setSelectedControlPoints(nextSelection)
            const anchor = selectionAnchorRef.current
            selectionAnchorRef.current = nextSelection.length === 0
                ? null
                : anchor && sameSection(anchor)
                    && nextSelection.some(item => item.controlPointId === anchor.controlPointId)
                    ? anchor
                    : nextSelection[0]
            setPersistedActiveCorrection({trackSlug: drag.trackSlug, correctionId: drag.correctionId})
            if (nextSelection.length > 0) setAreaMode(false)
            clearSelectionLasso()
            return
        }

        if (!moved && drag.mode === 'control' && drag.modifier === 'alt'
            && drag.markerControlPointId && !drag.previousLasso) {
            clearSelectionLasso()
            return
        }

        if (!moved && drag.shape === 'lasso') {
            const points = appendScreenSelectionVertex(drag.points, end)
            const draft = {
                shape: 'lasso',
                kind: drag.mode,
                modifier: drag.modifier,
                selectionColor: drag.selectionColor,
                replaceSelection: drag.replaceSelection,
                trackSlug: drag.trackSlug,
                correctionId: drag.correctionId,
                points,
            }
            lassoDraftRef.current = draft
            setAreaDrag({shape: 'lasso', kind: drag.mode, modifier: drag.modifier, selectionColor: drag.selectionColor, points})
            handleJourneyPointerMove(event)
            return
        }

        let polygon
        if (drag.shape === 'lasso') {
            const points = moved ? appendScreenSelectionVertex(drag.points, end, 4) : drag.points
            polygon = points.length >= 3 ? points : []
        }
        else {
            const area = normalizeScreenSelectionArea(drag.start, end)
            const selectionArea = area.width < 4 || area.height < 4
                ? normalizeScreenSelectionArea(
                    {x: drag.start.x - 10, y: drag.start.y - 10},
                    {x: drag.start.x + 10, y: drag.start.y + 10},
                )
                : area
            polygon = [
                {x: selectionArea.left, y: selectionArea.top},
                {x: selectionArea.right, y: selectionArea.top},
                {x: selectionArea.right, y: selectionArea.bottom},
                {x: selectionArea.left, y: selectionArea.bottom},
            ]
        }
        finishSelectionLasso({...drag, kind: drag.mode}, polygon)
    }, [clearSelectionLasso, finishSelectionLasso, handleJourneyPointerMove, projected.controlPoints, selectedControlPoints, setPersistedActiveCorrection])

    /** Discard an area selection interrupted by pointer cancellation. */
    const handleControlSelectionPointerCancel = useCallback(event => {
        const drag = dragRef.current
        if (drag?.kind !== 'control-area' && drag?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        dragRef.current = null
        clearSelectionLasso()
        handleJourneyPointerMove(event)
    }, [clearSelectionLasso, handleJourneyPointerMove])

    /** Keep polygon-vertex clicks from triggering map or marker actions before the lasso closes. */
    const handleSelectionClickCapture = useCallback(event => {
        const draft = lassoDraftRef.current
        if (!draft || selectionGestureModifier(event) !== draft.modifier
            || event.target?.closest?.('.fix-path-panel, .fix-path-context-menu')) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
    }, [])

    /** Close a click-vertex lasso with a double-click. */
    const handleSelectionDoubleClickCapture = useCallback(event => {
        const draft = lassoDraftRef.current
        if (!draft || selectionGestureModifier(event) !== draft.modifier
            || event.target?.closest?.('.fix-path-panel, .fix-path-context-menu')) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            clearSelectionLasso()
            return
        }
        const position = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        finishSelectionLasso(draft, appendScreenSelectionVertex(draft.points, position))
    }, [clearSelectionLasso, finishSelectionLasso])

    /** Cancel an unfinished click-vertex lasso with Escape. */
    const handleSelectionLassoKeyDown = useCallback(event => {
        if (event.key !== 'Escape' || !lassoDraftRef.current) return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        clearSelectionLasso()
    }, [clearSelectionLasso])

    /**
     * Add a correction control point from a map click during section editing.
     * @param {MouseEvent} event - Cesium canvas click event.
     */
    const handleMapClick = useCallback(event => {
        if (validationInProgressRef.current || selection.phase !== 'add-points') {
            return
        }
        if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            return
        }
        addControlPoint(event, event.clientX, event.clientY)
        event.stopImmediatePropagation?.()
    }, [addControlPoint, selection.phase])

    useEffect(() => {
        const canvas = lgs.viewer?.canvas
        const container = lgs.viewer?.container
        if (!open || !canvas || !container) return undefined

        container.addEventListener('pointermove', handleJourneyPointerMove, true)
        canvas.addEventListener('click', handleJourneyClick, true)
        canvas.addEventListener('contextmenu', handleJourneyContextMenu, true)
        canvas.addEventListener('pointerleave', handleJourneyPointerLeave)
        document.addEventListener('keydown', handleJourneyCursorModifierChange, true)
        document.addEventListener('keyup', handleJourneyCursorModifierChange, true)
        const cursorElement = journeyCursorRef.current

        return () => {
            canvas.classList.remove('fix-path-journey-hover')
            container.classList.remove('fix-path-custom-cursor')
            cursorElement?.classList.remove('is-visible')
            setJourneyCursorVisible(false)
            container.removeEventListener('pointermove', handleJourneyPointerMove, true)
            canvas.removeEventListener('click', handleJourneyClick, true)
            canvas.removeEventListener('contextmenu', handleJourneyContextMenu, true)
            canvas.removeEventListener('pointerleave', handleJourneyPointerLeave)
            document.removeEventListener('keydown', handleJourneyCursorModifierChange, true)
            document.removeEventListener('keyup', handleJourneyCursorModifierChange, true)
        }
    }, [handleJourneyClick, handleJourneyContextMenu, handleJourneyCursorModifierChange, handleJourneyPointerLeave, handleJourneyPointerMove, open])

    // Keep map gestures on Cesium's canvas and intercept only gestures owned by Fix Path.
    useEffect(() => {
        const canvas = lgs.viewer?.canvas
        const container = lgs.viewer?.container
        if (!open || !canvas || !container) {
            return undefined
        }

        container.addEventListener('pointerdown', handleControlSelectionPointerDown, true)
        container.addEventListener('pointermove', handleControlSelectionPointerMove, true)
        container.addEventListener('pointerup', handleControlSelectionPointerUp, true)
        container.addEventListener('pointercancel', handleControlSelectionPointerCancel, true)
        container.addEventListener('click', handleSelectionClickCapture, true)
        container.addEventListener('dblclick', handleSelectionDoubleClickCapture, true)
        document.addEventListener('keydown', handleSelectionLassoKeyDown, true)

        if (selection.phase === 'add-points') {
            canvas.addEventListener('click', handleMapClick, true)
        }

        return () => {
            container.removeEventListener('pointerdown', handleControlSelectionPointerDown, true)
            container.removeEventListener('pointermove', handleControlSelectionPointerMove, true)
            container.removeEventListener('pointerup', handleControlSelectionPointerUp, true)
            container.removeEventListener('pointercancel', handleControlSelectionPointerCancel, true)
            container.removeEventListener('click', handleSelectionClickCapture, true)
            container.removeEventListener('dblclick', handleSelectionDoubleClickCapture, true)
            document.removeEventListener('keydown', handleSelectionLassoKeyDown, true)
            canvas.removeEventListener('click', handleMapClick, true)
        }
    }, [
        open,
        selection.phase,
        handleControlSelectionPointerDown,
        handleControlSelectionPointerMove,
        handleControlSelectionPointerUp,
        handleControlSelectionPointerCancel,
        handleSelectionClickCapture,
        handleSelectionDoubleClickCapture,
        handleSelectionLassoKeyDown,
        handleMapClick,
    ])

    const handleWheel = event => {
        const viewer = lgs.viewer
        if (!viewer?.camera || event.target?.closest?.('.fix-path-panel')) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        if (scanProgress) {
            return
        }
        const height = Number(viewer.camera.positionCartographic?.height)
        const distance = Math.max(10, (Number.isFinite(height) ? height : 1000) * 0.12)
        if (event.deltaY < 0) {
            viewer.camera.zoomIn(distance)
        }
        else if (event.deltaY > 0) {
            viewer.camera.zoomOut(distance)
        }
    }

    /** Clear point-drag ownership and its preview before releasing browser capture. */
    const clearPointDrag = useCallback(() => {
        const drag = dragRef.current
        if (!drag || ['area', 'control-area', 'section-area'].includes(drag.kind)) return null
        dragRef.current = null
        setDragPreview(null)
        if (drag.moved) suppressControlClickRef.current = true
        try {
            if (drag.captureElement?.hasPointerCapture?.(drag.pointerId)) {
                drag.captureElement.releasePointerCapture(drag.pointerId)
            }
        }
        catch {
            // Capture may already have been lost or its marker removed.
        }
        return drag
    }, [])

    /** Discard an interrupted point drag without saving its preview. */
    const cancelPointDrag = useCallback(event => {
        const drag = dragRef.current
        if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return
        clearPointDrag()
    }, [clearPointDrag])

    /** Start a point drag owned by one primary-button pointer. */
    const handlePointDragStart = (event, drag) => {
        if (validationInProgressRef.current || event.button !== 0 || event.isPrimary === false) return
        clearPointDrag()
        event.preventDefault()
        event.stopPropagation()
        if (drag.kind === 'control') {
            suppressControlClickRef.current = false
            setPersistedActiveCorrection({trackSlug: drag.trackSlug, correctionId: drag.correctionId})
        }
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        catch {
            // A browser can invalidate the pointer before capture; keep the drag session alive.
        }
        dragRef.current = {
            ...drag,
            pointerId: event.pointerId,
            captureElement: event.currentTarget,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        }
    }

    /** Move points only while their owning pointer still holds the primary button. */
    const handlePointDragMove = useCallback(event => {
        if (validationInProgressRef.current || !dragRef.current
            || ['area', 'control-area', 'section-area'].includes(dragRef.current.kind)
            || event.pointerId !== dragRef.current.pointerId) {
            return
        }
        if ((event.buttons & 1) === 0) {
            cancelPointDrag(event)
            return
        }
        event.preventDefault()
        event.stopPropagation()
        if (!dragRef.current.moved && Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY) < 3) {
            return
        }
        const coordinate = pointAtScreenPosition(event.clientX, event.clientY)
        if (!coordinate) {
            return
        }
        const translatedControlPoints = dragRef.current.kind === 'control'
            ? translateFixPathControlPoints(
                dragRef.current.selectedControlPoints,
                dragRef.current,
                coordinate,
            )
            : undefined
        if (dragRef.current.kind === 'control') {
            setSelectedControlPoints(dragRef.current.selectionAfterDrag)
            selectionAnchorRef.current = dragRef.current.selectionAnchorAfterDrag
            suppressControlClickRef.current = true
        }
        dragRef.current = {...dragRef.current, moved: true, coordinate, translatedControlPoints}
        setDragPreview(dragRef.current)
    }, [cancelPointDrag, pointAtScreenPosition])

    /** Report a rejected drag without discarding the editable section. */
    const showDragError = useCallback(message => setPanelFeedback({
        type: 'warning',
        caption: 'Fix Path point not moved',
        text: message,
    }), [])

    /** Commit the last valid preview when the owning primary-button pointer is released. */
    const handlePointDragEnd = useCallback(event => {
        if (!dragRef.current
            || ['area', 'control-area', 'section-area'].includes(dragRef.current.kind)
            || event.pointerId !== dragRef.current.pointerId) {
            return
        }
        if (event.button !== 0) {
            cancelPointDrag(event)
            return
        }
        event.preventDefault()
        event.stopPropagation()
        const drag = clearPointDrag()
        if (validationInProgressRef.current) return
        if (!drag.moved) {
            return
        }
        if (!drag.coordinate) {
            return
        }
        setPanelFeedback(null)
        if (drag.kind === 'control') {
            commitDraftCorrections(updateControlPointCoordinates(
                draftCorrectionsRef.current,
                drag.translatedControlPoints ?? translateFixPathControlPoints(
                    drag.selectedControlPoints,
                    drag,
                    drag.coordinate,
                ),
            ))
            return
        }
        const trackContent = trackBySlug.get(drag.trackSlug)?.content
        const result = buildDraggedPointCorrections(
            trackContent,
            draftCorrectionsRef.current[drag.trackSlug] ?? [],
            drag.segmentIndex,
            drag.index,
            drag.coordinate,
        )
        if (result.error) {
            showDragError(result.error)
            return
        }
        commitDraftCorrections({...draftCorrectionsRef.current, [drag.trackSlug]: result.corrections})
    }, [cancelPointDrag, clearPointDrag, commitDraftCorrections, showDragError, trackBySlug])

    // Window capture keeps release/cancel observable even when a marker loses
    // capture or the pointer leaves the map. Area selection retains its own handlers.
    useEffect(() => {
        if (!open) return undefined
        /** Discard a drag when its tab becomes hidden. */
        const cancelHiddenDrag = () => {
            if (document.visibilityState === 'hidden') cancelPointDrag()
        }
        window.addEventListener('pointermove', handlePointDragMove, true)
        window.addEventListener('pointerup', handlePointDragEnd, true)
        window.addEventListener('pointercancel', cancelPointDrag, true)
        window.addEventListener('lostpointercapture', cancelPointDrag, true)
        window.addEventListener('blur', cancelPointDrag)
        document.addEventListener('visibilitychange', cancelHiddenDrag)
        return () => {
            window.removeEventListener('pointermove', handlePointDragMove, true)
            window.removeEventListener('pointerup', handlePointDragEnd, true)
            window.removeEventListener('pointercancel', cancelPointDrag, true)
            window.removeEventListener('lostpointercapture', cancelPointDrag, true)
            window.removeEventListener('blur', cancelPointDrag)
            document.removeEventListener('visibilitychange', cancelHiddenDrag)
            clearPointDrag()
        }
    }, [cancelPointDrag, clearPointDrag, handlePointDragEnd, handlePointDragMove, open])

    const resolveControlPointSelection = (event, target) => {
        const anchor = selectionAnchorRef.current
        const togglesPoint = Boolean(event?.shiftKey)
        const lockedSection = selectedControlPoints[0] ?? anchor
        const isInSection = point => point.trackSlug === target.trackSlug
            && point.correctionId === target.correctionId
        if (lockedSection && !isInSection(lockedSection)) {
            return {selectedControlPoints, anchor, ignored: true}
        }

        if (event?.shiftKey && anchor) {
            if (!isInSection(anchor)) {
                return {selectedControlPoints, anchor, ignored: true}
            }
            const sectionPoints = orderedControlPoints.filter(point => (
                point.trackSlug === anchor.trackSlug && point.correctionId === anchor.correctionId
            ))
            const anchorIndex = sectionPoints.findIndex(point => point.controlPointId === anchor.controlPointId)
            const targetIndex = sectionPoints.findIndex(point => point.controlPointId === target.controlPointId)
            if (anchorIndex >= 0 && targetIndex >= 0) {
                const range = sectionPoints.slice(
                    Math.min(anchorIndex, targetIndex),
                    Math.max(anchorIndex, targetIndex) + 1,
                )
                if (!togglesPoint) {
                    return {selectedControlPoints: range, anchor}
                }
                const selectedKeys = new Set([
                    ...selectedControlPoints.filter(point => (
                        point.trackSlug === anchor.trackSlug && point.correctionId === anchor.correctionId
                    )),
                    ...range,
                ].map(point => (
                    point.trackSlug + ':' + point.correctionId + ':' + point.controlPointId
                )))
                return {
                    selectedControlPoints: sectionPoints.filter(point => selectedKeys.has(
                        point.trackSlug + ':' + point.correctionId + ':' + point.controlPointId,
                    )),
                    anchor,
                }
            }
        }

        if (togglesPoint) {
            const sectionSelection = lockedSection
                ? selectedControlPoints.filter(point => (
                    point.trackSlug === lockedSection.trackSlug
                    && point.correctionId === lockedSection.correctionId
                ))
                : selectedControlPoints
            const alreadySelected = sectionSelection.some(point => point.controlPointId === target.controlPointId)
            const selection = alreadySelected
                ? sectionSelection.filter(point => point.controlPointId !== target.controlPointId)
                : [...sectionSelection, target]
            return {
                selectedControlPoints: selection,
                anchor: selection.length === 0
                    ? null
                    : anchor && isInSection(anchor) && selection.some(point => point.controlPointId === anchor.controlPointId)
                        ? anchor
                        : selection[0],
            }
        }

        return {selectedControlPoints: [target], anchor: target}
    }

    const selectCorrectionPoint = (event, trackSlug, correctionId, controlPointId, activateSection = false) => {
        if (validationInProgressRef.current) return
        const target = {trackSlug, correctionId, controlPointId}
        const result = activateSection
            ? {selectedControlPoints: [target], anchor: target}
            : resolveControlPointSelection(event, target)
        if (result.ignored) return
        clearSelectionLasso()
        selectionAnchorRef.current = result.anchor
        setSelectedControlPoints(result.selectedControlPoints)
        setPersistedActiveCorrection({trackSlug, correctionId})
        setAreaMode(false)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }

    /** Toggle selection of every visible control point in the displayed correction. */
    const toggleDisplayedCorrectionPointSelection = () => {
        if (validationInProgressRef.current || !displayedCorrection) return
        const nextSelection = buildDisplayedCorrectionPointSelection(displayedCorrection, selectedControlPoints)
        if (nextSelection === null) return

        clearSelectionLasso()
        selectionAnchorRef.current = nextSelection[0] ?? null
        setSelectedControlPoints(nextSelection)
        setPersistedActiveCorrection({
            trackSlug: displayedCorrection.trackSlug,
            correctionId: displayedCorrection.id,
        })
        setAreaMode(false)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }

    const handleCorrectionPointRowKeyDown = (event, trackSlug, correctionId, controlPointId) => {
        if (event.target !== event.currentTarget) {
            return
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            selectCorrectionPoint(event, trackSlug, correctionId, controlPointId)
        }
    }

    const handleCorrectionPointListKeyDown = event => {
        if (event.key !== 'ArrowUp'
            && event.key !== 'ArrowDown'
            && event.key !== 'PageUp'
            && event.key !== 'PageDown') {
            return
        }

        const rows = Array.from(
            event.currentTarget.querySelectorAll('.fix-path-correction-point-row'),
        )
        const composedPath = event.nativeEvent?.composedPath?.() ?? event.composedPath?.() ?? []
        const currentRow = event.target?.closest?.('.fix-path-correction-point-row')
            ?? composedPath.find(target => target?.matches?.('.fix-path-correction-point-row'))
        const currentIndex = rows.indexOf(currentRow)
        if (currentIndex < 0 || rows.length === 0) {
            return
        }

        let nextIndex
        if (event.key === 'PageUp') {
            nextIndex = 0
        } else if (event.key === 'PageDown') {
            nextIndex = rows.length - 1
        } else {
            const direction = event.key === 'ArrowUp' ? -1 : 1
            nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction))
        }

        event.preventDefault()
        event.stopPropagation()
        rows[nextIndex].focus()
    }

    const getControlPointActionState = (trackSlug, correctionId, controlPointId) => {
        const correction = (draftCorrectionsRef.current[trackSlug] ?? []).find(item => item.id === correctionId)
        const point = correction?.controlPoints.find(item => item.id === controlPointId)
        const removed = point?.removed === true
        return {
            point,
            canReset: Boolean(point && (removed || point.fixed === true)),
            canRemove: Boolean(point && !removed),
        }
    }

    const applyControlPointKeyboardShortcut = (event, target) => {
        if (validationInProgressRef.current) return false
        const actions = getControlPointActionState(target.trackSlug, target.correctionId, target.controlPointId)
        const resetByLegacyShortcut = event.key.toLowerCase() === 'r' && (event.ctrlKey || event.metaKey)
        if ((event.key === 'Backspace' && actions.canReset) || (resetByLegacyShortcut && actions.point)) {
            event.preventDefault()
            event.stopPropagation()
            resetControlPoint(target.trackSlug, target.correctionId, target.controlPointId)
            return true
        }
        if (event.key === 'Delete' && actions.canRemove) {
            event.preventDefault()
            event.stopPropagation()
            removeControlPoint(target.trackSlug, target.correctionId, target.controlPointId)
            return true
        }
        return false
    }

    const handleFixPathShortcut = event => {
        if (validationInProgressRef.current) return
        const composedPath = event.nativeEvent?.composedPath?.() ?? event.composedPath?.() ?? []
        const row = event.target?.closest?.('.fix-path-correction-point-row')
            ?? composedPath.find(target => target?.matches?.('.fix-path-correction-point-row'))
        const actionButton = event.target?.closest?.('wa-button, button')
            ?? composedPath.find(target => target?.matches?.('wa-button, button'))
        const editingField = composedPath.some(target => target?.matches?.(
            'input, textarea, select, [contenteditable="true"], wa-input, wa-number-input, wa-select',
        ))
        const isEditingTextKey = event.key === 'Backspace' || event.key === 'Delete'
        if (row && !actionButton && !(editingField && isEditingTextKey)) {
            const target = {
                trackSlug: row.dataset.trackSlug,
                correctionId: row.dataset.correctionId,
                controlPointId: row.dataset.controlPointId,
            }
            if (applyControlPointKeyboardShortcut(event, target)) return
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && displayedCorrection) {
            const allSectionPoints = displayedCorrection.controlPoints
                .filter(point => point.removed !== true)
                .map(point => ({
                    trackSlug: displayedCorrection.trackSlug,
                    correctionId: displayedCorrection.id,
                    controlPointId: point.id,
                }))
            if (allSectionPoints.length === 0) return
            event.preventDefault()
            event.stopPropagation()
            setSelectedControlPoints(allSectionPoints)
            selectionAnchorRef.current = allSectionPoints[0]
        }
    }

    const controlPointForEvent = (event, fallback) => {
        // A marker's SVG group is the hit target. Keep its own identity when close markers overlap.
        if (event.currentTarget?.classList?.contains('fix-path-control-point')) {
            return fallback
        }
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            return fallback
        }
        return findClosestProjectedControlPoint(projected.controlPoints, {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        }, fallback) ?? fallback
    }

    const handleControlPointPointerDown = (event, renderedPoint) => {
        if (validationInProgressRef.current || event.button !== 0 || event.isPrimary === false) return
        const point = controlPointForEvent(event, renderedPoint)
        if (eraseMode && point.active && event.button === 0) {
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            return
        }
        if (!point.active && event.button === 0) {
            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            return
        }
        event.preventDefault()
        const target = {
            trackSlug: point.trackSlug,
            correctionId: point.correctionId,
            controlPointId: point.controlPointId,
        }
        const alreadySelected = selectedControlPoints.some(selected => selected.trackSlug === target.trackSlug
            && selected.correctionId === target.correctionId
            && selected.controlPointId === target.controlPointId)
        const result = resolveControlPointSelection(event, target)
        if (result.ignored) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        const dragSelection = alreadySelected && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
            ? selectedControlPoints
            : result.selectedControlPoints
        const selectedSnapshots = dragSelection.flatMap(selected => {
            const corrections = draftCorrectionsByTrack[selected.trackSlug] ?? []
            const correction = corrections.find(item => item.id === selected.correctionId
                && item.controlPoints.some(control => control.id === selected.controlPointId))
            const control = correction?.controlPoints.find(item => item.id === selected.controlPointId)
            const trackContent = trackBySlug.get(selected.trackSlug)?.content
            return control && control.removed !== true
                ? [{
                    trackSlug: selected.trackSlug,
                    correctionId: correction.id,
                    controlPointId: control.id,
                    coordinate: getControlPointCoordinate(trackContent, correction, control),
                }]
                : []
        })
        const origin = selectedSnapshots.find(selected => selected.trackSlug === target.trackSlug
            && selected.correctionId === target.correctionId
            && selected.controlPointId === target.controlPointId)
        if (!origin) {
            return
        }
        handlePointDragStart(event, {
            kind: 'control',
            ...target,
            selectedControlPoints: selectedSnapshots,
            selectionAfterDrag: dragSelection,
            selectionAnchorAfterDrag: result.anchor,
        })
    }

    const handleControlPointClick = (event, renderedPoint) => {
        event.preventDefault()
        event.stopPropagation()
        if (suppressControlClickRef.current) {
            suppressControlClickRef.current = false
            return
        }
        if (validationInProgressRef.current) return
        const point = controlPointForEvent(event, renderedPoint)
        // Shift pointer gestures are owned by the Journey-area selection handlers above.
        if (event.shiftKey) return
        if (eraseMode) {
            if (point.active) {
                removeControlPointsFromSection(
                    orderedCorrections.find(correction => (
                        correction.trackSlug === point.trackSlug && correction.id === point.correctionId
                    )),
                    new Set([point.controlPointId]),
                )
            }
            return
        }
        if (Number.isInteger(point.sourceIndex)
            && selection.phase === 'add-points') {
            startCorrection({...point, index: point.sourceIndex})
            return
        }
        if (Number.isInteger(point.sourceIndex)
            && selection.phase === 'choose-start'
            && event.altKey
            && event.shiftKey) {
            startCorrection({...point, index: point.sourceIndex}, true)
            return
        }
        selectCorrectionPoint(
            event,
            point.trackSlug,
            point.correctionId,
            point.controlPointId,
            !point.active,
        )
    }

    const handleControlPointContextMenu = (event, renderedPoint) => {
        if (validationInProgressRef.current) return
        event.preventDefault()
        event.stopPropagation()
        const point = controlPointForEvent(event, renderedPoint)
        contextMenuAnchorRef.current = event.currentTarget
        setContextMenu({
            type: 'control-point',
            trackSlug: point.trackSlug,
            correctionId: point.correctionId,
            controlPointId: point.controlPointId,
            x: event.clientX,
            y: event.clientY,
        })
    }

    const handleControlPointKeyDown = (event, point) => {
        if (applyControlPointKeyboardShortcut(event, point)) return
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        selectCorrectionPoint(event, point.trackSlug, point.correctionId, point.controlPointId, !point.active)
    }

    const handleContextMenuKeyDown = event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const items = [...(contextMenuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])]
        if (items.length < 2) return
        event.preventDefault()
        const currentIndex = items.indexOf(event.target.closest('[role="menuitem"]'))
        const direction = event.key === 'ArrowDown' ? 1 : -1
        items[(currentIndex + direction + items.length) % items.length]?.focus({preventScroll: true})
    }

    const handleContextMenuItemKeyDown = event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.currentTarget.click()
    }

    /** Focus the requested section without changing camera scale or widget position. */
    const activateSectionAt = index => {
        if (validationInProgressRef.current) return
        if (orderedCorrections.length <= 1) return
        const sectionIndex = (index % orderedCorrections.length + orderedCorrections.length) % orderedCorrections.length
        const correction = orderedCorrections[sectionIndex]
        if (!correction) return
        lastCenteredSectionRef.current = null
        recenterCorrectionSection(correction)
        clearSelectionLasso()
        setPersistedActiveCorrection({trackSlug: correction.trackSlug, correctionId: correction.id})
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }

    const removeControlPoint = (trackSlug, correctionId, controlPointId) => {
        if (validationInProgressRef.current) return
        const correction = (draftCorrectionsRef.current[trackSlug] ?? []).find(item => item.id === correctionId)
        if (!correction?.controlPoints.some(point => point.id === controlPointId)) return
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [trackSlug]: (draftCorrectionsRef.current[trackSlug] ?? []).map(item => item.id === correctionId
                ? {
                    ...item,
                    controlPoints: item.controlPoints.map(point => point.id === controlPointId
                        ? {...point, removed: true}
                        : point),
                }
                : item),
        })
        setSelectedControlPoints(current => current.filter(point => (
            point.trackSlug !== trackSlug
            || point.correctionId !== correctionId
            || point.controlPointId !== controlPointId
        )))
        setContextMenu(null)
    }

    const removeControlPointsFromSection = (correction, selectedIds) => {
        if (validationInProgressRef.current) return
        if (!correction || selectedIds.size === 0) return

        const content = trackBySlug.get(correction.trackSlug)?.content
        const correctionIndex = orderedCorrections.findIndex(item => (
            item.trackSlug === correction.trackSlug && item.id === correction.id
        ))
        const updatedSections = removeFixPathControlPointsFromSection(content, correction, selectedIds)
        const nextCorrections = {
            ...draftCorrectionsRef.current,
            [correction.trackSlug]: (draftCorrectionsRef.current[correction.trackSlug] ?? [])
                .flatMap(item => item.id === correction.id ? updatedSections : [item]),
        }
        const remainingCorrections = Object.entries(nextCorrections).flatMap(([trackSlug, corrections]) => (
            corrections.map(correction => ({...correction, trackSlug}))
        )).sort((first, second) => (
            (availableTracks.findIndex(track => track.slug === first.trackSlug)
                - availableTracks.findIndex(track => track.slug === second.trackSlug))
            || first.segmentIndex - second.segmentIndex
            || first.startIndex - second.startIndex
        ))
        const nextCorrection = updatedSections[0]
            ? {...updatedSections[0], trackSlug: correction.trackSlug}
            : remainingCorrections[Math.min(correctionIndex, remainingCorrections.length - 1)]
        const historySection = _activeSection.current
        setPersistedActiveCorrection(nextCorrection
            ? {trackSlug: nextCorrection.trackSlug, correctionId: nextCorrection.id}
            : null, false)
        commitDraftCorrections(nextCorrections, true, {historySection})
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }

    const eraseSelectedControlPoints = () => {
        if (validationInProgressRef.current) return
        const correction = displayedCorrection
        const availablePointIds = new Set((correction?.controlPoints ?? [])
            .filter(point => point.removed !== true && point.erased !== true)
            .map(point => point.id))
        const selectedIds = new Set(selectedControlPoints
            .filter(point => point.trackSlug === correction?.trackSlug
                && point.correctionId === correction?.id
                && availablePointIds.has(point.controlPointId))
            .map(point => point.controlPointId))

        if (selectedIds.size > 0) {
            removeControlPointsFromSection(correction, selectedIds)
            setEraseMode(false)
            return
        }

        setEraseMode(current => !current)
    }

    const deleteCurrentSection = () => {
        if (validationInProgressRef.current || !displayedCorrection) return
        const correction = displayedCorrection
        const nextDraft = {
            ...draftCorrectionsRef.current,
            [correction.trackSlug]: (draftCorrectionsRef.current[correction.trackSlug] ?? [])
                .filter(item => item.id !== correction.id),
        }
        const remainingCorrections = orderedCorrections.filter(item => (
            item.trackSlug !== correction.trackSlug || item.id !== correction.id
        ))
        const nextCorrection = remainingCorrections[
            Math.min(Math.max(activeCorrectionIndex, 0), remainingCorrections.length - 1)
        ]
        const historySection = _activeSection.current

        clearSelectionLasso()
        setPersistedActiveCorrection(nextCorrection
            ? {trackSlug: nextCorrection.trackSlug, correctionId: nextCorrection.id}
            : null, false)
        commitDraftCorrections(nextDraft, true, {historySection})
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setEraseMode(false)
        setContextMenu(null)

        if (nextCorrection) {
            lastCenteredSectionRef.current = null
            recenterCorrectionSection(nextCorrection)
        }
    }

    const resetControlPoint = (trackSlug, correctionId, controlPointId) => {
        if (validationInProgressRef.current) return
        const correction = (draftCorrectionsRef.current[trackSlug] ?? [])
            .find(item => item.id === correctionId && item.controlPoints.some(point => point.id === controlPointId))
        const currentPoint = correction?.controlPoints.find(point => point.id === controlPointId)
        if (currentPoint?.removed === true) {
            commitDraftCorrections({
                ...draftCorrectionsRef.current,
                [trackSlug]: (draftCorrectionsRef.current[trackSlug] ?? []).map(item => item.id === correctionId
                    ? {
                        ...item,
                        controlPoints: item.controlPoints.map(point => point.id === controlPointId
                            ? {...point, removed: false}
                            : point),
                    }
                    : item),
            })
            const restored = {trackSlug, correctionId, controlPointId}
            setSelectedControlPoints(current => current.some(point => point.trackSlug === trackSlug
                && point.correctionId === correctionId
                && point.controlPointId === controlPointId) ? current : [...current, restored])
            setPersistedActiveCorrection({trackSlug, correctionId})
            return
        }
        const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(controlPointId)
        const sourceIndex = Number.isInteger(currentPoint?.sourceIndex)
            ? currentPoint.sourceIndex
            : sourcePoint ? Number(sourcePoint[2]) : Number.NaN
        const savedPoint = (originalCorrectionTracks[trackSlug] ?? [])
            .find(item => item.id === correctionId)
            ?.controlPoints
            .find(point => point.id === controlPointId)
        const segment = correction
            ? getGeometrySegments(trackBySlug.get(trackSlug)?.content?.geometry)[correction.segmentIndex]
            : null
        const sourceCoordinate = Number.isInteger(sourceIndex) ? segment?.[sourceIndex] : null
        const resetCoordinate = sourceCoordinate ?? savedPoint?.coordinate ?? currentPoint?.coordinate
        const restoredFixed = sourceCoordinate
            ? false
            : savedPoint
                ? savedPoint.fixed !== false
                : false

        if (resetCoordinate) {
            const normalizedCoordinate = [...resetCoordinate]
            if (normalizedCoordinate.length >= 3 && normalizedCoordinate[2] !== null
                && normalizedCoordinate[2] !== undefined && Number.isFinite(Number(normalizedCoordinate[2]))) {
                normalizedCoordinate[2] = Math.round(Number(normalizedCoordinate[2]))
            }
            commitDraftCorrections({
                ...draftCorrectionsRef.current,
                [trackSlug]: (draftCorrectionsRef.current[trackSlug] ?? []).map(item => item.id !== correctionId ? item : ({
                    ...item,
                    controlPoints: item.controlPoints.map(point => point.id === controlPointId
                        ? {
                            ...point,
                            coordinate: normalizedCoordinate,
                            fixed: restoredFixed,
                            removed: false,
                    }
                    : point),
                })),
            })
            setSelectedControlPoints(current => current.some(point => (
                point.trackSlug === trackSlug && point.correctionId === correctionId && point.controlPointId === controlPointId
            )) ? current : [...current, {trackSlug, correctionId, controlPointId}])
            setPersistedActiveCorrection({trackSlug, correctionId})
            return
        }

        removeControlPoint(trackSlug, correctionId, controlPointId)
    }

    /** Reset every selected point in the displayed correction as one edit. */
    const resetSelectedControlPoints = () => {
        if (validationInProgressRef.current || !displayedCorrection) return
        const {trackSlug, id: correctionId} = displayedCorrection
        const selectedIds = new Set(selectedControlPoints
            .filter(point => point.trackSlug === trackSlug && point.correctionId === correctionId)
            .map(point => point.controlPointId))
        if (selectedIds.size < 2) return

        const corrections = draftCorrectionsRef.current[trackSlug] ?? []
        const correction = corrections.find(item => item.id === correctionId)
        if (!correction) return

        const savedCorrection = (originalCorrectionTracks[trackSlug] ?? [])
            .find(item => item.id === correctionId)
        const segment = getGeometrySegments(trackBySlug.get(trackSlug)?.content?.geometry)[correction.segmentIndex]
        let changed = false
        const controlPoints = correction.controlPoints.map(point => {
            if (!selectedIds.has(point.id) || (point.removed !== true && point.fixed !== true)) {
                return point
            }

            changed = true
            if (point.removed === true) {
                return {...point, removed: false}
            }

            const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(point.id)
            const sourceIndex = Number.isInteger(point.sourceIndex)
                ? point.sourceIndex
                : sourcePoint ? Number(sourcePoint[2]) : Number.NaN
            const savedPoint = savedCorrection?.controlPoints.find(saved => saved.id === point.id)
            const sourceCoordinate = Number.isInteger(sourceIndex) ? segment?.[sourceIndex] : null
            const resetCoordinate = sourceCoordinate ?? savedPoint?.coordinate ?? point.coordinate
            const restoredFixed = sourceCoordinate
                ? false
                : savedPoint
                    ? savedPoint.fixed !== false
                    : false
            const normalizedCoordinate = [...resetCoordinate]
            if (normalizedCoordinate.length >= 3 && normalizedCoordinate[2] !== null
                && normalizedCoordinate[2] !== undefined && Number.isFinite(Number(normalizedCoordinate[2]))) {
                normalizedCoordinate[2] = Math.round(Number(normalizedCoordinate[2]))
            }

            return {
                ...point,
                coordinate: normalizedCoordinate,
                fixed: restoredFixed,
                removed: false,
            }
        })

        if (!changed) return
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [trackSlug]: corrections.map(item => item.id === correctionId
                ? {...item, controlPoints}
                : item),
        })
        setPersistedActiveCorrection({trackSlug, correctionId})
    }

    /** Mark every selected point in the displayed correction as removed in one edit. */
    const removeSelectedControlPoints = () => {
        if (validationInProgressRef.current || !displayedCorrection) return
        const {trackSlug, id: correctionId} = displayedCorrection
        const selectedIds = new Set(selectedControlPoints
            .filter(point => point.trackSlug === trackSlug && point.correctionId === correctionId)
            .map(point => point.controlPointId))
        if (selectedIds.size < 2) return

        const corrections = draftCorrectionsRef.current[trackSlug] ?? []
        let changed = false
        const nextCorrections = corrections.map(correction => correction.id !== correctionId
            ? correction
            : {
                ...correction,
                controlPoints: correction.controlPoints.map(point => {
                    if (!selectedIds.has(point.id) || point.removed === true) {
                        return point
                    }
                    changed = true
                    return {...point, removed: true}
                }),
            })

        if (!changed) return
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [trackSlug]: nextCorrections,
        })
        setSelectedControlPoints(current => current.filter(point => (
            point.trackSlug !== trackSlug
            || point.correctionId !== correctionId
            || !selectedIds.has(point.controlPointId)
        )))
        setContextMenu(null)
    }

    const updateControlCoordinatePart = (trackSlug, correctionId, controlPointId, coordinateIndex, rawValue) => {
        if (validationInProgressRef.current) return
        if (rawValue === '') {
            return
        }
        const parsedValue = Number(rawValue)
        const value = coordinateIndex === 2 ? UnitUtils.revert(parsedValue, heightUnit) : parsedValue
        if (!Number.isFinite(value)) {
            return
        }
        const currentCoordinate = (draftCorrectionsRef.current[trackSlug] ?? [])
            .find(item => item.id === correctionId)
            ?.controlPoints.find(point => point.id === controlPointId)
            ?.coordinate?.[coordinateIndex]
        if (Number.isFinite(Number(currentCoordinate)) && Math.abs(Number(currentCoordinate) - value) < 0.01) {
            return
        }
        if (!_heightInputSnapshot.current) {
            _heightInputSnapshot.current = {
                draft: draftCorrectionsRef.current,
                section: _activeSection.current,
            }
        }
        commitDraftCorrections({
            ...draftCorrectionsRef.current,
            [trackSlug]: updateControlCoordinate(
                draftCorrectionsRef.current[trackSlug] ?? [],
                correctionId,
                controlPointId,
                coordinate => {
                    const updated = [...coordinate]
                    while (updated.length <= coordinateIndex) updated.push(0)
                    updated[coordinateIndex] = value
                    return updated
                },
            ),
        }, false, {recordHistory: coordinateIndex !== 2})
    }

    /** Validate, persist, and redraw the latest complete correction draft. */
    const persistDraftCorrections = useCallback(async correctionsByTrack => {
        if (!journey || validationInProgressRef.current) return false
        setPanelFeedback(null)
        validationInProgressRef.current = true
        setSaving(true)
        try {
            const currentData = journey.fixPathCorrectionData ?? {revision: 0, tracks: {}}
            const persistedCorrectionsByTrack = currentData.tracks ?? {}
            const unchangedInvalidCorrections = new Set()
            /** Detect persisted corrections that remain untouched by the current edit. */
            const isUnchangedPersistedCorrection = (trackSlug, correction) => (
                isSameCorrectionSnapshot(
                    correction,
                    persistedCorrectionsByTrack[trackSlug]?.find(item => item.id === correction.id),
                )
            )

            for (const [trackSlug, corrections] of Object.entries(correctionsByTrack)) {
                const trackContent = trackBySlug.get(trackSlug)?.content
                if (!trackContent) continue
                for (const correction of corrections) {
                    if (correction.sourceFingerprint !== getFixPathSourceFingerprint(
                        trackContent,
                        correction.segmentIndex,
                        correction.startIndex,
                        correction.endIndex,
                    )) {
                        if (isUnchangedPersistedCorrection(trackSlug, correction)) {
                            unchangedInvalidCorrections.add(correction.id)
                            continue
                        }
                        setPanelFeedback({
                            type: 'warning',
                            caption: 'Track changed',
                            text: 'This correction no longer matches the current source points. Recreate the affected section.',
                        })
                        return false
                    }
                }
                const applied = applyFixPathCorrections(trackContent, corrections)
                const blockingSkippedIds = applied.skippedCorrectionIds.filter(correctionId => {
                    const correction = corrections.find(item => item.id === correctionId)
                    if (correction && isUnchangedPersistedCorrection(trackSlug, correction)) {
                        unchangedInvalidCorrections.add(correctionId)
                        return false
                    }
                    return true
                })
                if (blockingSkippedIds.length > 0) {
                    setPanelFeedback({
                        type: 'warning',
                        caption: 'Correction could not be applied',
                        text: 'Check the section endpoints and source track before editing further.',
                    })
                    return false
                }
            }

            const tracks = {...(currentData.tracks ?? {})}
            Object.entries(correctionsByTrack).forEach(([trackSlug, corrections]) => {
                if (corrections.length > 0) {
                    tracks[trackSlug] = corrections
                }
                else {
                    delete tracks[trackSlug]
                }
            })
            const nextData = normalizeFixPathCorrectionData({
                revision: (Number(currentData.revision) || 0) + 1,
                tracks,
                currentSection: currentData.currentSection,
            })
            if (!nextData) {
                setPanelFeedback({
                    type: 'warning',
                    caption: 'Corrections are not valid',
                    text: 'Resolve overlapping or incomplete sections before editing further.',
                })
                return false
            }
            const changedTrackSlugs = getChangedFixPathTrackSlugs(currentData.tracks, nextData.tracks)

            const contextualJourney = lgs.getJourneyBySlug?.(journeySlug)
            const previousData = journey.fixPathCorrectionData
            const previousEnabled = journey.fixPathEnabled === true
            const hasAnyCorrections = hasFixPathRouteEdits(nextData.tracks)
            preserveDraftAfterValidationRef.current = true
            journey.fixPathCorrectionData = nextData
            journey.fixPathEnabled = hasAnyCorrections
            if (contextualJourney && contextualJourney !== journey) {
                contextualJourney.fixPathCorrectionData = nextData
                contextualJourney.fixPathEnabled = hasAnyCorrections
            }

            let updated
            try {
                updated = await Promise.resolve(Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false}))
            }
            catch (error) {
                preserveDraftAfterValidationRef.current = false
                journey.fixPathCorrectionData = previousData
                journey.fixPathEnabled = previousEnabled
                if (contextualJourney && contextualJourney !== journey) {
                    contextualJourney.fixPathCorrectionData = previousData
                    contextualJourney.fixPathEnabled = previousEnabled
                }
                console.error('[FixPathEditor] Could not persist path corrections:', error)
                setPanelFeedback({
                    type: 'error',
                    caption: 'Fix Path update failed',
                    text: 'The corrections could not be saved and applied to this Journey.',
                })
                return false
            }

            try {
                const updatedJourney = updated ?? contextualJourney ?? journey
                const affectedTracks = changedTrackSlugs
                    .map(trackSlug => updatedJourney.tracks?.get?.(trackSlug))
                    .filter(track => typeof track?.draw === 'function')
                if (affectedTracks.length > 0) {
                    await Promise.all(affectedTracks.map(track => (
                        track.draw({action: DRAWING_FROM_UI, mode: NO_FOCUS})
                    )))
                }
                else if (changedTrackSlugs.length > 0 && typeof updatedJourney.draw === 'function') {
                    // Keep compatibility with lightweight Journey doubles and legacy adapters.
                    await updatedJourney.draw({action: DRAWING_FROM_UI, mode: NO_FOCUS})
                }
            }
            catch (error) {
                console.error('[FixPathEditor] Could not redraw path corrections:', error)
                setPanelFeedback({
                    type: 'error',
                    caption: 'Path corrections saved, but the Journey could not be refreshed',
                    text: 'The corrections were saved. Refresh the Journey to update its map display.',
                })
                return false
            }
            draftNeedsPersistenceRef.current = false
            if (unchangedInvalidCorrections.size > 0) {
                setPanelFeedback({
                    type: 'warning',
                    caption: 'Other sections need review',
                    text: 'The edit was saved. Recreate any unchanged sections whose source track has changed.',
                })
            }
            return true
        }
        finally {
            validationInProgressRef.current = false
            setSaving(false)
        }
    }, [journey, journeySlug, trackBySlug])

    useEffect(() => {
        persistDraftCorrectionsRef.current = persistDraftCorrections
    }, [persistDraftCorrections])

    if (!open) {
        return null
    }

    const viewerContainer = lgs.viewer?.container
    if (!viewerContainer) {
        return null
    }

    const areaRectangle = areaDrag?.shape === 'rectangle'
        ? normalizeScreenSelectionArea(areaDrag.start, areaDrag.current)
        : null
    const lassoPoints = areaDrag?.shape === 'lasso'
        ? areaDrag.points.map(point => point.x + ',' + point.y).join(' ')
        : ''
    const lassoGeometry = areaDrag?.shape === 'lasso' && areaDrag.points.length >= 3
        ? buildSmoothClosedScreenSelectionGeometry(areaDrag.points)
        : null
    const lassoTargetLabel = areaDrag?.kind === 'source' ? 'Journey points' : 'correction points'
    const lassoGestureLabel = areaDrag?.modifier === 'shift'
        ? 'Shift'
        : areaDrag?.modifier === 'ctrl-shift' ? 'Ctrl/Cmd+Shift' : 'Alt'
    const lassoGuideText = areaDrag?.shape === 'lasso'
        ? lassoGestureLabel + ': drag around ' + lassoTargetLabel + ' and release, or click vertices and double-click to select. Press Escape to cancel.'
        : null
    const sectionFixesMenuLabel = hasVisibleSectionFixes ? 'Hide section fixes' : 'Show section fixes'
    const isAreaSelectionCursor = journeyCursorIcon === 'lasso' || journeyCursorIcon === 'square-dashed'
    const content = (
        <>
        <div
            className="fix-path-overlay"
            ref={mapOverlayRef}
            style={{zIndex: fixPathZIndex}}
            onWheelCapture={handleWheel}
            onContextMenuCapture={event => {
                if (!event.target?.closest?.('.fix-path-panel, .fix-path-context-menu, .fix-path-control-point')) {
                    event.preventDefault()
                    event.stopPropagation()
                }
            }}
        >
            <div
                ref={journeyCursorRef}
                className={'fix-path-journey-cursor'
                    + (isAreaSelectionCursor ? ' is-area-selection-cursor' : '')
                    + (journeyCursorVisible ? ' is-visible' : '')
                    + (journeyCursorSelectionColor ? ' is-' + journeyCursorSelectionColor + '-selection' : '')}
                aria-hidden="true"
            >
                <WaIcon
                    name={journeyCursorIcon}
                    variant={journeyCursorIcon === 'circle-plus' ? 'regular' : 'solid'}
                    aria-hidden="true"
                />
            </div>
            {lassoGuideText && (
                <FixPathCallout
                    className="fix-path-selection-guide wa-theme-lgs1920-on-map"
                    type="info"
                    icon="draw-polygon"
                    appearance="filled-outlined"
                >
                    {lassoGuideText}
                </FixPathCallout>
            )}
            <svg className={'fix-path-markers' + (areaMode ? ' is-selecting-area' : '') + (eraseMode ? ' is-erasing' : '')} width={projected.width} height={projected.height} aria-label="Journey correction points">
                {areaRectangle && (
                    <rect
                        className={'fix-path-selection-rectangle is-' + (areaDrag.selectionColor ?? 'journey') + '-selection'}
                        x={areaRectangle.left}
                        y={areaRectangle.top}
                        width={areaRectangle.width}
                        height={areaRectangle.height}
                        aria-hidden="true"
                    />
                )}
                {lassoGeometry && (
                    <path className={'fix-path-selection-lasso is-' + (areaDrag.selectionColor ?? 'journey') + '-selection'} d={lassoGeometry.path} aria-hidden="true"/>
                )}
                {lassoPoints && areaDrag.points.length === 2 && (
                    <polyline className={'fix-path-selection-lasso is-' + (areaDrag.selectionColor ?? 'journey') + '-selection'} points={lassoPoints} aria-hidden="true"/>
                )}
                {projected.controlPoints.map(point => {
                    const selected = selectedControlPoints.some(item => item.trackSlug === point.trackSlug
                        && item.correctionId === point.correctionId
                        && item.controlPointId === point.controlPointId)
                    const moved = point.fixed === true
                    const unmodified = !moved
                    const unmodifiedDiamond = unmodified
                    return (
                        <g
                            key={'control-' + point.trackSlug + '-' + point.correctionId + '-' + point.controlPointId}
                            className={'fix-path-control-point'
                                + (selected ? ' is-selected' : '')
                                + (moved ? ' is-moved' : ' is-unmodified')
                                + (!point.active ? ' is-inactive' : '')}
                            data-track-slug={point.trackSlug}
                            data-correction-id={point.correctionId}
                            data-control-point-id={point.controlPointId}
                            role="button"
                            tabIndex="0"
                            aria-pressed={selected}
                            aria-keyshortcuts="Backspace Delete Control+R Meta+R"
                            aria-label={point.active
                                ? 'Correction point in current section, drag to move or right-click to remove'
                                : 'Correction point in another section, click to activate or right-click for options'}
                            onPointerDown={event => handleControlPointPointerDown(event, point)}
                            onClick={event => handleControlPointClick(event, point)}
                            onContextMenu={event => handleControlPointContextMenu(event, point)}
                            onKeyDown={event => handleControlPointKeyDown(event, point)}
                        >
                            <circle
                                className="fix-path-control-point-hitbox"
                                cx={point.x}
                                cy={point.y}
                                r="14"
                                aria-hidden="true"
                            />
                            {unmodifiedDiamond
                                ? <path
                                    className="fix-path-control-point-visual"
                                    d={`M ${point.x} ${point.y - FIX_PATH_CONTROL_MARKER_RADIUS} L ${point.x + FIX_PATH_CONTROL_MARKER_RADIUS} ${point.y} L ${point.x} ${point.y + FIX_PATH_CONTROL_MARKER_RADIUS} L ${point.x - FIX_PATH_CONTROL_MARKER_RADIUS} ${point.y} Z`}
                                    aria-hidden="true"
                                />
                                : <circle
                                    className="fix-path-control-point-visual"
                                    cx={point.x}
                                    cy={point.y}
                                    r={FIX_PATH_CONTROL_MARKER_RADIUS}
                                    aria-hidden="true"
                                />}
                        </g>
                    )
                })}
            </svg>
        </div>

        <Widget
            isVisible
            config={fixPathWidgetConfig}
            className="fix-path-widget-shell"
            childRef={fixPathWidgetCallbacks}
            resizeDirections={['n', 's']}
        >
            <FixPathEditorPanel {...{
                activeCorrectionIndex,
                activateSectionAt,
                areaMode,
                canRedo: historyAvailability.canRedo,
                canUndo: historyAvailability.canUndo,
                close,
                focusJourney,
                currentCorrectionVisible,
                feedback: panelFeedback,
                displayedCorrection,
                displayedCorrectionPreview,
                displayedTrack,
                deleteCurrentSection,
                handleCorrectionPointListKeyDown,
                handleCorrectionPointRowKeyDown,
                handleFixPathShortcut,
                helpOpen,
                heightUnit,
                orderedCorrections,
                eraseMode,
                eraseSelectedControlPoints,
                removeControlPoint,
                removeSelectedControlPoints,
                resetControlPoint,
                resetSelectedControlPoints,
                saving,
                scanProgress,
                selectCorrectionPoint,
                toggleDisplayedCorrectionPointSelection,
                selectedControlPoints,
                selection,
                setHelpOpen,
                setSelection,
                onCorrectionVisibilityChange,
                undoCorrectionEdit,
                redoCorrectionEdit,
                updateControlCoordinatePart,
                widgetResized,
                persistCurrentDraftCorrections,
            }}/>
            <FixPathEditorHelp
                active={helpOpen}
                onRequestClose={() => setHelpOpen(false)}
            />
        </Widget>

        {!saving && contextMenu?.type === 'journey' && (
            <div
                ref={contextMenuRef}
                className="fix-path-context-menu lgs-context-menu visible lgs-card wa-theme-lgs1920-on-map"
                role="menu"
                aria-label="Journey route actions"
                style={{left: contextMenu.x, top: contextMenu.y}}
                onKeyDown={handleContextMenuKeyDown}
                onContextMenu={event => {
                    event.preventDefault()
                    event.stopPropagation()
                }}
            >
                <ul role="none">
                    <li
                        className="fix-path-context-menu-item"
                        role="menuitem"
                        aria-label="Add correction point"
                        aria-keyshortcuts="Enter Space"
                        tabIndex={0}
                        onClick={() => {
                            addJourneyControlPoint(contextMenu.routeTarget)
                            setContextMenu(null)
                        }}
                        onKeyDown={handleContextMenuItemKeyDown}
                    >
                        <WaIcon name="plus" variant="regular" aria-hidden="true"/>
                        {'Add correction point'}
                    </li>
                    {orderedCorrections.length > 0 && (
                        <li
                            className="fix-path-context-menu-item"
                            role="menuitem"
                            aria-label={sectionFixesMenuLabel}
                            aria-keyshortcuts="Enter Space"
                            tabIndex={0}
                            onClick={() => {
                                toggleSectionFixes()
                                setContextMenu(null)
                            }}
                            onKeyDown={handleContextMenuItemKeyDown}
                        >
                            <WaIcon
                                name={hasVisibleSectionFixes ? 'eye-slash' : 'eye'}
                                variant="regular"
                                aria-hidden="true"
                            />
                            {sectionFixesMenuLabel}
                        </li>
                    )}
                </ul>
            </div>
        )}

        {!saving && contextMenu && contextMenuPoint && (contextMenuCanReset || contextMenuCanRemove) && (
            <div
                ref={contextMenuRef}
                className="fix-path-context-menu lgs-context-menu visible lgs-card wa-theme-lgs1920-on-map"
                role="menu"
                aria-label="Correction point actions"
                style={{left: contextMenu.x, top: contextMenu.y}}
                onKeyDown={handleContextMenuKeyDown}
                onContextMenu={event => {
                    event.preventDefault()
                    event.stopPropagation()
                }}
            >
                <ul role="none">
                    {contextMenuCanReset && (
                        <li
                            className="fix-path-context-menu-item"
                            role="menuitem"
                            aria-label={contextMenuPointRemoved ? 'Restore' : 'Reset'}
                            aria-keyshortcuts="Enter Space"
                            tabIndex={0}
                            onClick={() => {
                                resetControlPoint(contextMenu.trackSlug, contextMenu.correctionId, contextMenu.controlPointId)
                                setContextMenu(null)
                            }}
                            onKeyDown={handleContextMenuItemKeyDown}
                        >
                            <WaIcon name="arrow-rotate-left" variant="regular" aria-hidden="true"/>
                            {contextMenuPointRemoved ? 'Restore' : 'Reset'}
                        </li>
                    )}
                    {contextMenuCanRemove && (
                        <li
                            className="fix-path-context-menu-item"
                            role="menuitem"
                            aria-label="Remove"
                            aria-keyshortcuts="Enter Space"
                            tabIndex={0}
                            onClick={() => removeControlPoint(
                                contextMenu.trackSlug,
                                contextMenu.correctionId,
                                contextMenu.controlPointId,
                            )}
                            onKeyDown={handleContextMenuItemKeyDown}
                        >
                            <WaIcon name="trash-can" variant="regular" aria-hidden="true"/>
                            {'Remove'}
                        </li>
                    )}
                </ul>
            </div>
        )}
        </>
    )

    return createPortal(content, viewerContainer)
}
