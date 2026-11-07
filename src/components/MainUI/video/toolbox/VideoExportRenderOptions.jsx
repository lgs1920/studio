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
import {WaButton, WaNumberInput, WaOption, WaSelect} from '@awesome.me/webawesome/dist/react'
import {Fragment, memo, useCallback, useEffect} from 'react'
import {useSnapshot} from 'valtio'

const VIDEO_RENDER_DEFAULTS = {
    renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD,
    resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC,
    customDimensions: {width: 1920, height: 1080},
    renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD,
}

/**
 * Render and persist independent Cesium export settings.
 * @param {Object} props - Export settings presentation properties.
 * @param {boolean} [props.basicReplay=false] - Render compact choice buttons for Basic Replay.
 * @param {'all'|'quality'|'video'} [props.basicReplayGroup='all'] - Basic Replay settings group to render.
 * @returns {JSX.Element} Export renderer controls.
 */
export const VideoExportRenderOptions = memo(({basicReplay = false, basicReplayGroup = 'all'} = {}) => {
    const $video = lgs.stores.ui.video
    const $settings = lgs.settings.ui.video
    const video = useSnapshot($video)
    const settings = useSnapshot($settings)
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
    const customDimensions = video.customDimensions ?? settings.customDimensions ?? VIDEO_RENDER_DEFAULTS.customDimensions
    const automaticResolutionHint = resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
        ? 'Automatic uses an output pixel budget affected by the selected FPS and encoding quality.'
        : ''
    const basicResolutionHint = resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC
        ? 'Automatic uses a pixel budget affected by frame rate and encoding quality.'
        : ''

    useEffect(() => {
        Object.entries(VIDEO_RENDER_DEFAULTS).forEach(([key, value]) => {
            if ($settings[key] === undefined || $settings[key] === null) {
                $settings[key] = key === 'customDimensions' ? {...value} : value
            }
            if ($video[key] === undefined || $video[key] === null) {
                $video[key] = key === 'customDimensions' ? {...$settings[key]} : $settings[key]
            }
        })
        if ($settings.readinessPolicy !== readinessPolicy) {
            $settings.readinessPolicy = readinessPolicy
        }
        if ($video.readinessPolicy !== readinessPolicy) {
            $video.readinessPolicy = readinessPolicy
        }
    }, [$settings, $video, readinessPolicy])

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
            group: 'video',
            label: 'Mode',
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
            value: resolutionProfile,
            hint: basicResolutionHint,
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
            label: 'Map detail',
            value: renderQuality,
            choices: [
                {value: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD, label: 'Standard'},
                {value: REPLAY_VIDEO_RENDER_QUALITIES.HIGH, label: 'High'},
                {value: REPLAY_VIDEO_RENDER_QUALITIES.MAXIMUM, label: 'Maximum'},
            ],
            onSelect: value => updateSetting('renderQuality', value),
            disabled: renderHostMode !== REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ,
        },
        {
            group: 'quality',
            label: 'Map loading',
            value: readinessPolicy,
            choices: [
                {value: REPLAY_VIDEO_READINESS_POLICIES.ADAPTIVE, label: 'Balanced'},
                {value: REPLAY_VIDEO_READINESS_POLICIES.STRICT, label: 'Wait for details'},
            ],
            onSelect: value => updateSetting('readinessPolicy', value),
        },
    ]
    const basicGroupChoices = basicReplayGroup === 'all'
        ? basicChoices
        : basicChoices.filter(choice => choice.group === basicReplayGroup)
    const basicSectionLabel = basicReplayGroup === 'quality'
        ? 'Map quality settings'
        : basicReplayGroup === 'video'
            ? 'Video settings'
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
                    {basicGroupChoices.map(({label, value, choices, onSelect, disabled, choicesClassName, hint}) => (
                        <Fragment key={label}>
                            <div className="video-export-render-options__row" role="group" aria-label={label}>
                                <span className="video-export-render-options__label">{label}</span>
                                <div className="video-export-render-options__value">
                                    {renderBasicChoiceButtons({value, choices, onSelect, disabled, choicesClassName})}
                                    {hint && <span className="video-export-render-options__hint">{hint}</span>}
                                </div>
                            </div>
                            {label === 'Size' && resolutionProfile === REPLAY_VIDEO_RESOLUTION_PROFILES.CUSTOM && (
                                <>
                                    <WaNumberInput label="Width (px)"
                                                   label-at-start
                                                   className="half-width video-export-render-options__dimension-field"
                                                   size="s"
                                                   appearance="filled"
                                                   min="2"
                                                   step="2"
                                                   value={customDimensions.width}
                                                   onChange={event => updateCustomDimension('width', event)}/>
                                    <WaNumberInput label="Height (px)"
                                                   label-at-start
                                                   className="half-width video-export-render-options__dimension-field"
                                                   size="s"
                                                   appearance="filled"
                                                   min="2"
                                                   step="2"
                                                   value={customDimensions.height}
                                                   onChange={event => updateCustomDimension('height', event)}/>
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
                        {automaticResolutionHint && <span slot="hint">{automaticResolutionHint}</span>}
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
