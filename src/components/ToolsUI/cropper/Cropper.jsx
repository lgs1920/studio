/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2025-09-04
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
 * @param {JSX.Element|string} [props.CTA] - Call to actions buttons
 * @param {JSX.Element|string} [props.RatioSelector] - Ratio selector floating menu
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }     from 'valtio'
import { CropCenterLines } from './CropCenterLines'
import { CropOverlay }     from './CropOverlay'
import { CropperManager }  from './CropperManager'
import { CropZone }        from './CropZone'
import { DefinedCropZone } from '@Components/ToolsUI/cropper/DefinedCropZone'
import './style.css'

// Positioning constants
const CROP_X_PERCENTAGE = 1 // Crop region center at 100% width
const CROP_Y_PERCENTAGE = 1 // Crop region center at 100% height

export const Cropper = memo(({
                                 source,
                                 container,
                                 className = '',
                                 CTA = null, RatioSelector = null,
                                 QualitySelector = null,
                                 FPSSelector = null,
                                 store,
                                 options = {},
                             }) => {
    const cropper = useSnapshot(store)
    const [isSourceLoaded, setIsSourceLoaded] = useState(
        !(source instanceof HTMLImageElement && !source.complete),
    )
    const [crop, setCrop] = useState({
                                         x:     store.x ?? 0,
                                         y:     store.y ?? 0,
                                         width: store.width ?? 0,
                                         height: store.height ?? 0,
                                     })
    const [cssCrop, setCssCrop] = useState({
                                               x:      store.x ? Math.floor(store.x / (window.devicePixelRatio || 1)) : 0,
                                               y:      store.y ? Math.floor(store.y / (window.devicePixelRatio || 1)) : 0,
                                               width:  store.width ? Math.floor(store.width / (window.devicePixelRatio || 1)) : 0,
                                               height: store.height ? Math.floor(store.height / (window.devicePixelRatio || 1)) : 0,
                                           })
    const [interactionState, setInteractionState] = useState({
                                                                 action:             null,
                                                                 showHCenterLine:    false,
                                                                 showVCenterLine:    false,
                                                                 dragLockedHorizontal: false,
                                                                 dragLockedVertical: false,
                                                                 wasJustCentered:    false,
                                                                 isCentering:        false,
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
            setCssCrop(_manager.current.cssCrop || cssCrop) // Fallback to current cssCrop
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
        setCssCrop(_manager.current.cssCrop || cssCrop) // Fallback to current cssCrop
    }, [cropper, cssCrop])

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
            const initScale = (__.device.isMobile || __.device.isTablet) ? 1 : CropperManager.INIT_CROP_SCALE_FACTOR
            const containerWidth = bounds.width
            const containerHeight = bounds.height
            const initialWidth = (store.width || containerWidth) * initScale
            const initialHeight = (store.height || (store.aspectRatio ? initialWidth / store.aspectRatio : containerHeight)) * initScale
            const initialX = store.x || (containerWidth * CROP_X_PERCENTAGE - initialWidth) / 2
            const initialY = store.y || (containerHeight * CROP_Y_PERCENTAGE - initialHeight) / 2
            const initialCrop = {
                x: initialX,
                y: initialY,
                width: initialWidth,
                height: initialHeight,
            }
            const initialCssCrop = {
                x:      Math.floor(initialX / newManager.dpr),
                y:      Math.floor(initialY / newManager.dpr),
                width:  Math.floor(initialWidth / newManager.dpr),
                height: Math.floor(initialHeight / newManager.dpr),
            }

            newManager.crop = initialCrop
            newManager.cssCrop = initialCrop
            setCrop(initialCrop)
            setCssCrop(newManager.cssCrop)

        }

        const handleCropperClose = () => {
            if (_cropperContainer.current) {
                _cropperContainer.current.style.display = 'none'
            }
        }
        const handleCropUpdate = (e) => {
            setCrop(e.detail.crop)
            setCssCrop(e.detail.cssCrop || cssCrop) // Fallback to current cssCrop
        }
        source.addEventListener('onCropperClose', handleCropperClose)
        source.addEventListener('onCropUpdate', handleCropUpdate)

        return () => {
            source.removeEventListener('onCropperClose', handleCropperClose)
            source.removeEventListener('onCropUpdate', handleCropUpdate)
        }
    }, [source, container, isSourceLoaded, memoizedOptions, store, cssCrop])

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
                const newCrop = _manager.current.updateCropOnSourceChange(cropper)
                setCrop(newCrop)
                setCssCrop(_manager.current.cssCrop || cssCrop) // Fallback to current cssCrop
            }
        }
        const debouncedResize = _manager.current.debounce(handleResize, CropperManager.RESIZE_DEBOUNCE_MS)
        window.addEventListener('resize', debouncedResize)
        return () => window.removeEventListener('resize', debouncedResize)
    }, [cropper, cssCrop])

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
            setCssCrop(_manager.current.cssCrop || cssCrop) // Fallback to current cssCrop
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
    }, [cropper, updateCursor, cssCrop])

    // Set initial cursor
    useEffect(() => {
        updateCursor('grab')
    }, [updateCursor])

    // Early return if source is not loaded or manager/crop not initialized
    if (!isSourceLoaded || !_manager.current || !cssCrop) {
        return null
    }

    return (
        <div ref={_cropperContainer} className="crop-container">
            {RatioSelector && <RatioSelector manager={_manager.current}/>}
            {QualitySelector && <QualitySelector manager={_manager.current}/>}
            {FPSSelector && <FPSSelector manager={_manager.current}/>}

            {CTA && <CTA manager={_manager.current}/>}
            <CropOverlay style={styles.overlayStyle}/>
            <CropCenterLines
                interactionState={interactionState}
                styles={styles}
            />
            {cropper.ratioEditor ? (
                <CropZone
                    ref={_cropZone}
                    cssCrop={cssCrop}
                    manager={_manager.current}
                    cropper={cropper}
                    interactionState={interactionState}
                    className={className}
                    onStart={handleStart}
                    onDoubleClick={handleDoubleClick}
                />
            ) : (
                 <DefinedCropZone
                     ref={_cropZone}
                     cssCrop={cssCrop}
                     manager={{dpr: _manager.current.dpr}}
                     className={className}
                 />
             )}
        </div>
    )
})