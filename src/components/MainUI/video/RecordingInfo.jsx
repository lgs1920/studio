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
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaIcon } from '@awesome.me/webawesome/dist/react'
import { Fragment, memo } from 'react'
import './style.css'

export const RecordingInfo = memo(({mediaData, isVideo}) => {
    const averageFps = Number(mediaData.averageFps) || 0
    const targetFps = Number(mediaData.fps) || 0
    const displayedAverageFps = averageFps > 0 ? averageFps : targetFps
    const averageFpsLabel = displayedAverageFps > 0
                            ? displayedAverageFps.toFixed(1).replace(/\.0$/, '')
                            : '--'
    const filenameTagInfo = mediaData.filenameTagInfo
    const metadata = mediaData.metadata ?? {}
    const rawDate = metadata.date ? new Date(metadata.date) : null
    const recordingDate = rawDate && !Number.isNaN(rawDate.getTime())
        ? rawDate.toLocaleString()
        : null
    const descriptiveMetadata = [
        {icon: 'film', label: 'Title', value: metadata.title},
        {icon: 'user', label: 'Artist', value: metadata.artist},
        {icon: 'compact-disc', label: 'Album', value: metadata.album},
        {icon: 'tag', label: 'Genre', value: metadata.genre},
        {icon: 'calendar', label: 'Recorded', value: recordingDate},
    ].filter(item => item.value)

    return (
        <WaCard className="recording-info-card">
            <WaIcon className="recording-info-icon" name="crop-simple" variant="regular"/>
            <span className="recording-info-label">{'Format'}</span>
            <span className="recording-info-value">
                {`${filenameTagInfo?.formatLabel ?? mediaData.ratio?.label ?? 'Unknown'} - ${mediaData.dimensions.width}x${mediaData.dimensions.height}`}
            </span>

            {filenameTagInfo && (
                <>
                    <WaIcon className="recording-info-icon" name="tags" variant="regular"/>
                    <span className="recording-info-label">{'Filename tag'}</span>
                    <span className="recording-info-value">{filenameTagInfo.suffix}</span>

                    <WaIcon className="recording-info-icon" name="expand" variant="regular"/>
                    <span className="recording-info-label">{'Resolution'}</span>
                    <span className="recording-info-value">{filenameTagInfo.resolutionLabel}</span>

                    <WaIcon className="recording-info-icon" name="crop-simple" variant="regular"/>
                    <span className="recording-info-label">{'Aspect ratio'}</span>
                    <span className="recording-info-value">{filenameTagInfo.aspectRatioLabel}</span>
                </>
            )}

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

                    {descriptiveMetadata.map(item => (
                        <Fragment key={item.label}>
                            <WaIcon className="recording-info-icon" name={item.icon} variant="regular"/>
                            <span className="recording-info-label">{item.label}</span>
                            <span className="recording-info-value">{item.value}</span>
                        </Fragment>
                    ))}
                </>
            }
        </WaCard>
    )
})

RecordingInfo.displayName = 'RecordingInfo'
