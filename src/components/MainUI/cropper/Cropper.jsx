/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-16
 * Last modified: 2025-07-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSnapshot }    from 'valtio'
import PropTypes          from 'prop-types'
import { CropperManager } from './CropperManager'

/**
 * Cropper component for interactive crop region selection over canvas, video, or image elements.
 * Provides a draggable and resizable crop area with visual feedback and center alignment guides.
 *
 * @component
 * @param {Object} props - Component props
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - The source element to crop
 * @param {HTMLElement} [props.container] - The container element for bounds (optional, defaults to source)
 * @param {string} [props.className=''] - Additional CSS classes for the crop zone
 * @param {Object} props.store - The Valtio store for cropper state persistence
 * @param {Object} [props.options={}] - Configuration options for CropperManager
 * @returns {JSX.Element|null} The cropper UI elements or null if source is not loaded
 */
export const Cropper = ({source, container, className = '', store, options = {}}) => {
    const cropper = useSnapshot(store)
    const [isSourceLoaded, setIsSourceLoaded] = useState(
        !(source instanceof HTMLImageElement && !source.complete),
    )
    const [manager, setManager] = useState(null)
    const [crop, setCrop] = useState(() => ({
        x:     store.x ?? 0,
        y:     store.y ?? 0,
        width: store.width ?? 0,
        height: store.height ?? 0,
    }))
    const [interactionState, setInteractionState] = useState({
                                                                 action:             null,
                                                                 showHCenterLine:    false,
                                                                 showVCenterLine:    false,
                                                                 dragLockedHorizontal: false,
                                                                 dragLockedVertical: false,
                                                                 wasJustCentered:    false,
                                                                 isCentering:        false,
                                                             })
    const _videoCropper = useRef(null)
    const _cropZone = useRef(null)

    // Memoize options to prevent unnecessary re-renders
    const memoizedOptions = useMemo(() => options, [
        options.draggable,
        options.resizable,
        options.lockCentering,
        options.vibrate,
    ])

    /**
     * Updates the cursor style directly on the DOM element
     */
    const updateCursor = useCallback((newCursor) => {
        if (_cropZone.current) {
            _cropZone.current.style.cursor = newCursor
        }
    }, [])

    /**
     * Memoized handler for pointer/touch start events
     */
    const handleStart = useCallback((action, event) => {
        if (!manager) {
            return
        }

        const result = manager.handleStart(action, event, cropper)
        if (result && typeof result === 'object') {
            setCrop(result)

            // Update cursor immediately based on action
            if (action === 'drag') {
                if (event.ctrlKey && !event.touches) {
                    updateCursor('crosshair')
                }
                else {
                    updateCursor('grabbing')
                }
            }
        }
    }, [manager, cropper, updateCursor])

    /**
     * Memoized handler for double click events
     */
    const handleDoubleClick = useCallback(() => {
        if (!manager) {
            return
        }

        const newCrop = manager.maximizeRestore(cropper)
        setCrop(newCrop)
    }, [manager, cropper])

    // Handle source loading for images
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

    // Initialize CropperManager - only when dependencies actually change
    useEffect(() => {
        if (!isSourceLoaded || !source) {
            return
        }

        const newManager = new CropperManager(source, container, store, memoizedOptions)
        setManager(newManager)
        setCrop(newManager.crop)

        const handleCropperClose = (event) => {
            console.log('onClose', event)
            _videoCropper.current.style.display = 'none'
        }

        source.addEventListener('onCropperClose', handleCropperClose)

        return () => {
            newManager.destroy()
        }
    }, [source, container, isSourceLoaded, memoizedOptions])

    // Handle window resize with debouncing
    useEffect(() => {
        if (!manager) {
            return
        }

        let resizeTimeout
        const handleResize = () => {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(() => {
                if (manager && !manager.isDestroyed) {
                    manager.updateWindowSize()
                    const newCrop = manager.updateCropOnSourceChange(cropper)
                    setCrop(newCrop)
                }
            }, 100)
        }

        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
            clearTimeout(resizeTimeout)
        }
    }, [manager, cropper])

    // Manage centering reset
    useEffect(() => {
        if (!manager) {
            return
        }

        return manager.resetCentering((newState) => {
            if (!manager.isDestroyed) {
                setInteractionState(newState)
            }
        })
    }, [manager])

    // Handle global pointer/touch events
    useEffect(() => {
        if (!manager) {
            return
        }

        const handleMove = (e) => {
            if (manager.isDestroyed) {
                return
            }
            const bounds = manager.getSourceBounds()
            const {crop: newCrop, interaction} = manager.handleMove(e, cropper, bounds)
            setCrop(newCrop)
            setInteractionState(interaction)
        }

        const handleEnd = () => {
            if (manager.isDestroyed) {
                return
            }
            const newInteraction = manager.handleEnd()
            setInteractionState(newInteraction)

            // Reset cursor after interaction
            setTimeout(() => {
                updateCursor('grab')
            }, 100)
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
    }, [manager, cropper, updateCursor])

    // Set initial cursor when component mounts
    useEffect(() => {
        if (_cropZone.current) {
            updateCursor('grab')
        }
    }, [updateCursor])

    // Return null if source is not loaded or manager not initialized
    if (!isSourceLoaded || !manager || !crop) {
        return null
    }

    const styles = manager.getStyles(crop, interactionState)

    return (
        <div ref={_videoCropper}>
            {/* Crop overlay - dims the area outside the crop region */}
            <div className="crop-overlay" style={styles.overlayStyle}/>

            {/* Center alignment lines - external guides */}
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

            {/* Main crop zone */}
            <div
                ref={_cropZone}
                className={`crop-zone ${className}`}
                style={{
                    left:  crop.x / manager.dpr,
                    top:   crop.y / manager.dpr,
                    width: crop.width / manager.dpr,
                    height: crop.height / manager.dpr,
                    cursor: 'grab', // Curseur par défaut
                }}
                onPointerDown={(e) => handleStart('drag', e)}
                onTouchStart={(e) => handleStart('drag', e)}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => {
                    e.preventDefault() // Bloque le menu contextuel du navigateur
                    e.stopPropagation() // Empêche la propagation à d'autres éléments
                    console.log('ContextMenu event triggered on crop-zone') // Log pour débogage
                    handleStart('drag', e) // Appelle handleStart pour déclencher maximizeRestore
                }}
            >
                {/* Crop information display - compact version */}
                <div
                    className="crop-info lgs-one-line-card on-map small"
                    style={{
                        fontSize:   '10px',
                        padding:    '2px 4px',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {Math.round(crop.x / manager.dpr)}×{Math.round(crop.y / manager.dpr)} |{' '}
                    {Math.round(crop.width / manager.dpr)}×{Math.round(crop.height / manager.dpr)}
                </div>

                {/* Internal center lines */}
                {interactionState.showHCenterLine && <div className="center-line-inner-horizontal"/>}
                {interactionState.showVCenterLine && <div className="center-line-inner-vertical"/>}

                {/* Resize handles */}
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
}

/**
 * PropTypes for the Cropper component
 */
Cropper.propTypes = {
    source:  PropTypes.oneOfType([
                                     PropTypes.instanceOf(HTMLCanvasElement),
                                     PropTypes.instanceOf(HTMLVideoElement),
                                     PropTypes.instanceOf(HTMLImageElement),
                                 ]).isRequired,
    container: PropTypes.instanceOf(HTMLElement),
    className: PropTypes.string,
    store:   PropTypes.object.isRequired,
    options: PropTypes.shape({
                                 draggable: PropTypes.bool,
                                 resizable: PropTypes.bool,
                                 lockCentering: PropTypes.bool,
                                 vibrate:   PropTypes.bool,
                             }),
}

export default Cropper