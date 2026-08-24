import {JourneyReplayProgressBar} from '@Components/JourneyReplay/JourneyReplayProgressBar'
import '@Components/JourneyReplay/style.css'
import {Widget} from '@Components/MainUI/widgets/Widget'
import '@Components/MainUI/video/style.css'
import {captureReplayCropSnapshot} from '@Core/ui/ReplayCropSnapshot'
import {
    getReplayRecordingMonitorSnapshot,
    stopReplayRecordingMonitor,
    subscribeReplayRecordingMonitor,
    updateReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'
import {LGS_TOOLBAR, REPLAY_RECORDING_MONITOR_WIDGET_ID} from '@Core/constants'
import {WaButton, WaDivider, WaIcon, WaProgressBar, WaTooltip} from '@web.awesome.me/webawesome-pro/dist/react'
import {createPortal} from 'react-dom'
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {useSnapshot} from 'valtio'
import './replay-recording-monitor.css'

const MONITOR_WIDGET_POSITION_KEY = 'replay-recording-monitor-window-v3'
const MONITOR_WIDGET_Z_INDEX = 11800

/**
 * Format a duration in milliseconds for compact monitor output.
 *
 * @param {number|null} milliseconds - Duration to format.
 * @returns {string} Formatted duration.
 */
const formatDuration = milliseconds => {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000 || 0))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const minuteLabel = String(minutes).padStart(2, '0')
    const secondLabel = String(seconds).padStart(2, '0')

    return hours > 0
           ? `${String(hours).padStart(2, '0')}:${minuteLabel}:${secondLabel}`
           : `${minuteLabel}:${secondLabel}`
}

/**
 * Format encoded bytes for the compact monitor metrics row.
 *
 * @param {number|null} bytes - Encoded byte count.
 * @returns {string} Formatted byte count.
 */
