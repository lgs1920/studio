/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConversionSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2025-09-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND }      from '@Core/constants'
import {
    VideoConverter,
}                      from '@Core/ui/video/converter/VideoConverter'
import {
    faXmark,
}                      from '@fortawesome/pro-regular-svg-icons'
import {
    SlAlert, SlIcon, SlInput, SlOption, SlProgressBar, SlSelect, SlTooltip,
}                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }       from '@Utils/FA2SL'
import { useEffect }   from 'react'
import { useSnapshot } from 'valtio'

/**
 * VideoConversionSettings component for video conversion settings
 *
 * @param {Function} props.handleFormatChange - Handler for format change
 * @param {Function} props.handleQualityChange - Handler for quality change
 * @param {Function} props.handleFilenameChange - Handler for filename change
 * @returns {JSX.Element} Form for video conversion settings
 */
export const VideoConversionSettings = ({handleFilenameChange}) => {
    // Constants
    const AVAILABLE_FORMATS = VideoConverter.getAvailableFormats()
    const QUALITY_PRESETS = VideoConverter.getQualityPresets()

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    useEffect(() => {
        $video.conversion.doConversion = $video.format !== $video.conversion.inputFormat
    }, [])

    return (
        <form onSubmit={(e) => e.preventDefault()} className="video-preview-form">
            <div>
                    <SlInput
                        label={'Video file name'}
                        size="small"
                        name="video-file-name"
                        value={__.recorder.filename}
                        onSlInput={handleFilenameChange}
                    />
            </div>
        </form>
    )
}