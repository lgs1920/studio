/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackStyleSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DRAW_THEN_SAVE }                           from '@Core/constants'
import { TrackUtils }                               from '@Utils/cesium/TrackUtils'
import {
    TRACK_RENDER_SMOOTHING_MAX_STEP, TRACK_RENDER_SMOOTHING_MIN_STEP, defaultTrackRenderSmoothing,
    normalizeTrackRenderSmoothing,
}                                                   from '@Utils/cesium/trackRenderSmoothing'
import {
    TRACK_METER_WIDTHS,
    normalizeTrackRenderStyle,
}                                                   from '@Utils/cesium/trackRenderStyle'
import { WaColorPicker, WaDivider, WaNumberInput, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                                   from 'colord'
import { useCallback, useEffect, useRef }           from 'react'
import { useSnapshot }                              from 'valtio'
import { Utils }                                    from '../Utils'

const toNumber = (value, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

const toColorState = value => {
    const color = colord(value ?? '#ffffff')
    return {
        color:   color.alpha(1).toRgbString(),
        opacity: color.alpha(),
    }
}

const assignTrackRenderStyle = (editor, updates) => {
    if (!editor.track) {
        return false
    }

    const currentStyle = normalizeTrackRenderStyle(editor.track.renderStyle, {
        color:     editor.track.color,
        thickness: editor.track.thickness,
    })
    const nextStyle = normalizeTrackRenderStyle({
                                                    ...currentStyle,
                                                    ...updates,
                                                    underlay: {
                                                        ...currentStyle.underlay,
                                                        ...updates.underlay,
                                                    },
                                                    dash:     {
                                                        ...currentStyle.dash,
                                                        ...updates.dash,
                                                    },
                                                },
                                                {
                                                    color:     editor.track.color,
                                                    thickness: editor.track.thickness,
                                                })

    editor.track.renderStyle = nextStyle
    editor.track.color = nextStyle.color
    editor.track.thickness = nextStyle.farPixelWidth
    return true
}

const assignRenderSmoothing = async (editor, isJourneyScopedSmoothing, smoothing, updates) => {
    const target = isJourneyScopedSmoothing ? editor.journey : editor.track
    if (!target) {
        return
    }

    target.renderSmoothing = normalizeTrackRenderSmoothing({
                                                               ...smoothing,
                                                               ...updates,
                                                           })
    await Utils.updateTrack(DRAW_THEN_SAVE)
}

/**
 * Component to manage track visual settings (color, opacity, thickness)
 * Optimized for high-performance dragging
 * @returns {JSX.Element|null}
 */
export const TrackStyleSettings = () => {
    const $editor = lgs.theJourneyEditorProxy
    const {journey, track} = useSnapshot($editor)

    const _saveTimeoutRef = useRef(null)
    const _thicknessRef = useRef(null)
    const _opacityRef = useRef(null)
    const isJourneyScopedSmoothing = (journey?.tracks?.size ?? 0) <= 1
    const smoothingSource = isJourneyScopedSmoothing
                            ? (journey?.renderSmoothing ?? track?.renderSmoothing)
                            : track?.renderSmoothing
    const smoothing = normalizeTrackRenderSmoothing(smoothingSource, defaultTrackRenderSmoothing())
    const renderStyle = normalizeTrackRenderStyle(track?.renderStyle, {
        color:     track?.color,
        thickness: track?.thickness,
    })

    const trackColor = toColorState(renderStyle.color)
    const underlayColor = toColorState(renderStyle.underlay.color)
    const dashGapColor = toColorState(renderStyle.dash.gapColor)

    useEffect(() => {
        if (!$editor.track) {
            TrackUtils.setTheTrack(false)
        }
    }, [$editor])

    /**
     * Sync sliders only when external changes occur (Initial mount or undo/redo)
     */
    useEffect(() => {
        if (_thicknessRef.current) {
            _thicknessRef.current.value = renderStyle.farPixelWidth
        }
        if (_opacityRef.current) {
            _opacityRef.current.value = colord(renderStyle.color).alpha()
        }
    }, [
        renderStyle.color,
        renderStyle.dash.gapColor,
        renderStyle.farPixelWidth,
        renderStyle.underlay.color,
    ])

    const scheduleTrackUpdate = useCallback((afterSave = null) => {
        if (_saveTimeoutRef.current) {
            clearTimeout(_saveTimeoutRef.current)
        }
        _saveTimeoutRef.current = setTimeout(async () => {
            await Utils.updateTrack(DRAW_THEN_SAVE)
            afterSave?.()
            _saveTimeoutRef.current = null
        }, 150)
    }, [])

    useEffect(() => () => {
        if (_saveTimeoutRef.current) {
            clearTimeout(_saveTimeoutRef.current)
        }
    }, [])

    const applyRenderStyle = (updates, {afterSave = null} = {}) => {
        if (assignTrackRenderStyle($editor, updates)) {
            scheduleTrackUpdate(afterSave)
        }
    }

    const updateColorState = (event, colorState, onColor, afterSave = null) => {
        const isSlider = event.target.nodeName === 'WA-SLIDER'
        const val = event.target.value
        let newColor = colord(colorState.color)
        let newOpacity = colorState.opacity

        if (isSlider) {
            newOpacity = toNumber(val, colorState.opacity)
        }
        else {
            newColor = colord(val)
        }

        onColor(newColor.alpha(newOpacity).toRgbString(), afterSave)
    }

    const handleColorInput = (event) => {
        updateColorState(
            event,
            trackColor,
            color => applyRenderStyle({color}, {afterSave: () => __.ui.profiler?.updateColor()}),
        )
    }

    const handleMeterWidthInput = event => {
        applyRenderStyle({meterWidth: toNumber(event.target.value, renderStyle.meterWidth)})
    }

    const handleFarPixelWidthInput = event => {
        applyRenderStyle({farPixelWidth: toNumber(event.target.value, renderStyle.farPixelWidth)})
    }

    const handleUnderlayEnabled = event => {
        applyRenderStyle({
                             underlay: {
                                 enabled: event.target.checked,
                             },
                         })
    }

    const handleUnderlayColorInput = event => {
        updateColorState(
            event,
            underlayColor,
            color => applyRenderStyle({
                                          underlay: {
                                              color,
                                          },
                                      }),
        )
    }

    const handleUnderlayMeterWidthInput = event => {
        applyRenderStyle({
                             underlay: {
                                 meterWidth: toNumber(event.target.value, renderStyle.underlay.meterWidth),
                             },
                         })
    }

    const handleUnderlayPixelWidthInput = event => {
        applyRenderStyle({
                             underlay: {
                                 pixelWidth: toNumber(event.target.value, renderStyle.underlay.pixelWidth),
                             },
                         })
    }

    const handleDashEnabled = event => {
        applyRenderStyle({
                             dash: {
                                 enabled: event.target.checked,
                             },
                         })
    }

    const handleDashGapColorInput = event => {
        updateColorState(
            event,
            dashGapColor,
            color => applyRenderStyle({
                                          dash: {
                                              gapColor: color,
                                          },
                                      }),
        )
    }

    const handleDashLengthInput = event => {
        applyRenderStyle({
                             dash: {
                                 dashLength: toNumber(event.target.value, renderStyle.dash.dashLength),
                             },
                         })
    }

    const updateRenderSmoothing = async (updates) => {
        await assignRenderSmoothing($editor, isJourneyScopedSmoothing, smoothing, updates)
    }

    const handleSmoothingEnabled = (event) => {
        void updateRenderSmoothing({enabled: event.target.checked})
    }

    const handleSmoothingStep = (event) => {
        void updateRenderSmoothing({step: event.target.value})
    }

    /**
     * Scene render loop
     */
    const requestRender = useCallback(() => {
        lgs.scene.requestRender()
    }, [])

    useEffect(() => {
        lgs.scene.postUpdate.addEventListener(requestRender)
        return () => lgs.scene.postUpdate.removeEventListener(requestRender)
    }, [requestRender])

    const meterWidthMin = TRACK_METER_WIDTHS[0]
    const meterWidthMax = TRACK_METER_WIDTHS[TRACK_METER_WIDTHS.length - 1]

    if (!track?.visible) {
        return null
    }

    return (
        <div id="track-line-settings">
            <section className="lgs--track-style-section">
                <div className="drawer-horizontal-line lgs--track-style-settings">
                    <WaColorPicker
                        opacity={false}
                        size="small"
                        value={trackColor.color}
                        swatches={lgs.settings.getSwatches.list.join(';')}
                        onChange={handleColorInput}
                        noFormatToggle
                    />
                    <div className="lgs--track-style-controls">
                        <WaSlider
                            ref={_opacityRef}
                            min={0.05}
                            max={1}
                            step={0.05}
                            label-at-start
                            size="small"
                            label="Opacity"
                            value={trackColor.opacity}
                            onInput={handleColorInput}
                            valueFormatter={value => `${Math.round(value * 100)}%`}
                            placement="bottom"
                            withTooltip
                        />
                        <div className="lgs--track-render-grid">
                            <WaNumberInput
                                label-at-start
                                size="small"
                                min={meterWidthMin}
                                max={meterWidthMax}
                                step={0.5}
                                value={renderStyle.meterWidth}
                                onInput={handleMeterWidthInput}
                                appearance="filled"
                            >
                                <span slot="label">Width (m)</span>
                                <span slot="hint">Track width is mapped to meters once it is wider than 2 px on screen.</span>
                            </WaNumberInput>
                            <WaNumberInput
                                ref={_thicknessRef}
                                label-at-start
                                size="small"
                                min={1}
                                max={12}
                                step={0.5}
                                value={renderStyle.farPixelWidth}
                                onInput={handleFarPixelWidthInput}
                                appearance="filled"
                            >
                                <span slot="label">Far width (px)</span>
                                <span slot="hint">Minimum width used from far away so the track remains visible.</span>
                            </WaNumberInput>
                        </div>
                    </div>
                </div>
                <WaSwitch
                    className="lgs--track-style-switch"
                    label-at-start
                    size="xsmall"
                    checked={renderStyle.underlay.enabled}
                    onInput={handleUnderlayEnabled}
                >
                    <span>Underlay</span>
                </WaSwitch>
                {renderStyle.underlay.enabled && (
                    <div className="drawer-horizontal-line lgs--track-style-settings lgs--track-style-subsection">
                        <WaColorPicker
                            opacity={false}
                            size="small"
                            value={underlayColor.color}
                            swatches={lgs.settings.getSwatches.list.join(';')}
                            onChange={handleUnderlayColorInput}
                            noFormatToggle
                        />
                        <div className="lgs--track-style-controls">
                            <WaSlider
                                min={0.05}
                                max={1}
                                step={0.05}
                                label-at-start
                                size="small"
                                label="Opacity"
                                value={underlayColor.opacity}
                                onInput={handleUnderlayColorInput}
                                valueFormatter={value => `${Math.round(value * 100)}%`}
                                placement="bottom"
                                withTooltip
                            />
                            <div className="lgs--track-render-grid">
                                <WaNumberInput
                                    label-at-start
                                    size="small"
                                    min={meterWidthMin}
                                    max={8}
                                    step={0.5}
                                    value={renderStyle.underlay.meterWidth}
                                    onInput={handleUnderlayMeterWidthInput}
                                    appearance="filled"
                                >
                                    <span slot="label">Underlay (m)</span>
                                    <span slot="hint">Wider colored line drawn below the main track.</span>
                                </WaNumberInput>
                                <WaNumberInput
                                    label-at-start
                                    size="small"
                                    min={1}
                                    max={24}
                                    step={0.5}
                                    value={renderStyle.underlay.pixelWidth}
                                    onInput={handleUnderlayPixelWidthInput}
                                    appearance="filled"
                                >
                                    <span slot="label">Far underlay (px)</span>
                                    <span slot="hint">Fallback underlay width while the meter width is too small on screen.</span>
                                </WaNumberInput>
                            </div>
                        </div>
                    </div>
                )}
                <WaSwitch
                    className="lgs--track-style-switch"
                    label-at-start
                    size="xsmall"
                    checked={renderStyle.dash.enabled}
                    onInput={handleDashEnabled}
                >
                    <span>Dashes</span>
                </WaSwitch>
                {renderStyle.dash.enabled && (
                    <div className="drawer-horizontal-line lgs--track-style-settings lgs--track-style-subsection">
                        <WaColorPicker
                            opacity={false}
                            size="small"
                            value={dashGapColor.color}
                            swatches={lgs.settings.getSwatches.list.join(';')}
                            onChange={handleDashGapColorInput}
                            noFormatToggle
                        />
                        <div className="lgs--track-style-controls">
                            <WaSlider
                                min={0}
                                max={1}
                                step={0.05}
                                label-at-start
                                size="small"
                                label="Gap opacity"
                                value={dashGapColor.opacity}
                                onInput={handleDashGapColorInput}
                                valueFormatter={value => `${Math.round(value * 100)}%`}
                                placement="bottom"
                                withTooltip
                            />
                            <WaSlider
                                min={4}
                                max={96}
                                step={1}
                                label-at-start
                                size="small"
                                label="Dash length"
                                value={renderStyle.dash.dashLength}
                                onInput={handleDashLengthInput}
                                valueFormatter={value => `${Math.round(value)} px`}
                                placement="bottom"
                                withTooltip
                            />
                        </div>
                    </div>
                )}
            </section>
            <WaDivider/>
            <WaSwitch
                className="lgs--track-smoothing-switch"
                label-at-start
                size="xsmall"
                checked={smoothing.enabled}
                onInput={handleSmoothingEnabled}
            >
                <span>Smooth render</span>
            </WaSwitch>
            {smoothing.enabled && (
                <div className="lgs--track-smoothing-settings">
                    <WaNumberInput
                        className="lgs--track-smoothing-step"
                        label-at-start
                        size="small"
                        min={TRACK_RENDER_SMOOTHING_MIN_STEP}
                        max={TRACK_RENDER_SMOOTHING_MAX_STEP}
                        step={1}
                        value={smoothing.step}
                        onInput={handleSmoothingStep}
                        appearance="filled"
                    >
                        <span slot="label">Step</span>
                        <span slot="hint">Visual smoothing passes applied only to the rendered track.</span>
                    </WaNumberInput>
                </div>
            )}
        </div>
    )
}