const formatBytes = bytes => {
    const value = Number(bytes) || 0
    if (value < 1024) {
        return `${value} B`
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Exit Picture-in-Picture when the supplied monitor video owns it.
 *
 * @param {HTMLVideoElement|null} video - Monitor video element.
 * @returns {Promise<void>} Completion of the exit request.
 */
const closePictureInPicture = async video => {
    if (!video || typeof document === 'undefined' || document.pictureInPictureElement !== video) {
        return
    }
    if (typeof document.exitPictureInPicture !== 'function') {
        return
    }

    try {
        await document.exitPictureInPicture()
    }
    catch {
        // The browser can already have closed PiP while the recording is stopping.
    }
}

/**
 * Check whether the current browser exposes usable Picture-in-Picture support.
 *
 * @returns {boolean} True when the document and video element support PiP.
 */
const isPictureInPictureSupported = () => (
    typeof document !== 'undefined'
    && document.pictureInPictureEnabled === true
    && typeof globalThis.HTMLVideoElement?.prototype?.requestPictureInPicture === 'function'
)

/**
 * Build a readable action button with the project's icon and tooltip pattern.
 *
 * @param {Object} props - Button properties.
 * @param {string} props.id - Stable DOM id used by the tooltip.
 * @param {string} props.label - Accessible and tooltip label.
 * @param {string} props.icon - Font Awesome icon name.
 * @param {string} [props.className] - Additional button class names.
 * @returns {JSX.Element} Icon-only button.
 */
const MonitorIconButton = ({id, label, icon, className = '', ...buttonProps}) => (
    <span className="replay-recording-monitor-button-wrapper lgs-widget-no-drag">
        <WaTooltip for={id}>{label}</WaTooltip>
        <WaButton
            id={id}
            className={`replay-recording-monitor-icon-button lgs-widget-no-drag${className ? ` ${className}` : ''}`}
            size="s"
            title={label}
            aria-label={label}
            {...buttonProps}
        >
            <WaIcon name={icon} variant="regular" label={label}/>
        </WaButton>
    </span>
)

/**
 * Display recording progress with the current percentage inside the bar.
 *
 * @param {Object} props - Progress properties.
 * @param {number} props.percentage - Rounded progress percentage.
 * @returns {JSX.Element} Web Awesome progress bar.
 */
const ReplayRecordingProgress = ({percentage}) => (
    <WaProgressBar
        className="replay-recording-progress"
        value={percentage}
        label={`Recording progress: ${percentage}%`}
    >
        {percentage}%
    </WaProgressBar>
)

/**
 * Display normal Replay transport or the latest composed Draft/HQ frame in a
 * host-managed widget outside the captured video widget board.
 *
 * @param {Object} props - Monitor properties.
 * @param {Object} props.snapshot - External monitor snapshot.
 * @returns {JSX.Element|null} Monitor widget content.
 */
const ReplayRecordingMonitorSurface = ({snapshot}) => {
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot(lgs.stores.ui.video)
    const _canvas = useRef(null)
    const _video = useRef(null)
    const _stream = useRef(null)
    const _pictureInPictureActive = useRef(false)
    const [expandRequestKey, setExpandRequestKey] = useState(null)
    const [closed, setClosed] = useState(false)
    const recordingActive = snapshot.active === true
    const videoCaptureActive = video.editing
                               || video.preRecording
                               || video.recording
                               || video.recordingHQ
                               || video.snapshot
                               || video.finalizing
    const replayControlsVisible = !recordingActive
                                  && replay.recordingSync !== true
                                  && !videoCaptureActive
                                  && (replay.toolbarVisible || replay.active || replay.paused)

    const closeMonitorWidget = useCallback(() => {
        setClosed(true)
    }, [])

    const monitorConfig = useMemo(() => ({
        id:             REPLAY_RECORDING_MONITOR_WIDGET_ID,
        container:      typeof document !== 'undefined' ? document.documentElement : null,
        boundsContainer: typeof document !== 'undefined' ? document.documentElement : null,
        top:            '100%',
        left:           '100%',
        attachTo:       'bottom-right',
        icon:           'clapperboard-play',
        margin:         lgs.gutter?.s ?? 8,
        opacity:        lgs.settings?.ui?.toolbars?.opacity ?? 1,
        type:           LGS_TOOLBAR,
        persist:        true,
        positionKey:    MONITOR_WIDGET_POSITION_KEY,
        showControlBox: true,
        locked:         false,
        mandatory:      false,
        transient:      true,
        canReduce:      true,
        resizable:      true,
        min:            {width: 360, height: 380},
        max:            {width: 1280, height: 900},
        preserveChildrenWhenCollapsed: true,
        onRemove:       closeMonitorWidget,
        contextMenu:    {
            canRemove:   false,
            canEdit:     false,
            canSnapshot: false,
            canPosition: true,
        },
        zIndex:         MONITOR_WIDGET_Z_INDEX,
    }), [closeMonitorWidget])

    useEffect(() => {
        const canvas = _canvas.current
        const source = snapshot.frameCanvas
        if (!canvas || !(source instanceof HTMLCanvasElement)) {
            return
        }

        if (canvas.width !== source.width || canvas.height !== source.height) {
            canvas.width = source.width
            canvas.height = source.height
        }
        const context = canvas.getContext('2d', {alpha: false})
        context?.drawImage(source, 0, 0, source.width, source.height)
    }, [snapshot.frameCanvas, snapshot.frameVersion])

    useEffect(() => {
        const canvas = _canvas.current
        const monitorVideo = _video.current
        if (!snapshot.active || !canvas || !monitorVideo || typeof canvas.captureStream !== 'function') {
            return undefined
        }

        const stream = canvas.captureStream(30)
        _stream.current = stream
        monitorVideo.srcObject = stream
        monitorVideo.muted = true
        monitorVideo.playsInline = true
        const handleEnterPictureInPicture = () => {
            _pictureInPictureActive.current = true
        }
        const handleLeavePictureInPicture = () => {
            _pictureInPictureActive.current = false
        }
        monitorVideo.addEventListener('enterpictureinpicture', handleEnterPictureInPicture)
        monitorVideo.addEventListener('leavepictureinpicture', handleLeavePictureInPicture)
        void monitorVideo.play().catch(() => undefined)

        return () => {
            monitorVideo.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture)
            monitorVideo.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture)
            void closePictureInPicture(monitorVideo)
            stream.getTracks().forEach(track => track.stop())
            if (monitorVideo.srcObject === stream) {
                monitorVideo.srcObject = null
            }
            if (_stream.current === stream) {
                _stream.current = null
            }
            _pictureInPictureActive.current = false
        }
    }, [snapshot.active])

    useEffect(() => {
        if (!snapshot.active) {
            return undefined
        }

        const expandWhenReturningToStudio = () => {
            const monitorVideo = _video.current
            const pictureInPictureActive = _pictureInPictureActive.current
                                         || document.pictureInPictureElement === monitorVideo
            if (document.visibilityState === 'visible' && pictureInPictureActive) {
                setExpandRequestKey(value => value + 1)
            }
        }

        document.addEventListener('visibilitychange', expandWhenReturningToStudio)
        window.addEventListener('focus', expandWhenReturningToStudio)
        return () => {
            document.removeEventListener('visibilitychange', expandWhenReturningToStudio)
            window.removeEventListener('focus', expandWhenReturningToStudio)
        }
    }, [snapshot.active])

    const requestPictureInPicture = useCallback(async () => {
        const monitorVideo = _video.current
        if (!isPictureInPictureSupported() || !monitorVideo) {
            return
        }
        try {
            await monitorVideo.requestPictureInPicture()
            _pictureInPictureActive.current = true
        }
        catch {
            // The inline monitor remains available when PiP is unsupported or rejected.
        }
    }, [])

    const togglePause = useCallback(() => {
        if (snapshot.mode === 'hq') {
            const runtime = globalThis.lgs?.stores?.replay?.deferredExportPlan?.runtime
            if (snapshot.paused) {
                runtime?.resumeExport?.()
            }
            else {
                runtime?.pauseExport?.()
            }
        }
        else if (snapshot.paused) {
            globalThis.__?.recorder?.resumeVideo?.()
        }
        else {
            globalThis.__?.recorder?.pauseVideo?.()
        }
        updateReplayRecordingMonitor({paused: !snapshot.paused})
    }, [snapshot.mode, snapshot.paused])

    const cancelRecording = useCallback(async () => {
        const monitorVideo = _video.current
        void closePictureInPicture(monitorVideo)
        if (snapshot.mode === 'hq') {
            globalThis.lgs?.stores?.replay?.deferredExportPlan?.runtime?.abortExport?.()
        }
        else {
            await globalThis.__?.recorder?.cancelVideo?.()
        }
        stopReplayRecordingMonitor()
    }, [snapshot.mode])

    const stopRecording = useCallback(async () => {
        const monitorVideo = _video.current
        void closePictureInPicture(monitorVideo)
        if (snapshot.mode === 'hq') {
            globalThis.lgs?.stores?.replay?.deferredExportPlan?.runtime?.abortExport?.()
        }
        else {
            const videoStore = globalThis.lgs?.stores?.ui?.video
            if (videoStore) {
                videoStore.finalizing = true
            }
            await globalThis.__?.recorder?.stopVideo?.()
        }
    }, [snapshot.mode])

    const takeSnapshot = useCallback(() => {
        void captureReplayCropSnapshot()
    }, [])

    if ((!recordingActive && !replayControlsVisible) || (recordingActive && closed)) {
        return null
    }

    const totalVideoDuration = Number.isFinite(Number(snapshot.videoDurationMillis))
                               ? Math.max(0, Number(snapshot.videoDurationMillis))
                               : null
    const progressValue = snapshot.mode === 'draft' && totalVideoDuration > 0
                          ? Math.max(0, Math.min(1, snapshot.elapsedMillis / totalVideoDuration))
                          : snapshot.progress
    const progress = Math.round(progressValue * 100)
    const frameMetricAvailable = Number(snapshot.frameCount) > 0
    const frameLabel = `${snapshot.processedFrames}/${snapshot.frameCount}`
    const generatedVideoDuration = snapshot.mode === 'hq' && totalVideoDuration !== null
                                   ? totalVideoDuration * progressValue
                                   : snapshot.elapsedMillis
    const remainingMillis = snapshot.estimatedRemainingMillis !== null
                            ? snapshot.estimatedRemainingMillis
                            : (totalVideoDuration !== null
                                ? Math.max(0, totalVideoDuration - generatedVideoDuration)
                                : null)
    const remainingLabel = remainingMillis === null ? '--:--' : formatDuration(remainingMillis)
    const generatedVideoLabel = totalVideoDuration === null
                                ? formatDuration(generatedVideoDuration)
                                : `${formatDuration(generatedVideoDuration)} / ${formatDuration(totalVideoDuration)}`
    const isPreparing = snapshot.phase === 'preparing' || (snapshot.mode !== 'hq' && video.preRecording)
    const isFinalizing = snapshot.phase === 'finalizing'
                         || (snapshot.mode !== 'hq' && video.finalizing)
                         || progress >= 100
    const indicatorState = isFinalizing
                          ? 'finalizing'
                          : (isPreparing ? 'preparing' : 'recording')
    const indicatorAnimation = 'beat-fade'
    const title = !recordingActive
                  ? 'Replay'
                  : (isFinalizing ? 'Finalizing' : (isPreparing ? 'Preparing' : 'Recording'))
    const titleClassName = isPreparing || isFinalizing ? ' blinking' : ''
    const surface = (
        <aside
            className={`replay-recording-monitor lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map${recordingActive ? ' is-recording' : ' is-replay-controls'}`}
            aria-live={recordingActive ? 'polite' : 'off'}
        >
            <div className="replay-recording-monitor-header">
                {recordingActive && (
                    <WaIcon
                        name="circle"
                        family="duotone"
                        variant="regular"
                        animation={snapshot.paused ? 'fade' : indicatorAnimation}
                        className={`video-recorder-indicator ${indicatorState}${snapshot.paused ? ' paused' : ''}`}
                        label={snapshot.phase ?? 'Recording'}
                    />
                )}
                <span className={`replay-recording-monitor-title${titleClassName}`}>
                    {!recordingActive && <WaIcon name="clapperboard-play" variant="regular" label={title}/>}
                    {title}
                </span>
                {recordingActive && (
                    <MonitorIconButton
                        id="replay-monitor-cancel"
                        label="Cancel recording"
                        icon="xmark"
                        className="replay-recording-monitor-cancel-button"
                        appearance="plain"
                        variant="danger"
                        onClick={cancelRecording}
                    />
                )}
            </div>
            {!recordingActive && (
                <div className="replay-recording-monitor-replay-controls replay-controls">
                    <JourneyReplayProgressBar showSettings/>
                </div>
            )}
            {recordingActive && (
                <>
                    <div className="replay-recording-monitor-preview">
                        <canvas ref={_canvas} aria-label="Latest encoded recording frame"/>
                        <video ref={_video} muted playsInline aria-hidden="true"/>
                    </div>
                    <div className="replay-recording-monitor-status">
                        <span className="replay-recording-monitor-remaining">
                            <WaIcon name="stopwatch" variant="regular" label="Remaining time"/>
                            <strong className="replay-recording-monitor-remaining-value">{remainingLabel}</strong>
                        </span>
                    </div>
                    <ReplayRecordingProgress percentage={progress}/>
                    <div className="replay-recording-monitor-metrics">
                        {frameMetricAvailable
                            ? (
                                <span className="replay-recording-monitor-metric-frames" title="Processed frames">
                                    <WaIcon name="images" variant="regular" label="Processed frames"/>
                                    {frameLabel}
                                </span>
                            )
                            : <span className="replay-recording-monitor-metric-frames is-placeholder" aria-hidden="true"/>}
                        <span className="replay-recording-monitor-metric-duration" title="Generated video duration">
                            <WaIcon name="films" variant="regular" label="Generated video duration"/>
                            {generatedVideoLabel}
                        </span>
                        <span className="replay-recording-monitor-metric-size" title="Encoded size">
                            <WaIcon name="hard-drive" variant="regular" label="Encoded size"/>
                            {formatBytes(snapshot.size)}
                        </span>
                    </div>
                    <WaDivider className="replay-recording-monitor-divider"/>
                    <div className="replay-recording-monitor-controls">
                        <div className="replay-recording-monitor-control-group replay-recording-monitor-control-group-start">
                            <MonitorIconButton
                                id="replay-monitor-snapshot"
                                label="Take replay snapshot"
                                icon="camera"
                                appearance="plain"
                                onClick={takeSnapshot}
                            />
                        </div>
                        <div className="replay-recording-monitor-control-group replay-recording-monitor-control-group-center">
                            <MonitorIconButton
                                id="replay-monitor-pause"
                                label={snapshot.paused ? 'Resume recording' : 'Pause recording'}
                                icon={snapshot.paused ? 'play' : 'pause'}
                                appearance="plain"
                                onClick={togglePause}
                            />
                            <MonitorIconButton
                                id="replay-monitor-stop"
                                label={snapshot.mode === 'hq' ? 'Cancel HQ export' : 'Stop recording'}
                                icon="stop"
                                appearance="plain"
                                onClick={stopRecording}
                            />
                        </div>
                        <div className="replay-recording-monitor-control-group replay-recording-monitor-control-group-end">
                            {isPictureInPictureSupported() && (
                                <MonitorIconButton
                                    id="replay-monitor-pip"
                                    label="Open recording monitor in Picture-in-Picture"
                                    icon="picture-in-picture"
                                    appearance="plain"
                                    onClick={requestPictureInPicture}
                                />
                            )}
                        </div>
                    </div>
                </>
            )}
        </aside>
    )
    const widget = (
        <Widget
            isVisible={true}
            className="replay-recording-monitor-widget-shell"
            config={monitorConfig}
            expandRequestKey={expandRequestKey}
        >
            {surface}
        </Widget>
    )

    return typeof document !== 'undefined' && document.body
           ? createPortal(widget, document.body)
           : widget
}

/**
 * Subscribe to the recording monitor and remount its transient lifecycle per
 * replay/recording mode.
 *
 * @returns {JSX.Element} Unified monitor widget.
 */
export const ReplayRecordingMonitorWidget = () => {
    const snapshot = useSyncExternalStore(
        subscribeReplayRecordingMonitor,
        getReplayRecordingMonitorSnapshot,
        getReplayRecordingMonitorSnapshot,
    )
    const surfaceKey = snapshot.active ? 'recording' : 'replay'

    return <ReplayRecordingMonitorSurface key={surfaceKey} snapshot={snapshot}/>
}
