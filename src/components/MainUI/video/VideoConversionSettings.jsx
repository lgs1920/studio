/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConversionSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-30
 * Last modified: 2025-08-30
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
export const VideoConversionSettings = ({handleFormatChange, handleQualityChange, handleFilenameChange}) => {
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
                <span>{'Your video has been recorded.'}</span><br/>
                <span>{'Select the format, the quality and the name you want to use.'}</span>
            </div>
            <div className="video-file-name-quality-format">
                <SlSelect
                    size="small" hoist
                    label={'Format'}
                    value={video.format || 'MP4'}
                    onSlChange={handleFormatChange}
                    disabled={video.conversion.isConverting}
                >
                    {Object.entries(AVAILABLE_FORMATS).map(([key, format]) => (
                        <SlOption key={key} value={key}>
                            {format.description}
                        </SlOption>
                    ))}
                </SlSelect>
                <SlSelect
                    size="small" hoist
                    label={'Quality'}
                    value={video.quality || 'MEDIUM'}
                    onSlChange={handleQualityChange}
                    disabled={video.conversion.isConverting || video.format === video.conversion.inputFormat}
                >
                    {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                            <SlOption key={key} value={key}>
                                {preset.text}
                            </SlOption>
                    ))}
                </SlSelect>
                {!__.device.isMobile &&
                    <SlInput
                        size="small"
                        label={'File name prefix'}
                        name="video-file-name"
                        value={video.filename || __.recorder.filename}
                        onSlInput={handleFilenameChange}
                        disabled={video.conversion.isConverting}
                    />
                }
            </div>
            {__.device.isMobile &&
                <div className="video-file-name-quality-format">
                    <span>{'Video file name prefix'}</span>
                    <SlInput
                        size="small"
                        name="video-file-name"
                        value={video.filename || __.recorder.filename}
                        onSlInput={handleFilenameChange}
                        disabled={video.conversion.isConverting}
                    />
                </div>
            }

            {video.conversion.isConverting && video.conversion.progress.percentage > 0 && (
                <div class="video-conversion-progress-information">
                    <SlProgressBar
                        value={video.conversion.progress.percentage}
                        label={'Conversion Progress'}
                        className="conversion-progress"
                    />
                    <div>
                        <span>{`${video.conversion.progress.percentage.toFixed(0)}%`}</span>
                        <span>
                            {`[${__.convert(video.conversion.convertedTime).toTime()} / \
                            ${__.convert(video.conversion.duration * SECOND).toTime()}]`}
                        </span>
                    </div>

                </div>
            )}
            {video.conversion.errorMessage && (
                <SlAlert variant="danger" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faXmark)}/>
                    <strong>Error during conversion</strong>
                    <br/>
                    {video.conversion.errorMessage}
                </SlAlert>
            )}
            {/* TODO adds a console */}
            {/* {conversionLogs.length > 0 && ( */}
            {/*     <SlDetails className="conversion-logs" summary="Conversion Logs"> */}
            {/*         <SlDivider/> */}
            {/*         <pre className="lgs-console">{conversionLogs.join('\n')}</pre> */}
            {/*     </SlDetails> */}
            {/* )} */}
        </form>
    )
}