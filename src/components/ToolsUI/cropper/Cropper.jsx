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

    /**
     * Handles pointer/touch start events for drag or resize
     * Initializes interaction via manager
     * @param {string} action - Action type ('drag' or 'resize-<direction>')
     * @param {Event} event - DOM pointer/touch event
     */
    const handleStart = useCallback((action, event) => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        const result = _manager.current.handleStart(action, event, cropper)
        if (result && typeof result === 'object') {
            setCrop(result)
            setCssCrop(_manager.current.cssCrop || cssCrop)
            if (action === 'drag') {
                updateCursor(event.ctrlKey && !event.touches ? 'crosshair' : 'grabbing')
            }
        }
    }, [cropper, updateCursor, cssCrop])

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

            // Initialize crop position
            const bounds = newManager.getSourceBounds()
            const initScale = (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Tablet'))
                              ? 1
                              : CropperManager.INIT_CROP_SCALE_FACTOR
            const containerWidth = bounds.width
            const containerHeight = bounds.height
            const initialWidth = (store.width ?? containerWidth) * initScale
            const initialHeight = (store.height ?? (store.aspectRatio ? initialWidth / store.aspectRatio : containerHeight)) * initScale
            const initialX = store.x ?? (containerWidth * CROP_X_PERCENTAGE - initialWidth) / 2
            const initialY = store.y ?? (containerHeight * CROP_Y_PERCENTAGE - initialHeight) / 2
            const initialCrop = {
                x: initialX,
                y: initialY,
                width: initialWidth,
                height: initialHeight,
            }
            const initialCssCrop = {
                x:      Math.floor(initialX * newManager.dpr),
                y:      Math.floor(initialY * newManager.dpr),
                width:  Math.floor(initialWidth * newManager.dpr),
                height: Math.floor(initialHeight * newManager.dpr),
            }

            newManager.crop = initialCrop
            newManager.cssCrop = initialCssCrop
            setCrop(initialCrop)
            setCssCrop(initialCssCrop)
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

    /**
     * Cleanup CropperManager on source or container change
     * Prevents memory leaks
     */
    useEffect(() => {
        return () => {
            if (_manager.current && !_manager.current.isDestroyed) {
                _manager.current.destroy()
                _manager.current = null
            }
        }
    }, [source, container])

    /**
     * Handle window resize events
     * Updates crop position on source bounds change (debounced)
     */
    useEffect(() => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        const handleResize = () => {
            if (_manager.current && !_manager.current.isDestroyed) {
                const newCrop = _manager.current.updateCropOnSourceChange(cropper)
                setCrop(newCrop)
                setCssCrop(_manager.current.cssCrop || cssCrop)
            }
        }
        const debouncedResize = _manager.current.debounce(handleResize, CropperManager.RESIZE_DEBOUNCE_MS)
        window.addEventListener('resize', debouncedResize)
        return () => window.removeEventListener('resize', debouncedResize)
    }, [cropper, _manager])

    /**
     * Reset centering lines on mount
     * Initializes interaction state
     */
    useEffect(() => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        return _manager.current.resetCentering(setInteractionState)
    }, [_manager])

    /**
     * Handle global pointer/touch move and end events
     * Tracks drag/resize interactions across the window
     */
    useEffect(() => {
        if (!_manager.current || _manager.current.isDestroyed) {
            return
        }
        const handleMove = (e) => {
            if (_manager.current.isDestroyed) {
                return
            }
            const bounds = _manager.current.getSourceBounds()
            const {crop: newCrop, interaction} = _manager.current.handleMove(e, cropper, bounds)
            setCrop(newCrop)
            setCssCrop(_manager.current.cssCrop || cssCrop)
            setInteractionState(interaction)
        }
        const handleEnd = () => {
            if (_manager.current.isDestroyed) {
                return
            }
            setInteractionState(_manager.current.handleEnd())
            updateCursor('grab')
        }
        const eventOptions = {passive: false}
        window.addEventListener('pointermove', handleMove, eventOptions)
        window.addEventListener('pointerup', handleEnd)
        window.addEventListener('touchmove', handleMove, eventOptions)
        window.addEventListener('touchend', handleEnd)
        return () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleEnd)
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleEnd)
        }
    }, [cropper, updateCursor, cssCrop, _manager])

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