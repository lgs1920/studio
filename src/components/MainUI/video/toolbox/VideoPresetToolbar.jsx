/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPresetToolbar.jsx
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

/*******************************************************************************
 * File: VideoPresetToolbar.jsx
 ******************************************************************************/

import { VideoFPSToolbar }                                                 from '@Components/MainUI/video/toolbox/VideoFPSToolbar'
import {
    VideoQualityToolbar,
}                                                                          from '@Components/MainUI/video/toolbox/VideoQualityToolbar'
import {
    ScreenMediaRecorder,
}                                                                          from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    WaButton, WaIcon, WaPopup, WaTooltip,
}                                                                          from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                          from 'classnames'
import React, { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                                     from 'valtio'
import '../style.css'

export const VideoPresetToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const videoSettings = useSnapshot(lgs.settings.ui.video || {})

    const [preset, setPreset] = useState(null)
    const [open, setOpen] = useState(false)
    const _toolbarRef = useRef(null)

    /**
     * Find the preset key matching the current store indexes
     * @param {number} fpsIndex
     * @param {number} qualityIndex
     * @returns {string}
     */
    const getPresets = useCallback((fpsIndex, qualityIndex) => {
        for (const [key, p] of ScreenMediaRecorder.VIDEO_PRESETS) {
            if (key === 'custom') {
                continue
            }
            // Compare current store indexes with preset definition indexes
            if (p.fps === fpsIndex && p.quality === qualityIndex) {
                return {key, ...p}
            }
        }
        return {key: 'custom', ...ScreenMediaRecorder.VIDEO_PRESETS.get('custom')}
    }, [])

    /**
     * Sync local preset state when store indexes change
     */
    useEffect(() => {
        if (videoSettings?.adaptiveQuality?.enabled) {
            setPreset('auto')
            return
        }

        const current = getPresets(video.fps, video.quality)
        setPreset(current.key)

        if (current.key !== 'custom') {
            setOpen(false)
        }
    }, [video.fps, video.quality, videoSettings?.adaptiveQuality?.enabled, getPresets])

    /**
     * Handle click-away to close custom popup
     */
    useEffect(() => {
        if (!open) {
            return
        }
        const handlePointerDown = (event) => {
            if (_toolbarRef.current && !event.composedPath().includes(_toolbarRef.current)) {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    /**
     * Update store indexes based on preset selection
     */
    const handleChangePreset = useCallback((key, event) => {
        if (key === 'auto') {
            lgs.settings.ui.video.adaptiveQuality = {...lgs.settings.ui.video.adaptiveQuality, enabled: true}
            return
        }

        if (key === 'custom') {
            event?.stopPropagation()
            setOpen(prev => !prev)
            return
        }

        const config = ScreenMediaRecorder.VIDEO_PRESETS.get(key)
        if (config) {
            // Update proxy indexes
            $video.fps = config.fps
            $video.quality = config.quality

            // Sync settings
            lgs.settings.ui.video.fps = config.fps
            lgs.settings.ui.video.quality = config.quality

            if (lgs.settings.ui.video.adaptiveQuality?.enabled) {
                lgs.settings.ui.video.adaptiveQuality = {...lgs.settings.ui.video.adaptiveQuality, enabled: false}
            }
        }
    }, [$video])

    return (
        <div ref={_toolbarRef} className="video-preset-widget-wrapper lgs-card on-map">
            <div
                className={classNames('video-preset-widget', 'video-preset-grid', {'video-preset-grid-open': preset === 'custom'})}>
                <WaIcon id="grabber-video-preset" className="grabber" name="grip-dots" variant="solid"/>

                <div className="buttons-bar-on-map">
                    {Array.from(ScreenMediaRecorder.VIDEO_PRESETS).map(([key, value]) => (
                        <Fragment key={key}>
                            <WaButton
                                size="small"
                                appearance={key === preset ? 'outlined' : 'plain'}
                                variant="on-map"
                                id={`video-preset-${key}`}
                                onClick={event => handleChangePreset(key, event)}
                                withCaret={value.submenu}
                            >
                                {value.name}
                            </WaButton>

                            {value.submenu && (
                                <WaPopup
                                    anchor={`video-preset-${key}`}
                                    active={open}
                                    placement="bottom-end"
                                    strategy="fixed"
                                    distance={4}
                                >
                                    <div className="video-preset-custom lgs-card on-map">
                                        <div className="video-preset-grid"><span/><VideoFPSToolbar/></div>
                                        <div className="video-preset-grid"><span/><VideoQualityToolbar/></div>
                                    </div>
                                </WaPopup>
                            )}
                        </Fragment>
                    ))}
                    <WaButton
                        size="small"
                        appearance={preset === 'auto' ? 'outlined' : 'plain'}
                        variant="on-map"
                        onClick={() => handleChangePreset('auto')}
                    >
                        {'Auto'}
                    </WaButton>
                </div>
            </div>
        </div>
    )
})