/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-08-20
 * Last modified: 2026-09-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSPopup } from '@Components/LGSPopup'
import { cancelVideoEditing, prepareVideoEditingUi } from '@Components/MainUI/video/videoEditingCleanup'
import { VIDEO_CROP_ZONE } from '@Core/constants'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    DEFAULT_SIMPLE_REPLAY_DURATION,
    normalizeSimpleReplayDuration,
    SIMPLE_REPLAY_DURATIONS,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { VideoRecordingSettingsMenuContent } from './VideoRecordingSettingsMenus'
import '../style.css'

const RATIO_POPUP = 'ratio'
const VIDEO_PRESET_POPUP = 'video-preset'
const SIMPLE_SETTINGS_POPUP = 'simple-settings'

/**
 * VideoRecordingSettingsToolbar renders the horizontal video setup HUD.
 * @param {Object} props - Toolbar properties.
 * @param {boolean} [props.mainTheme=false] - Use the main application theme instead of the on-map theme.
 * @param {string} [props.layout='default'] - Presentation layout context.
 * @param {'all'|'actions'|'video-options'} [props.mode='all'] - Controls rendered by the toolbar.
 * @component
 */
export const VideoRecordingSettingsToolbar = memo(({mainTheme = false, layout = 'default', mode = 'all'} = {}) => {
    const $video = lgs.stores.ui.video
    const $cropper = $video.cropper
    const $replay = lgs.stores.replay
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const video = useSnapshot($video)
    const [openPopup, setOpenPopup] = useState(null)
    const [popupDirections, setPopupDirections] = useState({ratio: 'bottom', preset: 'bottom'})
    const _cropSyncPromise = useRef(null)
    const shouldShowToolbar = video.editing === true
                              && !video.preRecording
                              && !video.recording
                              && !video.snapshot
                              && !video.finalizing
    const simplePreparation = replay.simplePreparationActive === true
    const replayPreparation = replay.recordingSync === true || simplePreparation
    const showVideoOptions = mode !== 'actions'
    const showActions = mode !== 'video-options'

    const currentRatio = lgs.configuration.videoFormats.find(format => format.value === video.ratio)
    const fullQualityName = ScreenMediaRecorder.QUALITY[video.quality]?.name?.replace(/\s+Quality$/, '') ?? 'Medium'
    const currentQuality = simplePreparation
        ? ['Med', 'High', 'Ultra'][video.quality] ?? fullQualityName
        : fullQualityName
    const currentFPS = ScreenMediaRecorder.FPS[video.fps] ?? ScreenMediaRecorder.FPS[ScreenMediaRecorder.DEFAULT_FPS_INDEX]
    const simpleDuration = normalizeSimpleReplayDuration(
        replaySettings?.simple?.duration ?? DEFAULT_SIMPLE_REPLAY_DURATION,
    )

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
     * Requests direct HQ export from the linked Replay preparation view.
     * @returns {void} Nothing.
     */
    const handleHqExport = useCallback(() => {
        globalThis.window?.dispatchEvent(new globalThis.CustomEvent('lgs:video:start-hq-export'))
    }, [])

    /**
     * Store the selected Simple Replay duration for playback and export.
     * @param {Event} event - Duration select change event.
     * @returns {void} Nothing.
     */
    const handleSimpleDurationChange = useCallback(value => {
        const duration = normalizeSimpleReplayDuration(value)
        $replay.duration = duration
        lgs.settings.ui.replay.duration = duration
        lgs.settings.ui.replay.simple = {
            ...(lgs.settings.ui.replay.simple ?? {}),
            duration,
        }
    }, [$replay])

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

    const simpleSettingsTrigger = simplePreparation ? (
        <>
            <div className="simple-replay-settings-summary" aria-label="Current Replay settings">
                <span className="simple-replay-settings-summary__item">
                    <WaIcon name="crop-simple" label=""/>
                    <span>{currentRatio?.label ?? video.ratio}</span>
                </span>
                <span className="simple-replay-settings-summary__item">
                    <WaIcon name="ranking-star" label=""/>
                    <span>{`${currentQuality} · ${currentFPS} FPS`}</span>
                </span>
                <span className="simple-replay-settings-summary__item">
                    <WaIcon name="clock" label=""/>
                    <span>{`${simpleDuration}s`}</span>
                </span>
                <WaButton
                    id="simple-replay-settings-trigger"
                    size="s"
                    variant="brand"
                    appearance={openPopup === SIMPLE_SETTINGS_POPUP ? 'outlined' : 'plain'}
                    aria-label="Replay settings"
                    aria-expanded={openPopup === SIMPLE_SETTINGS_POPUP}
                    onClick={() => togglePopup(SIMPLE_SETTINGS_POPUP)}
                >
                    <WaIcon name="gear" variant="regular" label=""/>
                </WaButton>
            </div>
            <LGSPopup
                anchor="simple-replay-settings-trigger"
                active={openPopup === SIMPLE_SETTINGS_POPUP}
                onRequestClose={() => setOpenPopup(null)}
                placement="bottom"
                flip
                shift
                distance={8}
                strategy="fixed"
            >
                <div className={`video-recording-settings-popup video-recording-settings-popup--simple lgs-card ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'}`}>
                    <div className="simple-replay-settings-row" role="group" aria-label="Aspect ratio">
                        <WaIcon name="crop-simple" label=""/>
                        <span className="simple-replay-settings-row__label">{'Ratio'}</span>
                        <VideoRecordingSettingsMenuContent menu="ratio"
                                                           context={$cropper}
                                                           cropzoneId={VIDEO_CROP_ZONE}
                                                           unifiedChoices
                                                           mainTheme={mainTheme}/>
                    </div>
                    <div className="simple-replay-settings-row" role="group" aria-label="Video preset">
                        <WaIcon name="ranking-star" label=""/>
                        <span className="simple-replay-settings-row__label">{'Preset'}</span>
                        <VideoRecordingSettingsMenuContent menu="preset"
                                                           context={$cropper}
                                                           cropzoneId={VIDEO_CROP_ZONE}
                                                           compactSimple
                                                           mainTheme={mainTheme}/>
                    </div>
                    <div className="simple-replay-settings-row" role="group" aria-label="Duration">
                        <WaIcon name="clock" label=""/>
                        <span className="simple-replay-settings-row__label">{'Duration'}</span>
                        <div className="simple-replay-duration-buttons">
                            {SIMPLE_REPLAY_DURATIONS.map(duration => (
                                <WaButton key={duration}
                                          className={`video-choice-button${simpleDuration === duration ? ' is-selected' : ''}`}
                                          size="s"
                                          variant="neutral"
                                          appearance={simpleDuration === duration ? 'outlined' : 'plain'}
                                          aria-pressed={simpleDuration === duration}
                                          onClick={() => handleSimpleDurationChange(duration)}>
                                    {`${duration}s`}
                                </WaButton>
                            ))}
                        </div>
                    </div>
                </div>
            </LGSPopup>
        </>
    ) : null

    return (
        <div className={`video-recording-settings-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'}${layout === 'timeline-drawer' ? ' video-recording-settings-toolbar--timeline-drawer' : ''}`}>
            <div className="video-recording-settings-menu" role="toolbar" aria-label="Video recording settings">
                {showVideoOptions && !simplePreparation ? <WaButton
                    id="video-ratio-settings-trigger"
                    size="s"
                    appearance={openPopup === RATIO_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(RATIO_POPUP)}
                >
                    <WaIcon name="crop-simple" label=""/>
                    <span>
                        <span className="video-recording-settings-ratio-prefix">{'Ratio:'}</span>
                        {` ${currentRatio?.label ?? video.ratio}`}
                    </span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.ratio)} variant="solid" label=""/>
                </WaButton> : null}

                {showVideoOptions && !simplePreparation ? <LGSPopup
                    anchor="video-ratio-settings-trigger"
                    active={openPopup === RATIO_POPUP}
                    onRequestClose={() => setOpenPopup(null)}
                    outsideAnchors={['video-quality-fps-settings-trigger']}
                    placement="bottom-end"
                    distance={4}
                    strategy="fixed"
                    onWaReposition={event => handlePopupReposition('ratio', event)}
                >
                    <VideoRecordingSettingsMenuContent menu="ratio"
                                                       context={$cropper}
                                                       cropzoneId={VIDEO_CROP_ZONE}
                                                       mainTheme={mainTheme}/>
                </LGSPopup> : null}

                {showVideoOptions && !simplePreparation ? <WaButton
                    id="video-quality-fps-settings-trigger"
                    size="s"
                    appearance={openPopup === VIDEO_PRESET_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(VIDEO_PRESET_POPUP)}
                >
                    <WaIcon name="ranking-star" label=""/>
                    <span>
                        {`${currentQuality} · ${currentFPS} FPS`}
                    </span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.preset)} variant="solid" label=""/>
                </WaButton> : null}

                {showVideoOptions && !simplePreparation ? <LGSPopup
                    anchor="video-quality-fps-settings-trigger"
                    active={openPopup === VIDEO_PRESET_POPUP}
                    onRequestClose={() => setOpenPopup(null)}
                    outsideAnchors={['video-ratio-settings-trigger']}
                    placement="bottom-end"
                    distance={4}
                    strategy="fixed"
                    onWaReposition={event => handlePopupReposition('preset', event)}
                >
                    <div className={`video-recording-settings-popup lgs-card ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'}`}>
                        <VideoRecordingSettingsMenuContent menu="preset"
                                                           context={$cropper}
                                                           cropzoneId={VIDEO_CROP_ZONE}
                                                           mainTheme={mainTheme}/>
                    </div>
                </LGSPopup> : null}

                {showActions ? simpleSettingsTrigger : null}

                {showActions && replayPreparation && (
                    <WaButton
                        id="video-start-hq-export"
                        size="s"
                        variant="brand"
                        appearance="plain"
                        className="video-recording-settings-action video-recorder-start-recording"
                        aria-label="Create Replay video"
                        onClick={handleHqExport}
                    >
                        <WaIcon name="clapperboard-play" label=""/>
                        <span>{'Create Replay'}</span>
                    </WaButton>
                )}

                {showActions ? <span className="video-recording-settings-separator" aria-hidden="true"/> : null}

                {showActions ? <WaButton
                    id="video-cancel-editing"
                    size="s"
                    appearance="plain"
                    className="video-recording-settings-cancel"
                    aria-label="Cancel"
                    onClick={() => void handleCancel()}
                >
                    <WaIcon name="xmark" label=""/>
                    <span>{'Cancel'}</span>
                </WaButton> : null}
            </div>
        </div>
    )
})
