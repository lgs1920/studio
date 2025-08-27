/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConversionSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-27
 * Last modified: 2025-08-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    VideoConverter,
}                  from '@Core/ui/video/converter/VideoConverter'
import {
    SlDetails, SlDivider, SlInput, SlOption, SlSelect, SlProgressBar, SlAlert, SlIcon,
}                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }   from '@Utils/FA2SL'
import { faXmark } from '@fortawesome/pro-regular-svg-icons'

/**
 * VideoConversionSettings component for video conversion settings
 * @param {Object} props - Component props
 * @param {string} props.inputFormat - Detected input format
 * @param {Object} props.video - Video state from valtio
 * @param {string} props.finalFilename - Computed filename for output
 * @param {boolean} props.isConverting - Conversion status
 * @param {number} props.progressPercentage - Conversion progress percentage
 * @param {Array<string>} props.conversionLogs - Conversion logs
 * @param {string|null} props.errorMessage - Error message for conversion issues
 * @param {Function} props.handleFormatChange - Handler for format change
 * @param {Function} props.handleQualityChange - Handler for quality change
 * @param {Function} props.handleFilenameChange - Handler for filename change
 * @returns {JSX.Element} Form for video conversion settings
 */
export const VideoConversionSettings = ({
                                            inputFormat,
                                            video,
                                            finalFilename,
                                            isConverting,
                                            progressPercentage,
                                            conversionLogs,
                                            errorMessage,
                                            handleFormatChange,
                                            handleQualityChange,
                                            handleFilenameChange,
                                        }) => {
    // Constants
    const AVAILABLE_FORMATS = VideoConverter.getAvailableFormats()
    const QUALITY_PRESETS = VideoConverter.getQualityPresets()

    return (
        <form onSubmit={(e) => e.preventDefault()} className="video-preview-form">
            <div className="video-file-name-quality-format">
                <SlSelect
                    size="small"
                    label={'Video Format'}
                    value={video.format || 'MP4'}
                    onSlChange={handleFormatChange}
                    disabled={isConverting}
                >
                    {Object.entries(AVAILABLE_FORMATS).map(([key, format]) => (
                        <SlOption key={key} value={key}>
                            {format.description}
                        </SlOption>
                    ))}
                </SlSelect>
                <SlSelect
                    size="small"
                    label={'Quality Preset'}
                    value={video.quality || 'MEDIUM'}
                    onSlChange={handleQualityChange}
                    disabled={isConverting || video.format === inputFormat}
                >
                    {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                        <SlOption key={key} value={key}>
                            {preset.description}
                        </SlOption>
                    ))}
                </SlSelect>
            </div>
            <div className="video-file-name-quality-format">
                <SlInput
                    size="small"
                    label={'Video file name prefix'}
                    name="video-file-name"
                    value={video.filename || __.recorder.filename}
                    onSlInput={handleFilenameChange}
                    disabled={isConverting}
                />
                <div className="converted-video-file-name">
                    <span>{'File name:'}</span><span>{finalFilename}</span>
                </div>
            </div>
            {isConverting && progressPercentage > 0 && (
                <SlProgressBar
                    value={progressPercentage}
                    label={'Conversion Progress'}
                    className="conversion-progress"
                />
            )}
            {errorMessage && (
                <SlAlert variant="danger" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faXmark)}/>
                    <strong>Error during conversion</strong>
                    <br/>
                    {errorMessage}
                </SlAlert>
            )}
            {conversionLogs.length > 0 && (
                <SlDetails className="conversion-logs" summary="Conversion Logs">
                    <SlDivider/>
                    <pre className="lgs-console">{conversionLogs.join('\n')}</pre>
                </SlDetails>
            )}
        </form>
    )
}