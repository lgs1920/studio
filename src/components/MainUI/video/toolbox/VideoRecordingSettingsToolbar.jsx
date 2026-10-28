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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSPopup } from '@Components/LGSPopup'
import {
    cancelVideoEditing,
    prepareVideoCaptureUi,
    prepareVideoEditingUi,
} from '@Components/MainUI/video/videoEditingCleanup'
import { REPLAY_DRAWER, VIDEO_CROP_ZONE } from '@Core/constants'
import {
    DEFAULT_REPLAY_VIDEO_FPS_INDEX,
    DEFAULT_REPLAY_VIDEO_QUALITY_INDEX,
    REPLAY_VIDEO_FPS,
    REPLAY_VIDEO_QUALITY,
} from '@Core/ui/replay/ReplayVideoSettings'
import {
    normalizeBasicReplayDuration,
    BASIC_REPLAY_DURATIONS,
    toGlobalReplayCameraSettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    getBasicReplaySettings,
    normalizeBasicReplayEndFocus,
    REPLAY_SAMPLE_COUNT_OPTIONS,
    writeBasicReplaySettings,
} from '@Core/ui/replay/ReplayModeSettings'
import {isJourneyReplayDryRunActive} from '@Core/ui/replay/JourneyReplayRuntime'
import {createReplayPOISpeedProfile} from '@Core/ui/replay/ReplayPOISpeedProfile'
import {currentReplayJourney} from '@Core/ui/replay/ReplayUserModeConstants'
import {
    normalizeBasicReplaySettings,
    resolveBasicReplaySettings,
    syncJourneyBasicReplayDuration,
    syncJourneyBasicReplayEndFocus,
} from '@Core/ui/replay/ReplayUserModes'
import { WaButton, WaIcon, WaNumberInput, WaSwitch, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import { VideoRecordingSettingsMenuContent } from './VideoRecordingSettingsMenus'
import {BasicReplaySamplingSettings} from './BasicReplaySamplingSettings'
import {BasicReplayAppearanceSettings} from './BasicReplayAppearanceSettings'
import {BasicReplayPOISettings} from './BasicReplayPOISettings'
import '../style.css'

const RATIO_POPUP = 'ratio'
const VIDEO_PRESET_POPUP = 'video-preset'
const BASIC_SETTINGS_POPUP = 'basic-settings'

const formatBasicReplayDuration = seconds => {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60
    if (minutes === 0) {
        return `${totalSeconds}s`
    }
    return `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`
}

/**
 * VideoRecordingSettingsToolbar renders the horizontal video setup HUD.
 * @param {Object} props - Toolbar properties.
 * @param {boolean} [props.mainTheme=false] - Use the main application theme instead of the on-map theme.
 * @param {string} [props.layout='default'] - Presentation layout context.
 * @param {'all'|'actions'|'video-options'} [props.mode='all'] - Controls rendered by the toolbar.
 * @param {boolean} [props.timelineSettings=false] - Render the compact Replay settings popup for the Expert timeline.
 * @component
 */
export const VideoRecordingSettingsToolbar = memo(({
    mainTheme = false,
    layout = 'default',
    mode = 'all',
    timelineSettings = false,
} = {}) => {
    const $video = lgs.stores.ui.video
    const $cropper = $video.cropper
    const $replay = lgs.stores.replay
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const main = useOptionalSnapshot(lgs.stores.main)
    const video = useSnapshot($video)
    const [openPopup, setOpenPopup] = useState(null)
    const [popupDirections, setPopupDirections] = useState({ratio: 'bottom', preset: 'bottom'})
    const replaySettingsTriggerId = `replay-settings-trigger-${useId().replaceAll(':', '')}`
    const samplingIconTooltipId = `${replaySettingsTriggerId}-sampling`
    const _cropSyncPromise = useRef(null)
    const shouldShowToolbar = video.editing === true
                              && !video.preRecording
                              && !video.exporting
                              && !video.snapshot
                              && !video.finalizing
    const basicPreparation = replay.basicPreparationActive === true
    const compactReplaySettings = basicPreparation || timelineSettings
    const dryRunEnabled = basicPreparation
                          && (video.dryRunSelection ?? getBasicReplaySettings(replaySettings)?.dryRun) === true
    const linkedPlaybackActive = timelineSettings && isJourneyReplayDryRunActive(replay, video)
    const showVideoOptions = mode !== 'actions'
    const showActions = mode !== 'video-options'

    const currentRatio = lgs.configuration.videoFormats.find(format => format.value === video.ratio)
    const fullQualityName = REPLAY_VIDEO_QUALITY[video.quality]?.name?.replace(/\s+Quality$/, '') ?? 'Medium'
    const currentQuality = compactReplaySettings
        ? ['Med', 'High', 'Ultra'][video.quality] ?? fullQualityName
        : fullQualityName
    const currentFPS = REPLAY_VIDEO_FPS[video.fps] ?? REPLAY_VIDEO_FPS[DEFAULT_REPLAY_VIDEO_FPS_INDEX]
    const basicJourney = main?.theJourney ?? currentReplayJourney()
    const resolvedBasicSettings = resolveBasicReplaySettings({
        user: getBasicReplaySettings(replaySettings),
        journey: getBasicReplaySettings(basicJourney?.replay),
    })
    const basicDuration = resolvedBasicSettings.duration
    const basicSampleCount = resolvedBasicSettings.sampleCount
    const basicEndFocus = resolvedBasicSettings.endFocus
    const runtimePOISpeedProfile = replay.poiPlaybackProfile
    const hasCurrentRuntimePOISpeedProfile = runtimePOISpeedProfile?.journeySlug === basicJourney?.slug
        && runtimePOISpeedProfile.routeDurationMillis === basicDuration * 1000
        && runtimePOISpeedProfile.direction === (Number(replay.direction) < 0 ? -1 : 1)
        && runtimePOISpeedProfile.shouldSlowdown === (
            basicPreparation && resolvedBasicSettings.animatePoisDuringJourneyReplay
        )
    const basicPOISpeedProfile = hasCurrentRuntimePOISpeedProfile
        ? runtimePOISpeedProfile
        : createReplayPOISpeedProfile({
            entries: replay.nearbyPois ?? [],
            totalDistance: replay.totalDistance,
            replayDurationMillis: basicDuration * 1000,
            direction: replay.direction,
            basicSettings: resolvedBasicSettings,
            enabled: basicPreparation,
        })
    const basicTotalDuration = basicPOISpeedProfile.playbackDurationMillis / 1000
                            + (basicEndFocus.enabled ? basicEndFocus.duration : 0)
    const basicSampleOption = REPLAY_SAMPLE_COUNT_OPTIONS.find(option => option.value === basicSampleCount)
        ?? REPLAY_SAMPLE_COUNT_OPTIONS[0]

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
     * Opens or closes the Replay settings drawer.
     */
    const handleReplaySettings = useCallback(() => {
        __.ui.drawerManager.toggle(REPLAY_DRAWER)
    }, [])

    /**
     * Starts the Replay recording after the current crop and camera are ready.
    * @returns {Promise<void>} Completion promise.
     */
    const handleReplayRecording = useCallback(async () => {
        if (timelineSettings && isJourneyReplayDryRunActive($replay, $video)) {
            return
        }
        if (!__.mediaCapture && !dryRunEnabled) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        // Finish map rotation and its position update before freezing preparation/crop state.
        await __.ui.cameraManager?.stopRotate?.()
        await syncCropFrame('before-recording')
        const prepared = await __.ui.replay?.prepareReplayCamera?.({journey: lgs.theJourney})
        if (prepared === false) {
            return
        }

        prepareVideoCaptureUi()
        Object.assign($video, {
            editing:      false,
            preRecording: true,
            finalizing:   false,
            paused:       false,
            dryRun:       dryRunEnabled,
        })
    }, [$replay, $video, dryRunEnabled, syncCropFrame, timelineSettings])

    /**
     * Persist the Basic Replay Dry run preference without touching video quality.
     * @param {Event} event - Dry run switch change event.
     * @returns {void} Nothing.
     */
    const handleDryRunChange = useCallback(event => {
        const checked = event.currentTarget?.checked ?? event.target?.checked
        const basic = getBasicReplaySettings(lgs.settings.ui.replay) ?? {}
        lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, {
            ...basic,
            dryRun: checked === true,
        })
        $video.dryRunSelection = checked === true
    }, [$video])

    /**
     * Store the selected Basic Replay duration for playback and export.
     * @param {number|string} value - Requested Basic Replay duration in seconds.
     * @returns {void} Nothing.
     */
    const handleBasicDurationChange = useCallback(value => {
        const duration = normalizeBasicReplayDuration(value)
        const journeyDuration = syncJourneyBasicReplayDuration(duration)
        if (journeyDuration === null) {
            const basicSettings = normalizeBasicReplaySettings(getBasicReplaySettings(lgs.settings.ui.replay) ?? {})
            basicSettings.duration = duration
            basicSettings.camera = toGlobalReplayCameraSettings(basicSettings.camera)
            lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, basicSettings)
        }
        $replay.duration = duration
    }, [$replay])

    /** Persist Basic Replay end-focus settings globally and on the active Journey. */
    const updateBasicEndFocus = useCallback(updates => {
        const userBasic = getBasicReplaySettings(lgs.settings.ui.replay) ?? {}
        const currentSettings = resolveBasicReplaySettings({
            user: userBasic,
            journey: getBasicReplaySettings(basicJourney?.replay),
        })
        const endFocus = normalizeBasicReplayEndFocus({...currentSettings.endFocus, ...updates})
        lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, {
            ...userBasic,
            endFocus,
        })
        // `basicJourney` can come from a Valtio snapshot. Persist through the live Journey proxy.
        syncJourneyBasicReplayEndFocus(endFocus, currentReplayJourney())
        __.ui.replay?.refresh?.({camera: false})
        lgs.scene?.requestRender?.()
    }, [basicJourney])

    const handleBasicEndFocusSwitchChange = useCallback(event => {
        const enabled = event.currentTarget?.checked ?? event.target?.checked
        updateBasicEndFocus({enabled: enabled === true})
    }, [updateBasicEndFocus])

    const handleBasicEndFocusDurationInput = useCallback(event => {
        const rawDuration = event.currentTarget?.value ?? event.target?.value
        if (`${rawDuration ?? ''}`.trim() === '') {
            return
        }
        updateBasicEndFocus({duration: rawDuration})
    }, [updateBasicEndFocus])

    useEffect(() => {
        const safeFPS = Number.isInteger(lgs.settings.ui.video?.fps)
            && lgs.settings.ui.video.fps >= 0
            && lgs.settings.ui.video.fps < REPLAY_VIDEO_FPS.length
            ? lgs.settings.ui.video.fps
            : DEFAULT_REPLAY_VIDEO_FPS_INDEX
        const safeQuality = Number.isInteger(lgs.settings.ui.video?.quality)
            && lgs.settings.ui.video.quality >= 0
            && lgs.settings.ui.video.quality < REPLAY_VIDEO_QUALITY.length
            ? lgs.settings.ui.video.quality
            : DEFAULT_REPLAY_VIDEO_QUALITY_INDEX

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

    const replaySettingsTrigger = compactReplaySettings ? (
        <>
            <div className="basic-replay-settings-summary" aria-label="Current Replay settings">
                <WaTooltip for={replaySettingsTriggerId} placement="top">{'Video Settings'}</WaTooltip>
                <WaButton
                    id={replaySettingsTriggerId}
                    size="s"
                    variant="brand"
                    appearance={openPopup === BASIC_SETTINGS_POPUP ? 'outlined' : 'plain'}
                    aria-label="Video Settings"
                    aria-expanded={openPopup === BASIC_SETTINGS_POPUP}
                    onClick={() => togglePopup(BASIC_SETTINGS_POPUP)}
                >
                    <WaIcon name="gear" variant="regular" label=""/>
                </WaButton>
                <span className="basic-replay-settings-summary__separator" aria-hidden="true"/>
                <span className="basic-replay-settings-summary__item">
                    <WaIcon name="crop-simple" variant="regular" label=""/>
                    <span>{currentRatio?.label ?? video.ratio}</span>
                </span>
                <span className="basic-replay-settings-summary__item">
                    <WaIcon name={dryRunEnabled ? 'bolt' : 'ranking-star'}
                            variant="regular"
                            label=""/>
                    <span>{dryRunEnabled ? 'Dry run' : `${currentQuality} · ${currentFPS} FPS`}</span>
                </span>
                {basicPreparation && (
                    <span className="basic-replay-settings-summary__item basic-replay-settings-summary__sampling">
                        <WaTooltip for={samplingIconTooltipId} placement="top">{basicSampleOption.label}</WaTooltip>
                        <span id={samplingIconTooltipId}
                              className="basic-replay-settings-summary__sampling-target"
                              role="img"
                              aria-label={`Sampling: ${basicSampleOption.label}`}>
                            <WaIcon name={basicSampleOption.icon} variant="regular" label=""/>
                        </span>
                    </span>
                )}
                {basicPreparation && (
                    <span className="basic-replay-settings-summary__item">
                        <WaIcon name="clock" variant="regular" label=""/>
                        <span>{formatBasicReplayDuration(basicTotalDuration)}</span>
                    </span>
                )}
            </div>
            <LGSPopup
                anchor={replaySettingsTriggerId}
                active={openPopup === BASIC_SETTINGS_POPUP}
                onRequestClose={() => setOpenPopup(null)}
                placement="bottom"
                flip
                shift
                distance={8}
                strategy="fixed"
            >
                <div className={`video-recording-settings-popup video-recording-settings-popup--basic lgs-card ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'}`}>
                    <div className="basic-replay-settings-row basic-replay-settings-row--label-and-controls" role="group" aria-label="Aspect ratio">
                        <WaIcon name="crop-simple" variant="regular" label=""/>
                        <span className="basic-replay-settings-row__label">{'Ratio'}</span>
                        <VideoRecordingSettingsMenuContent menu="ratio"
                                                           context={$cropper}
                                                           cropzoneId={VIDEO_CROP_ZONE}
                                                           unifiedChoices
                                                           mainTheme={mainTheme}/>
                    </div>
                    {basicPreparation && (
                        <div className="basic-replay-settings-row basic-replay-settings-row--preparation" role="group" aria-label="Replay preparation options">
                            <div className="basic-replay-dry-run-control half-width">
                                <WaSwitch
                                    className="basic-replay-dry-run-switch"
                                    size="xs"
                                    label-at-start width-auto
                                    checked={dryRunEnabled}
                                    onChange={handleDryRunChange}
                                >
                                    <WaIcon name="bolt" variant="regular" label=""/>
                                    {'\u00a0'}
                                    {'Dry run'}
                                </WaSwitch>
                            </div>
                            <BasicReplaySamplingSettings/>
                        </div>
                    )}
                    {!dryRunEnabled && (
                        <div className="basic-replay-settings-row basic-replay-settings-row--label-and-controls" role="group" aria-label="Video quality">
                            <WaIcon name="ranking-star" variant="regular" label=""/>
                            <span className="basic-replay-settings-row__label">{'Quality'}</span>
                            <VideoRecordingSettingsMenuContent menu="preset"
                                                               context={$cropper}
                                                               cropzoneId={VIDEO_CROP_ZONE}
                                                               compactBasic
                                                               mainTheme={mainTheme}/>
                        </div>
                    )}
                    {basicPreparation && (
                        <BasicReplayAppearanceSettings/>
                    )}
                    {basicPreparation && (
                        <BasicReplayPOISettings/>
                    )}
                    {basicPreparation && (
                        <div className="basic-replay-settings-row basic-replay-end-focus-row" role="group" aria-label="End Focus Duration">
                            <WaIcon name="rotate" variant="regular" label=""/>
                            <div className="basic-replay-end-focus-controls">
                                <WaSwitch
                                    className="basic-replay-end-focus-switch"
                                    size="xs"
                                    label-at-start width-auto
                                    checked={basicEndFocus.enabled}
                                    onChange={handleBasicEndFocusSwitchChange}
                                >
                                    {'End Focus'}
                                </WaSwitch>
                                {basicEndFocus.enabled && (
                                    <WaNumberInput
                                        className="basic-replay-end-focus-duration lgs--short-input"
                                        appearance="filled"
                                        size="s"
                                        type="number"
                                        label="Duration (s)"
                                        label-at-start
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={basicEndFocus.duration}
                                        onInput={handleBasicEndFocusDurationInput}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    {basicPreparation && (
                        <div className="basic-replay-settings-row basic-replay-settings-row--label-and-controls" role="group" aria-label="Duration">
                            <WaIcon name="clock" variant="regular" label=""/>
                            <span className="basic-replay-settings-row__label">{'Duration'}</span>
                            <div className="basic-replay-duration-buttons">
                                {BASIC_REPLAY_DURATIONS.map(duration => (
                                    <WaButton key={duration}
                                              className={`video-choice-button${basicDuration === duration ? ' is-selected' : ''}`}
                                              size="s"
                                              variant="neutral"
                                              appearance={basicDuration === duration ? 'outlined' : 'plain'}
                                              aria-pressed={basicDuration === duration ? 'true' : 'false'}
                                              onClick={() => handleBasicDurationChange(duration)}>
                                        {duration === 60 ? '1 min' : `${duration}s`}
                                    </WaButton>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </LGSPopup>
        </>
    ) : null

    return (
        <div className={`video-recording-settings-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'}${layout === 'timeline-drawer' ? ' video-recording-settings-toolbar--timeline-drawer' : ''}`}>
            <div className="video-recording-settings-menu" role="toolbar" aria-label="Video recording settings">
                {showVideoOptions && !basicPreparation ? <WaButton
                    id="video-ratio-settings-trigger"
                    size="s"
                    appearance={openPopup === RATIO_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(RATIO_POPUP)}
                >
                    <WaIcon name="crop-simple" variant="regular" label=""/>
                    <span>
                        <span className="video-recording-settings-ratio-prefix">{'Ratio:'}</span>
                        {` ${currentRatio?.label ?? video.ratio}`}
                    </span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.ratio)} variant="regular" label=""/>
                </WaButton> : null}

                {showVideoOptions && !basicPreparation ? <LGSPopup
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

                {showVideoOptions && !basicPreparation ? <WaButton
                    id="video-quality-fps-settings-trigger"
                    size="s"
                    appearance={openPopup === VIDEO_PRESET_POPUP ? 'outlined' : 'plain'}
                    onClick={() => togglePopup(VIDEO_PRESET_POPUP)}
                >
                    <WaIcon name="ranking-star" variant="regular" label=""/>
                    <span>
                        {`${currentQuality} · ${currentFPS} FPS`}
                    </span>
                    <WaIcon slot="end" name={getCaretIcon(popupDirections.preset)} variant="regular" label=""/>
                </WaButton> : null}

                {showVideoOptions && !basicPreparation ? <LGSPopup
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

                {showActions ? replaySettingsTrigger : null}

                {showActions && compactReplaySettings ? (
                    <span className="video-recording-settings-separator" aria-hidden="true"/>
                ) : null}

                {showActions && timelineSettings ? (
                    <>
                        <WaTooltip for="open-replay-settings-from-timeline" placement="top">
                            {'Replay Settings'}
                        </WaTooltip>
                        <WaButton
                            id="open-replay-settings-from-timeline"
                            size="s"
                            variant="brand"
                            appearance="plain"
                            className="video-recording-settings-action video-recording-settings-replay"
                            aria-label="Replay Settings"
                            onClick={handleReplaySettings}
                        >
                            <WaIcon name="sliders" variant="regular" label=""/>
                        </WaButton>
                    </>
                ) : null}

                {showActions && compactReplaySettings ? (
                    <>
                        <WaTooltip for="video-start-recording" placement="top">
                            {dryRunEnabled ? 'Start Dry run' : 'Start Record'}
                        </WaTooltip>
                        <WaButton
                            id="video-start-recording"
                            size="s"
                            variant="brand"
                            appearance="plain"
                            className="video-recording-settings-action video-recorder-start-recording"
                            aria-label={dryRunEnabled ? 'Run Dry run' : 'Record'}
                            disabled={linkedPlaybackActive}
                            onClick={() => void handleReplayRecording()}
                        >
                            <WaIcon name={dryRunEnabled ? 'bolt' : 'clapperboard-play'}
                                    variant="regular"
                                    label=""/>
                            <span>{dryRunEnabled ? 'Dry run' : 'Record'}</span>
                        </WaButton>
                    </>
                ) : null}

                {showActions ? <span className="video-recording-settings-separator" aria-hidden="true"/> : null}

                {showActions ? (
                    <>
                        <WaTooltip for="video-cancel-editing" placement="top">{'Cancel'}</WaTooltip>
                        <WaButton
                            id="video-cancel-editing"
                            size="s"
                            appearance="plain"
                            className="video-recording-settings-cancel"
                            aria-label="Cancel"
                            onClick={() => void handleCancel()}
                        >
                            <WaIcon name="xmark" variant="regular" label=""/>
                            <span>{'Cancel'}</span>
                        </WaButton>
                    </>
                ) : null}
            </div>
        </div>
    )
})
