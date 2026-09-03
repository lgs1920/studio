/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-07-14
 * Last modified: 2026-09-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useOptionalSnapshot }                                      from '@Utils/ValtioUtils'
import { LGSPopup }            from '@Components/LGSPopup'
import { WaButton, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames from 'classnames'
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                          from 'valtio'
import '../style.css'

/**
 * CropRatioEditorToolbar renders a draggable toolbar for selecting crop ratios
 * with a popup menu for selection.
 * @component
 * @param {Object} props - Component properties.
 * @param {Object} props.context - Cropper state proxy.
 * @param {string} props.cropzoneId - Crop zone widget identifier.
 * @param {boolean} [props.embedded=false] - Render only the choices for an external popup.
 * @param {boolean} [props.mainTheme=false] - Use the main application theme for embedded menus.
 */
export const CropRatioEditorToolbar = memo(({context, cropzoneId, embedded = false, mainTheme = false}) => {
    // Use proxy from global state and props
    const $cropper = context
    const $video = lgs.stores.ui.video

    // Snapshots for rendering (without '$' prefix)
    const cropper = useOptionalSnapshot($cropper)
    const video = useSnapshot($video)

    // UI States
    const [_isPopupOpen, setIsPopupOpen] = useState(false)
    const themeClass = mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'
    const popupThemeClass = mainTheme ? 'crop-ratio-popup-menu--main-theme' : ''

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
     * Handles selection of a crop ratio preset and updates stores
     * @param {Object} preset - Video format preset from configuration
     */
    const handleChangeRatio = useCallback((preset) => {
        // Update video store proxy
        $video.ratio = preset.value
        lgs.settings.ui.video.ratio = preset.value

        const [w, h] = preset.value.split('x').map(Number)
        const numericRatio = w > 0 && h > 0 ? w / h : Number.NaN

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

    const handlePresetKeyDown = useCallback((event, preset) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        handleChangeRatio(preset)
    }, [handleChangeRatio])

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

    if (embedded) {
        return (
            <div className={`crop-ratio-popup-menu video-ratio-popup-menu lgs-card ${themeClass} ${popupThemeClass}`}>
                <ul>
                    {lgs.configuration.videoFormats.map(preset => (
                        isPresetVisible(preset) && (
                            <Fragment key={`embedded-crop-ratio-${preset.value}`}>
                                <WaTooltip for={`embedded-btn-ratio-${preset.value}`} placement="right">
                                    {`${preset.label}: ${preset.description}`}
                                </WaTooltip>

                                <li
                                    id={`embedded-btn-ratio-${preset.value}`}
                                    role="button"
                                    tabIndex={0}
                                    className={classNames('crop-ratio-choice-button', {'is-selected': video.ratio === preset.value})}
                                    onClick={() => handleChangeRatio(preset)}
                                    onKeyDown={(event) => handlePresetKeyDown(event, preset)}
                                >
                                    <span>{preset.label}</span>
                                </li>
                            </Fragment>
                        )
                    ))}
                </ul>
            </div>
        )
    }

    return (
        <>
            {cropper.ratioEditor && (
                <div ref={_widget} className={`crop-ratio-widget lgs-card ${themeClass}`}>
                    <span>{'Ratio:'}</span>

                    <WaButton
                        id="current-crop-ratio"
                        size="s"
                        appearance="outlined"
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsPopupOpen(!_isPopupOpen)
                        }}
                        withCaret
                    >
                        {currentPreset?.label || video.ratio}
                    </WaButton>

                    <LGSPopup
                        flip
                        anchor="current-crop-ratio"
                        active={_isPopupOpen}
                        onRequestClose={() => setIsPopupOpen(false)}
                        placement="bottom-end"
                        distance={2}
                        strategy="fixed"
                    >
                        <div className={`crop-ratio-popup-menu lgs-card ${themeClass} ${popupThemeClass}`}>
                            <ul>
                                {lgs.configuration.videoFormats.map(preset => (
                                    isPresetVisible(preset) && (
                                        <Fragment key={`crop-ratio-${preset.value}`}>
                                            <WaTooltip for={`btn-ratio-${preset.value}`} placement="right">
                                                {`${preset.label}: ${preset.description}`}
                                            </WaTooltip>

                                            <li
                                                id={`btn-ratio-${preset.value}`}
                                                role="button"
                                                tabIndex={0}
                                                className={classNames('crop-ratio-choice-button', {'is-selected': video.ratio === preset.value})}
                                                onClick={() => handleChangeRatio(preset)}
                                                onKeyDown={(event) => handlePresetKeyDown(event, preset)}
                                            >
                                                <span>{preset.label}</span>
                                            </li>
                                        </Fragment>
                                    )
                                ))}
                            </ul>
                        </div>
                    </LGSPopup>
                </div>
            )}
        </>
    )
})
