/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPresetToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-30
 * Last modified: 2025-11-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }                        from '@Components/FontAwesomeIcon'
import { VideoFPSToolbar }                        from '@Components/MainUI/video/toolbox/VideoFPSToolbar'
import { VideoQualityToolbar }                    from '@Components/MainUI/video/toolbox/VideoQualityToolbar'
/**
 * VideoFPSSelector renders a draggable toolbar for selecting video FPS
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.store - Valtio store with crop state (fpsEditor, etc.)
 * @returns {JSX.Element} Draggable video FPS selector UI
 */
import { ScreenMediaRecorder }                    from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { faGripDots, faCaretDown, faCaretRight }  from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                  from '@Utils/FA2SL'
import classNames                                 from 'classnames'
import { memo, useCallback, useEffect, useState } from 'react'
import { useSnapshot }                            from 'valtio'
import '../style.css'

export const VideoPresetToolbar = memo(() => {
    // Access reactive cropper and video states
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [preset, setPreset] = useState(null)
    const [open, setOpen] = useState(false)


    const getPresets = (fps, quality) => {
        // Iterate over the Map entries
        for (const [key, preset] of ScreenMediaRecorder.VIDEO_PRESETS) {
            if (key === 'custom') {
                continue
            } // skip custom during matching
            if (preset.fps === fps && preset.quality === quality) {
                return {key, ...preset}
            }
        }
        // Default to custom if no match
        const customPreset = ScreenMediaRecorder.VIDEO_PRESETS.get('custom')
        return {key: 'custom', ...customPreset}
    }
    /**
     * Initialize default FPS from settings
     */
    useEffect(() => {


        $video.fps = lgs.settings.ui.video.fps ?? ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
        $video.quality = lgs.settings.ui.video.quality ?? ScreenMediaRecorder.QUALITY[ScreenMediaRecorder.DEFAULT_QUALITY_INDEX]

        const current = getPresets($video.fps, $video.quality)
        setPreset(current.key)
        if (current.key !== 'custom') {
            setOpen(false)
        }
    }, [$video.fps, $video.quality])


    /**
     * Handles selection of a FPS value
     * Updates the selected FPS and stores it in settings
     * @param {number} index - Index of the selected FPS
     * @param {Event} event - Click event from icon
     */
    const handleChangePreset = useCallback(key => {
        const {fps, quality} = ScreenMediaRecorder.VIDEO_PRESETS.get(key)
        setPreset(key)

        if (key === 'custom') {
            setOpen(prev => !prev)

        }
        else {
            setOpen(false)
            lgs.stores.ui.video.fps = fps
            lgs.settings.ui.video.fps = fps
            $video.fps = fps
            lgs.stores.ui.video.quality = quality
            lgs.settings.ui.video.quality = quality
            $video.quality = quality
        }
    }, [])

    useEffect(() => {
        if (preset === 'custom') {
            // Checks if it is an predefined preset
            const current = getPresets($video.fps, $video.quality)
            setPreset(current.key)
        }

    }, [open])

    const handleOpen = useCallback(event => {
        setOpen(!open)
    }, [open])

    // Render draggable toolbar with FPS options
    return (
        <div className="video-preset-widget-wrapper  lgs-card on-map">
            <div
                className={classNames('video-preset-widget', 'video-preset-grid', {'video-preset-grid-open': preset === 'custom'})}>
                <SlTooltip content="Drag me">
                    <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                </SlTooltip>
                <div className="buttons-bar-on-map">
                    {Array.from(ScreenMediaRecorder.VIDEO_PRESETS).map(([key, value]) => (
                        <SlTooltip
                            key={key}
                            content={value.description ?? value.name}
                            placement="top"
                        >
                            <div
                                className={classNames('lgs-one-line-card on-map', {'selected': key === preset})}
                                onClick={event => handleChangePreset(key, event)}
                            >
                                {value.name}
                            </div>
                        </SlTooltip>
                    ))}
                </div>

            </div>
            {open &&
                <div className="video-preset-custom">
                    <hr/>
                    <div className="video-preset-grid"><span/><VideoFPSToolbar/></div>
                    <div className="video-preset-grid"><span/><VideoQualityToolbar/></div>


                </div>
            }
        </div>
    )
})