/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-05
 * Last modified: 2025-09-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropRatioSelector renders a draggable toolbar for selecting crop ratios
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for crop operations
 * @param {Object} props.manager.store - Valtio store with crop state (ratioEditor, etc.)
 * @returns {JSX.Element} Draggable crop ratio selector UI
 */
import { DragHandler }                                              from '@Core/ui/drag-handler/DragHandler'
import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'
import { faGripDots }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import classNames from 'classnames'
import { memo, useCallback, useEffect, useRef, useState }           from 'react'
import { useSnapshot }                                              from 'valtio'
import './style.css'

/**
 * Positioning constants for CropRatioSelector placement
 * @type {Object.<string, number>}
 * @constant
 */
const POSITIONING = {
    X_PERCENTAGE: 0.66, // Position at 66% of container width
    Y_PERCENTAGE: 0.5, // Position at 50% of container height
}

/**
 * Icon mappings for crop ratio presets
 * @type {Object.<string, import('@fortawesome/fontawesome-svg-core').IconDefinition>}
 * @constant
 */
const ICONS = {
    'square': faSquare,
    '9x16': faRectangleVertical,
    '16x9': faRectangle,
    '1x1': faSquare,
    '4x3': faCropSimple,
}

/**
 * CropRatioSelector component
 */
export const CropRatioSelector = memo(({manager}) => {
    // Access reactive cropper and toolbar states
    const $cropper = manager?.store
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video || {}, {sync: true})

    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

    // Track selected ratio, defaulting to first video format
    const defaultRatio = __.device.isPortrait ? '9x16' : '16x9'


    /**
     * Updates menu position based on container bounds
     * @function
     * @param {Object} bounds - Container bounds from manager.getSourceBounds()
     */
    const updatePosition = useCallback((bounds) => {
        if (!_toolbar.current || !manager || !bounds || !bounds.width || !bounds.height) {
            return
        }
        const cssBounds = {
            width:  Math.floor(bounds.width / manager.dpr),
            height: Math.floor(bounds.height / manager.dpr),
        }
        _toolbar.current.style.position = 'absolute'
        _toolbar.current.style.left = `${cssBounds.width * POSITIONING.X_PERCENTAGE}px`
        _toolbar.current.style.top = `${cssBounds.height * POSITIONING.Y_PERCENTAGE}px`
        _toolbar.current.style.width = 'auto'
        _toolbar.current.style.transform = 'translateX(-50%)' // Center horizontally
        _toolbar.current.style.opacity = toolbars.opacity || 1
    }, [toolbars.opacity, manager])

    // Initialize position and drag handler, handle resize
    useEffect(() => {
        if (!manager || !cropper.ratioEditor || !_toolbar.current) {
            return
        }

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        _toolbar.current._dragHandler = new DragHandler({
                                                            grabber: _toolbar.current,
                                                            parent:  _toolbar.current,
                                                            container: lgs.canvas,
                                                        })

        // Update position on resize
        const handleResize = () => {
            updatePosition(manager.getSourceBounds())
        }
        window.addEventListener('resize', handleResize)

        // Cleanup on unmount or when ratioEditor changes
        return () => {
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
            window.removeEventListener('resize', handleResize)
        }
    }, [manager, cropper.ratioEditor, updatePosition])

    // Handle crop updates
    useEffect(() => {
        const handleCropUpdate = (event) => {
            setForceRender((prev) => prev + 1) // Force local re-render
            updatePosition(manager.getSourceBounds()) // Update position with new bounds
        }
        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [manager, updatePosition])

    useEffect(() => {
        $video.ratio = cropper.ratioEditor
                       ? lgs.configuration.videoFormats.find(p => p.value === cropper.aspectRatio?.toString().replace('/', 'x'))?.value ||
                           lgs.configuration.videoFormats[0]?.value ||
                           defaultRatio
                       : defaultRatio
    }, [])

    /**
     * Handles selection of a crop ratio preset
     * Updates the selected ratio and resets the crop with new aspect ratio
     * @function
     * @param {Object} preset - Video format preset (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeRatio = useCallback((preset, event) => {
        if (!_toolbar.current || !manager || !lgs.canvas) {
            return
        }

        $video.ratio = preset.value

        // Parse ratio and reset crop
        const [w, h] = preset.value.split('x').map(Number)
        const newCrop = manager.resetCrop({aspectRatio: w / h, lockRatio: preset.locked})

        // Update cssCrop using setter
        if (newCrop) {
            manager.cssCrop = newCrop
        }
        else {
            console.warn('CropRatioSelector: Failed to update cssCrop, newCrop is invalid')
            return
        }

        // Update store to keep ratioEditor active
        $cropper.ratioEditor = true
        $cropper.aspectRatio = w / h

        // Trigger a render update
        setForceRender((prev) => prev + 1)

        // Simulate pointer event to trigger resize
        const rect = lgs.canvas.getBoundingClientRect()
        const cssRect = {
            left: Math.floor(rect.left / manager.dpr),
            top:  Math.floor(rect.top / manager.dpr),
        }
        const pointerMoveEvent = new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            clientX: cssRect.left + 1,
            clientY: cssRect.top + 1,
        })
        lgs.canvas.dispatchEvent(pointerMoveEvent)
    }, [manager, $cropper])

    /**
     * Determines if a given preset is visible on the current device and orientation
     * @param {Object} preset - The preset object from YAML
     * @returns {boolean} True if the preset should be visible
     */
    const isPresetVisible = useCallback((preset) => {
        const device = __.device.getDeviceType() // e.g., "mobile"
        const orientation = __.device.getOrientation() // e.g., "portrait"
        const key = `${device}-${orientation}` // e.g., "mobile-portrait"
        // If no visibility is defined, preset is visible everywhere
        if (!preset.visibility) {
            return true
        }
        // Check if visibility includes either the device or the device-orientation key
        return preset.visibility.includes(device) || preset.visibility.includes(key)
    }, [])

    // Render draggable toolbar with ratio preset icons
    return (
        <>
            {cropper.ratioEditor && (
                <div className="crop-ratio-selector-container" ref={_toolbar}>
                    <div className="crop-ratio-selector lgs-toolbar lgs-card on-map">
                        {/* Drag handle for moving the toolbar */}
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                        </SlTooltip>
                        <div className="buttons-bar-on-map">
                            {lgs.configuration.videoFormats.map(preset => (
                                isPresetVisible(preset) && (
                                    <SlTooltip
                                        key={preset.value}
                                        content={`${preset.label}: ${preset.description}`}
                                        placement="right"
                                    >
                                        <SlIcon
                                            library="fa"
                                            className={classNames('lgs-one-line-card on-map', {'selected': preset.value === video.ratio})}
                                            onClick={event => handleChangeRatio(preset, event)}
                                            name={FA2SL.set(ICONS[preset.value] || faSquare)}
                                        />
                                    </SlTooltip>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
})