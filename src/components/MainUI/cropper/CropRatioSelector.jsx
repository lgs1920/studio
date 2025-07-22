/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioSelector.jsx
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

import { DragHandler }       from '@Core/ui/drag-handler/DragHandler'
import {
    faCropSimple, faGripDots, faRectangle, faRectangleVertical, faSquare,
}                                               from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                          from 'valtio'
import './style.css'

/**
 * Positioning constants for CropRatioSelector placement
 * @type {Object.<string, number>}
 * @constant
 */
const POSITIONING = {
    X_PERCENTAGE: 0.66, // Position at 66% of container width
    Y_PERCENTAGE: 0.5,   // Position at 50% of container height
}

/**
 * Icon mappings for crop ratio presets
 * @type {Object.<string, import('@fortawesome/fontawesome-svg-core').IconDefinition>}
 * @constant
 */
const ICONS = {
    '9x16': faRectangleVertical,
    '16x9': faRectangle,
    '1x1':  faSquare,
    '4x3':  faCropSimple,
}

/**
 * CropRatioSelector renders a draggable toolbar for selecting crop ratios
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for crop operations
 * @param {Object} props.manager.store - Valtio store with crop state (ratioEditor, etc.)
 * @returns {JSX.Element} Draggable crop ratio selector UI
 */
const CropRatioSelector = memo(({manager}) => {
    // Access reactive cropper and toolbar states
    const $cropper = manager?.store
    const cropper = useSnapshot($cropper || {})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})

    // Reference to the cropper menu DOM element
    const cropperMenuRef = useRef(null)

    // Track selected ratio, defaulting to first video format
    const selectedRatio = cropper.ratioEditor
                          ? lgs.configuration.videoFormats.find(p => p.value === cropper.aspectRatio?.toString().replace('/', 'x'))?.value
                              || lgs.configuration.videoFormats[0]?.value
                              || '16x9'
                          : '16x9'

    /**
     * Updates menu position based on container bounds
     * @function
     * @param {Object} bounds - Container bounds from manager.getSourceBounds()
     */
    const updatePosition = useCallback((bounds) => {
        if (!cropperMenuRef.current) {
            return
        }
        cropperMenuRef.current.style.position = 'absolute'
        cropperMenuRef.current.style.left = `${bounds.width * POSITIONING.X_PERCENTAGE}px`
        cropperMenuRef.current.style.top = `${bounds.height * POSITIONING.Y_PERCENTAGE}px`
        cropperMenuRef.current.style.width = 'auto'
        cropperMenuRef.current.style.opacity = toolbars.opacity || 1
    }, [toolbars.opacity])

    // Initialize position and drag handler, handle resize
    useEffect(() => {
        if (!manager || !cropper.ratioEditor || !cropperMenuRef.current) {
            return
        }

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        const dragHandler = new DragHandler({
                                                grabber: cropperMenuRef.current,
                                                parent:  cropperMenuRef.current,
                                                container: lgs.canvas,
                                            })

        // Debounced resize handler to update position
        const debouncedResize = manager.debounce(() => {
            updatePosition(manager.getSourceBounds())
        }, manager.RESIZE_DEBOUNCE_MS)

        window.addEventListener('resize', debouncedResize)

        // Store references for cleanup
        cropperMenuRef.current._dragHandler = dragHandler
        cropperMenuRef.current._resizeHandler = debouncedResize

        // Cleanup on unmount or when ratioEditor changes
        return () => {
            if (cropperMenuRef.current?._dragHandler) {
                cropperMenuRef.current._dragHandler.destroy()
            }
            if (cropperMenuRef.current?._resizeHandler) {
                window.removeEventListener('resize', cropperMenuRef.current._resizeHandler)
            }
        }
    }, [manager, cropper.ratioEditor, updatePosition])

    /**
     * Handles selection of a crop ratio preset
     * Updates the selected ratio and resets the crop with new aspect ratio
     * @function
     * @param {Object} preset - Video format preset (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeRatio = useCallback((preset, event) => {
        if (!cropperMenuRef.current || !manager) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        // Update selected class on icons
        const icons = cropperMenuRef.current.querySelectorAll('.crop-ratio-presets sl-icon')
        icons.forEach(icon => icon.classList.remove('selected'))
        event.target.classList.add('selected')

        // Parse ratio and reset crop
        const [w, h] = preset.value.split('x').map(Number)
        manager.resetCrop({aspectRatio: w / h, lockRatio: preset.locked})
    }, [manager])

    // Render draggable toolbar with ratio preset icons
    return (
        <>
            {cropper.ratioEditor && (
                <div className="crop-controls lgs-toolbar lgs-card on-map" ref={cropperMenuRef}>
                    {/* Drag handle for moving the toolbar */}
                    <SlTooltip content="Drag me">
                        <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                    </SlTooltip>
                    <div className="crop-ratio-presets">
                        {lgs.configuration.videoFormats.map(preset => (
                            <SlTooltip
                                key={preset.value}
                                content={`${preset.label}: ${preset.description}`}
                                placement="right"
                            >
                                <SlIcon
                                    library="fa"
                                    className={`lgs-card ${selectedRatio === preset.value ? 'selected' : ''}`}
                                    onClick={e => handleChangeRatio(preset, e)}
                                    name={FA2SL.set(ICONS[preset.value] || faSquare)}
                                />
                            </SlTooltip>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
})

CropRatioSelector.displayName = 'CropRatioSelector'

export { CropRatioSelector }