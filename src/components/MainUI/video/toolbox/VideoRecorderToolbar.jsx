/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecorderToolbar.jsx - Displays video recording controls and stats
 ******************************************************************************/
import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { UIToast }                          from '@Utils/UIToast'
import { UnitUtils }                        from '@Utils/UnitUtils'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                      from 'valtio'
import '../style.css'

/**
 * RecorderControls - Renders play/pause and stop buttons for the recorder
 */
const RecorderControls = memo(({recording, paused, recorder, starting, onFinalize}) => {

    const $video = lgs.stores.ui.video

    const handlePlayPause = useCallback(() => {
        if (recorder) {
            paused ? recorder.resumeVideo() : recorder.pauseVideo()
        }
    }, [recorder, paused])

    const handleStop = useCallback(() => {
        onFinalize(true)
        $video.finalizing = true
        recorder?.stopVideo()
    }, [recorder, onFinalize, $video])

    return (
        <>
            <WaTooltip for="video-recorder-play-pause">
                {paused ? 'Click to resume' : 'Click to pause'}
            </WaTooltip>
            <WaButton
                id="video-recorder-play-pause"
                appearance="plain"
                variant="brand"
                size="s"
                className="video-recorder-action"
                onClick={handlePlayPause}
                disabled={!recorder || starting || !recording}
            >
                <WaIcon name={paused ? 'play' : 'pause'} variant="regular"/>
            </WaButton>
            {recording && (
                <>
                    <WaTooltip for="video-recorder-stop">{'Click to stop'}</WaTooltip>
                    <WaButton
                        id="video-recorder-stop"
                        appearance="plain"
                        variant="brand"
                        size="s"
                        className="video-recorder-action"
                        onClick={handleStop}
                        aria-label="Stop recording"
                    >
                        <WaIcon name="stop" variant="regular"/>
                    </WaButton>
                </>
            )}
        </>
    )
})

const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))
const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

/**
 * VideoRecorderToolbar component
 */
