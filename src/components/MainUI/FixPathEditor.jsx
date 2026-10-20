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
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {DRAWING_FROM_UI, FIX_PATH_EDITOR_WIDGET, NO_FOCUS, UPDATE_JOURNEY_SILENTLY} from '@Core/constants'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { Utils } from '@Editor/Utils'
import {
    applyFixPathCorrections,
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    getMaxFixPathSegmentMeters,
    normalizeFixPathActiveSection,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'
import {
    buildDraggedPointCorrections,
    buildFixPathSection,
    removeFixPathControlPointsFromSection,
    translateFixPathControlPoints,
} from '@Utils/cesium/fixPathCorrectionEditing'
import {
    buildSourcePointSvgPath,
    findClosestSourcePoint,
    isScreenPointInsideArea,
    normalizeScreenSelectionArea,
} from '@Utils/cesium/fixPathScreenSelection'
import {UIToast} from '@Utils/UIToast'
import {ELEVATION_UNITS, INTERNATIONAL, UnitUtils} from '@Utils/UnitUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import { WaIcon } from '@awesome.me/webawesome/dist/react'
import {Cartesian2, Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {FixPathEditorHelp} from './FixPathEditorHelp'
import {FixPathEditorPanel} from './FixPathEditorPanel'
import {
    EMPTY_CORRECTION_TRACKS,
    FIX_PATH_WIDGET_CONFIG,
    OCCLUSION_SCAN_BATCH_SIZE,
    SOURCE_SCAN_BATCH_SIZE,
    SOURCE_VISIBILITY_CELL_SIZE,
} from './FixPathEditorConfig'
import {
    cloneCorrectionList,
    correctionAtPoint,
    coordinateDistanceMeters,
    findClosestProjectedControlPoint,
    getControlPointCoordinate,
    getGeometrySegments,
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
    const [selectedSourcePoints, setSelectedSourcePoints] = useState([])
    const [projected, setProjected] = useState({width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: []})
    const [areaMode, setAreaMode] = useState(true)
    const [areaDrag, setAreaDrag] = useState(null)
    const [scanProgress, setScanProgress] = useState(null)
    const [helpOpen, setHelpOpen] = useState(false)
    const [widgetResized, setWidgetResized] = useState(false)
    const [dragPreview, setDragPreview] = useState(null)
    const [contextMenu, setContextMenu] = useState(null)
    const [saving, setSaving] = useState(false)
    const [eraseMode, setEraseMode] = useState(false)
    const [hiddenCorrectionKeys, setHiddenCorrectionKeys] = useState(() => new Set())
    const [historyAvailability, setHistoryAvailability] = useState({canUndo: false, canRedo: false})
    const contextMenuRef = useRef(null)
    const contextMenuAnchorRef = useRef(null)
    const draftCorrectionsRef = useRef({})
    const validationInProgressRef = useRef(false)
    const draftNeedsPersistenceRef = useRef(false)
    const persistDraftCorrectionsRef = useRef(null)
    const mapOverlayRef = useRef(null)
    const scanGenerationRef = useRef(0)
    const dragRef = useRef(null)
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
    const journeySettings = useOptionalSnapshot(lgs.settings.journey)
    const unitSystemSnapshot = useOptionalSnapshot(lgs.settings.unitSystem)
    const maxSegmentMeters = getMaxFixPathSegmentMeters(journeySettings.fixPathMaxSegmentMeters)
    const unitSystem = Number(unitSystemSnapshot.current ?? INTERNATIONAL)
    const heightUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[INTERNATIONAL]
    const fixPathWidgetCallbacks = useMemo(() => ({
        current: {onResizeStart: () => setWidgetResized(true)},
    }), [])

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
    const contextMenuCorrection = contextMenu
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
        setSelectedSourcePoints([])
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
                const corrections = draftCorrectionsByTrack[track.slug] ?? []
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
    }, [open, availableTracks, draftCorrectionsByTrack, hiddenCorrectionKeys])

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
                selectedSourcePoints,
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
    }, [open, availableTracks, selectedSourcePoints, displayCorrectionsByTrack, selection, displayedCorrection, hiddenCorrectionKeys])

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

    const startCorrection = useCallback((point, extendExisting = false) => {
        if (validationInProgressRef.current) return
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
            UIToast.warning({
                caption: 'Choose a nearby attachment point',
                text: 'A correction section must end later on the same track segment.',
            })
            return
        }
        const trackContent = trackBySlug.get(point.trackSlug)?.content
        const distance = getFixPathSegmentDistanceMeters(
            trackContent,
            point.segmentIndex,
            selection.startPoint.index,
            point.index,
        )
        if (distance > maxSegmentMeters) {
            UIToast.warning({
                caption: 'Fix Path section is too long',
                text: 'This route section is ' + Math.round(distance) + ' m. Split it into shorter sections or increase the limit in application settings.',
            })
            return
        }
        const corrections = draftCorrectionsRef.current[point.trackSlug] ?? []
        const bridgesCorrection = corrections.some(correction => correction.segmentIndex === point.segmentIndex
            && correction.startIndex <= point.index
            && correction.endIndex >= selection.startPoint.index)
        if (!(selection.controlPoints?.length > 0) && !bridgesCorrection) {
            UIToast.warning({
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
            UIToast.warning({
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
    }, [commitDraftCorrections, maxSegmentMeters, selection, setPersistedActiveCorrection, trackBySlug])

    const addControlPoint = useCallback((event, clientX, clientY) => {
        if (validationInProgressRef.current) return
        if (selection.phase !== 'add-points' || !selection.startPoint) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const coordinate = pointAtScreenPosition(clientX, clientY)
        if (!coordinate) {
            return
        }
        const startTrack = trackBySlug.get(selection.startPoint.trackSlug)
        const segment = getGeometrySegments(startTrack?.content?.geometry)[selection.startPoint.segmentIndex]
        const start = segment?.[selection.startPoint.index]
        if (!start || coordinateDistanceMeters(start, coordinate) > maxSegmentMeters) {
            UIToast.warning({
                caption: 'Fix Path section is too long',
                text: 'Keep correction points within ' + maxSegmentMeters + ' m of the starting track point.',
            })
            return
        }
        const controlPoints = [...(selection.controlPoints ?? []), {id: makeId(), coordinate}]
            .map((point, index, points) => ({...point, progress: (index + 1) / (points.length + 1)}))
        setSelection({...selection, controlPoints})
    }, [maxSegmentMeters, pointAtScreenPosition, selection, trackBySlug])

    const scanSelectedArea = useCallback(async area => {
        const viewer = lgs.viewer
        const scene = viewer?.scene
        const canvas = viewer?.canvas
        const overlay = mapOverlayRef.current
        if (!scene || !canvas || !overlay) {
            return []
        }
        const generation = ++scanGenerationRef.current
        const routeSegments = availableTracks.flatMap(track => getGeometrySegments(track.content?.geometry)
            .map((coordinates, segmentIndex) => ({trackSlug: track.slug, segmentIndex, coordinates})))
        const total = routeSegments.reduce((sum, segment) => sum + segment.coordinates.length, 0)
        const overlayRect = overlay.getBoundingClientRect()
        const canvasRect = canvas.getBoundingClientRect()
        const candidates = []
        let processed = 0
        setAreaMode(false)
        setAreaDrag(null)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setScanProgress({phase: 'project', value: 0, processed: 0, total})

        for (const segment of routeSegments) {
            for (let index = 0; index < segment.coordinates.length; index += 1) {
                const coordinate = segment.coordinates[index]
                const worldPosition = worldPositionForCoordinate(scene, coordinate)
                const screen = projectCoordinate(scene, overlayRect, canvasRect, canvas, coordinate, worldPosition)
                if (screen && isScreenPointInsideArea({x: screen.x, y: screen.y}, area)) {
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
                if (processed % SOURCE_SCAN_BATCH_SIZE === 0) {
                    setScanProgress({
                        phase: 'project',
                        value: total > 0 ? Math.min(70, Math.round(processed / total * 70)) : 70,
                        processed,
                        total,
                    })
                    await nextAnimationFrame()
                    if (scanGenerationRef.current !== generation) {
                        return
                    }
                }
            }
        }

        const visibilityCells = new Map()
        candidates.forEach(point => {
            const cell = Math.floor(point.x / SOURCE_VISIBILITY_CELL_SIZE) + ':' + Math.floor(point.y / SOURCE_VISIBILITY_CELL_SIZE)
            const group = visibilityCells.get(cell) ?? []
            group.push(point)
            visibilityCells.set(cell, group)
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
            if (index % OCCLUSION_SCAN_BATCH_SIZE === OCCLUSION_SCAN_BATCH_SIZE - 1) {
                setScanProgress({
                    phase: 'visibility',
                    value: 70 + Math.round((index + 1) / Math.max(1, groups.length) * 30),
                    processed: total,
                    total,
                })
                await nextAnimationFrame()
                if (scanGenerationRef.current !== generation) {
                    return
                }
            }
        }

        if (scanGenerationRef.current !== generation) {
            return
        }
        setSelectedSourcePoints(visiblePoints)
        setScanProgress(null)
        if (visiblePoints.length === 0) {
            UIToast.info({
                caption: 'No Journey points in this area',
                text: 'Select a larger screen area that contains one or more visible route points.',
            })
        }
        return visiblePoints
    }, [availableTracks])

    /** Add scanned source vertices to the active section and merge any bridged sections. */
    const extendCorrectionWithSourcePoints = useCallback((sourcePoints, correction = displayedCorrection) => {
        if (validationInProgressRef.current || !correction || sourcePoints.length === 0) return false
        const trackContent = trackBySlug.get(correction.trackSlug)?.content
        const corrections = draftCorrectionsRef.current[correction.trackSlug] ?? []
        const currentCorrection = corrections.find(item => item.id === correction.id)
        if (!trackContent || !currentCorrection) return false

        const selectedIndexes = new Set(sourcePoints
            .filter(point => point.trackSlug === correction.trackSlug
                && point.segmentIndex === correction.segmentIndex
                && Number.isInteger(point.index))
            .map(point => point.index))
        if (selectedIndexes.size === 0) return false

        const startIndex = Math.min(currentCorrection.startIndex, ...selectedIndexes)
        const endIndex = Math.max(currentCorrection.endIndex, ...selectedIndexes)
        if (startIndex === currentCorrection.startIndex && endIndex === currentCorrection.endIndex) {
            setSelectedControlPoints([])
            setSelectedSourcePoints([])
            selectionAnchorRef.current = null
            return false
        }

        const result = buildFixPathSection(
            trackContent,
            corrections,
            currentCorrection.segmentIndex,
            startIndex,
            endIndex,
        )
        if (result.error || !result.correction) {
            UIToast.warning({
                caption: 'Could not add points to this section',
                text: result.error ?? 'Select visible points on the same Journey segment as the current section.',
            })
            return false
        }

        const nextDraft = {
            ...draftCorrectionsRef.current,
            [correction.trackSlug]: result.corrections,
        }
        const previousSection = _activeSection.current
        setPersistedActiveCorrection({trackSlug: correction.trackSlug, correctionId: result.correction.id}, false)
        commitDraftCorrections(nextDraft, true, {historySection: previousSection})
        setSelectedControlPoints([])
        setSelectedSourcePoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setAreaMode(false)
        return true
    }, [commitDraftCorrections, displayedCorrection, setPersistedActiveCorrection, trackBySlug])

    /**
     * Start a screen-area selection from a Shift-primary mouse or pen drag.
     * @param {PointerEvent} event - Cesium canvas pointer event.
     */
    const handleAreaPointerDown = useCallback(event => {
        if (!areaMode || scanProgress || event.button !== 0 || !event.shiftKey || event.pointerType === 'touch') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        if (Number.isInteger(event.pointerId)) {
            event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            return
        }
        const start = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        dragRef.current = {
            kind: 'area',
            start,
            current: start,
            suppressControlClick: event.currentTarget?.classList?.contains('fix-path-control-point') === true,
        }
        setAreaDrag({start, current: start})
    }, [areaMode, scanProgress])

    /**
     * Update the active screen-area selection.
     * @param {PointerEvent} event - Cesium canvas pointer event.
     */
    const handleAreaPointerMove = useCallback(event => {
        if (dragRef.current?.kind !== 'area') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            return
        }
        const current = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        dragRef.current = {...dragRef.current, current}
        setAreaDrag({start: dragRef.current.start, current})
    }, [])

    /**
     * Finish the active screen-area selection and scan its Journey points.
     * @param {PointerEvent} event - Cesium canvas pointer event.
     */
    const handleAreaPointerUp = useCallback(event => {
        if (dragRef.current?.kind !== 'area') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const drag = dragRef.current
        dragRef.current = null
        if (drag.suppressControlClick) {
            suppressControlClickRef.current = true
            setTimeout(() => { suppressControlClickRef.current = false }, 0)
        }
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            setAreaDrag(null)
            return
        }
        const end = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const area = normalizeScreenSelectionArea(drag.start, end)
        setAreaDrag(null)
        const sectionToExtend = orderedCorrections.find(correction => (
            correction.trackSlug === _activeSection.current?.trackSlug
            && correction.id === _activeSection.current?.correctionId
        )) ?? displayedCorrection
        const selectionArea = area.width < 4 || area.height < 4
            ? normalizeScreenSelectionArea({x: drag.start.x - 10, y: drag.start.y - 10}, {x: drag.start.x + 10, y: drag.start.y + 10})
            : area
        void scanSelectedArea(selectionArea).then(sourcePoints => {
            if (sectionToExtend && sourcePoints?.length > 0) {
                extendCorrectionWithSourcePoints(sourcePoints, sectionToExtend)
            }
        })
    }, [displayedCorrection, extendCorrectionWithSourcePoints, orderedCorrections, scanSelectedArea])

    /**
     * Discard a screen-area selection interrupted by pointer cancellation.
     * @param {PointerEvent} event - Cesium canvas pointer event.
     */
    const handleAreaPointerCancel = useCallback(event => {
        if (dragRef.current?.kind !== 'area') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        dragRef.current = null
        setAreaDrag(null)
    }, [])

    /** Start Shift selection for map markers or source points, or an Alt control-area selection. */
    const handleControlSelectionPointerDown = useCallback(event => {
        const marker = event.target?.closest?.('.fix-path-control-point')
        const markerPoint = marker
            ? projected.controlPoints.find(point => point.trackSlug === marker.dataset.trackSlug
                && point.correctionId === marker.dataset.correctionId
                && point.controlPointId === marker.dataset.controlPointId)
            : null
        const shiftSectionSelection = event.shiftKey && Boolean(displayedCorrection) && !marker
        const shiftControlSelection = event.shiftKey && Boolean(marker)
        const altSelection = event.altKey && !event.shiftKey
        if (scanProgress || selection.phase === 'add-points'
            || event.button !== 0 || (!shiftSectionSelection && !shiftControlSelection && !altSelection)
            || event.pointerType === 'touch'
            || event.target?.closest?.('.fix-path-panel, .fix-path-context-menu')) {
            return
        }

        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) return
        const start = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const pointAtStart = markerPoint ?? findClosestProjectedControlPoint(projected.controlPoints, start)
        const lockedSection = selectedControlPoints[0] ?? selectionAnchorRef.current
        if ((altSelection || shiftControlSelection) && lockedSection && pointAtStart && (
            pointAtStart.trackSlug !== lockedSection.trackSlug
            || pointAtStart.correctionId !== lockedSection.correctionId
        )) {
            return
        }
        const section = shiftSectionSelection
            ? displayedCorrection
            : lockedSection ?? pointAtStart ?? activeCorrection ?? displayedCorrection
        const correctionId = section?.correctionId ?? section?.id
        if (!section?.trackSlug || !correctionId) return

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        catch {
            // Keep the selection gesture alive if the browser invalidates capture.
        }
        dragRef.current = {
            kind: shiftSectionSelection ? 'section-area' : 'control-area',
            start,
            current: start,
            trackSlug: section.trackSlug,
            correctionId,
            modifier: event.shiftKey ? 'shift' : 'alt',
            markerControlPointId: markerPoint?.controlPointId,
        }
        setAreaDrag({start, current: start})
    }, [activeCorrection, displayedCorrection, projected.controlPoints, scanProgress, selectedControlPoints, selection.phase])

    /** Update a control selection rectangle while keeping Cesium gestures suspended. */
    const handleControlSelectionPointerMove = useCallback(event => {
        if (dragRef.current?.kind !== 'control-area' && dragRef.current?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) return
        const current = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        dragRef.current = {...dragRef.current, current}
        setAreaDrag({start: dragRef.current.start, current})
    }, [])

    /** Add Shift-selected Journey vertices to the active section or toggle Shift-clicked controls. */
    const handleControlSelectionPointerUp = useCallback(event => {
        const drag = dragRef.current
        if (drag?.kind !== 'control-area' && drag?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        dragRef.current = null
        setAreaDrag(null)

        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) return
        const end = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        if (drag.kind === 'section-area') {
            const area = normalizeScreenSelectionArea(drag.start, end)
            const selectionArea = area.width < 4 || area.height < 4
                ? normalizeScreenSelectionArea(
                    {x: drag.start.x - 10, y: drag.start.y - 10},
                    {x: drag.start.x + 10, y: drag.start.y + 10},
                )
                : area
            const sectionToExtend = orderedCorrections.find(correction => (
                correction.trackSlug === drag.trackSlug && correction.id === drag.correctionId
            ))
            void scanSelectedArea(selectionArea).then(sourcePoints => {
                if (sectionToExtend && sourcePoints?.length > 0) {
                    extendCorrectionWithSourcePoints(sourcePoints, sectionToExtend)
                }
            })
            return
        }
        const sectionControlPoints = projected.controlPoints.filter(point => (
            point.trackSlug === drag.trackSlug && point.correctionId === drag.correctionId
        ))
        const sameSection = point => point.trackSlug === drag.trackSlug && point.correctionId === drag.correctionId
        const currentSelection = selectedControlPoints.filter(sameSection)
        const distance = Math.hypot(end.x - drag.start.x, end.y - drag.start.y)

        if (distance < 4) {
            if (drag.modifier !== 'shift') return
            const point = drag.markerControlPointId
                ? sectionControlPoints.find(item => item.controlPointId === drag.markerControlPointId)
                : findClosestProjectedControlPoint(sectionControlPoints, end)
            if (!point) return
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
            return
        }

        const area = normalizeScreenSelectionArea(drag.start, end)
        if (area.width < 4 || area.height < 4) return
        const enclosedPoints = sectionControlPoints
            .filter(point => isScreenPointInsideArea(point, area))
            .map(point => ({
                trackSlug: point.trackSlug,
                correctionId: point.correctionId,
                controlPointId: point.controlPointId,
            }))
        if (enclosedPoints.length === 0) return
        const selectedById = new Map([...currentSelection, ...enclosedPoints]
            .map(point => [point.controlPointId, point]))
        const nextSelection = [...selectedById.values()]
        setSelectedControlPoints(nextSelection)
        const anchor = selectionAnchorRef.current
        selectionAnchorRef.current = anchor && sameSection(anchor)
            && nextSelection.some(point => point.controlPointId === anchor.controlPointId)
            ? anchor
            : nextSelection[0]
        setPersistedActiveCorrection({trackSlug: drag.trackSlug, correctionId: drag.correctionId})
        setAreaMode(false)
    }, [extendCorrectionWithSourcePoints, orderedCorrections, projected.controlPoints, scanSelectedArea, selectedControlPoints, setPersistedActiveCorrection])

    /** Clear a control-point selection rectangle cancelled by the browser. */
    const handleControlSelectionPointerCancel = useCallback(event => {
        if (dragRef.current?.kind !== 'control-area' && dragRef.current?.kind !== 'section-area') return
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        dragRef.current = null
        setAreaDrag(null)
    }, [])

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

        const selectingArea = areaMode && !scanProgress
        if (selectingArea) {
            canvas.classList.add('fix-path-selecting-area')
            canvas.addEventListener('pointerdown', handleAreaPointerDown, true)
            canvas.addEventListener('pointermove', handleAreaPointerMove, true)
            canvas.addEventListener('pointerup', handleAreaPointerUp, true)
            canvas.addEventListener('pointercancel', handleAreaPointerCancel, true)
        }
        if (selection.phase === 'add-points') {
            canvas.addEventListener('click', handleMapClick, true)
        }

        return () => {
            canvas.classList.remove('fix-path-selecting-area')
            container.removeEventListener('pointerdown', handleControlSelectionPointerDown, true)
            container.removeEventListener('pointermove', handleControlSelectionPointerMove, true)
            container.removeEventListener('pointerup', handleControlSelectionPointerUp, true)
            container.removeEventListener('pointercancel', handleControlSelectionPointerCancel, true)
            canvas.removeEventListener('pointerdown', handleAreaPointerDown, true)
            canvas.removeEventListener('pointermove', handleAreaPointerMove, true)
            canvas.removeEventListener('pointerup', handleAreaPointerUp, true)
            canvas.removeEventListener('pointercancel', handleAreaPointerCancel, true)
            canvas.removeEventListener('click', handleMapClick, true)
        }
    }, [
        open,
        areaMode,
        scanProgress,
        selection.phase,
        handleAreaPointerDown,
        handleAreaPointerMove,
        handleAreaPointerUp,
        handleAreaPointerCancel,
        handleControlSelectionPointerDown,
        handleControlSelectionPointerMove,
        handleControlSelectionPointerUp,
        handleControlSelectionPointerCancel,
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

    const handlePointDragStart = (event, drag) => {
        if (validationInProgressRef.current) return
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
        dragRef.current = {...drag, startX: event.clientX, startY: event.clientY, moved: false}
    }

    const handlePointDragMove = event => {
        if (validationInProgressRef.current || !dragRef.current || dragRef.current.kind === 'area') {
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
    }

    const showDragError = message => UIToast.warning({caption: 'Fix Path point not moved', text: message})

    const handlePointDragEnd = event => {
        if (validationInProgressRef.current || !dragRef.current || dragRef.current.kind === 'area') {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        const drag = dragRef.current
        dragRef.current = null
        setDragPreview(null)
        if (!drag.moved) {
            return
        }
        if (!drag.coordinate) {
            return
        }
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
    }

    const handleSourcePointerDown = event => {
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            return
        }
        const point = findClosestSourcePoint(
            projected.sourcePoints,
            {x: event.clientX - rect.left, y: event.clientY - rect.top},
            10,
        )
        if (!point) {
            return
        }
        handlePointDragStart(event, {
            kind: 'source',
            trackSlug: point.trackSlug,
            segmentIndex: point.segmentIndex,
            index: point.index,
        })
    }

    const handleSourcePointerUp = event => {
        const drag = dragRef.current
        if (drag?.kind !== 'source') {
            handlePointDragEnd(event)
            return
        }
        handlePointDragEnd(event)
        if (!drag.moved) {
            startCorrection(drag)
        }
    }

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
        selectionAnchorRef.current = result.anchor
        setSelectedControlPoints(result.selectedControlPoints)
        setPersistedActiveCorrection({trackSlug, correctionId})
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
        if (validationInProgressRef.current) return
        if (areaMode && event.shiftKey && event.button === 0) {
            handleAreaPointerDown(event)
            if (dragRef.current?.kind === 'area') return
        }
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
        const previewByCorrection = new Map()
        const selectedSnapshots = dragSelection.flatMap(selected => {
            const corrections = draftCorrectionsByTrack[selected.trackSlug] ?? []
            const correction = corrections.find(item => item.id === selected.correctionId
                && item.controlPoints.some(control => control.id === selected.controlPointId))
            const control = correction?.controlPoints.find(item => item.id === selected.controlPointId)
            const trackContent = trackBySlug.get(selected.trackSlug)?.content
            const previewKey = selected.trackSlug + ':' + selected.correctionId
            if (correction && trackContent && !previewByCorrection.has(previewKey)) {
                previewByCorrection.set(previewKey, applyFixPathCorrections(trackContent, [correction]).content)
            }
            return control
                ? [{
                    trackSlug: selected.trackSlug,
                    correctionId: correction.id,
                    controlPointId: control.id,
                    coordinate: getControlPointCoordinate(
                        trackContent,
                        correction,
                        control,
                        previewByCorrection.get(previewKey) ?? null,
                    ),
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
        validationInProgressRef.current = true
        setSaving(true)
        try {
            for (const [trackSlug, corrections] of Object.entries(correctionsByTrack)) {
                const trackContent = trackBySlug.get(trackSlug)?.content
                if (!trackContent) continue
                for (const correction of corrections) {
                    const distance = getFixPathSegmentDistanceMeters(
                        trackContent,
                        correction.segmentIndex,
                        correction.startIndex,
                        correction.endIndex,
                    )
                    if (distance > maxSegmentMeters) {
                        UIToast.warning({
                            caption: 'Fix Path section exceeds the configured limit',
                            text: 'One section is ' + Math.round(distance) + ' m. Split it into sections shorter than ' + maxSegmentMeters + ' m.',
                        })
                        return false
                    }
                    if (correction.sourceFingerprint !== getFixPathSourceFingerprint(
                        trackContent,
                        correction.segmentIndex,
                        correction.startIndex,
                        correction.endIndex,
                    )) {
                        UIToast.warning({caption: 'Track changed', text: 'This correction no longer matches the current source points. Recreate the affected section.'})
                        return false
                    }
                }
                const applied = applyFixPathCorrections(trackContent, corrections)
                if (applied.skippedCorrectionIds.length > 0) {
                    UIToast.warning({caption: 'Correction could not be applied', text: 'Check the section endpoints and source track before editing further.'})
                    return false
                }
            }

            const currentData = journey.fixPathCorrectionData ?? {revision: 0, tracks: {}}
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
                UIToast.warning({caption: 'Corrections are not valid', text: 'Resolve overlapping or incomplete sections before editing further.'})
                return false
            }

            const contextualJourney = lgs.getJourneyBySlug?.(journeySlug)
            const previousData = journey.fixPathCorrectionData
            const previousEnabled = journey.fixPathEnabled === true
            const hasAnyCorrections = Object.values(nextData.tracks).some(corrections => corrections.some(correction => (
                correction.controlPoints.some(point => point.removed !== true)
            )))
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
                UIToast.error({
                    caption: 'Fix Path update failed',
                    text: 'The corrections could not be saved and applied to this Journey.',
                    errors: error,
                })
                return false
            }

            try {
                await (updated ?? contextualJourney ?? journey).draw?.({action: DRAWING_FROM_UI, mode: NO_FOCUS})
            }
            catch (error) {
                console.error('[FixPathEditor] Could not redraw path corrections:', error)
                UIToast.error({
                    caption: 'Path corrections saved, but the Journey could not be refreshed',
                    text: 'The corrections were saved. Refresh the Journey to update its map display.',
                    errors: error,
                })
                return false
            }
            draftNeedsPersistenceRef.current = false
            return true
        }
        finally {
            validationInProgressRef.current = false
            setSaving(false)
        }
    }, [journey, journeySlug, maxSegmentMeters, trackBySlug])

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

    const areaRectangle = areaDrag
        ? normalizeScreenSelectionArea(areaDrag.start, areaDrag.current)
        : null
    const sourcePath = buildSourcePointSvgPath(projected.sourcePoints, 8)
    const selectedPath = buildSourcePointSvgPath(projected.sourcePoints.filter(point => (
        selection.startPoint?.trackSlug === point.trackSlug
        && selection.startPoint?.segmentIndex === point.segmentIndex
        && selection.startPoint?.index === point.index
    )), 8)

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
            <svg className={'fix-path-markers' + (areaMode ? ' is-selecting-area' : '') + (eraseMode ? ' is-erasing' : '')} width={projected.width} height={projected.height} aria-label="Journey correction points">
                {areaRectangle && (
                    <rect
                        className="fix-path-selection-rectangle"
                        x={areaRectangle.left}
                        y={areaRectangle.top}
                        width={areaRectangle.width}
                        height={areaRectangle.height}
                    />
                )}
                {sourcePath && (
                    <path
                        className="fix-path-source-points"
                        d={sourcePath}
                        role="button"
                        tabIndex="0"
                        aria-label={projected.sourcePoints.length + ' Journey points in selected area'}
                        onPointerDown={handleSourcePointerDown}
                        onPointerMove={handlePointDragMove}
                        onPointerUp={handleSourcePointerUp}
                        onPointerCancel={handleSourcePointerUp}
                    />
                )}
                {selectedPath && (
                    <path
                        className="fix-path-source-points is-selected"
                        d={selectedPath}
                        aria-hidden="true"
                        onPointerDown={handleSourcePointerDown}
                        onPointerMove={handlePointDragMove}
                        onPointerUp={handleSourcePointerUp}
                        onPointerCancel={handleSourcePointerUp}
                    />
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
                            onPointerMove={event => dragRef.current?.kind === 'area'
                                ? handleAreaPointerMove(event)
                                : handlePointDragMove(event)}
                            onPointerUp={event => dragRef.current?.kind === 'area'
                                ? handleAreaPointerUp(event)
                                : handlePointDragEnd(event)}
                            onPointerCancel={event => dragRef.current?.kind === 'area'
                                ? handleAreaPointerCancel(event)
                                : handlePointDragEnd(event)}
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
                {projected.pendingControlPoints.map((point, index) => (
                    <circle
                        key={'pending-' + index}
                        className="fix-path-pending-point"
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        aria-hidden="true"
                    />
                ))}
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
                displayedCorrection,
                displayedCorrectionPreview,
                displayedTrack,
                handleCorrectionPointListKeyDown,
                handleCorrectionPointRowKeyDown,
                handleFixPathShortcut,
                helpOpen,
                heightUnit,
                orderedCorrections,
                projected,
                eraseMode,
                eraseSelectedControlPoints,
                removeControlPoint,
                resetControlPoint,
                saving,
                scanProgress,
                selectCorrectionPoint,
                selectedControlPoints,
                selection,
                setHelpOpen,
                setEraseMode,
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
                maxSegmentMeters={maxSegmentMeters}
            />
        </Widget>

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
                            <WaIcon name="trash" variant="regular" aria-hidden="true"/>
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
