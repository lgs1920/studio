/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2025-09-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Component for rendering the video quality toolbar content
 * @component
 * @returns {JSX.Element} Video quality toolbar UI
 */
import { useCallback, useEffect } from 'react'
import { SlIcon, SlTooltip }      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }              from '@Utils/FA2SL'
import { faGripDots }         from '@fortawesome/pro-solid-svg-icons'
import classNames             from 'classnames'
import { VideoRecorder }      from '@Core/ui/video/recorder/VideoRecorder'
import { useSnapshot }        from 'valtio'

export const VideoQualityToolbar = () => {
    // Access reactive video state
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Handles selection of a crop quality key
     * @param {number} index - Index of the selected video quality
     * @param {Event} event - Click event from icon
     */
    const handleChangeQuality = useCallback((index, event) => {
        lgs.stores.ui.video.quality = index
    }, [])

    /**
     * Initialize default Quality from settings
     */
    useEffect(() => {
        $video.quality = lgs.settings.ui.video.quality ?? VideoRecorder.QUALITY[0].value
    }, [])


    return (
        <div className="video-quality-widget lgs-card on-map">
            <SlTooltip content="Drag me">
                <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
            </SlTooltip>
            <div className="buttons-bar-on-map">
                {VideoRecorder.QUALITY.map(({value, name, short}, index) => (
                    <SlTooltip
                        key={index}
                        content={name}
                        placement="left"
                    >
                        <div
                            className={classNames('lgs-one-line-card', 'on-map', {'selected': index === video.quality})}
                            onPointerDown={(event) => handleChangeQuality(index, event)}>
                            {short}
                        </div>
                    </SlTooltip>
                ))}
            </div>
        </div>
    )
}