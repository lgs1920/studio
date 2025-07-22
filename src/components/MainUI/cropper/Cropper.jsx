/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-22
 * Last modified: 2025-07-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
 * @param {JSX.Element|string} [props.CTA] - All to actions buttons
 * @param {JSX.Element|string} [props.RatioSelector] - ratio selector floating Menu
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'
import { CropCenterLines }                                         from './CropCenterLines'
import { CropOverlay }                                             from './CropOverlay'
import { CropperManager }                                          from './CropperManager'
import { CropZone }                                                from './CropZone'
import './style.css'

// Positioning constants
const CROP_X_PERCENTAGE = 0.7 // Crop region center at 70% width
const CROP_Y_PERCENTAGE = 0.5 // Crop region center at 50% height

export const Cropper = memo(({
                                 source,
                                 container,
                                 className = '',
                                 CTA = null,
                                 RatioSelector = null,
                                 store,
                                 options = {},
                             }) => {
    const cropper = useSnapshot(store)
    const [isSourceLoaded, setIsSourceLoaded] = useState(
        !(source instanceof HTMLImageElement && !source.complete),
    )
    const [crop, setCrop] = useState({
                                         x:      store.x ?? 0,
                                         y:      store.y ?? 0,
                                         width:  store.width ?? 0,
                                         height: store.height ?? 0,
                                     })
    const [interactionState, setInteractionState] = useState({
                                                                 action:               null,
                                                                 showHCenterLine:      false,
                                                                 showVCenterLine:      false,
                                                                 dragLockedHorizontal: false,
                                                                 dragLockedVertical:   false,
                                                                 wasJustCentered:      false,
                                                                 isCentering:          false,
                                                             })
    const _cropperContainer = useRef(null)
    const _cropZone = useRef(null)
    const _manager = useRef(null)

    // Memoize options
    const memoizedOptions = useMemo(() => ({
        draggable: true,
        resizable: true,
        lockCentering: true,
        vibrate: true,
        ...options,
    }), [options])

    // Memoize styles for crop elements
    const styles = useMemo(() => {
        if (!_manager.current || !crop) {
            return {
                overlayStyle: {},
                hCenterLineLeftStyle: {},
                hCenterLineRightStyle: {},
                vCenterLineTopStyle: {},
                vCenterLineBottomStyle: {},
            }
        }
        return _manager.current.getStyles(crop, interactionState)
    }, [crop, interactionState])

    /**
     * Updates cursor style on crop zone
     * @param {string} cursor - CSS cursor value
     */
    const updateCursor = useCallback((cursor) => {
        if (_cropZone.current) {
            _cropZone.current.style.cursor = cursor
        }
    }, [])

    /**
     * Handles pointer/touch start events
     * @param {string} action - Action type ('drag' or 'resize-<direction>')
     * @param {Event} event - DOM event
     */
    const handleStart = useCallback((action, event) => {
        if (!_manager.current) {
            return
        }
        const result = _manager.current.handleStart(action, event, cropper)
        if (result && typeof result === 'object') {
            setCrop(result)
            if (action === 'drag') {
                updateCursor(event.ctrlKey && !event.touches ? 'crosshair' : 'grabbing')
            }
        }
    }, [cropper, updateCursor])

    /**
     * Handles double-click to maximize/restore crop
     */
    const handleDoubleClick = useCallback(() => {
        if (!_manager.current) {
            return
        }
        const newCrop = _manager.current.maximizeRestore(cropper)
        setCrop(newCrop)
    }, [cropper])

    // Handle image source loading
    useEffect(() => {
        if (source instanceof HTMLImageElement && !source.complete) {
            const handleLoad = () => setIsSourceLoaded(true)
            const handleError = () => setIsSourceLoaded(false)
            source.addEventListener('load', handleLoad)
            source.addEventListener('error', handleError)
            return () => {
                source.removeEventListener('load', handleLoad)
                source.removeEventListener('error', handleError)
            }
        }
    }, [source])

    // Initialize CropperManager and set initial crop position
    useEffect(() => {
        if (!isSourceLoaded || !source) {
            return
        }

        // Create manager only if it doesn't exist or is destroyed
        if (!_manager.current || _manager.current.isDestroyed) {
            const newManager = new CropperManager(source, container, store, memoizedOptions)
            _manager.current = newManager

            // Hard initialize crop position
            const bounds = newManager.getSourceBounds()
            const containerWidth = bounds.width
            const containerHeight = bounds.height
            const initialWidth = store.width || containerWidth * 0.5
            const initialHeight = store.height || (store.aspectRatio ? initialWidth / store.aspectRatio : containerHeight * 0.5)
            const initialX = store.x || (containerWidth * CROP_X_PERCENTAGE - initialWidth / 2)
            const initialY = store.y || (containerHeight * CROP_Y_PERCENTAGE - initialHeight / 2)
            const initialCrop = {
                x: initialX,
                y: initialY,
                width: initialWidth,
                height: initialHeight,
            }
            setCrop(initialCrop)
            newManager.crop = initialCrop
        }

        const handleCropperClose = () => {
            if (_cropperContainer.current) {
                _cropperContainer.current.style.display = 'none'
            }
        }
        source.addEventListener('onCropperClose', handleCropperClose)

        return () => {
            source.removeEventListener('onCropperClose', handleCropperClose)
        }
    }, [source, container, isSourceLoaded, memoizedOptions, store])

    // Cleanup CropperManager only when source or container changes
    useEffect(() => {
        return () => {
            if (_manager.current && !_manager.current.isDestroyed) {
                _manager.current.destroy()
                _manager.current = null
            }
        }
    }, [source, container])

    // Handle window resize
    useEffect(() => {
        if (!_manager.current) {
            return
        }
        const handleResize = () => {
            if (_manager.current && !_manager.current.isDestroyed) {
                setCrop(_manager.current.updateCropOnSourceChange(cropper))
            }
        }
        const debouncedResize = _manager.current.debounce(handleResize, CropperManager.RESIZE_DEBOUNCE_MS)
        window.addEventListener('resize', debouncedResize)
        return () => window.removeEventListener('resize', debouncedResize)
    }, [cropper])

    // Reset centering lines
    useEffect(() => {
        if (!_manager.current) {
            return
        }
        return _manager.current.resetCentering(setInteractionState)
    }, [])

    // Handle global pointer/touch events
    useEffect(() => {
        if (!_manager.current) {
            return
        }
        const handleMove = (e) => {
            if (_manager.current.isDestroyed) {
                return
            }
            const bounds = _manager.current.getSourceBounds()
            const {crop: newCrop, interaction} = _manager.current.handleMove(e, cropper, bounds)
            setCrop(newCrop)
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
    }, [cropper, updateCursor])

    // Set initial cursor
    useEffect(() => {
        updateCursor('grab')
    }, [updateCursor])

    // Early return if source is not loaded or manager/crop not initialized
    if (!isSourceLoaded || !_manager.current || !crop) {
        return null
    }

    return (
        <div ref={_cropperContainer} className="crop-container">
            {RatioSelector && <RatioSelector manager={_manager.current}/>}

            {CTA && <CTA manager={_manager.current}/>}

            <CropOverlay style={styles.overlayStyle}/>
            <CropCenterLines
                interactionState={interactionState}
                styles={styles}
            />
            <CropZone
                ref={_cropZone
                }
                crop={crop}
                manager={_manager.current}
                cropper={cropper}
                interactionState={interactionState}
                className={className}
                onStart={handleStart}
                onDoubleClick={handleDoubleClick}
            />
        </div>
    )
})