/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-27
 * Last modified: 2026-02-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Component for rendering the video quality toolbar content
 * @component
 * @returns {JSX.Element} Video quality toolbar UI
 */
import { useCallback, useEffect } from 'react'
import { SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import { faGripDots }        from '@fortawesome/pro-solid-svg-icons'
import classNames              from 'classnames'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { useSnapshot }         from 'valtio'

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
        lgs.settings.ui.video.quality = index
        if (lgs.settings.ui.video.adaptiveQuality?.enabled) {
            lgs.settings.ui.video.adaptiveQuality = {...lgs.settings.ui.video.adaptiveQuality, enabled: false}
        }
    }, [])


    /**
     * Initialize default Quality from settings
     */
    useEffect(() => {
        $video.quality = lgs.settings.ui.video.quality ?? ScreenMediaRecorder.QUALITY[0].value
    }, [])


    return (
        <div className="video-quality-widget">
            <span>{'Quality'}</span>
            <div className="buttons-bar-on-map">
                {ScreenMediaRecorder.QUALITY.map(({value, name, short}, index) => (
                    <SlTooltip
                        key={index}
                        content={name}
                        placement="bottom"
                    >
                        <div
                            className={classNames('lgs-one-line-card', 'on-map', {'selected': index === video.quality})}
                            onClick={(event) => handleChangeQuality(index, event)}>
                            {short}
                        </div>
                    </SlTooltip>
                ))}
            </div>
        </div>
    )
}
