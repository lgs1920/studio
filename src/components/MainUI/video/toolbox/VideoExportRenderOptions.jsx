/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoExportRenderOptions.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    REPLAY_VIDEO_READINESS_POLICIES,
    REPLAY_VIDEO_RENDER_HOST_MODES,
    REPLAY_VIDEO_RENDER_QUALITIES,
    REPLAY_VIDEO_RESOLUTION_PROFILES,
} from '@Core/ui/replay/ReplayVideoRenderSpec'
import {WaButton, WaIcon, WaNumberInput, WaOption, WaSelect} from '@awesome.me/webawesome/dist/react'
import {Fragment, memo, useCallback, useEffect, useRef} from 'react'
import {useSnapshot} from 'valtio'

const VIDEO_RENDER_DEFAULTS = {
    renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD,
    resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC,
    customDimensions: {width: 1920, height: 1080},
    renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD,
}
const VIDEO_RENDER_PORTRAIT_DIMENSIONS = Object.freeze({width: 1080, height: 1920})

/**
 * Render and persist independent Cesium export settings.
 * @param {Object} props - Export settings presentation properties.
 * @param {boolean} [props.basicReplay=false] - Render compact choice buttons for Basic Replay.
 * @param {'all'|'quality'|'video'|'duration'} [props.basicReplayGroup='all'] - Basic Replay settings group to render.
 * @returns {JSX.Element} Export renderer controls.
 */
