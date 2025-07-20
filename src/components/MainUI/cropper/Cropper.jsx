/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-20
 * Last modified: 2025-07-20
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
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSnapshot }                                             from 'valtio'
import { CropperCTA }                                              from '@Components/MainUI/cropper/CropperCTA'
import { CropRatioSelector }                                       from './CropRatioSelector'
import { CropperManager }                                          from './CropperManager'
import './style.css'

// Positioning constants
const CROP_X_PERCENTAGE = 0.7 // Crop region center at 70% width
const CROP_Y_PERCENTAGE = 0.5 // Crop region center at 50% height

export const Cropper = memo(({source, container, className = '', store, options = {}}) => {
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
                                                                 action:          null,
                                                                 showHCenterLine: false,
                                                                 showVCenterLine: false,
                                                                 dragLockedHorizontal: false,
                                                                 dragLockedVertical: false,
                                                                 wasJustCentered: false,
                                                                 isCentering:     false,
                                                             })
    const cropperContainerRef = useRef(null)
    const cropZoneRef = useRef(null)
    const managerRef = useRef(null)

    // Memoize options
    const memoizedOptions = useMemo(() => ({
        draggable:     true,
        resizable:     true,
        lockCentering: true,
        vibrate:       true,
        ...options,
    }), [options])

    // Memoize styles for crop elements
    const styles = useMemo(() => {
        if (!managerRef.current || !crop) {
            return {
                overlayStyle:           {},
                hCenterLineLeftStyle:   {},
                hCenterLineRightStyle:  {},
                vCenterLineTopStyle:    {},
                vCenterLineBottomStyle: {},
            }
        }
        return managerRef.current.getStyles(crop, interactionState)
    }, [crop, interactionState])

    /**
     * Updates cursor style on crop zone
     * @param {string} cursor - CSS cursor value
     */
    const updateCursor = useCallback((cursor) => {
        if (cropZoneRef.current) {
            cropZoneRef.current.style.cursor = cursor
        }
    }, [])

    /**
     * Handles pointer/touch start events
     * @param {string} action - Action type ('drag' or 'resize-<direction>')
     * @param {Event} event - DOM event
     */
    const handleStart = useCallback((action, event) => {
        if (!managerRef.current) {
            return
        }
        const result = managerRef.current.handleStart(action, event, cropper)
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
        if (!managerRef.current) {
            return
        }
        const newCrop = managerRef.current.maximizeRestore(cropper)
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
        if (!managerRef.current || managerRef.current.isDestroyed) {
            console.log('inside')
            const newManager = new CropperManager(source, container, store, memoizedOptions)
            managerRef.current = newManager

            // Hard initialize crop position
            const bounds = newManager.getSourceBounds()
            const containerWidth = bounds.width
            const containerHeight = bounds.height
            const initialWidth = store.width || containerWidth * 0.5
            const initialHeight = store.height || (store.aspectRatio ? initialWidth / store.aspectRatio : containerHeight * 0.5)
            const initialX = store.x || (containerWidth * CROP_X_PERCENTAGE - initialWidth / 2)
            const initialY = store.y || (containerHeight * CROP_Y_PERCENTAGE - initialHeight / 2)
            const initialCrop = {
                x:      initialX,
                y:      initialY,
                width:  initialWidth,
                height: initialHeight,
            }
            setCrop(initialCrop)
            newManager.crop = initialCrop
        }

        const handleCropperClose = () => {
            if (cropperContainerRef.current) {
                cropperContainerRef.current.style.display = 'none'
            }
        }
        source.addEventListener('onCropperClose', handleCropperClose)

        return () => {
            console.log('bye')
            source.removeEventListener('onCropperClose', handleCropperClose)
        }
    }, [source, container, isSourceLoaded, memoizedOptions, store])

    // Cleanup CropperManager only when source or container changes
    useEffect(() => {
        return () => {
            if (managerRef.current && !managerRef.current.isDestroyed) {
                console.log('destroying manager')
                managerRef.current.destroy()
                managerRef.current = null
            }
        }
    }, [source, container])

    // Handle window resize
    useEffect(() => {
        if (!managerRef.current) {
            return
        }
        const handleResize = () => {
            if (managerRef.current && !managerRef.current.isDestroyed) {
                setCrop(managerRef.current.updateCropOnSourceChange(cropper))
            }
        }
        const debouncedResize = managerRef.current.debounce(handleResize, CropperManager.RESIZE_DEBOUNCE_MS)
        window.addEventListener('resize', debouncedResize)
        return () => window.removeEventListener('resize', debouncedResize)
    }, [cropper])

    // Reset centering lines
    useEffect(() => {
        if (!managerRef.current) {
            return
        }
        return managerRef.current.resetCentering(setInteractionState)
    }, [])

    // Handle global pointer/touch events
    useEffect(() => {
        if (!managerRef.current) {
            return
        }
        const handleMove = (e) => {
            if (managerRef.current.isDestroyed) {
                return
            }
            const bounds = managerRef.current.getSourceBounds()
            const {crop: newCrop, interaction} = managerRef.current.handleMove(e, cropper, bounds)
            setCrop(newCrop)
            setInteractionState(interaction)
        }
        const handleEnd = () => {
            if (managerRef.current.isDestroyed) {
                return
            }
            setInteractionState(managerRef.current.handleEnd())
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
    if (!isSourceLoaded || !managerRef.current || !crop) {
        return null
    }

    return (
        <div ref={cropperContainerRef} className="crop-container">
            {memoizedOptions.editor && <CropRatioSelector manager={managerRef.current}/>}
            <CropperCTA/>
            <div className="crop-overlay" style={styles.overlayStyle}/>
            <div className="center-lines-container">
                {interactionState.showHCenterLine && (
                    <>
                        <div className="center-line-horizontal-left" style={styles.hCenterLineLeftStyle}/>
                        <div className="center-line-horizontal-right" style={styles.hCenterLineRightStyle}/>
                    </>
                )}
                {interactionState.showVCenterLine && (
                    <>
                        <div className="center-line-vertical-top" style={styles.vCenterLineTopStyle}/>
                        <div className="center-line-vertical-bottom" style={styles.vCenterLineBottomStyle}/>
                    </>
                )}
            </div>
            <div
                ref={cropZoneRef}
                className={`crop-zone ${className}`}
                style={{
                    left:   crop.x / managerRef.current.dpr,
                    top:    crop.y / managerRef.current.dpr,
                    width:  crop.width / managerRef.current.dpr,
                    height: crop.height / managerRef.current.dpr,
                    cursor: 'grab',
                }}
                onPointerDown={(e) => handleStart('drag', e)}
                onTouchStart={(e) => handleStart('drag', e)}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleStart('drag', e)
                }}
            >
                <div className="crop-info lgs-one-line-card on-map small">
                    {Math.round(crop.x / managerRef.current.dpr)}×{Math.round(crop.y / managerRef.current.dpr)} |{' '}
                    {Math.round(crop.width / managerRef.current.dpr)}×{Math.round(crop.height / managerRef.current.dpr)}
                </div>
                {interactionState.showHCenterLine && <div className="center-line-inner-horizontal"/>}
                {interactionState.showVCenterLine && <div className="center-line-inner-vertical"/>}
                {cropper.resizable &&
                    CropperManager.handleMap.map(([dir, cursor]) => (
                        <div
                            key={dir}
                            className={`crop-handle handle-${dir}`}
                            style={{cursor}}
                            onPointerDown={(e) => {
                                e.stopPropagation()
                                handleStart(`resize-${dir}`, e)
                            }}
                            onTouchStart={(e) => {
                                e.stopPropagation()
                                handleStart(`resize-${dir}`, e)
                            }}
                        />
                    ))}
            </div>
        </div>
    )
})