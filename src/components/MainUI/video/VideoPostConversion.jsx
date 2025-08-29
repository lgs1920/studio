/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPostConversion.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-29
 * Last modified: 2025-08-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND }      from '@Core/constants'
import { faDownload }      from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }           from '@Utils/FA2SL'
import { UnitUtils }   from '@Utils/UnitUtils'
import { useCallback }     from 'react'
import { useSnapshot } from 'valtio'

/**
 * VideoPostConversion component for viewing converted video details
 *
 * @param {Object} props.videoBlob - Blob of the converted video
 * @returns {JSX.Element} Interface for viewing converted video details
 */
export const VideoPostConversion = ({videoBlob}) => {
    // Calculate file size in MB

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    return (
        <div className="post-conversion-container">
            <div className="video-info">
                <div className="info-item">
                    <span>{'File name:'}&nbsp;{$video.conversion.finalFilename}</span>
                    <div>
                        <span>{'Size:'}&nbsp;{videoBlob ? __.convert(videoBlob.size).toSize() : '0.00'}</span>
                        <span>{'Duration:'}&nbsp;{__.convert(video.conversion.duration * SECOND).toTime()}</span>
                    </div>
                </div>
            </div>
            {video.conversion.isConverted && (
                <SlAlert variant="success" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faDownload)}/>
                    <strong>{`${video.conversion.doConversion ? 'Conversion and downloading' : 'Downloading'} completed`}</strong>
                    <br/>
                    {`Your video has been ${video.conversion.doConversion ? 'converted and downloaded' : 'downloaded'} successfully.`}
                </SlAlert>
            )}
        </div>
    )
}