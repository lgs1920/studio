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
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {DRAWING_FROM_UI, NO_FOCUS, UPDATE_JOURNEY_SILENTLY} from '@Core/constants'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { Utils } from '@Editor/Utils'
import {
    applyFixPathCorrections,
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    getMaxFixPathSegmentMeters,
    normalizeFixPathCorrectionData,
} from '@Utils/cesium/fixPathCorrections'
import {
    buildDraggedPointCorrections,
    buildFixPathSection,
    translateFixPathControlPoints,
} from '@Utils/cesium/fixPathCorrectionEditing'
import {
    buildSourcePointSvgPath,
    findClosestSourcePoint,
    isScreenPointInsideArea,
    normalizeScreenSelectionArea,
} from '@Utils/cesium/fixPathScreenSelection'
import {UIToast} from '@Utils/UIToast'
import { WaIcon } from '@awesome.me/webawesome/dist/react'
import {Cartesian2, Cartographic, Math as CesiumMath} from 'cesium'
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
    const [hasSelectedPoint, setHasSelectedPoint] = useState(false)
    const [selectedSourcePoints, setSelectedSourcePoints] = useState([])
    const [projected, setProjected] = useState({width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: [], previewLines: []})
    const [areaMode, setAreaMode] = useState(true)
    const [areaDrag, setAreaDrag] = useState(null)
    const [scanProgress, setScanProgress] = useState(null)
    const [helpOpen, setHelpOpen] = useState(false)
    const [dragPreview, setDragPreview] = useState(null)
    const [contextMenu, setContextMenu] = useState(null)
    const [saving, setSaving] = useState(false)
    const mapOverlayRef = useRef(null)
    const scanGenerationRef = useRef(0)
    const dragRef = useRef(null)
    const selectionAnchorRef = useRef(null)
    const suppressControlClickRef = useRef(false)
    const journeySettings = useOptionalSnapshot(lgs.settings.journey)
    const maxSegmentMeters = getMaxFixPathSegmentMeters(journeySettings.fixPathMaxSegmentMeters)

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
    const activeCorrectionIndex = orderedCorrections.indexOf(displayedCorrection)
    const displayedTrack = displayedCorrection ? trackBySlug.get(displayedCorrection.trackSlug) : null
    const displayedCorrectionPreview = useMemo(() => displayedCorrection && displayedTrack?.content
        ? applyFixPathCorrections(displayedTrack.content, [displayedCorrection]).content
        : null, [displayedCorrection, displayedTrack])

    // Reset editable drafts when the persisted Journey editing session changes.
    useEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect -- The draft mirrors persisted Journey state and resets only at session boundaries.
        setDraftCorrectionsByTrack(Object.fromEntries(availableTracks.map(track => [
            track.slug,
            cloneCorrectionList(savedCorrectionTracks?.[track.slug], track.content),
        ])))
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setActiveCorrection(null)
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setHasSelectedPoint(false)
        setSelectedSourcePoints([])
        setAreaMode(true)
        setAreaDrag(null)
        setScanProgress(null)
        setDragPreview(null)
    }, [open, journeySlug, correctionRevision, savedCorrectionTracks, availableTracks])

    // Keep map panning available throughout editing and lock rotation after point selection.
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
        const orientationProperties = hasSelectedPoint ? ['enableRotate', 'enableTilt', 'enableLook'] : []
        const previousOrientation = Object.fromEntries(orientationProperties.map(property => [property, controller[property]]))
        orientationProperties.forEach(property => { controller[property] = false })
        return () => {
            orientationProperties.forEach(property => {
                if (controller[property] === false) {
                    controller[property] = previousOrientation[property]
                }
            })
            movementProperties.forEach(property => {
                if (controller[property] === true) {
                    controller[property] = previousMovement[property]
                }
            })
        }
    }, [open, hasSelectedPoint])

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
        scanGenerationRef.current += 1
        dragRef.current = null
        setHelpOpen(false)
        closeFixPathEditor()
        setContextMenu(null)
        setDragPreview(null)
        setAreaDrag(null)
        setScanProgress(null)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        selectionAnchorRef.current = null
    }, [])

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

    // Reproject only selected Journey points and corrected geometry without walking every source vertex per render.
    useEffect(() => {
        const viewer = lgs.viewer
        const overlay = mapOverlayRef.current
        const scene = viewer?.scene
        if (!open || !viewer || !scene || !overlay) {
            setProjected({width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: [], previewLines: []})
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
            ))
        }
        const removePostRender = scene.postRender?.addEventListener?.(update)
        update()
        return () => removePostRender?.()
    }, [open, availableTracks, selectedSourcePoints, displayCorrectionsByTrack, selection, displayedCorrection])

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
        if (selection.phase === 'choose-start') {
            const existingCorrection = correctionAtPoint(
                draftCorrectionsByTrack[point.trackSlug] ?? [],
                point.segmentIndex,
                point.index,
            )
            if (existingCorrection && !extendExisting) {
                setActiveCorrection({trackSlug: point.trackSlug, correctionId: existingCorrection.id})
                setHasSelectedPoint(true)
                return
            }
            setActiveCorrection(existingCorrection
                ? {trackSlug: point.trackSlug, correctionId: existingCorrection.id}
                : null)
            setHasSelectedPoint(true)
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
        const corrections = draftCorrectionsByTrack[point.trackSlug] ?? []
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
        setDraftCorrectionsByTrack(current => ({
            ...current,
            [point.trackSlug]: result.corrections,
        }))
        setActiveCorrection({trackSlug: point.trackSlug, correctionId: result.correction.id})
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }, [draftCorrectionsByTrack, maxSegmentMeters, selection, trackBySlug])

    const addControlPoint = useCallback((event, clientX, clientY) => {
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
            return
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
    }, [availableTracks])

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
        dragRef.current = {kind: 'area', start, current: start}
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
        const rect = mapOverlayRef.current?.getBoundingClientRect()
        if (!rect) {
            setAreaDrag(null)
            return
        }
        const end = {x: event.clientX - rect.left, y: event.clientY - rect.top}
        const area = normalizeScreenSelectionArea(drag.start, end)
        setAreaDrag(null)
        if (area.width < 4 || area.height < 4) {
            UIToast.info({caption: 'Select a screen area', text: 'Drag to draw a rectangle around the Journey points.'})
            return
        }
        scanSelectedArea(area)
    }, [scanSelectedArea])

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

    /**
     * Add a correction control point from a map click during section editing.
     * @param {MouseEvent} event - Cesium canvas click event.
     */
    const handleMapClick = useCallback(event => {
        if (selection.phase !== 'add-points') {
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
        if (!open || !canvas) {
            return undefined
        }

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
        event.preventDefault()
        event.stopPropagation()
        setHasSelectedPoint(true)
        if (drag.kind === 'control') {
            suppressControlClickRef.current = false
            setActiveCorrection({trackSlug: drag.trackSlug, correctionId: drag.correctionId})
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
        if (!dragRef.current || dragRef.current.kind === 'area') {
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
        if (!dragRef.current || dragRef.current.kind === 'area') {
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
            setDraftCorrectionsByTrack(current => updateControlPointCoordinates(
                current,
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
            draftCorrectionsByTrack[drag.trackSlug] ?? [],
            drag.segmentIndex,
            drag.index,
            drag.coordinate,
        )
        if (result.error) {
            showDragError(result.error)
            return
        }
        setDraftCorrectionsByTrack(current => ({...current, [drag.trackSlug]: result.corrections}))
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
        const togglesPoint = Boolean(event?.ctrlKey || event?.metaKey)
        if (event?.shiftKey && anchor) {
            const anchorIndex = orderedControlPoints.findIndex(point => point.trackSlug === anchor.trackSlug
                && point.correctionId === anchor.correctionId && point.controlPointId === anchor.controlPointId)
            const targetIndex = orderedControlPoints.findIndex(point => point.trackSlug === target.trackSlug
                && point.correctionId === target.correctionId && point.controlPointId === target.controlPointId)
            if (anchorIndex >= 0 && targetIndex >= 0) {
                const range = orderedControlPoints.slice(
                    Math.min(anchorIndex, targetIndex),
                    Math.max(anchorIndex, targetIndex) + 1,
                )
                if (!togglesPoint) {
                    return {selectedControlPoints: range, anchor}
                }
                const selectedKeys = new Set([...selectedControlPoints, ...range].map(point => (
                    point.trackSlug + ':' + point.correctionId + ':' + point.controlPointId
                )))
                return {
                    selectedControlPoints: orderedControlPoints.filter(point => selectedKeys.has(
                        point.trackSlug + ':' + point.correctionId + ':' + point.controlPointId,
                    )),
                    anchor,
                }
            }
        }

        if (togglesPoint) {
            const alreadySelected = selectedControlPoints.some(point => point.trackSlug === target.trackSlug
                && point.controlPointId === target.controlPointId)
            const selection = alreadySelected
                ? selectedControlPoints.filter(point => point.trackSlug !== target.trackSlug
                    || point.controlPointId !== target.controlPointId)
                : [...selectedControlPoints, target]
            return {selectedControlPoints: selection, anchor: anchor ?? target}
        }

        return {selectedControlPoints: [target], anchor: target}
    }

    const selectCorrectionPoint = (event, trackSlug, correctionId, controlPointId) => {
        const target = {trackSlug, correctionId, controlPointId}
        const result = resolveControlPointSelection(event, target)
        selectionAnchorRef.current = result.anchor
        setSelectedControlPoints(result.selectedControlPoints)
        setActiveCorrection({trackSlug, correctionId})
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setHasSelectedPoint(true)
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

    const handleFixPathShortcut = event => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a' || !displayedCorrection) {
            return
        }
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
        setHasSelectedPoint(true)
    }

    const controlPointForEvent = (event, fallback) => {
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
        const point = controlPointForEvent(event, renderedPoint)
        const target = {
            trackSlug: point.trackSlug,
            correctionId: point.correctionId,
            controlPointId: point.controlPointId,
        }
        const alreadySelected = selectedControlPoints.some(selected => selected.trackSlug === target.trackSlug
            && selected.controlPointId === target.controlPointId)
        const result = resolveControlPointSelection(event, target)
        const dragSelection = alreadySelected && !event.shiftKey && !event.ctrlKey && !event.metaKey
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
        if (suppressControlClickRef.current) {
            suppressControlClickRef.current = false
            return
        }
        const point = controlPointForEvent(event, renderedPoint)
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
        selectCorrectionPoint(event, point.trackSlug, point.correctionId, point.controlPointId)
    }

    const handleControlPointContextMenu = (event, renderedPoint) => {
        event.preventDefault()
        event.stopPropagation()
        const point = controlPointForEvent(event, renderedPoint)
        setContextMenu({
            trackSlug: point.trackSlug,
            correctionId: point.correctionId,
            controlPointId: point.controlPointId,
            x: event.clientX,
            y: event.clientY,
        })
    }

    const handleControlPointKeyDown = (event, point) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }
        event.preventDefault()
        selectCorrectionPoint(event, point.trackSlug, point.correctionId, point.controlPointId)
    }

    const activateSectionAt = index => {
        if (orderedCorrections.length <= 1) return
        const sectionIndex = (index % orderedCorrections.length + orderedCorrections.length) % orderedCorrections.length
        const correction = orderedCorrections[sectionIndex]
        if (!correction) return
        setActiveCorrection({trackSlug: correction.trackSlug, correctionId: correction.id})
        setSelectedControlPoints([])
        selectionAnchorRef.current = null
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
    }

    const deleteCorrectionSection = (trackSlug, correctionId) => {
        const sectionIndex = orderedCorrections.findIndex(correction => (
            correction.trackSlug === trackSlug && correction.id === correctionId
        ))
        const nextCorrection = orderedCorrections[sectionIndex + 1] ?? orderedCorrections[sectionIndex - 1]
        setDraftCorrectionsByTrack(current => ({
            ...current,
            [trackSlug]: (current[trackSlug] ?? []).filter(correction => correction.id !== correctionId),
        }))
        setSelectedControlPoints(current => current.filter(point => point.correctionId !== correctionId))
        selectionAnchorRef.current = null
        setActiveCorrection(nextCorrection
            ? {trackSlug: nextCorrection.trackSlug, correctionId: nextCorrection.id}
            : null)
        setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})
        setHasSelectedPoint(true)
    }

    const removeControlPoint = (trackSlug, correctionId, controlPointId) => {
        const correction = (draftCorrectionsByTrack[trackSlug] ?? []).find(item => item.id === correctionId)
        const remainingPoints = correction?.controlPoints.filter(point => point.id !== controlPointId
            && point.removed !== true) ?? []
        if (remainingPoints.length === 0) {
            deleteCorrectionSection(trackSlug, correctionId)
            setContextMenu(null)
            return
        }
        setDraftCorrectionsByTrack(current => ({
            ...current,
            [trackSlug]: (current[trackSlug] ?? []).map(item => item.id === correctionId
                ? {
                    ...item,
                    controlPoints: item.controlPoints.map(point => point.id === controlPointId
                        ? {...point, removed: true}
                        : point),
                }
                : item),
        }))
        setSelectedControlPoints(current => current.filter(point => (
            point.trackSlug !== trackSlug || point.controlPointId !== controlPointId
        )))
        setContextMenu(null)
    }

    const resetControlPoint = (trackSlug, correctionId, controlPointId) => {
        const correction = (draftCorrectionsByTrack[trackSlug] ?? [])
            .find(item => item.id === correctionId && item.controlPoints.some(point => point.id === controlPointId))
        const currentPoint = correction?.controlPoints.find(point => point.id === controlPointId)
        const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(controlPointId)
        const sourceIndex = Number.isInteger(currentPoint?.sourceIndex)
            ? currentPoint.sourceIndex
            : sourcePoint ? Number(sourcePoint[2]) : Number.NaN
        const savedPoint = (originalCorrectionTracks[trackSlug] ?? [])
            .flatMap(correction => correction.controlPoints)
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
                : currentPoint?.removed === true
                    ? currentPoint.fixed !== false
                    : false

        if (resetCoordinate) {
            const normalizedCoordinate = [...resetCoordinate]
            if (normalizedCoordinate.length >= 3 && normalizedCoordinate[2] !== null
                && normalizedCoordinate[2] !== undefined && Number.isFinite(Number(normalizedCoordinate[2]))) {
                normalizedCoordinate[2] = Math.round(Number(normalizedCoordinate[2]))
            }
            setDraftCorrectionsByTrack(current => ({
                ...current,
                [trackSlug]: (current[trackSlug] ?? []).map(item => ({
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
            }))
            setSelectedControlPoints(current => current.some(point => (
                point.trackSlug === trackSlug && point.controlPointId === controlPointId
            )) ? current : [...current, {trackSlug, controlPointId}])
            setActiveCorrection({trackSlug, correctionId})
            setHasSelectedPoint(true)
            return
        }

        removeControlPoint(trackSlug, correctionId, controlPointId)
    }

    const updateControlCoordinatePart = (trackSlug, correctionId, controlPointId, coordinateIndex, rawValue) => {
        if (rawValue === '') {
            return
        }
        const parsedValue = Number(rawValue)
        const value = coordinateIndex === 2 ? Math.round(parsedValue) : parsedValue
        if (!Number.isFinite(value)) {
            return
        }
        setDraftCorrectionsByTrack(current => ({
            ...current,
            [trackSlug]: updateControlCoordinate(
                current[trackSlug] ?? [],
                correctionId,
                controlPointId,
                coordinate => {
                    const updated = [...coordinate]
                    while (updated.length <= coordinateIndex) updated.push(0)
                    updated[coordinateIndex] = value
                    return updated
                },
            ),
        }))
    }

    const validate = async () => {
        if (!journey || saving) {
            return
        }
        const segmentLimit = getMaxFixPathSegmentMeters()
        for (const [trackSlug, corrections] of Object.entries(draftCorrectionsByTrack)) {
            const trackContent = trackBySlug.get(trackSlug)?.content
            if (!trackContent) {
                continue
            }
            for (const correction of corrections) {
                const distance = getFixPathSegmentDistanceMeters(
                    trackContent,
                    correction.segmentIndex,
                    correction.startIndex,
                    correction.endIndex,
                )
                if (distance > segmentLimit) {
                    UIToast.warning({
                        caption: 'Fix Path section exceeds the configured limit',
                        text: 'One section is ' + Math.round(distance) + ' m. Split it into sections shorter than ' + segmentLimit + ' m.',
                    })
                    return
                }
                if (correction.sourceFingerprint !== getFixPathSourceFingerprint(
                    trackContent,
                    correction.segmentIndex,
                    correction.startIndex,
                    correction.endIndex,
                )) {
                    UIToast.warning({caption: 'Track changed', text: 'This correction no longer matches the current source points. Recreate the affected section.'})
                    return
                }
            }
            const applied = applyFixPathCorrections(trackContent, corrections)
            if (applied.skippedCorrectionIds.length > 0) {
                UIToast.warning({caption: 'Correction could not be applied', text: 'Check the section endpoints and source track before validating.'})
                return
            }
        }

        const currentData = journey.fixPathCorrectionData ?? {revision: 0, tracks: {}}
        const tracks = {...(currentData.tracks ?? {})}
        Object.entries(draftCorrectionsByTrack).forEach(([trackSlug, corrections]) => {
            if (corrections.length > 0) {
                tracks[trackSlug] = corrections
            }
            else {
                delete tracks[trackSlug]
            }
        })
        const nextData = normalizeFixPathCorrectionData({revision: (Number(currentData.revision) || 0) + 1, tracks})
        if (!nextData) {
            UIToast.warning({caption: 'Corrections are not valid', text: 'Resolve overlapping or incomplete sections before validating.'})
            return
        }

        const contextualJourney = lgs.getJourneyBySlug?.(journeySlug)
        const previousData = journey.fixPathCorrectionData
        const previousEnabled = journey.fixPathEnabled === true
        const hasAnyCorrections = Object.values(nextData.tracks).some(corrections => corrections.length > 0)
        const hasNewCorrections = Object.entries(draftCorrectionsByTrack).some(([trackSlug, corrections]) => {
            const persisted = savedCorrectionTracks?.[trackSlug] ?? []
            return corrections.some(correction => !persisted.some(item => item.id === correction.id))
        })
        const nextEnabled = hasAnyCorrections && (previousEnabled || hasNewCorrections)
        journey.fixPathCorrectionData = nextData
        journey.fixPathEnabled = nextEnabled
        if (contextualJourney && contextualJourney !== journey) {
            contextualJourney.fixPathCorrectionData = nextData
            contextualJourney.fixPathEnabled = nextEnabled
        }
        setSaving(true)
        let updated
        try {
            updated = await Promise.resolve(Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false}))
        }
        catch (error) {
            journey.fixPathCorrectionData = previousData
            journey.fixPathEnabled = previousEnabled
            if (contextualJourney && contextualJourney !== journey) {
                contextualJourney.fixPathCorrectionData = previousData
                contextualJourney.fixPathEnabled = previousEnabled
            }
            console.error('[FixPathEditor] Could not persist path corrections:', error)
            setSaving(false)
            UIToast.error({
                caption: 'Fix Path validation failed',
                text: 'The corrections could not be saved and applied to this Journey.',
                errors: error,
            })
            return
        }

        // Persisted corrections are authoritative; close before a potentially slow Cesium redraw.
        setSaving(false)
        close()
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
        }
    }

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
            <svg className={'fix-path-markers' + (areaMode ? ' is-selecting-area' : '')} width={projected.width} height={projected.height} aria-label="Journey correction points">
                {projected.previewLines.map((line, index) => (
                    <polyline
                        key={'preview-' + index}
                        className="fix-path-preview-line"
                        points={line.map(point => point.x + ',' + point.y).join(' ')}
                    />
                ))}
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
                        && item.controlPointId === point.controlPointId)
                    return (
                        <g
                            key={'control-' + point.trackSlug + '-' + point.correctionId + '-' + point.controlPointId}
                            className={'fix-path-control-point'
                                + (selected ? ' is-selected' : '')
                                + (!point.active ? ' is-inactive' : '')}
                            role="button"
                            tabIndex="0"
                            aria-pressed={selected}
                            aria-label="Correction point, drag to move or right-click to remove"
                            onPointerDown={event => handleControlPointPointerDown(event, point)}
                            onPointerMove={handlePointDragMove}
                            onPointerUp={handlePointDragEnd}
                            onPointerCancel={handlePointDragEnd}
                            onClick={event => handleControlPointClick(event, point)}
                            onContextMenu={event => handleControlPointContextMenu(event, point)}
                            onKeyDown={event => handleControlPointKeyDown(event, point)}
                        >
                            <circle
                                className="fix-path-control-point-hitbox"
                                cx={point.x}
                                cy={point.y}
                                r="12"
                                aria-hidden="true"
                            />
                            <circle
                                className="fix-path-control-point-visual"
                                cx={point.x}
                                cy={point.y}
                                r={selected ? 9 : 6}
                                aria-hidden="true"
                            />
                        </g>
                    )
                })}
                {projected.pendingControlPoints.map((point, index) => (
                    <circle
                        key={'pending-' + index}
                        className="fix-path-pending-point"
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        aria-hidden="true"
                    />
                ))}
            </svg>
        </div>

        <Widget isVisible config={fixPathWidgetConfig} className="fix-path-widget-shell">
            <FixPathEditorPanel {...{
                activeCorrectionIndex,
                activateSectionAt,
                areaMode,
                close,
                deleteCorrectionSection,
                displayedCorrection,
                displayedCorrectionPreview,
                displayedTrack,
                handleCorrectionPointListKeyDown,
                handleCorrectionPointRowKeyDown,
                handleFixPathShortcut,
                helpOpen,
                orderedCorrections,
                projected,
                removeControlPoint,
                resetControlPoint,
                saving,
                scanProgress,
                selectCorrectionPoint,
                selectedControlPoints,
                selection,
                setHelpOpen,
                setSelection,
                updateControlCoordinatePart,
                validate,
            }}/>
            <FixPathEditorHelp
                active={helpOpen}
                onRequestClose={() => setHelpOpen(false)}
                maxSegmentMeters={maxSegmentMeters}
            />
        </Widget>

        {contextMenu && (
                <div className="fix-path-context-menu" style={{left: contextMenu.x, top: contextMenu.y}}>
                    <button
                        type="button"
                        onClick={() => removeControlPoint(
                            contextMenu.trackSlug,
                            contextMenu.correctionId,
                            contextMenu.controlPointId,
                        )}
                    >
                        <WaIcon name="trash" variant="regular"/>{' Remove'}
                    </button>
                </div>
        )}
        </>
    )

    return createPortal(content, viewerContainer)
}
