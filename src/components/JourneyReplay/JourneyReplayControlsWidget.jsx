/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayControlsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-18
 * Last modified: 2026-07-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR } from '@Core/constants'
import { WaCard, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

const SECOND_MILLIS = 1000

const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const formatCountdownTime = millis => {
    const totalSeconds = Math.max(0, Math.ceil((finiteNumber(millis, 0) ?? 0) / SECOND_MILLIS))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const minuteLabel = String(minutes).padStart(2, '0')
    const secondLabel = String(seconds).padStart(2, '0')

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${minuteLabel}:${secondLabel}`
    }

    return `${minuteLabel}:${secondLabel}`
}

const formatFileSize = bytes => {
    const size = Math.max(0, finiteNumber(bytes, 0) ?? 0)
    const units = ['B', 'KB', 'MB', 'GB']
    let value = size
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
    }

    if (unitIndex === 0) {
        return `${Math.round(value)} ${units[unitIndex]}`
    }

    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

const hqExportCreationProgress = runtime => {
    const progress = finiteNumber(runtime?.exportProgress, null)
    if (progress !== null) {
        return clampProgress(progress)
    }

    const processedFrames = finiteNumber(runtime?.exportProcessedFrames, null)
    const frameCount = finiteNumber(runtime?.exportFrameCount, null)
    if (processedFrames !== null && frameCount !== null && frameCount > 0) {
        return clampProgress(processedFrames / frameCount)
    }

    return 0
}

const hqExportVideoDurationMillis = plan => (
    finiteNumber(plan?.videoTimeline?.durationMillis, null)
    ?? finiteNumber(plan?.manifest?.durationMillis, null)
    ?? finiteNumber(plan?.manifest?.metadata?.replayDurationMillis, 0)
)

export const JourneyReplayControlsWidget = memo(() => {
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot(lgs.stores.ui.video)
    const hqExportPlan = replay.deferredExportPlan ?? null
    const hqExportRuntime = hqExportPlan?.runtime ?? null
    const hqExportRunning = hqExportRuntime?.status === 'exporting'
    const hqProgress = hqExportCreationProgress(hqExportRuntime)
    const hqVideoDurationSeconds = (
        hqProgress * Math.max(0, hqExportVideoDurationMillis(hqExportPlan)) / SECOND_MILLIS
    ).toFixed(1)
    const hqRemainingMillis = finiteNumber(hqExportRuntime?.exportEstimatedRemainingMillis, null)
    const hqElapsedMillis = finiteNumber(hqExportRuntime?.exportElapsedMillis, null)
    const hqPaused = hqExportRuntime?.exportPaused === true
    const hqFileSizeLabel = formatFileSize(hqExportRuntime?.exportFileSize)
    const hqExportPreparing = finiteNumber(hqExportRuntime?.exportFrameIndex, null) === null
    const hqIndicatorState = hqProgress >= 1
                              ? 'finalizing'
                              : (hqExportPreparing ? 'preparing' : 'recording')
    const hqIndicatorAnimation = hqIndicatorState === 'finalizing' ? 'beat-fade' : undefined
    const hqTimeLabel = hqRemainingMillis !== null
                        ? formatCountdownTime(hqRemainingMillis)
                        : (hqElapsedMillis !== null ? formatCountdownTime(hqElapsedMillis) : null)
    const hqTimeDisplay = hqTimeLabel ? (
        <span className="replay-controls-hq-time">
            <WaIcon name="stopwatch" variant="regular"/>
            <span>{hqTimeLabel}</span>
        </span>
    ) : null

    const pauseHqExport = useCallback(() => {
        lgs.stores.replay.deferredExportPlan?.runtime?.pauseExport?.()
    }, [])

    const resumeHqExport = useCallback(() => {
        lgs.stores.replay.deferredExportPlan?.runtime?.resumeExport?.()
    }, [])

    const abortHqExport = useCallback(() => {
        const runtime = lgs.stores.replay.deferredExportPlan?.runtime
        if (typeof runtime?.abortExport === 'function') {
            runtime.abortExport()
            return
        }
        runtime?.abortController?.abort?.()
    }, [])

    const config = useMemo(() => ({
        id:             'replay-controls-widget',
        top:            hqExportRunning ? '50%' : '82%',
        left:           hqExportRunning ? '50%' : '50%',
        attachTo:       hqExportRunning ? 'center' : 'bottom',
        icon:           'drone',
        opacity:        lgs.settings.ui.toolbars.opacity,
        type:           LGS_TOOLBAR,
        persist:        true,
        showControlBox: false,
        locked:         hqExportRunning,
        mandatory:      true,
        contextMenu:    {
            canRemove:   false,
            canEdit:     false,
            canSnapshot: false,
            canPosition: false,
        },
        zIndex:         11800,
    }), [hqExportRunning])

    if (!hqExportRunning && (
        replay.recordingSync === true
        || (video.preRecording || video.recording || video.snapshot || video.finalizing)
        || (!replay.toolbarVisible && !replay.active && !replay.paused)
    )) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WaCard className={`replay-controls lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map${hqExportRunning ? ' video-recorder-widget' : ''}`}>
                {hqExportRunning && (
                    <div className="replay-controls-hq-row">
                        <WaIcon
                            name="circle"
                            family="duotone"
                            variant="regular"
                            animation={hqPaused ? 'fade' : hqIndicatorAnimation}
                            className={`video-recorder-indicator ${hqIndicatorState}${hqPaused ? ' paused' : ''}`}
                        />
                        <span className="replay-controls-hq-file">
                            <WaIcon name="films" variant="regular"/>
                            <span>{hqFileSizeLabel} / {`${hqVideoDurationSeconds}s`}</span>

                        </span>
                        <JourneyReplayProgressBar
                            className="replay-controls-hq-progress"
                            showSettings={false}
                            showDistance={false}
                            progressOverride={hqProgress}
                            timeLabelOverride={hqTimeDisplay}
                            playingOverride={!hqPaused}
                            pausedOverride={hqPaused}
                            onPlay={resumeHqExport}
                            onPause={pauseHqExport}
                            onStop={abortHqExport}
                            playLabelOverride="Continue HQ creation"
                            pauseLabelOverride="Pause HQ creation"
                            stopLabelOverride="Abort HQ creation"
                            stopIcon="xmark"
                            stopVariant="danger"
                        />
                    </div>
                )}
                {!hqExportRunning && (
                    <JourneyReplayProgressBar showSettings/>
                )}
            </WaCard>
        </Widget>
    )
})
