/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-20
 * Last modified: 2025-08-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DragHandler }                                              from '@Core/ui/drag-handler/DragHandler'
import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'
import { faGripDots }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlIconButton, SlTooltip }                          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
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
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

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
        if (!_toolbar.current) {
            return
        }
        _toolbar.current.style.position = 'absolute'
        _toolbar.current.style.left = `${bounds.width * POSITIONING.X_PERCENTAGE}px`
        _toolbar.current.style.top = `${bounds.height * POSITIONING.Y_PERCENTAGE}px`
        _toolbar.current.style.width = 'auto'
        _toolbar.current.style.opacity = toolbars.opacity || 1
    }, [toolbars.opacity])

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
                                                            grabber:   _toolbar.current,
                                                            parent:    _toolbar.current,
                                                            container: lgs.canvas,
                                                        })

        // Cleanup on unmount or when ratioEditor changes
        return () => {
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
        }
    }, [manager, cropper.ratioEditor, updatePosition])

    useEffect(() => {
        const handleCropUpdate = (event) => {
            console.debug('CropRatioSelector: onCropUpdate received:', event.detail.crop)
            setForceRender((prev) => prev + 1) // Forcer le re-rendu local
        }
        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [])

    /**
     * Handles selection of a crop ratio preset
     * Updates the selected ratio and resets the crop with new aspect ratio
     * @function
     * @param {Object} preset - Video format preset (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeRatio = (preset, event) => {
        if (!_toolbar.current || !manager) {
            return
        }

        // event.preventDefault()
        // event.stopPropagation()

        // Update selected class on icons
        const icons = _toolbar.current.querySelectorAll('.crop-ratio-presets sl-icon')
        icons.forEach(icon => icon.classList.remove('selected'))
        event.target.classList.add('selected')

        // Parse ratio and reset crop
        const [w, h] = preset.value.split('x').map(Number)
        manager.resetCrop({aspectRatio: w / h, lockRatio: preset.locked})
        const rect = lgs.canvas.getBoundingClientRect()

        // Trick : simulates a pointer event to trigger the resize...
        // TODO: find a better way to do this
        const pointerMoveEvent = new PointerEvent('pointermove', {
            bubbles:    true,
            cancelable: true,
            clientX:    rect.left + 1, // Déplacer de 1 pixel par rapport à la position initiale
            clientY:    rect.top + 1,
        })
        lgs.canvas.dispatchEvent(pointerMoveEvent)
    }

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
                                        onClick={event => handleChangeRatio(preset, event)}
                                        name={FA2SL.set(ICONS[preset.value] || faSquare)}
                                    />
                                </SlTooltip>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
})

CropRatioSelector.displayName = 'CropRatioSelector'

export { CropRatioSelector }