export const VideoExportRenderOptions = memo(({basicReplay = false, basicReplayGroup = 'all'} = {}) => {
    const $video = lgs.stores.ui.video
    const $settings = lgs.settings.ui.video
    const video = useSnapshot($video)
    const settings = useSnapshot($settings)
    const layers = useSnapshot(lgs.settings.layers ?? $settings)
    const hasSelected3DTiles = Boolean(layers.base3d || layers.tiles3d)
    const videoRatioValue = video.ratio?.value ?? video.ratio
    const videoRatio = lgs.configuration?.videoFormats?.find(format => format.value === videoRatioValue)
    const configuredAspectRatio = Number(videoRatio?.aspectRatio ?? video.ratio?.aspectRatio)
    const [ratioWidth, ratioHeight] = `${videoRatioValue ?? ''}`.replace(':', 'x').split('x').map(Number)
    const videoAspectRatio = configuredAspectRatio > 0
        ? configuredAspectRatio
        : ratioWidth > 0 && ratioHeight > 0
            ? ratioWidth / ratioHeight
            : null
    const customDimensionsOrientation = videoAspectRatio === null
        ? 'unknown'
        : videoAspectRatio < 1
            ? 'portrait'
            : videoAspectRatio > 1
                ? 'landscape'
                : 'square'
    const defaultCustomDimensions = customDimensionsOrientation === 'portrait'
        ? VIDEO_RENDER_PORTRAIT_DIMENSIONS
        : VIDEO_RENDER_DEFAULTS.customDimensions
    const renderHostMode = video.renderHostMode ?? settings.renderHostMode ?? VIDEO_RENDER_DEFAULTS.renderHostMode
    const resolutionProfile = video.resolutionProfile ?? settings.resolutionProfile ?? VIDEO_RENDER_DEFAULTS.resolutionProfile
    const renderQuality = video.renderQuality ?? settings.renderQuality ?? VIDEO_RENDER_DEFAULTS.renderQuality
    const configuredReadinessPolicy = [video.readinessPolicy, settings.readinessPolicy].find(value => (
        Object.values(REPLAY_VIDEO_READINESS_POLICIES).includes(value)
    ))
    const readinessPolicy = configuredReadinessPolicy ?? (
        renderHostMode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
            ? REPLAY_VIDEO_READINESS_POLICIES.STRICT
            : REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE
    )
    const customDimensions = video.customDimensions ?? settings.customDimensions ?? defaultCustomDimensions
    const _previousRatioOrientation = useRef(null)
    const _previousResolutionProfile = useRef(null)

    useEffect(() => {
        Object.entries(VIDEO_RENDER_DEFAULTS).forEach(([key, value]) => {
            const defaultValue = key === 'customDimensions' ? defaultCustomDimensions : value
            if ($settings[key] === undefined || $settings[key] === null) {
                $settings[key] = key === 'customDimensions' ? {...defaultValue} : defaultValue
            }
            if ($video[key] === undefined || $video[key] === null) {
                $video[key] = key === 'customDimensions' ? {...$settings[key]} : $settings[key]
            }
        })
        const ratioOrientationChanged = _previousRatioOrientation.current !== customDimensionsOrientation
        const enteringCustomProfile = resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM
            && _previousResolutionProfile.current !== REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM
        _previousRatioOrientation.current = customDimensionsOrientation
        _previousResolutionProfile.current = resolutionProfile
        const shouldOrientCustomDimensions = resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM
            && (ratioOrientationChanged || enteringCustomProfile)
            && (basicReplay !== true || basicReplayGroup === 'all' || basicReplayGroup === 'video')
            && ['portrait', 'landscape'].includes(customDimensionsOrientation)
        if (shouldOrientCustomDimensions) {
            // Reorient the stored bounds once when the selected ratio or custom mode changes.
            const dimensions = $video.customDimensions ?? $settings.customDimensions ?? defaultCustomDimensions
            const width = Math.max(2, Math.round(Number(dimensions.width) || defaultCustomDimensions.width))
            const height = Math.max(2, Math.round(Number(dimensions.height) || defaultCustomDimensions.height))
            const dimensionsArePortrait = width < height
            const ratioIsPortrait = customDimensionsOrientation === 'portrait'
            if (dimensionsArePortrait !== ratioIsPortrait) {
                const nextDimensions = {width: height, height: width}
                $video.customDimensions = {...nextDimensions}
                $settings.customDimensions = {...nextDimensions}
            }
        }
        if ($settings.readinessPolicy !== readinessPolicy) {
            $settings.readinessPolicy = readinessPolicy
        }
        if ($video.readinessPolicy !== readinessPolicy) {
            $video.readinessPolicy = readinessPolicy
        }
    }, [
        $settings,
        $video,
        basicReplay,
        basicReplayGroup,
        customDimensionsOrientation,
        defaultCustomDimensions,
        readinessPolicy,
        resolutionProfile,
    ])

    /**
     * Persist one renderer setting in the runtime store and user preferences.
     *
     * @param {string} key - Setting key.
     * @param {*} value - Selected value.
     * @returns {void}
     */
    const updateSetting = useCallback((key, value) => {
        $video[key] = value
        $settings[key] = value
    }, [$settings, $video])

    /**
     * Persist one custom output bound while retaining the other dimension.
     *
     * @param {'width'|'height'} dimension - Dimension being edited.
     * @param {Event} event - Web Awesome input event.
     * @returns {void}
     */
    const updateCustomDimension = useCallback((dimension, event) => {
        const value = Math.max(2, Math.round(Number(event.target.value) || 2))
        const next = {...customDimensions, [dimension]: value}
        $video.customDimensions = {...next}
        $settings.customDimensions = {...next}
    }, [$settings, $video, customDimensions])

    const basicChoices = [
        {
            group: 'quality',
            label: 'Render',
            icon: 'paintbrush-fine',
            value: renderHostMode,
            choices: [
                {value: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD, label: 'Standard'},
                {value: REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ, label: 'High quality'},
            ],
            onSelect: value => updateSetting('renderHostMode', value),
        },
        {
            group: 'video',
            label: 'Size',
            icon: 'expand',
            value: resolutionProfile,
            choices: [
                {value: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC, label: 'Automatic'},
                {value: REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD, label: '1080p'},
                {value: REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K, label: '4K'},
                {value: REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM, label: 'Custom'},
            ],
            onSelect: value => updateSetting('resolutionProfile', value),
            choicesClassName: 'video-export-render-options__choices--resolution',
        },
        {
            group: 'quality',
            label: 'Building detail',
            icon: 'building',
            value: renderQuality,
            visible: renderHostMode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ && hasSelected3DTiles,
            choices: [
                {value: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, label: 'Standard'},
                {value: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, label: 'High'},
                {value: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM, label: 'Maximum'},
            ],
            onSelect: value => updateSetting('renderQuality', value),
        },
        {
            group: 'duration',
            label: 'Map loading',
            icon: 'spinner-scale',
            value: readinessPolicy,
            choices: [
                {value: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE, label: 'Balanced'},
                {value: REPLAY_VIDEO_READINESS_POLICIES.STRICT, label: 'Wait for details'},
            ],
            onSelect: value => updateSetting('readinessPolicy', value),
        },
    ]
    const basicGroupChoices = basicChoices.filter(choice => (
        (basicReplayGroup === 'all' || choice.group === basicReplayGroup)
        && choice.visible !== false
    ))
    const basicSectionLabel = basicReplayGroup === 'quality'
        ? 'Video and map quality settings'
        : basicReplayGroup === 'video'
            ? 'Video output settings'
            : basicReplayGroup === 'duration'
                ? 'Map loading settings'
                : 'Replay export settings'

    /**
     * Render one Basic Replay choice group using the shared video preset buttons.
     * @param {Object} options - Choice group configuration.
     * @param {string} options.value - Current choice value.
     * @param {Array<Object>} options.choices - Available value and label pairs.
     * @param {Function} options.onSelect - Persist a selected value.
     * @param {boolean} [options.disabled=false] - Disable the choice buttons.
     * @param {string} [options.choicesClassName] - Additional choice group class.
     * @returns {JSX.Element} Accessible choice buttons.
     */
    const renderBasicChoiceButtons = ({value, choices, onSelect, disabled = false, choicesClassName = ''}) => (
        <div className={`video-export-render-options__choices${choicesClassName ? ` ${choicesClassName}` : ''}`}>
            {choices.map(choice => {
                const selected = choice.value === value
                return (
                    <WaButton
                        key={choice.value}
                        className={`video-choice-button${selected ? ' is-selected' : ''}`}
                        size="s"
                        variant="neutral"
                        appearance={selected ? 'outlined' : 'plain'}
                        aria-pressed={selected ? 'true' : 'false'}
                        disabled={disabled}
                        onClick={() => onSelect(choice.value)}
                    >
                        {choice.label}
                    </WaButton>
                )
            })}
        </div>
    )

    return (
        <section className={`video-export-render-options${basicReplay ? ' video-export-render-options--basic' : ''}`}
                 aria-label={basicReplay ? basicSectionLabel : 'Cesium export rendering'}>
            {basicReplay ? (
                <div className="video-export-render-options__basic-rows">
                        {basicGroupChoices.map(({label, icon, value, choices, onSelect, disabled, choicesClassName}) => (
                        <Fragment key={label}>
                            <div className="video-export-render-options__row" role="group" aria-label={label}>
                                    <div className="video-export-render-options__label">
                                        <WaIcon name={icon} variant="regular" label=""/>
                                        <span>{label}</span>
                                    </div>
                                <div className="video-export-render-options__value">
                                    {renderBasicChoiceButtons({value, choices, onSelect, disabled, choicesClassName})}
                                </div>
                            </div>
                            {label === 'Size' && resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM && (
                                <>
                                        <WaNumberInput label="Max width (px)"
                                                   label-at-start
                                                   className="half-width video-export-render-options__dimension-field"
                                                   size="s"
                                                   appearance="filled"
                                                   min="2"
                                                   step="2"
                                                   value={customDimensions.width}
                                                   onChange={event => updateCustomDimension('width', event)}/>
                                        <WaNumberInput label="Max height (px)"
                                                   label-at-start
                                                   className="half-width video-export-render-options__dimension-field"
                                                   size="s"
                                                   appearance="filled"
                                                   min="2"
                                                   step="2"
                                                   value={customDimensions.height}
                                                   onChange={event => updateCustomDimension('height', event)}/>
                                        <span className="video-export-render-options__hint video-export-render-options__dimension-hint">
                                            {'The video keeps the selected ratio and stays within these maximum sizes.'}
                                        </span>
                                </>
                            )}
                        </Fragment>
                    ))}
                </div>
            ) : (
                <>
                    <WaSelect label="Export renderer"
                              label-at-start
                              size="s"
                              appearance="filled"
                              value={renderHostMode}
                              onChange={event => updateSetting('renderHostMode', event.target.value)}>
                        <WaOption value={REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD}>{'Standard / Fast'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ}>{'Native HQ'}</WaOption>
                    </WaSelect>
                    <WaSelect label="Output resolution"
                              label-at-start
                              size="s"
                              appearance="filled"
                              value={resolutionProfile}
                              onChange={event => updateSetting('resolutionProfile', event.target.value)}>
                        <WaOption value={REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC}>{'Automatic'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RESOLUTION_PROFILES.FULL_HD}>{'1080p'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RESOLUTION_PROFILES.UHD_4K}>{'4K UHD'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM}>{'Custom'}</WaOption>
                    </WaSelect>
                    {resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM && (
                        <div className="video-export-render-options__dimensions" role="group" aria-label="Custom output bounds">
                            <WaNumberInput label="Maximum width"
                                           label-at-start
                                           className="half-width"
                                           size="s"
                                           appearance="filled"
                                           min="2"
                                           step="2"
                                           value={customDimensions.width}
                                           onChange={event => updateCustomDimension('width', event)}/>
                            <WaNumberInput label="Maximum height"
                                           label-at-start
                                           className="half-width"
                                           size="s"
                                           appearance="filled"
                                           min="2"
                                           step="2"
                                           value={customDimensions.height}
                                           onChange={event => updateCustomDimension('height', event)}/>
                        </div>
                    )}
                    <WaSelect label="Cesium detail"
                              label-at-start
                              size="s"
                              appearance="filled"
                              disabled={renderHostMode !== REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ}
                              value={renderQuality}
                              onChange={event => updateSetting('renderQuality', event.target.value)}>
                        <WaOption value={REPLAY_VIDEO_RENDER_QUALITIES.STANDARD}>{'Standard · SSE 16'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RENDER_QUALITIES.HIGH}>{'High · SSE 4'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM}>{'Maximum · SSE 2'}</WaOption>
                    </WaSelect>
                    <WaSelect label="Tile readiness"
                              label-at-start
                              size="s"
                              appearance="filled"
                              value={readinessPolicy}
                              onChange={event => updateSetting('readinessPolicy', event.target.value)}>
                        <WaOption value={REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE}>{'Adaptive'}</WaOption>
                        <WaOption value={REPLAY_VIDEO_READINESS_POLICIES.STRICT}>{'Strict'}</WaOption>
                    </WaSelect>
                </>
            )}
        </section>
    )
})

VideoExportRenderOptions.displayName = 'VideoExportRenderOptions'
