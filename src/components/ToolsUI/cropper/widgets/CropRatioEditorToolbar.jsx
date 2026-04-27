/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip, WaPopup } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                          from 'valtio'
import '../style.css'

/**
 * CropRatioEditorToolbar renders a draggable toolbar for selecting crop ratios
 * with a popup menu for selection.
 * @component
 */
export const CropRatioEditorToolbar = memo(({context, cropzoneId}) => {
    // Use proxy from global state and props
    const $cropper = context
    const $video = lgs.stores.ui.video

    // Snapshots for rendering (without '$' prefix)
    const cropper = useSnapshot($cropper || {})
    const video = useSnapshot($video || {})

    // UI States
    const [_isPopupOpen, setIsPopupOpen] = useState(false)

    const _widget = useRef(null)

    const getPresetByValue = useCallback((value) => {
        if (!value) {
            return null
        }
        return lgs.configuration.videoFormats.find(preset => preset.value === value) ?? null
    }, [])

    /**
     * Syncs the global video ratio when an external crop update occurs
     */
    useEffect(() => {
        /**
         * @param {CustomEvent} event
         */
        const handleCropUpdate = (event) => {
            const newRatio = event.detail?.ratio?.value
            // Update proxy only if value actually changed to prevent loops
            if (newRatio && $video.ratio !== newRatio) {
                $video.ratio = newRatio
            }
            if (newRatio && getPresetByValue(newRatio) && lgs.settings.ui.video.ratio !== newRatio) {
                lgs.settings.ui.video.ratio = newRatio
            }
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [$video, getPresetByValue])

    /**
     * Handles global pointerdown to close popup when clicking outside the widget
     */
    useEffect(() => {
        if (!_isPopupOpen) {
            return
        }

        const handlePointerDown = (event) => {
            const path = event.composedPath()
            // Close if click target is outside the widget container
            if (_widget.current && !path.includes(_widget.current)) {
                setIsPopupOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [_isPopupOpen])

    /**
     * Handles selection of a crop ratio preset and updates stores
     * @param {Object} preset - Video format preset from configuration
     */
    const handleChangeRatio = useCallback((preset) => {
        // Update video store proxy
        $video.ratio = preset.value
        lgs.settings.ui.video.ratio = preset.value

        const [w, h] = preset.value.split('x').map(Number)
        const numericRatio = w / h

        // Update external widget manager
        __.ui.widgetManager.updateCropRatio(cropzoneId, preset.value, numericRatio, preset.locked)

        // Update cropper store proxy
        $cropper.ratioEditor = true
        $cropper.aspectRatio = numericRatio

        setIsPopupOpen(false)
    }, [$cropper, $video, cropzoneId])

    /**
     * Checks if a preset should be visible based on current device and orientation
     * @param {Object} preset
     * @returns {boolean}
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

    useEffect(() => {
        const configRatio = __.ui.widgetManager.getWidgetConfig(cropzoneId)?.ratio?.value
        const savedRatio = lgs.settings.ui.video?.ratio
        const fallbackRatio = __.device.isPortrait ? '9x16' : '16x9'
        const nextPreset = getPresetByValue(configRatio)
            ?? getPresetByValue(savedRatio)
            ?? getPresetByValue(fallbackRatio)
            ?? lgs.configuration.videoFormats.find(isPresetVisible)
            ?? lgs.configuration.videoFormats[0]

        if (!nextPreset) {
            return
        }

        if ($video.ratio !== nextPreset.value) {
            $video.ratio = nextPreset.value
        }
        if (lgs.settings.ui.video.ratio !== nextPreset.value) {
            lgs.settings.ui.video.ratio = nextPreset.value
        }
    }, [$video, cropzoneId, getPresetByValue, isPresetVisible])

    // Find current active preset for label display
    const currentPreset = lgs.configuration.videoFormats.find(p => p.value === video.ratio)

    return (
        <>
            {cropper.ratioEditor && (
                <div ref={_widget} className="crop-ratio-widget lgs-card wa-theme-lgs1920-on-map">
                    <WaTooltip for="crop-ratio-grabber" placement="top">{'Drag me'}</WaTooltip>
                    <WaIcon id="crop-ratio-grabber" className="grabber" name="grip-dots" variant="solid"/>

                    <span>{'Format:'}</span>

                    <WaButton
                        id="current-crop-ratio"
                        size="small"
                        appearance="outlined"
                        onClick={(e) => {
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
                        <div className="lgs-card wa-theme-lgs1920-on-map"
                             style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                            {lgs.configuration.videoFormats.map(preset => (
                                isPresetVisible(preset) && (
                                    <React.Fragment key={`crop-ratio-${preset.value}`}>
                                        <WaTooltip for={`btn-ratio-${preset.value}`} placement="right">
                                            {`${preset.label}: ${preset.description}`}
                                        </WaTooltip>

                                        <WaButton
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
