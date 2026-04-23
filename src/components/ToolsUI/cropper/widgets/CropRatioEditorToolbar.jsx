/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    faCropSimple, faRectangleWide, faRectangle, faRectangleVertical, faSquare, faRectangleTall,
}                                   from '@fortawesome/pro-regular-svg-icons'
import { faExpandWide, faGripDots } from '@fortawesome/pro-solid-svg-icons'
import { WaButton, WaIcon, WaTooltip, WaPopup }                  from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                from 'classnames'
import * as PropTypes                                            from 'prop-types'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'
import '../style.css'

/**
 * Icon mappings for crop ratio presets
 * @type {Object.<string, string>}
 * @constant
 */
const ICONS = {
    'square': 'square',
    '9x16':   'rectangle-wide',
    '16x9':   'rectangle-wide',
    '1x1':    'square',
    '4x5':    'rectangle-vertical',
    '4x3':    'rectangle',
    '0x0':    'expand-wide',
}

/**
 * CropRatioEditorToolbar renders a draggable toolbar for selecting crop ratios
 * with a popup menu for selection.
 * @component
 */
export const CropRatioEditorToolbar = memo(({context, cropzoneId}) => {
    const $cropper = context
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video || {}, {sync: true})

    /** * State for popup visibility */
    const [_isPopupOpen, setIsPopupOpen] = useState(false)
    /** * Ref for the widget container to handle click-away */
    const _widgetRef = useRef(null)

    useEffect(() => {
        let executed = false
        const handleCropUpdate = (event) => {
            if (executed) {
                return
            }
            executed = true
            $video.ratio = event.detail.ratio.value
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [$video])

    /**
     * Handles global pointerdown to close popup when clicking outside the widget
     */
    useEffect(() => {
        if (!_isPopupOpen) {
            return
        }

        /**
         * @param {PointerEvent} event
         */
        const handlePointerDown = (event) => {
            const path = event.composedPath()
            // If the click path doesn't include our widget container, close
            if (_widgetRef.current && !path.includes(_widgetRef.current)) {
                setIsPopupOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [_isPopupOpen])

    /**
     * Handles selection of a crop ratio preset
     * @param {Object} preset - Video format preset
     */
    const handleChangeRatio = useCallback((preset) => {
        $video.ratio = preset.value
        const [w, h] = preset.value.split('x').map(Number)
        __.ui.widgetManager.updateCropRatio(cropzoneId, preset.value, w / h, preset.locked)

        $cropper.ratioEditor = true
        $cropper.aspectRatio = w / h
        setIsPopupOpen(false)
    }, [$cropper, $video, cropzoneId])

    /**
     * Filters visibility based on device and orientation
     */
    const isPresetVisible = useCallback((preset) => {
        const device = __.device.getDeviceType()
        const orientation = __.device.getOrientation()
        const key = `${device}-${orientation}`
        if (!preset.visibility) {
            return true
        }
        return preset.visibility.includes(device) || preset.visibility.includes(key)
    }, [])

    /** * Current selected preset for the trigger icon */
    const currentPreset = lgs.configuration.videoFormats.find(p => p.value === video.ratio)

    return (
        <>
            {cropper.ratioEditor && (
                <div ref={_widgetRef} className="crop-ratio-widget lgs-card on-map">
                    <WaTooltip for="crop-ratio-grabber" placement="top">{'Drag me'}</WaTooltip>
                    <WaIcon id="crop-ratio-grabber" className="grabber" name="grip-dots" variant="solid"/>

                    <span>{'Format:'}</span>
                    <WaButton
                        id="current-crop-ratio"
                        size="small"
                        appearance="outlined"
                        variant="on-map"
                        onClick={(e) => {
                            // Stop propagation to prevent the global listener from firing immediately
                            e.stopPropagation()
                            setIsPopupOpen(!_isPopupOpen)
                        }}
                        withCaret
                    >
                        {currentPreset?.label || video.ratio}
                    </WaButton>

                    <WaPopup
                        flip
                        anchor="current-crop-ratio"
                        active={_isPopupOpen}
                        placement="bottom-end"
                        distance={2}
                        strategy="fixed"
                    >
                        <div className="lgs-card on-map" style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                            {lgs.configuration.videoFormats.map(preset => (
                                isPresetVisible(preset) && (
                                    <React.Fragment key={`crop-ratio-${preset.value}`}>
                                        <WaTooltip for={`btn-ratio-${preset.value}`} placement="right">
                                            {`${preset.label}: ${preset.description}`}
                                        </WaTooltip>
                                        <WaButton
                                            variant="on-map"
                                            id={`btn-ratio-${preset.value}`}
                                            size="small"
                                            appearance={video.ratio === preset.value ? 'accent' : 'plain'}
                                            onClick={() => handleChangeRatio(preset)}
                                            style={{justifyContent: 'flex-start', width: '100%'}}
                                        >
                                            {preset.label}
                                        </WaButton>
                                    </React.Fragment>
                                )
                            ))}
                        </div>
                    </WaPopup>
                </div>
            )}
        </>
    )
})