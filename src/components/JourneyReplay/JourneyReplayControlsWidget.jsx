/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayControlsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR } from '@Core/constants'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
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

export const JourneyReplayControlsWidget = memo(() => {
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot(lgs.stores.ui.video)
    const hqExportRuntime = replay.deferredExportPlan?.runtime ?? null
    const hqExportRunning = hqExportRuntime?.status === 'exporting'
    const hqProgress = hqExportCreationProgress(hqExportRuntime)
    const hqRemainingMillis = finiteNumber(hqExportRuntime?.exportEstimatedRemainingMillis, null)
    const hqElapsedMillis = finiteNumber(hqExportRuntime?.exportElapsedMillis, null)
    const hqPaused = hqExportRuntime?.exportPaused === true
    const hqTimeLabel = hqRemainingMillis !== null
                        ? formatCountdownTime(hqRemainingMillis)
                        : (hqElapsedMillis !== null ? formatCountdownTime(hqElapsedMillis) : null)

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
        icon: 'drone',
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
            <WaCard className="replay-controls lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
                {hqExportRunning && (
                    <div className="replay-controls-hq-row">
                        <span className="replay-controls-hq-label">{'HQ Video creation'}</span>
                        <JourneyReplayProgressBar
                            className="replay-controls-hq-progress"
                            showSettings={false}
                            showDistance={false}
                            progressOverride={hqProgress}
                            timeLabelOverride={hqTimeLabel}
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
