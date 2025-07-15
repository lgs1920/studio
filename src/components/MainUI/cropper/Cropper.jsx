/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-15
 * Last modified: 2025-07-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Cropper - A React component for selecting a cropping region over a canvas, video, or image element.
 * Handles display, event handling, and proxy logic, using CropperManager for core crop logic.
 * @param {Object} props - Component props
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - The source element to crop
 * @param {HTMLElement|null} props.container - The container element for bounds (optional, defaults to source)
 * @param {string} [props.className=''] - Additional CSS classes for the overlay container
 * @param {Object} props.store - The global store for cropper state
 * @returns {JSX.Element} The cropper UI
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }                                       from 'valtio'
import PropTypes                                             from 'prop-types'
import { SECOND }                                            from '@Core/constants'
import { CropperManager } from './CropperManager'

/**
 * Cropper component for interactive crop region selection
 * @param {Object} props - Component props
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - The source element to crop
 * @param {HTMLElement|null} props.container - The container element for bounds (optional, defaults to source)
 * @param {string} [props.className] - Additional CSS classes for the overlay container
 * @param {Object} props.store - The global store for cropper state
 * @returns {JSX.Element} The cropper UI
 */
export const Cropper = ({source, container, className = '', store}) => {
    // Store CropperManager instance for this component
    const cropperManagerRef = useRef(null)
    // Snapshot of global store for reactivity
    const cropper = useSnapshot(store)
    // State to track if source is loaded
    const [isSourceLoaded, setIsSourceLoaded] = useState(!(source instanceof HTMLImageElement))
    // State to force re-render on crop updates
    const [cropUpdate, setCropUpdate] = useState(0)
    // State for window size to handle resize events
    const [windowSize, setWindowSize] = useState({
                                                     width: window.innerWidth,
                                                     height: window.innerHeight,
                                                 });
    // Interaction states for drag and resize
    const [action, setAction] = useState(null)
    const [showHCenterLine, setShowHCenterLine] = useState(false)
    const [showVCenterLine, setShowVCenterLine] = useState(false)
    const [dragLockedHorizontal, setDragLockedHorizontal] = useState(false)
    const [dragLockedVertical, setDragLockedVertical] = useState(false)

    // References for interaction tracking
    const _raf = useRef(null)
    const _action = useRef(null)
    const _start = useRef({x: 0, y: 0, width: 0, height: 0, clientX: 0, clientY: 0, isShiftPressed: false})
    const _lastTap = useRef(null)

    // Constants for interaction behavior
    const DRAG_SENSITIVITY = 0.4 // Sensitivity factor for dragging
    const CENTER_TOLERANCE = 5 * (window.devicePixelRatio || 1) // Tolerance for centering detection (HDPI-adjusted)
    const CENTER_LOCK_DURATION = 2 // Duration to lock drag after centering (seconds)
    const DOUBLE_TAP_THRESHOLD = 300 // Threshold for double-tap detection (milliseconds)

    // Initialize CropperManager only when source is loaded
    useEffect(() => {
        if (source instanceof HTMLImageElement && !source.complete) {
            // Wait for image to load
            const handleLoad = () => {
                cropperManagerRef.current = new CropperManager(source, container, store)
                setIsSourceLoaded(true)
            }
            source.addEventListener('load', handleLoad)
            return () => source.removeEventListener('load', handleLoad)
        }
        else {
            cropperManagerRef.current = new CropperManager(source, container, store)
            setIsSourceLoaded(true)
        }
    }, [source, container, store])

    // Compute container bounds for positioning
    const sourceBounds = useMemo(() => {
        return cropperManagerRef.current ? cropperManagerRef.current.getSourceBounds() : {
            x:      0,
            y:      0,
            width:  0,
            height: 0,
        }
    }, [windowSize, isSourceLoaded, cropUpdate])

    /**
     * Handles window resize to update crop region
     * @private
     */
    useEffect(() => {
        if (!isSourceLoaded || !cropperManagerRef.current) {
            return
        }
        // Update window size and crop region on resize
        const handleResize = () => {
            setWindowSize({
                              width: window.innerWidth,
                              height: window.innerHeight,
                          });
            cropperManagerRef.current.updateWindowSize()
            cropperManagerRef.current.updateCropOnSourceChange(cropper)
            setCropUpdate(prev => prev + 1) // Force re-render
        };
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [cropper, isSourceLoaded]);

    /**
     * Resets center lines and drag lock after delay
     * @private
     */
    useEffect(() => {
        if (showHCenterLine || showVCenterLine) {
            // Reset center lines and locks after a single delay
            const timer = setTimeout(() => {
                setShowHCenterLine(false)
                setShowVCenterLine(false)
                setDragLockedHorizontal(false)
                setDragLockedVertical(false)
            }, CENTER_LOCK_DURATION * SECOND);
            return () => clearTimeout(timer)
        }
    }, [showHCenterLine, showVCenterLine]);

    /**
     * Handles maximize/restore on double-click or double-tap
     * @private
     */
    const handleMaximizeRestore = useCallback(() => {
        if (cropperManagerRef.current) {
            cropperManagerRef.current.maximizeRestore(cropper)
            setCropUpdate(prev => prev + 1) // Force re-render
        }
    }, [cropper])

    /**
     * Handles center crop on Ctrl+Click
     * @private
     */
    const handleCenterCrop = useCallback(() => {
        if (cropperManagerRef.current) {
            cropperManagerRef.current.centerCrop(cropper)
            setCropUpdate(prev => prev + 1) // Force re-render
        }
    }, [cropper]);

    /**
     * Handles pointer/touch start for dragging or resizing
     * @param {string} actionType - Action type ('drag' or 'resize-<direction>')
     * @param {PointerEvent|TouchEvent} e - Event object
     * @private
     */
    const handleStart = useCallback((actionType, e) => {
        if (!cropperManagerRef.current || cropper.recording) {
            return
        }
        if (actionType === 'drag' || actionType.startsWith('resize')) {
            e.preventDefault()
        }
        const dpr = window.devicePixelRatio || 1
        const clientX = (e.type === 'touchstart' ? e.touches[0].clientX : e.clientX) * dpr
        const clientY = (e.type === 'touchstart' ? e.touches[0].clientY : e.clientY) * dpr
        const isShiftPressed = e.shiftKey && actionType.startsWith('resize')

        // Center crop on Ctrl+Click (non-touch)
        if (actionType === 'drag' && e.ctrlKey && e.type !== 'touchstart') {
            handleCenterCrop()
            return
        }

        // Detect double-tap for maximize/restore (touch only)
        if (actionType === 'drag' && e.type === 'touchstart') {
            const now = Date.now()
            if (_lastTap.current && (now - _lastTap.current) < DOUBLE_TAP_THRESHOLD) {
                e.preventDefault()
                handleMaximizeRestore()
                _lastTap.current = null
                return
            }
            _lastTap.current = now
        }

        // Start drag or resize action
        setAction(actionType)
        _action.current = actionType
        _start.current = {
            x:      cropperManagerRef.current.crop.x,
            y:      cropperManagerRef.current.crop.y,
            width:  cropperManagerRef.current.crop.width,
            height: cropperManagerRef.current.crop.height,
            clientX,
            clientY,
            isShiftPressed,
        };
    }, [cropper.recording, handleMaximizeRestore, handleCenterCrop]);

    /**
     * Handles pointer/touch move for dragging or resizing
     * @param {PointerEvent|TouchEvent} e - Event object
     * @private
     */
    const handleMove = useCallback((e) => {
        if (!action || !_action.current || !cropperManagerRef.current) {
            return
        }
        if (action === 'drag' && dragLockedHorizontal && dragLockedVertical) {
            return // Block drag during double centering
        }
        e.preventDefault()
        const dpr = window.devicePixelRatio || 1
        const clientX = (e.type === 'touchmove' ? e.touches[0].clientX : e.clientX) * dpr
        const clientY = (e.type === 'touchmove' ? e.touches[0].clientY : e.clientY) * dpr

        // Cancel any existing RAF to avoid overlapping calls
        if (_raf.current) {
            __.cancelAnimationFrame(_raf.current)
        }

        _raf.current = __.requestAnimationFrame(() => {
            // Update crop via CropperManager and handle centering feedback
            const updates = cropperManagerRef.current.updateCrop(
                action,
                cropper,
                clientX,
                clientY,
                _start.current,
                sourceBounds,
                dragLockedHorizontal,
                dragLockedVertical,
            )
            setShowHCenterLine(updates.showHCenterLine)
            setShowVCenterLine(updates.showVCenterLine)
            setDragLockedHorizontal(updates.dragLockedHorizontal)
            setDragLockedVertical(updates.dragLockedVertical)
            cropperManagerRef.current.syncStore() // Sync store on every move
            setCropUpdate(prev => prev + 1) // Force re-render
            _raf.current = null
        });
    }, [action, cropper, sourceBounds, dragLockedHorizontal, dragLockedVertical]);

    /**
     * Handles pointer/touch end
     * @private
     */
    const handleEnd = useCallback(() => {
        if (action && cropperManagerRef.current) {
            cropperManagerRef.current.syncStore()
            setCropUpdate(prev => prev + 1) // Force re-render
        }
        setAction(null)
        _action.current = null
        if (_raf.current) {
            __.cancelAnimationFrame(_raf.current)
            _raf.current = null
        }
    }, [action]);

    /**
     * Manages event listeners for pointer and touch interactions
     * @private
     */
    useEffect(() => {
        if (action) {
            window.addEventListener('pointermove', handleMove, {passive: false})
            window.addEventListener('pointerup', handleEnd)
            window.addEventListener('touchmove', handleMove, {passive: false})
            window.addEventListener('touchend', handleEnd)
            return () => {
                window.removeEventListener('pointermove', handleMove)
                window.removeEventListener('pointerup', handleEnd)
                window.removeEventListener('touchmove', handleMove)
                window.removeEventListener('touchend', handleEnd)
                if (_raf.current) {
                    __.cancelAnimationFrame(_raf.current)
                    _raf.current = null
                }
            };
        }
    }, [action, handleMove, handleEnd]);

    /**
     * Clean up CropperManager on component unmount
     * @private
     */
    useEffect(() => {
        return () => {
            if (cropperManagerRef.current) {
                cropperManagerRef.current.destroy()
            }
        }
    }, [])

    /**
     * Defines resize handle directions and cursors
     * @type {Array<[string, string]>}
     */
    const handleMap = useMemo(() => [
        ['nw', 'nwse-resize'],
        ['ne', 'nesw-resize'],
        ['se', 'nwse-resize'],
        ['sw', 'nesw-resize'],
        ['n', 'ns-resize'],
        ['e', 'ew-resize'],
        ['s', 'ns-resize'],
        ['w', 'ew-resize'],
    ], []);

    // Render nothing until source is loaded
    if (!isSourceLoaded || !cropperManagerRef.current) {
        return null
    }

    // HDPI adjustment for rendering
    const dpr = window.devicePixelRatio || 1

    // Styles for crop zone, converted to CSS pixels
    const dynamicStyle = {
        left:   cropperManagerRef.current.crop.x / dpr,
        top:    cropperManagerRef.current.crop.y / dpr,
        width:  cropperManagerRef.current.crop.width / dpr,
        height: cropperManagerRef.current.crop.height / dpr,
        cursor: action === 'drag' ? 'grabbing' : cropper.draggable ? 'grab' : 'default',
    };

    // Clip path for overlay to exclude crop region
    const overlayStyle = {
        clipPath: `polygon(
            0 0,
            100% 0,
            100% 100%,
            0 100%,
            0 ${cropperManagerRef.current.crop.y / dpr}px,
            ${cropperManagerRef.current.crop.x / dpr}px ${cropperManagerRef.current.crop.y / dpr}px,
            ${cropperManagerRef.current.crop.x / dpr}px ${cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height / dpr}px,
            ${cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width / dpr}px ${cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height / dpr}px,
            ${cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width / dpr}px ${cropperManagerRef.current.crop.y / dpr}px,
            0 ${cropperManagerRef.current.crop.y / dpr}px
        )`,
    };

    // Styles for horizontal center lines
    const hCenterLineLeftStyle = {
        left:  sourceBounds.x / dpr,
        top:   (cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height / 2) / dpr,
        width: (cropperManagerRef.current.crop.x - sourceBounds.x) / dpr,
    };

    const hCenterLineRightStyle = {
        left:  (cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width) / dpr,
        top:   (cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height / 2) / dpr,
        width: (sourceBounds.x + sourceBounds.width - (cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width)) / dpr,
    };

    // Styles for vertical center lines
    const vCenterLineTopStyle = {
        top:    sourceBounds.y / dpr,
        left:   (cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width / 2) / dpr,
        height: (cropperManagerRef.current.crop.y - sourceBounds.y) / dpr,
    };

    const vCenterLineBottomStyle = {
        top:    (cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height) / dpr,
        left:   (cropperManagerRef.current.crop.x + cropperManagerRef.current.crop.width / 2) / dpr,
        height: (sourceBounds.y + sourceBounds.height - (cropperManagerRef.current.crop.y + cropperManagerRef.current.crop.height)) / dpr,
    };

    return (
        <>
            {/* Overlay to dim non-cropped area */}
            <div className="crop-overlay" style={overlayStyle}/>
            {/* Container for center line indicators */}
            <div className="center-lines-container">
                {showHCenterLine && <div className="center-line-horizontal-left" style={hCenterLineLeftStyle}/>}
                {showHCenterLine && <div className="center-line-horizontal-right" style={hCenterLineRightStyle}/>}
                {showVCenterLine && <div className="center-line-vertical-top" style={vCenterLineTopStyle}/>}
                {showVCenterLine && <div className="center-line-vertical-bottom" style={vCenterLineBottomStyle}/>}
            </div>
            {/* Crop zone with handles and info */}
            <div
                className={`crop-zone ${className}`}
                style={dynamicStyle}
                onPointerDown={e => handleStart('drag', e)}
                onTouchStart={e => handleStart('drag', e)}
                onDoubleClick={handleMaximizeRestore}
            >
                {/* Display crop coordinates and size */}
                <div className="crop-info lgs-one-line-card on-map small">
                    X: {Math.round(cropperManagerRef.current.crop.y / dpr)} Y: {Math.round(cropperManagerRef.current.crop.x / dpr)} -
                    W: {Math.round(cropperManagerRef.current.crop.width / dpr)} H: {Math.round(cropperManagerRef.current.crop.height / dpr)}
                </div>
                {/* Inner center lines for visual feedback */}
                {showHCenterLine && <div className="center-line-inner-horizontal"/>}
                {showVCenterLine && <div className="center-line-inner-vertical"/>}
                {/* Resize handles */}
                {cropper.resizable && handleMap.map(([dir, cursor]) => (
                    <div
                        key={dir}
                        className={`crop-handle handle-${dir}`}
                        style={{cursor}}
                        onPointerDown={e => {
                            e.stopPropagation()
                            handleStart(`resize-${dir}`, e)
                        }}
                        onTouchStart={e => {
                            e.stopPropagation()
                            handleStart(`resize-${dir}`, e)
                        }}
                    />
                ))}
            </div>
        </>
    );
};

/**
 * Prop types for the Cropper component
 * @type {Object}
 */
Cropper.propTypes = {
    source:    PropTypes.oneOfType([
                                       PropTypes.instanceOf(HTMLCanvasElement),
                                       PropTypes.instanceOf(HTMLVideoElement),
                                       PropTypes.instanceOf(HTMLImageElement),
                                   ]).isRequired,
    container: PropTypes.instanceOf(HTMLElement),
    className: PropTypes.string,
    store:     PropTypes.object.isRequired,
}