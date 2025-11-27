/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-27
 * Last modified: 2025-11-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoFPSSelector renders a draggable toolbar for selecting video FPS
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.store - Valtio store with crop state (fpsEditor, etc.)
 * @returns {JSX.Element} Draggable video FPS selector UI
 */
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { faGripDots }          from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import classNames            from 'classnames'
import { memo, useCallback, useEffect } from 'react'
import { useSnapshot }       from 'valtio'
import '../style.css'

export const VideoFPSToolbar = memo(() => {
    // Access reactive cropper and video states
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Initialize default FPS from settings
     */
    useEffect(() => {
        $video.fps = lgs.settings.ui.video.fps ?? ScreenMediaRecorder.FPS[0]
    }, [])


    /**
     * Handles selection of a FPS value
     * Updates the selected FPS and stores it in settings
     * @param {number} index - Index of the selected FPS
     * @param {Event} event - Click event from icon
     */
    const handleChangeFPS = useCallback(index => {
        lgs.stores.ui.video.fps = index
    }, [])

    // Render draggable toolbar with FPS options
    return (
        <div className="video-fps-widget lgs-card on-map">
            <SlTooltip content="Drag me">
                <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
            </SlTooltip>
            <div className="buttons-bar-on-map">
                {ScreenMediaRecorder.FPS.map((fps, index) => (
                    <SlTooltip
                        key={index}
                        content={`FPS: ${fps}`}
                        placement="top"
                    >
                        <div
                            className={classNames('lgs-one-line-card on-map', {'selected': index === video.fps})}
                            onClick={event => handleChangeFPS(index, event)}
                        >
                            {fps}
                        </div>
                    </SlTooltip>
                ))}
            </div>
        </div>

    )
})