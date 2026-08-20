/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-08-19
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyReplayButton } from '@Components/JourneyReplay/JourneyReplayButton'
import { LGSPopup } from '@Components/LGSPopup'
import { CropRatioEditorToolbar } from '@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar'
import { VideoPresetToolbar } from '@Components/MainUI/video/toolbox/VideoPresetToolbar'
import { cancelVideoEditing, prepareVideoCaptureUi, prepareVideoEditingUi } from '@Components/MainUI/video/videoEditingCleanup'
import { VIDEO_CROP_ZONE } from '@Core/constants'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import '../style.css'

const RATIO_POPUP = 'ratio'
const VIDEO_PRESET_POPUP = 'video-preset'

/**
 * VideoRecordingSettingsToolbar renders the horizontal video setup HUD.
 * @component
 */
export const VideoRecordingSettingsToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const $cropper = $video.cropper
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot($video)
    const [openPopup, setOpenPopup] = useState(null)
    const [popupDirections, setPopupDirections] = useState({ratio: 'top', preset: 'top'})
    const _cropSyncPromise = useRef(null)
    const shouldShowToolbar = video.editing === true
                              && !video.preRecording
                              && !video.recording
                              && !video.snapshot
                              && !video.finalizing

    const currentRatio = lgs.configuration.videoFormats.find(format => format.value === video.ratio)
    const currentQuality = ScreenMediaRecorder.QUALITY[video.quality]?.short ?? 'M'
    const currentFPS = ScreenMediaRecorder.FPS[video.fps] ?? ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]

    /**
     * Persists the live crop before leaving the video editor or starting capture.
     * @param {string} phase - Synchronization phase used for diagnostics.
     * @returns {Promise<unknown>} Crop synchronization promise.
     */
    const syncCropFrame = useCallback((phase = 'sync') => {
        if (_cropSyncPromise.current) {
            return _cropSyncPromise.current
        }

        let promise
        try {
            promise = Promise.resolve(__.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, true, phase))
        }
        catch (error) {
            promise = Promise.reject(error)
        }

        _cropSyncPromise.current = promise
        promise.then(
            () => {
                if (_cropSyncPromise.current === promise) {
                    _cropSyncPromise.current = null
                }
            },
            () => {
                if (_cropSyncPromise.current === promise) {
                    _cropSyncPromise.current = null
                }
            },
        )

        return promise
    }, [])

    /**
     * Opens or closes one of the HUD popups.
     * @param {string} popup - Popup identifier.
     */
    const togglePopup = useCallback((popup) => {
        setOpenPopup(current => current === popup ? null : popup)
    }, [])

    /**
     * Keeps the trigger caret aligned with the popup's actual placement after a flip.
     * @param {'ratio'|'preset'} popup - Popup identifier.
     * @param {CustomEvent} event - Popup reposition event.
     */
    const handlePopupReposition = useCallback((popup, event) => {
        const side = event.currentTarget?.getAttribute('data-current-placement')?.split('-')[0]
        if (!side) {
            return
        }
        setPopupDirections(current => current[popup] === side ? current : {...current, [popup]: side})
    }, [])

    const getCaretIcon = side => ({
        top:    'chevron-up',
        bottom: 'chevron-down',
        left:   'chevron-left',
        right:  'chevron-right',
    }[side] ?? 'chevron-up')

    /**
     * Persists the crop and cancels video setup.
     * @returns {Promise<void>} Completion promise.
     */
    const handleCancel = useCallback(async () => {
        await syncCropFrame('editing-exit')
        cancelVideoEditing()
    }, [syncCropFrame])

    /**
     * Starts video capture after the current crop has been persisted.
     * @returns {Promise<void>} Completion promise.
     */
    const handleVideoRecording = useCallback(async () => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        await syncCropFrame('before-recording')
        prepareVideoCaptureUi()
        Object.assign($video, {
            editing:      false,
            preRecording: true,
            recording:    false,
            finalizing:   false,
            paused:       false,
        })
    }, [$video, syncCropFrame])

    useEffect(() => {
        const safeFPS = Number.isInteger(lgs.settings.ui.video?.fps)
            && lgs.settings.ui.video.fps >= 0
            && lgs.settings.ui.video.fps < ScreenMediaRecorder.FPS.length
            ? lgs.settings.ui.video.fps
            : ScreenMediaRecorder.DEFAULT_FPS_INDEX
        const safeQuality = Number.isInteger(lgs.settings.ui.video?.quality)
            && lgs.settings.ui.video.quality >= 0
            && lgs.settings.ui.video.quality < ScreenMediaRecorder.QUALITY.length
            ? lgs.settings.ui.video.quality
            : ScreenMediaRecorder.DEFAULT_QUALITY_INDEX

        if ($video.fps !== safeFPS) {
            $video.fps = safeFPS
        }
        if ($video.quality !== safeQuality) {
            $video.quality = safeQuality
        }
        if (lgs.settings.ui.video.fps !== safeFPS) {
            lgs.settings.ui.video.fps = safeFPS
        }
        if (lgs.settings.ui.video.quality !== safeQuality) {
            lgs.settings.ui.video.quality = safeQuality
        }
    }, [$video])

    /**
     * Keeps crop editing enabled while the setup HUD is visible.
     */
    useEffect(() => {
        if (!shouldShowToolbar) {
            return
        }

        prepareVideoEditingUi()
        Object.assign($cropper, {
            ratioEditor:  true,
            presetEditor: true,
            widgetEditor: true,
        })
        __.ui.widgetManager.windowResizing = true
    }, [$cropper, shouldShowToolbar])

    useEffect(() => {
        if (!shouldShowToolbar || replay.recordingSync !== true) {
            return undefined
        }

        let cancelled = false
        let raf = 0

        const centerCropZone = () => {
            if (cancelled) {
                return
            }

            const element = __.ui.widgetManager.getElementById(VIDEO_CROP_ZONE)
            if (!element) {
                raf = requestAnimationFrame(centerCropZone)
                return
            }

            __.ui.widgetManager.toCenter(element, 0)
            void syncCropFrame('replay-sync-center')
        }

        raf = requestAnimationFrame(centerCropZone)

        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
        }
    }, [replay.recordingSync, shouldShowToolbar, syncCropFrame])

    if (!shouldShowToolbar) {
        return null
    }

    const leadingAction = replay.recordingSync === true && Boolean(lgs.theJourney) ? (
        <JourneyReplayButton
            id="launch-the-replay-editor-from-video"
            tooltip="top"
            tooltipText="Journey Replay Settings"
            tooltipPlacement="top"
            tooltipStyle="wa"
            variant="brand"
            appearance="plain"
            className="video-recording-settings-replay"
            showOnlyWhenLinked
            ariaLabel="Journey Replay Settings"
        />
    ) : null

    return (
        <div className="video-recording-settings-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
            <div className="video-recording-settings-menu" role="toolbar" aria-label="Video recording settings">
                <WaButton
                    id="video-ratio-settings-trigger"
                    size="s"
                    appearance={openPopup === RATIO_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(RATIO_POPUP)}
                >
                    <WaIcon name="crop-simple" label=""/>
                    <span>{`Ratio: ${currentRatio?.label ?? video.ratio}`}</span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.ratio)} variant="solid" label=""/>
                </WaButton>

                <LGSPopup
                    anchor="video-ratio-settings-trigger"
                    active={openPopup === RATIO_POPUP}
                    onRequestClose={() => setOpenPopup(null)}
                    outsideAnchors={['video-quality-fps-settings-trigger']}
                    placement="top-start"
                    distance={4}
                    strategy="fixed"
                    onWaReposition={event => handlePopupReposition('ratio', event)}
                >
                    <CropRatioEditorToolbar context={$cropper} cropzoneId={VIDEO_CROP_ZONE} embedded/>
                </LGSPopup>

                <WaButton
                    id="video-quality-fps-settings-trigger"
                    size="s"
                    appearance={openPopup === VIDEO_PRESET_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(VIDEO_PRESET_POPUP)}
                >
                    <WaIcon name="sliders" label=""/>
                    <span>{`Quality: ${currentQuality} · ${currentFPS} FPS`}</span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.preset)} variant="solid" label=""/>
                </WaButton>

                <LGSPopup
                    anchor="video-quality-fps-settings-trigger"
                    active={openPopup === VIDEO_PRESET_POPUP}
                    onRequestClose={() => setOpenPopup(null)}
                    outsideAnchors={['video-ratio-settings-trigger']}
                    placement="top-start"
                    distance={4}
                    strategy="fixed"
                    onWaReposition={event => handlePopupReposition('preset', event)}
                >
                    <div className="video-recording-settings-popup lgs-card wa-theme-lgs1920-on-map">
                        <VideoPresetToolbar embedded/>
                    </div>
                </LGSPopup>

                {leadingAction}

                <WaButton
                    id="video-start-recording"
                    size="s"
                    variant="brand"
                    appearance="plain"
                    className="video-recording-settings-action video-recorder-start-recording"
                    aria-label="Record"
                    onClick={() => void handleVideoRecording()}
                >
                    <WaIcon name="clapperboard-play" label=""/>
                    <span>{'Record'}</span>
                </WaButton>

                <span className="video-recording-settings-cancel-separator" aria-hidden="true"/>

                <WaButton
                    id="video-cancel-editing"
                    size="s"
                    appearance="plain"
                    className="video-recording-settings-cancel"
                    aria-label="Cancel"
                    onClick={() => void handleCancel()}
                >
                    <WaIcon name="xmark" label=""/>
                    <span>{'Cancel'}</span>
                </WaButton>
            </div>
        </div>
    )
})
