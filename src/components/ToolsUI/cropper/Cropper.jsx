/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-15
 * Last modified: 2025-09-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Cropper component for interactive crop region selection over canvas, video, or image elements.
 * Provides a draggable and resizable crop area with visual feedback and center alignment guides.
 * @component
 * @param {Object} props - Component properties
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - Element to crop
 * @param {HTMLElement} [props.container] - Container for bounds (defaults to source)
 * @param {string} [props.className=''] - Additional CSS classes for crop zone
 * @param {Object} props.store - Valtio store for cropper state
 * @param {Object} [props.options={}] - Configuration options for CropperHandler
 * @param {JSX.Element|string} [props.children] - Additional UI elements (e.g., CTA buttons)
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { CropRatioSelector } from '@Components/ToolsUI/cropper/CropRatioSelector'
import { DefinedCropZone }   from '@Components/ToolsUI/cropper/DefinedCropZone'
import { DragHandler }       from '@Core/ui/drag-handler/DragHandler'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }       from 'valtio'
import { CropCenterLines }   from './CropCenterLines'
import { CropOverlay }       from './CropOverlay'
import { CropperHandler }    from './CropperHandler'
import { CropZone }          from './CropZone'
import './style.css'

export const Cropper = memo(({overlay = false, source, container, className = '', store, options = {}, children}) => {
    // State for tracking source loading and CSS crop coordinates
    const cropper = useSnapshot(store) // Reactive snapshot of Valtio store
    const [isSourceLoaded, setIsSourceLoaded] = useState(
        !(source instanceof HTMLImageElement && !source.complete),
    )
    const [cssCrop, setCssCrop] = useState(null) // Local state for CSS crop coordinates

    // References
    const _cropperContainer = useRef(null)
    const _cropZone = useRef(null)
    const _overlay = useRef(null)
    const _cropperHandler = useRef(null)
    const _dragHandler = useRef(null)
    const _rafId = useRef(null) // Reference for requestAnimationFrame ID

    /**
     * Memoized options for CropperHandler
     * @returns {Object} Combined default and user-provided options
     */
    const memoizedOptions = useMemo(
        () => ({
            draggable:     true,
            resizable:     true,
            lockCentering: true,
            vibrate:       true,
            ...options,
        }),
        [options],
    )

    /**
     * Updates cursor style on crop zone
     * @param {string} cursor - CSS cursor value (e.g., 'grab', 'grabbing')
     */
    const updateCursor = useCallback(cursor => {
        if (_cropZone.current) {
            _cropZone.current.style.cursor = cursor
        }
        else {
            console.warn('[updateCursor] _cropZone.current is null')
        }
    }, [])

    /**
     * Synchronizes crop state with DOM, store, and CropperHandler
     * @param {Object} cssCrop - Crop coordinates and dimensions in CSS pixels
     * @param {string} context - Context of update ('drag', 'resize', or 'none')
     * @param {boolean} updateState - Whether to update store and CropperHandler
     */
    const syncCrop = useCallback(
        (cssCrop, context = 'drag', updateState = false) => {
            if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
                console.warn('CropperHandler is null or destroyed')
                return
            }
            if (!cssCrop || cssCrop.width <= 0 || cssCrop.height <= 0) {
                console.warn('Invalid crop dimensions:', cssCrop)
                return
            }

            const updateAll = () => {
                if (!updateState) {
                    return
                }

                // Get interaction state from CropperHandler
                const interaction = _cropperHandler.current.interactionState
                // Get styles from CropperHandler
                const styles = _cropperHandler.current.getStyles(
                    _cropperHandler.current.toPhysicalCrop(cssCrop),
                    interaction,
                )

                // Update overlay and crop zone styles
                if (_overlay.current) {
                    Object.assign(_overlay.current.style, styles.overlayStyle)
                }
                if (_cropZone.current) {
                    Object.assign(_cropZone.current.style, {
                        left:   `${cssCrop.x}px`,
                        top:    `${cssCrop.y}px`,
                        width:  `${cssCrop.width}px`,
                        height: `${cssCrop.height}px`,
                    })
                }

                // Update local state
                setCssCrop(cssCrop)

                // Update store with physical crop
                const physicalCrop = _cropperHandler.current.toPhysicalCrop(cssCrop)
                if (
                    store.x !== physicalCrop.x ||
                    store.y !== physicalCrop.y ||
                    store.width !== physicalCrop.width ||
                    store.height !== physicalCrop.height
                ) {
                    Object.assign(store, physicalCrop)
                }

                // Update CropperHandler crop and cssCrop
                if (_cropperHandler.current && !_cropperHandler.current.isDestroyed) {
                    _cropperHandler.current.crop = physicalCrop
                    _cropperHandler.current.cssCrop = physicalCrop
                }
            }
            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
            }
            _rafId.current = requestAnimationFrame(updateAll)
        },
        [store],
    )

    /**
     * Handles start of drag or resize actions
     * @param {string} action - Action type ('drag' or 'resize-*')
     * @param {Event} event - Triggering event
     */
    const handleStart = useCallback(
        (action, event) => {

            if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
                return
            }
            if (_dragHandler.current?.dragging) {

                return
            }

            // Prioritize resize over drag if event originates from a handle
            if (action.startsWith('resize-')) {
                _dragHandler.current?.handleEnd(new Event('pointerup'))
                const zone = _cropZone.current
                if (zone) {
                    zone.style.pointerEvents = 'none'
                    zone.querySelectorAll('.crop-handle').forEach(h => (h.style.pointerEvents = 'auto'))
                }
                if (memoizedOptions.vibrate && navigator.vibrate) {
                    navigator.vibrate(10)
                }
                const result = _cropperHandler.current.handleStart(action, event, cropper)
                if (result && typeof result === 'object') {
                    syncCrop(_cropperHandler.current.toCssCrop(result), 'resize', true)
                }
                return
            }

            if (action === 'drag') {
                updateCursor('grabbing')
                if (memoizedOptions.vibrate && navigator.vibrate) {
                    navigator.vibrate(10)
                }
                const result = _dragHandler.current?.handleStart(event)
                if (result && typeof result === 'object') {
                    syncCrop({
                                 x:      result.x,
                                 y:      result.y,
                                 width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                                 height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                             }, 'drag', true)
                }
            }
        },
        [cropper, memoizedOptions, syncCrop, updateCursor, cssCrop],
    )

    /**
     * Handles movement during drag or resize
     * @param {string} action - Action type ('drag' or 'resize-*')
     * @param {Event} event - Triggering event
     */
    const handleMove = useCallback(
        (action, event) => {

            if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
                console.warn('CropperHandler is null or destroyed')
                return
            }
            if (action === 'drag' && _dragHandler.current?.dragging) {
                const rect = _cropZone.current?.getBoundingClientRect()
                if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
                    _dragHandler.current?.handleEnd(new Event('pointerup'))
                    return
                }
                const css = _dragHandler.current.handleMove(event, cropper)
                if (css && typeof css === 'object') {
                    const newCssCrop = {
                        x:      css.x,
                        y:      css.y,
                        width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                        height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                    }
                    syncCrop(newCssCrop, 'drag', true)
                }
            }
            else if (action?.startsWith('resize-') && _cropperHandler.current.cropping) {
                const bounds = _cropperHandler.current.getSourceBounds()
                const result = _cropperHandler.current.handleMove(event, cropper, bounds)
                if (result && typeof result === 'object') {
                    syncCrop(_cropperHandler.current.toCssCrop(result.crop), 'resize', true)
                }
            }
        },
        [cropper, syncCrop, cssCrop],
    )

    /**
     * Handles end of drag or resize actions
     * @param {string} action - Action type ('drag' or 'resize-*')
     * @param {Event} event - Triggering event
     */
    const handleEnd = useCallback(
        (action, event) => {
            if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
                console.warn('CropperHandler is null or destroyed')
                return
            }
            if (action === 'drag' && _dragHandler.current?.dragging) {
                const css = _dragHandler.current.handleEnd(event)
                updateCursor('grab')
                if (css && typeof css === 'object') {
                    syncCrop({
                                 x:      css.x,
                                 y:      css.y,
                                 width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                                 height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                             }, 'drag', true)
                }
                else {
                    syncCrop({
                                 x:      cssCrop?.x || cropper.x / (_cropperHandler.current?.dpr || 1),
                                 y:      cssCrop?.y || cropper.y / (_cropperHandler.current?.dpr || 1),
                                 width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                                 height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                             }, 'drag', true)
                }
            }
            else if (action.startsWith('resize-') && _cropperHandler.current.cropping) {
                const zone = _cropZone.current
                if (zone) {
                    zone.style.pointerEvents = 'auto'
                    zone.querySelectorAll('.crop-handle').forEach(h => (h.style.pointerEvents = ''))
                }
                const result = _cropperHandler.current.handleEnd(event)
                syncCrop(_cropperHandler.current.toCssCrop(_cropperHandler.current.crop), 'resize', true)
            }
        },
        [cropper, syncCrop, updateCursor, cssCrop],
    )

    /**
     * Handles double-click to maximize or restore crop area
     */
    const handleDoubleClick = useCallback(() => {
        if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
            console.warn('CropperHandler is null or destroyed')
            return
        }
        const newCrop = _cropperHandler.current.maximizeRestore(cropper)
        syncCrop(_cropperHandler.current.toCssCrop(newCrop), 'none', true)
    }, [cropper, syncCrop])

    // Effect to handle image source loading
    useEffect(() => {
        if (!(source instanceof HTMLImageElement) || source.complete) {
            setIsSourceLoaded(true)
            return
        }

        const handleLoad = () => {
            setIsSourceLoaded(true)
            if (_cropperHandler.current && !_cropperHandler.current.isDestroyed) {
                const newCrop = _cropperHandler.current.resetCrop({
                                                                      aspectRatio: store.aspectRatio ?? null,
                                                                      options:     {lockRatio: store.lockRatio},
                                                                  })
                syncCrop(_cropperHandler.current.toCssCrop(newCrop), 'none', true)
            }
        }
        const handleError = () => setIsSourceLoaded(false)

        source.addEventListener('load', handleLoad)
        source.addEventListener('error', handleError)
        return () => {
            source.removeEventListener('load', handleLoad)
            source.removeEventListener('error', handleError)
        }
    }, [source, store, syncCrop])

    // Effect to initialize CropperHandler
    useEffect(() => {
        if (!isSourceLoaded || !source || !source.width || !source.height) {
            return
        }

        const boundsContainer = container ?? source
        if (!_cropperHandler.current || _cropperHandler.current.isDestroyed) {
            _cropperHandler.current = new CropperHandler(source, boundsContainer, store, memoizedOptions)
            const newCrop = _cropperHandler.current.resetCrop({
                                                                  aspectRatio: store.aspectRatio ?? null,
                                                                  options:     {lockRatio: store.lockRatio},
                                                              })
            setCssCrop(_cropperHandler.current.toCssCrop(newCrop))
            syncCrop(_cropperHandler.current.toCssCrop(newCrop), 'none', true)
        }

        const handleCropperClose = () => {
            if (_cropperContainer.current) {
                _cropperContainer.current.style.display = 'none'
            }
        }
        const handleCropUpdate = e => {
            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
            }
            _rafId.current = requestAnimationFrame(() => {
                syncCrop(e.detail.cssCrop, 'resize', true)
            })
        }

        source.addEventListener('onCropperClose', handleCropperClose)
        source.addEventListener('onCropUpdate', handleCropUpdate)
        return () => {
            source.removeEventListener('onCropperClose', handleCropperClose)
            source.removeEventListener('onCropUpdate', handleCropUpdate)
            if (_cropperHandler.current) {
                _cropperHandler.current.destroy()
                _cropperHandler.current = null
            }
            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
                _rafId.current = null
            }
        }
    }, [source, container, isSourceLoaded, memoizedOptions, store, syncCrop])

    // Effect to install DragHandler
    useEffect(() => {
        const cropZone = _cropZone.current
        const cropperContainer = _cropperContainer.current
        if (!cropZone || !cropperContainer || !_cropperHandler.current || _dragHandler.current) {
            return
        }

        // Initialize DragHandler
        _dragHandler.current = new DragHandler({
                                                   grabber:   cropZone,
                                                   target:    cropZone,
                                                   container: cropperContainer,
                                                   position:  {
                                                       placement: 'top-left',
                                                       left:      cssCrop?.x || 0,
                                                       top:       cssCrop?.y || 0,
                                                   },
                                               })

        // Define event handlers
        const onStart = e => {
            if (_cropperHandler.current.cropping) {
                return
            }
            updateCursor('grabbing')
            syncCrop({
                         x:      e.detail.value?.x ?? cssCrop?.x ?? cropper.x / (_cropperHandler.current?.dpr || 1),
                         y:      e.detail.value?.y ?? cssCrop?.y ?? cropper.y / (_cropperHandler.current?.dpr || 1),
                         width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                         height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                     }, 'drag', false)

            // Fallback timeout to ensure drag stops
            setTimeout(() => {
                if (_dragHandler.current?.dragging) {
                    onStop(new Event('timeout'))
                    _dragHandler.current?.handleEnd(new Event('pointerup'))
                }
            }, 5000)
        }

        const onMove = e => {
            if (_cropperHandler.current.cropping || !_dragHandler.current?.dragging) {
                return
            }

            const rect = _cropZone.current?.getBoundingClientRect()
            if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
                _dragHandler.current?.handleEnd(new Event('pointerup'))
                return
            }

            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
            }

            _rafId.current = requestAnimationFrame(() => {
                const css = {
                    x:      Math.floor(e.detail.value?.x ?? cssCrop?.x ?? cropper.x / (_cropperHandler.current?.dpr || 1)),
                    y:      Math.floor(e.detail.value?.y ?? cssCrop?.y ?? cropper.y / (_cropperHandler.current?.dpr || 1)),
                    width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                    height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
                }
                syncCrop(css, 'drag', true)
                _rafId.current = null
            })
        }

        const onStop = e => {

            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
                _rafId.current = null
            }
            updateCursor('grab')
            const css = {
                x:      e.detail.value?.x ?? cssCrop?.x ?? cropper.x / (_cropperHandler.current?.dpr || 1),
                y:      e.detail.value?.y ?? cssCrop?.y ?? cropper.y / (_cropperHandler.current?.dpr || 1),
                width:  cssCrop?.width || cropper.width / (_cropperHandler.current?.dpr || 1),
                height: cssCrop?.height || cropper.height / (_cropperHandler.current?.dpr || 1),
            }
            syncCrop(css, 'drag', true)
        }

        // Attach event listeners
        cropZone.addEventListener(DragHandler.DRAG_START, onStart)
        cropZone.addEventListener(DragHandler.DRAG, onMove)
        cropZone.addEventListener(DragHandler.DRAG_STOP, onStop)

        // Cleanup function
        return () => {
            cropZone.removeEventListener(DragHandler.DRAG_START, onStart)
            cropZone.removeEventListener(DragHandler.DRAG, onMove)
            cropZone.removeEventListener(DragHandler.DRAG_STOP, onStop)
            if (_dragHandler.current) {
                _dragHandler.current.handleEnd(new Event('pointerup'))
                _dragHandler.current.destroy()
                _dragHandler.current = null
            }
            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
                _rafId.current = null
            }
        }
    }, [_cropZone, _cropperContainer, _cropperHandler, updateCursor]) // Reduced dependencies

    // Effect to handle window blur and visibility change
    useEffect(() => {
        const endAllInteractions = () => {

            try {
                if (_dragHandler.current?.dragging) {
                    _dragHandler.current.handleEnd(new Event('pointerup'))
                }
            }
            catch {
                console.warn('Cropper.jsx: Error ending drag')
            }
            if (_cropperHandler.current && !_cropperHandler.current.isDestroyed) {
                _cropperHandler.current.handleEnd()
            }
            const zone = _cropZone.current
            if (zone) {
                zone.style.pointerEvents = 'auto'
                zone.querySelectorAll('.crop-handle').forEach(h => (h.style.pointerEvents = ''))
            }
            if (_rafId.current) {
                cancelAnimationFrame(_rafId.current)
                _rafId.current = null
            }
            updateCursor('grab')
        }

        const onVisibility = () => document.hidden && endAllInteractions()

        window.addEventListener('blur', endAllInteractions)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('blur', endAllInteractions)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [updateCursor])

    // Effect to set initial cursor
    useEffect(() => updateCursor('grab'), [updateCursor])

    // Effect to sync cssCrop with store changes
    useEffect(() => {
        if (_cropperHandler.current && !_cropperHandler.current.isDestroyed) {
            const newCssCrop = _cropperHandler.current.toCssCrop(cropper)
            if (
                cssCrop?.x !== newCssCrop.x ||
                cssCrop?.y !== newCssCrop.y ||
                cssCrop?.width !== newCssCrop.width ||
                cssCrop?.height !== newCssCrop.height
            ) {
                setCssCrop(newCssCrop)
            }
        }
    }, [cropper, cssCrop])

    if (!isSourceLoaded || !_cropperHandler.current || !cssCrop || cssCrop.width <= 0 || cssCrop.height <= 0) {
        return null
    }

    return (
        <div ref={_cropperContainer} className="crop-container">
            {overlay && <CropOverlay innerRef={_overlay}
                                     style={_cropperHandler.current.getStyles(cropper).overlayStyle}/>}
            <CropCenterLines interactionState={_cropperHandler.current.interactionState}
                             styles={_cropperHandler.current.getStyles(cropper)}/>
            {cropper.ratioEditor ? (
                <>
                    <CropRatioSelector manager={_cropperHandler.current}/>
                    <CropZone
                        innerRef={_cropZone}
                        cssCrop={cssCrop}
                        style={_cropperHandler.current.getStyles(cropper).cropZone}
                        manager={_cropperHandler.current}
                        cropper={cropper}
                        interactionState={_cropperHandler.current.interactionState}
                        className={className}
                        infoPosition={options.infoPosition}
                        infoComponent={options.infoComponent}
                        onStart={handleStart}
                        onMove={handleMove}
                        onEnd={handleEnd}
                        onDoubleClick={handleDoubleClick}
                    />
                </>
            ) : (
                 <DefinedCropZone
                     cssCrop={cssCrop}
                     style={_cropperHandler.current.getStyles(cropper, _cropperHandler.current.interactionState).cropZone}
                     className={className}
                     infoPosition={options.infoPosition}
                     infoComponent={options.infoComponent}
                 />
             )}
            {children}
        </div>
    )
})