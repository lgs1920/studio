/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayRecordingMonitorWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Widget} from '@Components/MainUI/widgets/Widget'
import '@Components/MainUI/video/style.css'
import {captureReplayCropSnapshot} from '@Core/ui/ReplayCropSnapshot'
import {
    getReplayRecordingMonitorSnapshot,
    stopReplayRecordingMonitor,
    subscribeReplayRecordingMonitor,
    updateReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'
import {isDocumentPictureInPictureSupported} from '@Core/ui/widget-manager/WidgetWindowManager'
import {LGS_TOOLBAR, REPLAY_RECORDING_MONITOR_WIDGET_ID} from '@Core/constants'
import {LGS1920_ICON_LIBRARY} from '@Utils/useWebAwesomeKits'
import {WaButton, WaIcon, WaProgressBar, WaTooltip} from '@web.awesome.me/webawesome-pro/dist/react'
import {createPortal} from 'react-dom'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {useSnapshot} from 'valtio'
import './replay-recording-monitor.css'

const MONITOR_WIDGET_POSITION_KEY = 'replay-recording-monitor-window-v5'
const MONITOR_WIDGET_Z_INDEX = 11800
const RECORDING_PICTURE_IN_PICTURE_WIDTH = 480
const RECORDING_PICTURE_IN_PICTURE_HEIGHT = 400
const RECORDING_EXTERNAL_WINDOW_BOOTSTRAP_URL = import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}src/external-window-bootstrap.js`
    : `${import.meta.env.BASE_URL}assets/js/external-window-bootstrap.js`
const RECORDING_EXTERNAL_WINDOW_PRELOAD_ATTRIBUTE = 'data-replay-recording-pip-preload'

/**
 * Warm the external document bootstrap while the recording monitor is visible.
 *
 * @returns {void} Nothing.
 */
const preloadPictureInPictureResources = () => {
    if (typeof document === 'undefined' || !document.head) {
        return
    }
    if (document.head.querySelector(`[${RECORDING_EXTERNAL_WINDOW_PRELOAD_ATTRIBUTE}]`)) {
        return
    }

    const preload = document.createElement('link')
    preload.rel = 'modulepreload'
    preload.href = RECORDING_EXTERNAL_WINDOW_BOOTSTRAP_URL
    preload.setAttribute(RECORDING_EXTERNAL_WINDOW_PRELOAD_ATTRIBUTE, '')
    document.head.appendChild(preload)
}

preloadPictureInPictureResources()

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
 * Prepare a Document Picture-in-Picture document for the recording surface.
 *
 * @param {Window|null} externalWindow - Document Picture-in-Picture window.
 * @returns {HTMLElement|null} External body used by the React portal.
 */
const preparePictureInPictureDocument = externalWindow => {
    const externalDocument = externalWindow?.document
    if (!externalDocument || typeof document === 'undefined') {
        return null
    }

    externalDocument.documentElement.className = document.documentElement.className
    externalDocument.documentElement.style.visibility = 'hidden'
    Object.entries(document.documentElement.dataset).forEach(([key, value]) => {
        externalDocument.documentElement.dataset[key] = value
    })
    externalDocument.title = 'LGS1920 - Recording'
    externalDocument.head.replaceChildren()

    const base = externalDocument.createElement('base')
    base.href = document.baseURI
    externalDocument.head.appendChild(base)

    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(source => {
        externalDocument.head.appendChild(source.cloneNode(true))
    })

    const bootstrap = externalDocument.createElement('script')
    bootstrap.type = 'module'
    bootstrap.src = RECORDING_EXTERNAL_WINDOW_BOOTSTRAP_URL
    bootstrap.addEventListener('error', () => {
        externalDocument.documentElement.style.visibility = ''
    }, {once: true})
    externalDocument.head.appendChild(bootstrap)

    externalDocument.body.replaceChildren()
    externalDocument.body.className = ''
    externalDocument.body.style.margin = '0'
    externalDocument.body.style.width = '100%'
    externalDocument.body.style.height = '100%'
    externalDocument.body.style.overflow = 'hidden'
    externalDocument.body.style.backgroundColor = 'transparent'
    Object.entries(document.body.dataset).forEach(([key, value]) => {
        externalDocument.body.dataset[key] = value
    })
    return externalDocument.body
}

/**
 * Build a readable action button with the project's icon and tooltip pattern.
 *
 * @param {Object} props - Button properties.
 * @param {string} props.id - Stable DOM id used by the tooltip.
 * @param {string} props.label - Accessible and tooltip label.
 * @param {string} props.icon - Font Awesome icon name.
 * @param {string} [props.library] - Optional icon library name.
 * @param {string} [props.className] - Additional button class names.
 * @returns {JSX.Element} Icon-only button.
 */
const MonitorIconButton = ({id, label, icon, library, className = '', ...buttonProps}) => (
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
            <WaIcon {...(library ? {library} : {})} name={icon} variant="regular" label={label}/>
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
 * Display normal Replay transport or the latest composed Interactive/HQ frame in a
 * host-managed widget outside the captured video widget board.
 *
 * @param {Object} props - Monitor properties.
 * @param {Object} props.snapshot - External monitor snapshot.
 * @returns {JSX.Element|null} Monitor widget content.
 */
const ReplayRecordingMonitorSurface = ({snapshot}) => {
    const video = useSnapshot(lgs.stores.ui.video)
    const _canvas = useRef(null)
    const _pictureInPictureWindow = useRef(null)
    const _pictureInPictureCleanup = useRef(null)
    const [pictureInPictureWindow, setPictureInPictureWindow] = useState(null)
    const recordingActive = snapshot.active === true

    useEffect(() => {
        if (recordingActive) {
            preloadPictureInPictureResources()
        }
    }, [recordingActive])

    const handlePictureInPictureClosed = useCallback((externalWindow) => {
        if (_pictureInPictureWindow.current !== externalWindow) {
            return
        }

        _pictureInPictureCleanup.current?.()
        _pictureInPictureCleanup.current = null
        _pictureInPictureWindow.current = null
        setPictureInPictureWindow(null)
    }, [])

    const closePictureInPicture = useCallback(() => {
        const externalWindow = _pictureInPictureWindow.current
        if (!externalWindow) {
            return
        }

        _pictureInPictureCleanup.current?.()
        _pictureInPictureCleanup.current = null
        _pictureInPictureWindow.current = null
        setPictureInPictureWindow(null)
        externalWindow.close?.()
    }, [])

    const monitorConfig = useMemo(() => ({
        id:             REPLAY_RECORDING_MONITOR_WIDGET_ID,
        container:      pictureInPictureWindow?.document?.documentElement
                        ?? (typeof document !== 'undefined' ? document.documentElement : null),
        boundsContainer: pictureInPictureWindow?.document?.documentElement
                         ?? (typeof document !== 'undefined' ? document.documentElement : null),
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
        min:            {width: 360, height: 280},
        max:            {width: 1280, height: 900},
        preserveChildrenWhenCollapsed: true,
        contextMenu:    {
            canRemove:   false,
            canEdit:     false,
            canSnapshot: false,
            canPosition: true,
        },
        zIndex:         MONITOR_WIDGET_Z_INDEX,
    }), [pictureInPictureWindow])

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

    useEffect(() => () => closePictureInPicture(), [closePictureInPicture])

    useLayoutEffect(() => {
        const externalDocument = pictureInPictureWindow?.document
        if (!externalDocument?.documentElement) {
            return undefined
        }

        externalDocument.documentElement.style.visibility = ''
        return undefined
    }, [pictureInPictureWindow])

    const requestPictureInPicture = useCallback(async () => {
        if (!isDocumentPictureInPictureSupported()) {
            return
        }

        try {
            const externalWindow = await globalThis.documentPictureInPicture.requestWindow({
                width:  RECORDING_PICTURE_IN_PICTURE_WIDTH,
                height: RECORDING_PICTURE_IN_PICTURE_HEIGHT,
            })
            const body = preparePictureInPictureDocument(externalWindow)
            if (!body) {
                externalWindow.close?.()
                return
            }

            closePictureInPicture()
            const handleClosed = () => handlePictureInPictureClosed(externalWindow)
            externalWindow.addEventListener?.('pagehide', handleClosed, {once: true})
            externalWindow.addEventListener?.('unload', handleClosed, {once: true})
            _pictureInPictureCleanup.current = () => {
                externalWindow.removeEventListener?.('pagehide', handleClosed)
                externalWindow.removeEventListener?.('unload', handleClosed)
            }
            _pictureInPictureWindow.current = externalWindow
            setPictureInPictureWindow(externalWindow)
        }
        catch {
            // The inline monitor remains available when Document PiP is rejected.
        }
    }, [closePictureInPicture, handlePictureInPictureClosed])

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

    const stopRecording = useCallback(async () => {
        closePictureInPicture()
        try {
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
        }
        finally {
            stopReplayRecordingMonitor()
        }
    }, [closePictureInPicture, snapshot.mode])

    const takeSnapshot = useCallback(() => {
        void captureReplayCropSnapshot()
    }, [])

    if (!recordingActive) {
        return null
    }

    const totalVideoDuration = Number.isFinite(Number(snapshot.videoDurationMillis))
                               ? Math.max(0, Number(snapshot.videoDurationMillis))
                               : null
    const progressValue = snapshot.mode === 'interactive' && totalVideoDuration > 0
                          ? Math.max(0, Math.min(1, snapshot.elapsedMillis / totalVideoDuration))
                          : snapshot.progress
    const progress = Math.round(progressValue * 100)
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
    const title = isFinalizing ? 'Finalizing' : (isPreparing ? 'Preparing' : 'Recording')
    const titleClassName = isPreparing || isFinalizing ? ' blinking' : ''
    const surface = (
        <aside
            className={`replay-recording-monitor lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map is-recording${pictureInPictureWindow ? ' is-picture-in-picture' : ''}`}
            aria-live="polite"
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
                    {title}
                </span>
            </div>
            {recordingActive && (
                <>
                    <div className="replay-recording-monitor-preview">
                        <canvas ref={_canvas} aria-label="Latest encoded recording frame"/>
                    </div>
                    <div className="replay-recording-monitor-metrics">
                        <span className="replay-recording-monitor-metric-remaining" title="Remaining time">
                            <WaIcon name="stopwatch" variant="regular" label="Remaining time"/>
                            <strong className="replay-recording-monitor-remaining-value">{remainingLabel}</strong>
                        </span>
                        <span className="replay-recording-monitor-metric-duration" title="Generated video duration">
                            <WaIcon name="films" variant="regular" label="Generated video duration"/>
                            {generatedVideoLabel}
                        </span>
                        <span className="replay-recording-monitor-metric-size" title="Encoded size">
                            <WaIcon name="hard-drive" variant="regular" label="Encoded size"/>
                            {formatBytes(snapshot.size)}
                        </span>
                    </div>
                    <ReplayRecordingProgress percentage={progress}/>
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
                                label={snapshot.mode === 'hq' ? 'Cancel Replay export' : 'Stop recording'}
                                icon="stop"
                                appearance="plain"
                                onClick={stopRecording}
                            />
                        </div>
                        <div className="replay-recording-monitor-control-group replay-recording-monitor-control-group-end">
                            {pictureInPictureWindow ? (
                                <MonitorIconButton
                                    id="replay-monitor-pip-close"
                                    label="Close Recording window in Picture-in-Picture"
                                    icon="picture-in-picture-out"
                                    library={LGS1920_ICON_LIBRARY}
                                    appearance="plain"
                                    onClick={closePictureInPicture}
                                />
                            ) : isDocumentPictureInPictureSupported() && (
                                <MonitorIconButton
                                    id="replay-monitor-pip"
                                    label="Open Recording window in Picture-in-Picture"
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
        >
            {surface}
        </Widget>
    )

    const widgetHost = pictureInPictureWindow?.document?.body
                       ?? (typeof document !== 'undefined' ? document.body : null)

    return widgetHost
           ? createPortal(widget, widgetHost)
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