export const VideoRecorderToolbar = ({toolbar}) => {
    const $video = lgs.stores.ui.video
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot($video)
    const syncWithJourneyReplay = replay.recordingSync === true
    const isMobile = __.device?.isMobile === true
    const videoTimelineDurationMillis = finiteNumber(replay.deferredExportPlan?.videoTimeline?.durationMillis)

    const [state, setState] = useState({
                                           recordedDuration: 0,
                                           recordedSize: 0,
                                           finalizing:   false,
                                       })
    const draftVideoProgress = syncWithJourneyReplay
                               && videoTimelineDurationMillis !== null
                               && videoTimelineDurationMillis > 0
                               ? clampProgress(state.recordedDuration / videoTimelineDurationMillis)
                               : null
    const indicatorState = video.finalizing
                          ? 'finalizing'
                          : (video.preRecording ? 'preparing' : 'recording')
    const indicatorAnimation = indicatorState === 'ready' || indicatorState === 'finalizing'
                               ? 'beat-fade'
                               : undefined

    const _toolbar = useRef(toolbar || null)
    const caption = 'Video Recording'

    /**
     * Formats duration in milliseconds to human-readable format
     */
    const formatDuration = useCallback((ms) => {
        if (ms <= 0) {
            return '0s'
        }
        return UnitUtils.convert(ms).toTime()
    }, [])

    /**
     * Formats size in bytes to human-readable format
     */
    const formatSize = useCallback((bytes) => {
        return UnitUtils.convert(bytes).toBytesUnit()
    }, [])

    /**
     * Updates video and local state
     */
    const updateState = useCallback((updates) => {
        Object.assign($video, updates)
        setState((prev) => ({...prev, ...updates}))
    }, [$video])

    /**
     * Shows toast notification
     */
    const showToast = useCallback((type, text) => {
        UIToast[type]({caption, text})
    }, [])

    // Manage recorder events
    useEffect(() => {
        if (!__.recorder) {
            console.warn('Recorder not initialized')
            return
        }

        const handleInfo = (event) => {
            // Use the duration directly from the event
            setState((prev) => ({
                ...prev,
                recordedSize:     event.detail.size,
                recordedDuration: event.detail.duration,
            }))
        }

        const handlePause = () => {
            if ($video.paused) {
                return
            }

            // Use the duration from the recorder
            const duration = __.recorder ? __.recorder.mediaData.duration : 0
            updateState({
                            paused:           true,
                            recordedDuration: duration,
                        })
            showToast('warning', 'Paused')
        }

        const handleResume = () => {
            if (!$video.paused) {
                return
            }

            // Use the duration from the recorder
            const duration = __.recorder ? __.recorder.mediaData.duration : 0
            updateState({
                            paused:           false,
                            recordedDuration: duration,
                        })
            showToast('success', 'Resumed')
        }

        const handleFinalize = () => {
            if ($video.finalizing) {
                return
            }
            $video.finalizing = true
            updateState({finalizing: true})
        }

        const handleStop = (event) => {
            if (__.recorder?.isRecording() || $video.paused) {
                __.recorder.stopVideo()
            }

            updateState({
                            preRecording: false,
                            recording:    false,
                            paused:       false,
                            step:         null,
                            size:         0,
                            recordedDuration: 0,
                            recordedSize: 0,
                        })

            switch (event.type) {
                case ScreenMediaRecorder.events.STOP:
                    showToast('success', 'Done. Waiting...')
                    break
                case ScreenMediaRecorder.events.MAX_SIZE:
                    showToast('warning', `Stopped due to max size limit (${video.maxSize}MB). Waiting...`)
                    break
                case ScreenMediaRecorder.events.MAX_DURATION:
                    showToast('warning', `Stopped due to max duration limit (${video.maxDuration}m). Waiting...`)
                    break
            }
        }

        const handleDownload = (event) => {
            showToast('success', `Saved in ${event.detail.filename}`)
        }

        const handleError = (event) => {
            showToast('error', event.detail?.error?.message ?? 'Video recording failed.')
        }

        const events = [
            [ScreenMediaRecorder.events.INFO, handleInfo],
            [ScreenMediaRecorder.events.PAUSE, handlePause],
            [ScreenMediaRecorder.events.RESUME, handleResume],
            [ScreenMediaRecorder.events.MAX_SIZE, handleStop],
            [ScreenMediaRecorder.events.MAX_DURATION, handleStop],
            [ScreenMediaRecorder.events.STOP, handleStop],
            [ScreenMediaRecorder.events.CANCEL, handleStop],
            [ScreenMediaRecorder.events.ERROR, handleError],
            [ScreenMediaRecorder.events.DOWNLOAD, handleDownload],
            [ScreenMediaRecorder.events.FINALIZE, handleFinalize],
        ]

        events.forEach(([event, handler]) => __.recorder.addEventListener(event, handler))

        return () => {
            if (__.recorder) {
                events.forEach(([event, handler]) => __.recorder.removeEventListener(event, handler))
            }
        }
    }, [updateState, showToast, video.maxSize, video.maxDuration, $video])

    const handleCancel = useCallback(async () => {
        if (__.recorder) {
            await __.recorder.cancelVideo()
        }
        updateState({
                        preRecording: false,
                        recording:    false,
                        paused:       false,
                        size:         0,
                        editing:      true,
                        recordedDuration: 0,
                        recordedSize: 0,
                        finalizing:   false,
                    })
        showToast('warning', 'Recording has been canceled!')
    }, [updateState, showToast])

    return (
        <WaCard
            ref={_toolbar}
            className="video-recorder-widget lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map"
        >
            <WaIcon
                name="circle"
                family="duotone"
                variant="regular"
                animation={video.paused ? 'fade' : indicatorAnimation}
                className={`video-recorder-indicator ${indicatorState}${video.paused ? ' paused' : ''}`}
            />
            <span className="duration">{formatDuration(state.recordedDuration)}</span>
            <span className="size">{formatSize(state.recordedSize)}</span>
            {syncWithJourneyReplay && (
                isMobile ? (
                    <JourneyReplayProgressBar
                        className="video-recorder-replay-progress"
                        showActions={false}
                        showSnapshot
                        actionAppearance="plain"
                        snapshotAppearance="plain"
                        showSettings={false}
                        showTime={false}
                        showDistance={false}
                        progressOverride={draftVideoProgress}
                        disabled={video.preRecording}
                    />
                ) : (
                    <JourneyReplayProgressBar
                        className="video-recorder-replay-progress"
                        showActions={false}
                        showSnapshot
                        actionAppearance="plain"
                        snapshotAppearance="plain"
                        showSettings={false}
                        progressOverride={draftVideoProgress}
                        disabled={video.preRecording}
                    />
                )
            )}
            {video.preRecording ? (
                <div className="blinking">Preparing...</div>
            ) : state.finalizing ? (
                <div className="blinking">Finalisation...</div>
            ) : (
                 <RecorderControls
                     recording={video.recording}
                     paused={video.paused}
                     recorder={__.recorder}
                     starting={video.preRecording}
                     onFinalize={(value) => setState((prev) => ({...prev, finalizing: value}))}
                 />
             )}
            <span className="video-recorder-spacer"/>
            <WaTooltip for="video-recorder-cancel" placement="top">{'Cancel'}</WaTooltip>
            <WaButton
                id="video-recorder-cancel"
                appearance="plain"
                variant="brand"
                size="s"
                onPointerDown={handleCancel}
                disabled={video.preRecording}
                className="video-recorder-action lgs-cancel-recording"
            >
                <WaIcon name="xmark" variant="regular"/>
            </WaButton>
        </WaCard>
    )
}
