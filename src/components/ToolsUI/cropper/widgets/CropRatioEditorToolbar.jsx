/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-06
 * Last modified: 2025-10-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'
import { faGripDots }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import classNames from 'classnames'
import { memo, useCallback, useEffect, useRef, useState }           from 'react'
import { useSnapshot }                                              from 'valtio'
import '../style.css'

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
 * CropRatioEditorToolbar renders a draggable toolbar for selecting crop ratios
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.context - Valtio store with crop state (ratioEditor, etc.)
 * @param {string} props.cropzoneId - ID of the cropzone to update
 * @returns {JSX.Element} Draggable crop ratio selector UI
 */
export const CropRatioEditorToolbar = memo(({context, cropzoneId}) => {
    // Access reactive cropper and toolbar states
    const $cropper = context
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video || {}, {sync: true})

    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

    // Track selected ratio, defaulting to first video format
    const defaultRatio = __.device.isPortrait ? '9x16' : '16x9'

    // Handle crop updates
    useEffect(() => {
        const handleCropUpdate = (event) => {
            // setForceRender((prev) => prev + 1) // Force local re-render
        }
        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [context])

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
        $video.ratio = preset.value

        // Parse ratio and update cropzone
        const [w, h] = preset.value.split('x').map(Number)
        __.ui.widgetManager.updateCropRatio(cropzoneId, w / h, preset.locked)

        // Update store to keep ratioEditor active
        $cropper.ratioEditor = true
        $cropper.aspectRatio = w / h

    }, [$cropper, cropzoneId])

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

    return (
        <>
            {cropper.ratioEditor && (
                <div className="crop-ratio-widget lgs-toolbar lgs-card on-map">
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
                                        onPointerDown={event => handleChangeRatio(preset, event)}
                                        name={FA2SL.set(ICONS[preset.value] || faSquare)}
                                    />
                                </SlTooltip>
                            )
                        ))}
                    </div>
                </div>
            )}
        </>
    )
})