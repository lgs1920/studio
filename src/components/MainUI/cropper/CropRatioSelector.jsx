/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioSelector.jsx
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
 * CropSelector.jsx
 * Component for selecting crop ratios with drag functionality and icon selection
 * @returns {JSX.Element} Crop selector UI component
 */
import { DragHandler }                                    from '@Core/ui/drag-handler/DragHandler'
import { faGripDots }                                     from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlTooltip }                              from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'
import './style.css'

export const CropRatioSelector = memo(({manager}) => {
    const $cropper = lgs.stores.main.components.cropper
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)
    const state = useSnapshot($cropper)
    const _cropperMenu = useRef(null)
    const [selectedRatio, setSelectedRatio] = useState(lgs.configuration.videoFormats[0]?.value || '16/9')

    /**
     * Updates toolbar opacity when toolbars.opacity changes
     */
    useEffect(() => {
        if (_cropperMenu.current) {
            _cropperMenu.current.style.opacity = toolbars.opacity
        }
    }, [toolbars.opacity])

    /**
     * Initializes drag handler for the crop selector
     */
    useEffect(() => {
        const editor = _cropperMenu.current
        if (!editor) {
            return
        }

        const dragHandler = new DragHandler({
                                                grabber:   editor,
                                                parent:    editor,
                                                container: lgs.canvas,
                                            })

        return () => {
            dragHandler.destroy()
        }
    }, [])

    /**
     * Handles ratio selection, updates UI, and resets crop
     * @param {Object} preset - Selected video format preset
     * @param {Event} event - Click event
     */
    const handleChangeRatio = useCallback((preset, event) => {
        console.log($cropper)
        if (!_cropperMenu.current) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        // Update selected class
        const icons = _cropperMenu.current.querySelectorAll('.crop-ratio-presets sl-icon')
        icons.forEach(icon => icon.classList.remove('selected'))
        event.target.classList.add('selected')

        // Update state and crop
        setSelectedRatio(preset.value)
        const [w, h] = preset.value.split('x').map(Number)
        manager.resetCrop({aspectRatio: w / h, lockRatio: preset.locked})
        return true

    }, [$cropper])

    return (
        <div className="crop-controls lgs-toolbar lgs-card on-map" ref={_cropperMenu}>
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
                            onMouseDown={e => handleChangeRatio(preset, e)}
                            name={FA2SL.set(__.cropper.icons[preset.value])}
                        />
                    </SlTooltip>
                ))}
            </div>
        </div>
    )
})

CropRatioSelector.displayName = 'CropSelector'