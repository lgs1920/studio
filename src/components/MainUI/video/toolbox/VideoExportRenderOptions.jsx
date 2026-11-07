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
import {WaNumberInput, WaOption, WaSelect} from '@awesome.me/webawesome/dist/react'
import {memo, useCallback, useEffect} from 'react'
import {useSnapshot} from 'valtio'

const VIDEO_RENDER_DEFAULTS = {
    renderHostMode: REPLAY_VIDEO_RENDER_HOST_MODES.STANDARD,
    resolutionProfile: REPLAY_VIDEO_RESOLUTION_PROFILES.AUTOMATIC,
    customDimensions: {width: 1920, height: 1080},
    renderQuality: REPLAY_VIDEO_RENDER_QUALITIES.STANDARD,
}

/**
 * Render and persist independent Cesium export settings.
 *
 * @returns {JSX.Element} Export renderer controls.
 */
export const VideoExportRenderOptions = memo(() => {
    const $video = lgs.stores.ui.video
    const $settings = lgs.settings.ui.video
    const video = useSnapshot($video)
    const settings = useSnapshot($settings)
    const renderHostMode = video.renderHostMode ?? settings.renderHostMode ?? VIDEO_RENDER_DEFAULTS.renderHostMode
    const resolutionProfile = video.resolutionProfile ?? settings.resolutionProfile ?? VIDEO_RENDER_DEFAULTS.resolutionProfile
    const renderQuality = video.renderQuality ?? settings.renderQuality ?? VIDEO_RENDER_DEFAULTS.renderQuality
    const readinessPolicy = video.readinessPolicy ?? settings.readinessPolicy ?? (
        renderHostMode === REPLAY_VIDEO_RENDER_HOST_MODES.NATIVE_HQ
            ? REPLAY_VIDEO_READINESS_POLICIES.STRICT
            : VIDEO_RENDER_DEFAULTS.readinessPolicy
    )
    const customDimensions = video.customDimensions ?? settings.customDimensions ?? VIDEO_RENDER_DEFAULTS.customDimensions

    useEffect(() => {
        Object.entries(VIDEO_RENDER_DEFAULTS).forEach(([key, value]) => {
            if ($settings[key] === undefined || $settings[key] === null) {
                $settings[key] = key === 'customDimensions' ? {...value} : value
            }
            if ($video[key] === undefined || $video[key] === null) {
                $video[key] = key === 'customDimensions' ? {...$settings[key]} : $settings[key]
            }
        })
    }, [$settings, $video])

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

    return (
        <section className="video-export-render-options" aria-label="Cesium export rendering">
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
        </section>
    )
})

VideoExportRenderOptions.displayName = 'VideoExportRenderOptions'
