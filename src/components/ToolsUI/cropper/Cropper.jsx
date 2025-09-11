/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-11
 * Last modified: 2025-09-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CropRatioSelector } from '@Components/ToolsUI/cropper/CropRatioSelector'
import { DefinedCropZone }   from '@Components/ToolsUI/cropper/DefinedCropZone'
/**
 * Cropper component for interactive crop region selection over canvas, video, or image elements.
 * Provides a draggable and resizable crop area with visual feedback and center alignment guides.
 * @component
 * @param {Object} props - Component props
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - Element to crop
 * @param {HTMLElement} [props.container] - Container for bounds (defaults to source)
 * @param {string} [props.className=''] - Additional CSS classes for crop zone
 * @param {Object} props.store - Valtio store for cropper state
 * @param {Object} [props.options={}] - Configuration options for CropperManager
 * @param {JSX.Element|string} [props.CTA] - Call to actions buttons
 * @param {JSX.Element|string} [props.RatioSelector] - Ratio selector floating menu
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }       from 'valtio'
import { CropCenterLines }   from './CropCenterLines'
import { CropOverlay }       from './CropOverlay'
import { CropperManager }    from './CropperManager'
import { CropZone }          from './CropZone'
import './style.css'
import { DragHandler } from '../../../core/ui/drag-handler/DragHandler'

// Positioning constants
const CROP_X_PERCENTAGE = 1 // Crop region center at 100% width
const CROP_Y_PERCENTAGE = 1 // Crop region center at 100% height

export const Cropper = memo(({
                                 source,
                                 container,
                                 className = '',
                                 store,
                                 options = {},
                                 children,
                             }) => {
    /**
     * Get snapshot of Valtio store for reactive state updates
     * Ensures optimized re-renders only for accessed properties
     */
    const cropper = useSnapshot(store)

    /**
     * State for tracking source loading status
     * Prevents rendering until source is ready
     */
    const [isSourceLoaded, setIsSourceLoaded] = useState(
        !(source instanceof HTMLImageElement && !source.complete),
    )

    /**
     * State for crop coordinates and dimensions (logical pixels)
     * Used for manager calculations
     */
    const [crop, setCrop] = useState({
                                         x:     store.x ?? 0,
                                         y:     store.y ?? 0,
                                         width: store.width ?? 0,
                                         height: store.height ?? 0,
                                     })

    /**
     * State for CSS crop values (adjusted for device pixel ratio)
     * Used for rendering the crop zone in CSS pixels
     */
    const [cssCrop, setCssCrop] = useState({
                                               x:      store.x ? Math.floor((store.x ?? 0) * (window.devicePixelRatio || 1)) : 0,
                                               y:      store.y ? Math.floor((store.y ?? 0) * (window.devicePixelRatio || 1)) : 0,
                                               width:  store.width ? Math.floor((store.width ?? 0) * (window.devicePixelRatio || 1)) : 0,
                                               height: store.height ? Math.floor((store.height ?? 0) * (window.devicePixelRatio || 1)) : 0,
                                           })

    /**
     * State for interaction feedback (drag, resize, centering)
     * Controls visual guides like center lines
     */
    const [interactionState, setInteractionState] = useState({
                                                                 action:             null,
                                                                 showHCenterLine:    false,
                                                                 showVCenterLine:    false,
                                                                 dragLockedHorizontal: false,
                                                                 dragLockedVertical: false,
                                                                 wasJustCentered:    false,
                                                                 isCentering:        false,
                                                             })

    // DOM and manager references
    const _cropperContainer = useRef(null)
    const _cropZone = useRef(null)
    const _manager = useRef(null)
    const _dragHandler = useRef(null)
    const _centerLinesTimer = useRef(null)
    const _lockHTimer = useRef(null)
    const _lockVTimer = useRef(null)
    // Ajouts: drapeaux pour bloquer le drag pendant/juste après un resize
    const _isResizing = useRef(false)
    const _suppressDrag = useRef(false)
    const _dhTargetResizePaused = useRef(false)

    /**
     * Memoize CropperManager options to prevent unnecessary recreations
     * Combines default options with user-provided options
     */
    const memoizedOptions = useMemo(() => ({
        draggable: true,
        resizable: true,
        lockCentering: true,
        vibrate: true,
        ...options,
    }), [options])

    /**
     * Memoize styles for crop elements (overlay, center lines)
     * Computed by manager based on crop and interaction state
     */
    const styles = useMemo(() => {
        if (!_manager.current || !cssCrop) {
            return {
                overlayStyle: {},
                hCenterLineLeftStyle: {},
                hCenterLineRightStyle: {},
                vCenterLineTopStyle: {},
                vCenterLineBottomStyle: {},
            }
        }
        return _manager.current.getStyles(cssCrop, interactionState)
    }, [cssCrop, interactionState])

    /**
     * Updates cursor style on crop zone
     * @param {string} cursor - CSS cursor value (e.g., 'grab', 'grabbing')
     */
    const updateCursor = useCallback((cursor) => {
        if (_cropZone.current) {
            _cropZone.current.style.cursor = cursor
        }
    }, [])

    const handleStart = useCallback((action, event) => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        if (action === 'drag') {
            return
        }
        if (action && action.startsWith('resize-')) {
            _isResizing.current = true
            _suppressDrag.current = true

            // 1) End any drag immediately
            try {
                if (_dragHandler.current && typeof _dragHandler.current.handleEnd === 'function') {
                    _dragHandler.current.handleEnd(new Event('pointerup'))
                }
            }
            catch {
            }

            // 2) Pause DragHandler's target resize observer (prevents automatic reposition on size change)
            try {
                if (_dragHandler.current && _dragHandler.current.targetResizeObserver && !_dhTargetResizePaused.current) {
                    _dragHandler.current.targetResizeObserver.disconnect()
                    _dhTargetResizePaused.current = true
                }
            }
            catch {
            }

            // 3) Block drag on the zone but keep handles usable
            const zone = _cropZone.current
            if (zone) {
                zone.style.pointerEvents = 'none'
                // re-enable pointer events on handles
                zone.querySelectorAll('.crop-handle').forEach(h => (h.style.pointerEvents = 'auto'))
            }
        }

        const result = _manager.current.handleStart(action, event, cropper)
        if (result && typeof result === 'object') {
            setCrop(result)
            setCssCrop(_manager.current.cssCrop || cssCrop)
        }
    }, [cropper, cssCrop])

    /**
     * Handles double-click to maximize or restore crop area
     * Toggles between full bounds and current crop
     */
    const handleDoubleClick = useCallback(() => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        const newCrop = _manager.current.maximizeRestore(cropper)
        setCrop(newCrop)
        setCssCrop(_manager.current.cssCrop || cssCrop)
    }, [cropper, cssCrop])

    /**
     * Handle image source loading and errors
     * Updates isSourceLoaded state
     */
    useEffect(() => {
        if (!(source instanceof HTMLImageElement) || source.complete) {
            setIsSourceLoaded(true)
            return
        }

        const handleLoad = () => setIsSourceLoaded(true)
        const handleError = () => setIsSourceLoaded(false)
        source.addEventListener('load', handleLoad)
        source.addEventListener('error', handleError)
        return () => {
            source.removeEventListener('load', handleLoad)
            source.removeEventListener('error', handleError)
        }
    }, [source])

    /**
     * Initialize CropperManager and set initial crop position
     * Runs only when source and container are ready
     */
    useEffect(() => {
        if (!isSourceLoaded || !source) {
            return
        }

        // Use container fallback to source when container is not provided
        const boundsContainer = container ?? source

        // Create manager only if it doesn't exist or is destroyed
        if (!_manager.current || _manager.current.isDestroyed) {
            const newManager = new CropperManager(source, boundsContainer, store, memoizedOptions)
            _manager.current = newManager

            // Let manager compute a centered initial crop
            newManager.resetCrop({
                                     aspectRatio: store.aspectRatio ?? null,
                                     options:     {lockRatio: store.lockRatio},
                                 })

            setCrop({...newManager.crop})
            setCssCrop({...newManager.cssCrop})
        }

        /**
         * Hide cropper container on close event
         */
        const handleCropperClose = () => {
            if (_cropperContainer.current) {
                _cropperContainer.current.style.display = 'none'
            }
        }

        /**
         * Update crop state on custom crop update event
         * @param {CustomEvent} e - Event with crop and cssCrop details
         */
        const handleCropUpdate = (e) => {
            setCrop(e.detail.crop)
            setCssCrop(e.detail.cssCrop || cssCrop)
        }

        // Safely add event listeners
        if (source.addEventListener) {
            source.addEventListener('onCropperClose', handleCropperClose)
            source.addEventListener('onCropUpdate', handleCropUpdate)
        }

        return () => {
            if (source.removeEventListener) {
                source.removeEventListener('onCropperClose', handleCropperClose)
                source.removeEventListener('onCropUpdate', handleCropUpdate)
            }
        }
    }, [source, container, isSourceLoaded, memoizedOptions, store])

    // Install DragHandler ONCE for CropZone, and sync cssCrop/store on movement
    useEffect(() => {
        const zoneEl = _cropZone.current
        const containerEl = _cropperContainer.current
        if (!zoneEl || !containerEl || !_manager.current) {
            return
        }
        if (_dragHandler.current) {
            return
        }

        _dragHandler.current = new DragHandler({
                                                   grabber:   zoneEl,
                                                   target:    zoneEl,
                                                   container: containerEl,
                                                   position:  {placement: 'top-left', left: cssCrop.x, top: cssCrop.y},
                                               })

        const dpr = window.devicePixelRatio || 1
        const toPhysical = (rectCss) => ({
            x:      Math.floor(rectCss.x * dpr),
            y:      Math.floor(rectCss.y * dpr),
            width:  Math.floor(rectCss.width * dpr),
            height: Math.floor(rectCss.height * dpr),
        })

        const updateFromDrag = ({x, y, width, height}) => {
            // Bloque toute MAJ venant de DragHandler pendant un resize ou la période de suppression
            if (_isResizing.current || _suppressDrag.current) {
                return
            }
            // Update CSS crop (UI)
            setCssCrop({x: Math.floor(x), y: Math.floor(y), width: Math.floor(width), height: Math.floor(height)})

            // Sync manager values (no logic, just so overlay/lines compute correctly)
            const phys = toPhysical({x, y, width, height})
            if (_manager.current && !_manager.current.isDestroyed) {
                _manager.current.crop = {..._manager.current.crop, ...phys}
                _manager.current.cssCrop = _manager.current.crop
            }

            // Update store (logical pixels)
            store.x = phys.x
            store.y = phys.y
            store.width = phys.width
            store.height = phys.height
        }

        const onStart = (e) => {
            if (_isResizing.current || _suppressDrag.current) {
                return
            }
            const r = e.detail.value
            updateFromDrag(r)
        }
        const onMove = (e) => {
            if (_isResizing.current || _suppressDrag.current) {
                return
            }
            const r = e.detail.value
            updateFromDrag(r)
        }
        const onStop = (e) => {
            if (_isResizing.current || _suppressDrag.current) {
                return
            }
            const r = e.detail.value
            updateFromDrag(r)
        }

        zoneEl.addEventListener(DragHandler.DRAG_START, onStart)
        zoneEl.addEventListener(DragHandler.DRAG, onMove)
        zoneEl.addEventListener(DragHandler.DRAG_STOP, onStop)

        return () => {
            zoneEl.removeEventListener(DragHandler.DRAG_START, onStart)
            zoneEl.removeEventListener(DragHandler.DRAG, onMove)
            zoneEl.removeEventListener(DragHandler.DRAG_STOP, onStop)
            _dragHandler.current = null
        }
        // do not depend on cssCrop to avoid re-creating handler per frame
    }, [_cropZone.current, _cropperContainer.current, _manager.current, store])

    // Keep DOM position in sync with cssCrop when not dragging
    useEffect(() => {
        const el = _cropZone.current
        const dh = _dragHandler.current
        if (!el) {
            return
        }
        if (dh && dh.dragging) {
            return
        }
        el.style.left = `${cssCrop.x}px`
        el.style.top = `${cssCrop.y}px`
        el.style.width = `${cssCrop.width}px`
        el.style.height = `${cssCrop.height}px`
    }, [cssCrop])

    /**
     * Handle global pointer/touch move and end events
     * Tracks resize interactions across the window (dragging is handled by DragHandler)
     */
    useEffect(() => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        const handleMove = (e) => {
            const bounds = _manager.current.getSourceBounds()
            const {crop: newCrop, interaction} = _manager.current.handleMove(e, cropper, bounds)

            // Update overlay/calc state
            const nextCss = _manager.current.cssCrop || cssCrop
            setCrop(newCrop)
            setCssCrop(nextCss)
            setInteractionState(interaction)

            // Force DOM sync of the crop zone to stay center-anchored like overlay
            const el = _cropZone.current
            if (el) {
                el.style.position = 'absolute'
                el.style.transform = ''
                el.style.left = `${Math.floor(nextCss.x)}px`
                el.style.top = `${Math.floor(nextCss.y)}px`
                el.style.width = `${Math.floor(nextCss.width)}px`
                el.style.height = `${Math.floor(nextCss.height)}px`
            }
        }
        const releaseDragSuppression = () => {
            _suppressDrag.current = false
        }
        const handleEnd = (e) => {
            const newInteraction = _manager.current.handleEnd(e)
            setInteractionState(newInteraction)
            _isResizing.current = false

            // 1) Resume DragHandler's target resize observer
            try {
                if (_dragHandler.current && _dragHandler.current.targetResizeObserver && _dhTargetResizePaused.current && _cropZone.current) {
                    _dragHandler.current.targetResizeObserver.observe(_cropZone.current)
                    _dhTargetResizePaused.current = false
                }
            }
            catch {
            }

            // 2) Restore pointer events on the zone
            const zone = _cropZone.current
            if (zone) {
                zone.style.pointerEvents = 'auto'
                zone.querySelectorAll('.crop-handle').forEach(h => (h.style.pointerEvents = ''))
            }

            // 3) Suppress reflex drag until the next real pointerup
            _suppressDrag.current = true
            const onceUp = () => {
                releaseDragSuppression()
                document.removeEventListener('pointerup', onceUp, true)
                document.removeEventListener('touchend', onceUp, true)
            }
            document.addEventListener('pointerup', onceUp, true)
            document.addEventListener('touchend', onceUp, true)
            setTimeout(() => {
                if (_suppressDrag.current) {
                    _suppressDrag.current = false
                }
            }, 300)
        }
        const options = {passive: false, capture: true}

        document.addEventListener('pointermove', handleMove, options)
        document.addEventListener('pointerup', handleEnd, options)
        document.addEventListener('pointercancel', handleEnd, options)
        document.addEventListener('touchmove', handleMove, options)
        document.addEventListener('touchend', handleEnd, options)
        document.addEventListener('touchcancel', handleEnd, options)
        document.addEventListener('keyup', handleEnd, options)

        return () => {
            document.removeEventListener('pointermove', handleMove, options)
            document.removeEventListener('pointerup', handleEnd, options)
            document.removeEventListener('pointercancel', handleEnd, options)
            document.removeEventListener('touchmove', handleMove, options)
            document.removeEventListener('touchend', handleEnd, options)
            document.removeEventListener('touchcancel', handleEnd, options)
            document.removeEventListener('keyup', handleEnd, options)
        }
    }, [cropper, cssCrop, _manager])

    // ADD: stop any drag when pointer/mouse leaves the window or page loses focus
    useEffect(() => {
        const endAllDrags = () => {
            // Stop DragHandler drag (if any)
            try {
                if (_dragHandler.current && typeof _dragHandler.current.handleEnd === 'function') {
                    _dragHandler.current.handleEnd(new Event('pointerup'))
                }
            }
            catch {
            }
            // Stop CropperManager interactions (resizes)
            if (_manager.current && !_manager.current.isDestroyed) {
                setInteractionState(_manager.current.handleEnd())
            }
        }

        const onVisibility = () => {
            if (document.hidden) {
                endAllDrags()
            }
        }

        const onPointerOut = (e) => {
            // When leaving the window (relatedTarget === null), stop drag
            if (!e.relatedTarget) {
                endAllDrags()
            }
        }

        window.addEventListener('blur', endAllDrags)
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('mouseleave', endAllDrags)
        window.addEventListener('pointercancel', endAllDrags)
        window.addEventListener('touchcancel', endAllDrags)
        window.addEventListener('pointerout', onPointerOut)

        return () => {
            window.removeEventListener('blur', endAllDrags)
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('mouseleave', endAllDrags)
            window.removeEventListener('pointercancel', endAllDrags)
            window.removeEventListener('touchcancel', endAllDrags)
            window.removeEventListener('pointerout', onPointerOut)
        }
    }, [])

    /**
     * Set initial cursor style on mount
     */
    useEffect(() => {
        updateCursor('grab')
    }, [updateCursor])

    // Early return if source is not loaded or manager not initialized
    if (!isSourceLoaded || !_manager.current || !cssCrop) {
        return null
    }

    return (
        <div ref={_cropperContainer} className="crop-container">
            <CropOverlay style={styles.overlayStyle}/>
            <CropCenterLines
                interactionState={interactionState}
                styles={styles}
            />
            {cropper.ratioEditor ? (
                <>
                    <CropRatioSelector manager={_manager.current}/>
                    <CropZone
                        innerRef={_cropZone}
                        cssCrop={cssCrop}
                        manager={_manager.current}
                        cropper={cropper}
                        interactionState={interactionState}
                        className={className}
                        onStart={handleStart}
                        onDoubleClick={handleDoubleClick}
                    />
                </>
            ) : (
                 <DefinedCropZone
                     cssCrop={cssCrop}
                     className={className}
                 />
             )}
        </div>
    )
})