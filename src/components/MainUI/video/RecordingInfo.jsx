/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RecordingInfo.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo }           from 'react'
import './style.css'

export const RecordingInfo = memo(({mediaData, isVideo}) => {
    const averageFps = Number(mediaData.averageFps) || 0
    const targetFps = Number(mediaData.fps) || 0
    const displayedAverageFps = averageFps > 0 ? averageFps : targetFps
    const averageFpsLabel = displayedAverageFps > 0
                            ? displayedAverageFps.toFixed(1).replace(/\.0$/, '')
                            : '--'

    return (
        <WaCard className="recording-info-card">
            <WaIcon className="recording-info-icon" name="crop-simple" variant="regular"/>
            <span className="recording-info-label">{'Format'}</span>
            <span className="recording-info-value">
                {mediaData.ratio.label} - {mediaData.dimensions.width}x{mediaData.dimensions.height}
            </span>

            <WaIcon className="recording-info-icon" name="file" variant="regular"/>
            <span className="recording-info-label">{'Size'}</span>
            <span className="recording-info-value">{__.convert(mediaData.size).toBytesUnit()}</span>

            {isVideo &&
                <>
                    <WaIcon className="recording-info-icon" name="hourglass" variant="regular"/>
                    <span className="recording-info-label">{'Duration'}</span>
                    <span className="recording-info-value">{__.convert(mediaData.duration).toTime()}</span>

                    <span className="recording-info-label recording-info-label-offset">{'FPS'}</span>
                    <span className="recording-info-value">{averageFpsLabel}</span>

                    <span className="recording-info-label recording-info-label-offset">{'Quality'}</span>
                    <span className="recording-info-value">{mediaData.quality?.name}</span>
                </>
            }
        </WaCard>
    )
})

RecordingInfo.displayName = 'RecordingInfo'
