/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPresetToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
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
import { LGSPopup }                                                        from '@Components/LGSPopup'
import {
    WaButton,
}                                                                          from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                          from 'classnames'
import { Fragment, memo, useCallback, useEffect, useRef, useState }        from 'react'
import { useSnapshot }                                                     from 'valtio'
import '../style.css'

export const VideoPresetToolbar = memo(({embedded = false}) => {
    const $video = lgs.stores.ui.video
    const $videoSettings = lgs.settings.ui.video
    const video = useSnapshot($video)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)

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

    const getSafeIndex = useCallback((value, list, fallback) => {
        return Number.isInteger(value) && value >= 0 && value < list.length ? value : fallback
    }, [])

    useEffect(() => {
        const safeFps = getSafeIndex($videoSettings?.fps, ScreenMediaRecorder.FPS, ScreenMediaRecorder.DEFAULT_FPS_INDEX)
        const safeQuality = getSafeIndex($videoSettings?.quality, ScreenMediaRecorder.QUALITY, ScreenMediaRecorder.DEFAULT_QUALITY_INDEX)

        if ($video.fps !== safeFps) {
            $video.fps = safeFps
        }
        if ($video.quality !== safeQuality) {
            $video.quality = safeQuality
        }
        if ($videoSettings.fps !== safeFps) {
            $videoSettings.fps = safeFps
        }
        if ($videoSettings.quality !== safeQuality) {
            $videoSettings.quality = safeQuality
        }
    }, [$video, $videoSettings, getSafeIndex])

    /**
     * Sync local preset state when store indexes change
     */
    useEffect(() => {
        const current = getPresets(video.fps, video.quality)
        setPreset(current.key)

        if (current.key !== 'custom') {
            setOpen(false)
        }
    }, [video.fps, video.quality, getPresets])

    /**
     * Update store indexes based on preset selection
     */
    const handleChangePreset = useCallback((key, event) => {
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
            $videoSettings.fps = config.fps
            $videoSettings.quality = config.quality
        }
    }, [$video, $videoSettings])

    const presetButtons = Array.from(ScreenMediaRecorder.VIDEO_PRESETS).map(([key, value]) => (
        <Fragment key={key}>
            <WaButton
                className={classNames('video-choice-button', {'is-selected': key === preset})}
                size="s"
                variant="neutral"
                appearance={key === preset ? 'outlined' : 'plain'}
                id={`video-preset-${key}`}
                onClick={event => handleChangePreset(key, event)}
                withCaret={value.submenu}
            >
                {value.name}
            </WaButton>

            {value.submenu && (
                <LGSPopup
                    anchor={`video-preset-${key}`}
                    active={open}
                    onRequestClose={() => setOpen(false)}
                    placement="top-end"
                    strategy="fixed"
                    distance={4}
                >
                    <div className="video-preset-custom lgs-card wa-theme-lgs1920-on-map"
                         style={{opacity: toolbars.opacity}}>
                        <VideoFPSToolbar choicesOnMap/>
                        <VideoQualityToolbar choicesOnMap/>
                    </div>
                </LGSPopup>
            )}
        </Fragment>
    ))

    if (embedded) {
        return (
            <div className="video-preset-toolbar-embedded">
                <div className="video-preset-widget">
                    <div className="buttons-bar-on-map video-choice-buttons video-choice-buttons-on-map">
                        {presetButtons}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div ref={_toolbarRef} className="video-preset-widget-wrapper lgs-card wa-theme-lgs1920-on-map">
            <div className="video-preset-widget">
                <div className="buttons-bar-on-map video-choice-buttons video-choice-buttons-on-map">
                    {presetButtons}
                </div>
            </div>
        </div>
    )
})
