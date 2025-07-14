/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-14
 * Last modified: 2025-07-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }                                       from 'valtio'
import PropTypes                                             from 'prop-types'
import { SECOND }                                            from '@Core/constants'

/**
 * CropOverlay - A React component for selecting a cropping region over a canvas or video element
 *
 * @param {Object} props - Component props
 * @param {HTMLCanvasElement|HTMLVideoElement} props.source - The source element to crop (canvas or video)
 * @param {string} [props.className] - Additional CSS classes for the overlay container
 */
export const Cropper = ({source, className = ''}) => {
    // Access cropper state from global store
    const $cropper = lgs.stores.main.components.cropper
    const cropper = useSnapshot($cropper)

    // Window size state
    const [windowSize, setWindowSize] = useState({
                                                     width:  window.innerWidth,
                                                     height: window.innerHeight,
                                                 })

    // Initialize crop region
    const cropWidth = cropper.width || source?.width || 1280
    const cropHeight = cropper.height || source?.height || 720
    const [crop, setCrop] = useState({
                                         x:      cropper.x ?? (window.innerWidth - cropWidth) / 2,
                                         y:      cropper.y ?? (window.innerHeight - cropHeight) / 2,
                                         width:  cropWidth,
                                         height: cropHeight,
                                     })

    // Interaction states
    const [action, setAction] = useState(null)
    const [showHCenterLine, setShowHCenterLine] = useState(false)
    const [showVCenterLine, setShowVCenterLine] = useState(false)
    const [dragLockedHorizontal, setDragLockedHorizontal] = useState(false)
    const [dragLockedVertical, setDragLockedVertical] = useState(false)
    const [hasBeenLockedHorizontal, setHasBeenLockedHorizontal] = useState(false)
    const [hasBeenLockedVertical, setHasBeenLockedVertical] = useState(false)

    // References for interaction tracking
    const _raf = useRef(null)
    const _action = useRef(null)
    const _start = useRef({x: 0, y: 0, width: 0, height: 0, clientX: 0, clientY: 0, isShiftPressed: false})

    // Drag sensitivity factor
    const DRAG_SENSITIVITY = 0.4

    // Tolerance for detecting centering (pixels)
    const CENTER_TOLERANCE = 5

    // Delay for resetting center lines and drag lock (seconds)
    const BLOCKING_DELAY = 2

    /**
     * Computes bounds and aspect ratio for crop region
     * @returns {Object} Maximum bounds and aspect ratio
     */
    const bounds = useMemo(() => {
        const maxX = source?.width || windowSize.width || 1280
        const maxY = source?.height || windowSize.height || 720
        let aspectRatio = 1
        if (cropper.mode === 'ratio') {
            const preset = __.presets.ratios.find(r => r.value === cropper.presetValue)
            aspectRatio = preset?.aspectRatio || 1
        }
        else {
            const [w, h] = cropper.presetValue.split('x').map(Number)
            aspectRatio = w / h
        }
        return {maxX, maxY, minSize: 20, aspectRatio}
    }, [cropper.mode, cropper.presetValue, source, windowSize])

    /**
     * Updates window size on resize
     */
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                              width:  window.innerWidth,
                              height: window.innerHeight,
                          })
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    /**
     * Resets center lines and drag lock after delay
     */
    useEffect(() => {
        if (showHCenterLine || showVCenterLine) {
            const timer = setTimeout(() => {
                setShowHCenterLine(false)
                setShowVCenterLine(false)
                setDragLockedHorizontal(false)
                setDragLockedVertical(false)
                if (showHCenterLine) {
                    setHasBeenLockedHorizontal(true)
                }
                if (showVCenterLine) {
                    setHasBeenLockedVertical(true)
                }
            }, BLOCKING_DELAY * SECOND)
            return () => clearTimeout(timer)
        }
    }, [showHCenterLine, showVCenterLine])

    /**
     * Handles pointer/touch start for dragging or resizing
     * @param {string} actionType - Action type ('drag' or 'resize-<direction>')
     * @param {React.PointerEvent|React.TouchEvent} e - Event object
     */
    const handleStart = useCallback((actionType, e) => {
        if (cropper.recording || (actionType === 'drag' && (!cropper.draggable || (dragLockedHorizontal && dragLockedVertical)))) {
            return
        }
        e.preventDefault()
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
        setAction(actionType)
        _action.current = actionType
        _start.current = {
            x:              crop.x,
            y:              crop.y,
            width:          crop.width,
            height:         crop.height,
            clientX,
            clientY,
            isShiftPressed: e.shiftKey && actionType.startsWith('resize'),
        }
    }, [cropper.recording, cropper.draggable, crop.x, crop.y, crop.width, crop.height, dragLockedHorizontal, dragLockedVertical])

    /**
     * Handles pointer/touch move for dragging or resizing
     * @param {React.PointerEvent|React.TouchEvent} e - Event object
     */
    const handleMove = useCallback((e) => {
        if (!action || !_action.current) {
            return
        }
        e.preventDefault()
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
        const dx = (clientX - _start.current.clientX) * (action === 'drag' ? DRAG_SENSITIVITY : 1)
        const dy = (clientY - _start.current.clientY) * (action === 'drag' ? DRAG_SENSITIVITY : 1)

        if (_raf.current) {
            return
        }

        _raf.current = __.requestAnimationFrame(() => {
            setCrop(prev => {
                let newX = prev.x
                let newY = prev.y
                let newWidth = prev.width
                let newHeight = prev.height

                if (action === 'drag') {
                    if (!dragLockedHorizontal) {
                        newX = Math.max(0, Math.min(_start.current.x + dx, bounds.maxX - prev.width))
                    }
                    if (!dragLockedVertical) {
                        newY = Math.max(0, Math.min(_start.current.y + dy, bounds.maxY - prev.height))
                    }
                    const hCenter = Math.abs((newX + prev.width / 2) - (window.innerWidth / 2)) < CENTER_TOLERANCE
                    const vCenter = Math.abs((newY + prev.height / 2) - (window.innerHeight / 2)) < CENTER_TOLERANCE
                    setShowHCenterLine(vCenter)
                    setShowVCenterLine(hCenter)
                    if (hCenter && !hasBeenLockedHorizontal) {
                        setDragLockedHorizontal(true)
                        if (navigator.vibrate) {
                            navigator.vibrate(200)
                        }
                    }
                    if (vCenter && !hasBeenLockedVertical) {
                        setDragLockedVertical(true)
                        if (navigator.vibrate) {
                            navigator.vibrate(200)
                        }
                    }
                    if (!hCenter && hasBeenLockedHorizontal) {
                        setHasBeenLockedHorizontal(false)
                    }
                    if (!vCenter && hasBeenLockedVertical) {
                        setHasBeenLockedVertical(false)
                    }
                }
                else if (action.startsWith('resize')) {
                    const dir = action.replace('resize-', '')
                    const useSymmetric = cropper.lockRatio && !_start.current.isShiftPressed
                    const centerX = useSymmetric ? prev.x + prev.width / 2 : null
                    const centerY = useSymmetric ? prev.y + prev.height / 2 : null

                    if (dir === 'se') {
                        newWidth = Math.max(bounds.minSize, Math.min(clientX - prev.x, bounds.maxX - prev.x))
                        newHeight = Math.max(bounds.minSize, Math.min(clientY - prev.y, bounds.maxY - prev.y))
                    }
                    else if (dir === 'sw') {
                        newX = Math.max(0, Math.min(clientX, prev.x + prev.width - bounds.minSize))
                        newWidth = Math.max(bounds.minSize, prev.x + prev.width - clientX)
                        newHeight = Math.max(bounds.minSize, Math.min(clientY - prev.y, bounds.maxY - prev.y))
                    }
                    else if (dir === 'ne') {
                        newWidth = Math.max(bounds.minSize, Math.min(clientX - prev.x, bounds.maxX - prev.x))
                        newY = Math.max(0, Math.min(clientY, prev.y + prev.height - bounds.minSize))
                        newHeight = Math.max(bounds.minSize, prev.y + prev.height - clientY)
                    }
                    else if (dir === 'nw') {
                        newX = Math.max(0, Math.min(clientX, prev.x + prev.width - bounds.minSize))
                        newWidth = Math.max(bounds.minSize, prev.x + prev.width - clientX)
                        newY = Math.max(0, Math.min(clientY, prev.y + prev.height - bounds.minSize))
                        newHeight = Math.max(bounds.minSize, prev.y + prev.height - clientY)
                    }
                    else if (dir === 'e') {
                        newWidth = Math.max(bounds.minSize, Math.min(clientX - prev.x, bounds.maxX - prev.x))
                    }
                    else if (dir === 'w') {
                        newX = Math.max(0, Math.min(clientX, prev.x + prev.width - bounds.minSize))
                        newWidth = Math.max(bounds.minSize, prev.x + prev.width - clientX)
                    }
                    else if (dir === 's') {
                        newHeight = Math.max(bounds.minSize, Math.min(clientY - prev.y, bounds.maxY - prev.y))
                    }
                    else if (dir === 'n') {
                        newY = Math.max(0, Math.min(clientY, prev.y + prev.height - bounds.minSize))
                        newHeight = Math.max(bounds.minSize, prev.y + prev.height - clientY)
                    }

                    if (cropper.lockRatio) {
                        if (dir.length === 1) {
                            if (dir === 'e' || dir === 'w') {
                                newHeight = newWidth / bounds.aspectRatio
                            }
                            else {
                                newWidth = newHeight * bounds.aspectRatio
                            }
                        }
                        else {
                            newHeight = newWidth / bounds.aspectRatio
                        }
                        if (useSymmetric && centerX !== null && centerY !== null) {
                            newX = centerX - newWidth / 2
                            newY = centerY - newHeight / 2
                            newX = Math.max(0, Math.min(newX, bounds.maxX - newWidth))
                            newY = Math.max(0, Math.min(newY, bounds.maxY - newHeight))
                        }
                    }
                }

                return {x: newX, y: newY, width: newWidth, height: newHeight}
            })
            _raf.current = null
        })
    }, [action, bounds, cropper.lockRatio, dragLockedHorizontal, dragLockedVertical, hasBeenLockedHorizontal, hasBeenLockedVertical])

    /**
     * Handles pointer/touch end
     */
    const handleEnd = useCallback(() => {
        if (action) {
            $cropper.x = crop.x
            $cropper.y = crop.y
            $cropper.width = crop.width
            $cropper.height = crop.height
        }
        setAction(null)
        _action.current = null
    }, [action, crop, source, $cropper])

    /**
     * Manages event listeners for pointer and touch interactions
     */
    useEffect(() => {
        if (action) {
            window.addEventListener('pointermove', handleMove)
            window.addEventListener('pointerup', handleEnd)
            window.addEventListener('touchmove', handleMove)
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
            }
        }
    }, [action, handleMove, handleEnd])

    /**
     * Defines resize handle directions and cursors
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
    ], [])

    // Styles for crop overlay and handles
    const dynamicStyle = {
        left:   crop.x,
        top:    crop.y,
        width:  crop.width,
        height: crop.height,
        cursor: action === 'drag' ? 'grabbing' : cropper.draggable ? 'grab' : 'default',
    }

    const overlayStyle = {
        clipPath: `polygon(
            0 0,
            100% 0,
            100% 100%,
            0 100%,
            0 ${crop.y}px,
            ${crop.x}px ${crop.y}px,
            ${crop.x}px ${crop.y + crop.height}px,
            ${crop.x + crop.width}px ${crop.y + crop.height}px,
            ${crop.x + crop.width}px ${crop.y}px,
            0 ${crop.y}px
        )`,
    }

    const hCenterLineLeftStyle = {
        left:  0,
        top:   crop.y + crop.height / 2,
        width: crop.x,
    }

    const hCenterLineRightStyle = {
        left:  crop.x + crop.width,
        top:   crop.y + crop.height / 2,
        width: window.innerWidth - (crop.x + crop.width),
    }

    const vCenterLineTopStyle = {
        top:    0,
        left:   crop.x + crop.width / 2,
        height: crop.y,
    }

    const vCenterLineBottomStyle = {
        top:    crop.y + crop.height,
        left:   crop.x + crop.width / 2,
        height: window.innerHeight - (crop.y + crop.height),
    }


    return (
        <>
            <div className="crop-overlay" style={overlayStyle}/>
            <div className="center-lines-container">
                {showHCenterLine && <div className="center-line-horizontal-left" style={hCenterLineLeftStyle}/>}
                {showHCenterLine && <div className="center-line-horizontal-right" style={hCenterLineRightStyle}/>}
                {showVCenterLine && <div className="center-line-vertical-top" style={vCenterLineTopStyle}/>}
                {showVCenterLine && <div className="center-line-vertical-bottom" style={vCenterLineBottomStyle}/>}
            </div>
            <div
                className={`crop-zone ${className}`}
                style={dynamicStyle}
                onPointerDown={e => handleStart('drag', e)}
                onTouchStart={e => handleStart('drag', e)}
            >
                <div className="crop-info lgs-one-line-card on-map small">
                    X: {Math.round(crop.y)} Y: {Math.round(crop.x)} -
                    W: {Math.round(crop.width)} H: {Math.round(crop.height)}
                </div>
                {showHCenterLine && <div className="center-line-inner-horizontal"/>}
                {showVCenterLine && <div className="center-line-inner-vertical"/>}
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
    )
}
