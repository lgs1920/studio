/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackStyleSettings.jsx
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

import { DRAW_THEN_SAVE }                           from '@Core/constants'
import { TrackUtils }                               from '@Utils/cesium/TrackUtils'
import {
    TRACK_RENDER_SMOOTHING_MAX_STEP, TRACK_RENDER_SMOOTHING_MIN_STEP, defaultTrackRenderSmoothing,
    normalizeTrackRenderSmoothing,
}                                                   from '@Utils/cesium/trackRenderSmoothing'
import {
    TRACK_METER_WIDTHS,
    TRACK_RENDER_STYLE_CUSTOM_PRESET,
    TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
    TRACK_RENDER_STYLE_PRESETS,
    normalizeTrackRenderStyle,
    visibleTrackDashGapColor,
}                                                   from '@Utils/cesium/trackRenderStyle'
import {
    formatSliderPercent,
    sanitizeNumericControlValue,
}                                                   from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import {
    WaColorPicker, WaDivider, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch,
}                                                   from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                                   from 'colord'
import { useCallback, useEffect, useRef }           from 'react'
import { useSnapshot }                              from 'valtio'
import { Utils }                                    from '../Utils'
import { TrackStylePreview }                        from './TrackStylePreview'

const toNumber = (value, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

const toColorValue = value => {
    const color = colord(value ?? '#ffffff')
    return color.isValid() ? color.toRgbString() : '#ffffff'
}

const toOpaqueColorValue = value => {
    const color = colord(value ?? '#ffffff')
    return color.isValid() ? color.alpha(1).toHex() : '#ffffff'
}

const getOpacityValue = value => {
    const color = colord(value ?? '#ffffff')
    return sanitizeNumericControlValue(color.isValid() ? color.alpha() : 1, 1, {min: 0, max: 1})
}

const composeColorValue = (color, opacity) => {
    const nextColor = colord(color ?? '#ffffff')
    const nextOpacity = sanitizeNumericControlValue(opacity, 1, {min: 0, max: 1})
    return (nextColor.isValid() ? nextColor : colord('#ffffff')).alpha(nextOpacity).toRgbString()
}

const TrackStyleField = ({label, hint, className = '', children}) => (
    <div className={`lgs--track-style-field ${className}`.trim()}>
        <span className="lgs--track-style-label">{label}</span>
        {children}
        {hint && <span className="lgs--track-style-input-hint">{hint}</span>}
    </div>
)

const TrackStyleColorField = ({label, hint, value, onChange, className = ''}) => (
    <TrackStyleField label={label} hint={hint} className={`lgs--track-style-color-field ${className}`.trim()}>
        <div className="lgs--track-style-color-control">
            <WaColorPicker
                className="lgs--track-style-color-picker"
                size="s"
                aria-label={label}
                value={toOpaqueColorValue(value)}
                swatches={lgs.settings.getSwatches.list.join(';')}
                onInput={(event) => onChange(composeColorValue(event.target.value, getOpacityValue(value)))}
            />
            <WaSlider
                className="lgs--track-style-opacity-slider"
                size="s"
                label="Opacity"
                min="0"
                max="1"
                step="0.05"
                label-at-start
                width-auto
                placement="top"
                withTooltip
                value={getOpacityValue(value)}
                valueFormatter={formatSliderPercent}
                onInput={(event) => onChange(composeColorValue(toOpaqueColorValue(value), event.target.value))}
            />
        </div>
    </TrackStyleField>
)

const TrackStyleNumberField = ({label, unit, hint, className = '', ...props}) => (
    <TrackStyleField
        label={unit ? `${label} (${unit})` : label}
        hint={hint}
        className={`lgs--track-style-number-field ${className}`.trim()}
    >
        <WaNumberInput
            className="lgs--track-style-number-input"
            size="s"
            appearance="filled"
            {...props}
        />
    </TrackStyleField>
)

const TrackStyleControlGroup = ({colorLabel = 'Color', color, onColorChange, fields = [], className = ''}) => (
    <div className={`lgs--track-style-control-group ${className}`.trim()}>
        <TrackStyleColorField
            label={colorLabel}
            value={color}
            onChange={onColorChange}
        />
        {fields.length > 0 && (
            <div className={`lgs--track-style-field-grid ${fields.length === 1 ? 'is-single' : ''}`.trim()}>
                {fields.map(({key, ...field}) => (
                    <TrackStyleNumberField key={key ?? field.label} {...field}/>
                ))}
            </div>
        )}
    </div>
)

const mergeRenderStyle = (baseStyle, updates, legacy = {}) => normalizeTrackRenderStyle({
                                                                                            ...baseStyle,
                                                                                            ...updates,
                                                                                            underlay: {
                                                                                                ...baseStyle.underlay,
                                                                                                ...updates.underlay,
                                                                                            },
                                                                                            dash:     {
                                                                                                ...baseStyle.dash,
                                                                                                ...updates.dash,
                                                                                            },
                                                                                        },
                                                                                        legacy)

const assignTrackRenderStyle = (editor, updates) => {
    if (!editor.track) {
        return false
    }

    const currentStyle = normalizeTrackRenderStyle(editor.track.renderStyle, {
        color:     editor.track.color,
        thickness: editor.track.thickness,
    })
    const nextStyle = mergeRenderStyle(currentStyle, updates, {
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
export const TrackStyleSettings = ({showTitle = true}) => {
    const $editor = lgs.theJourneyEditorProxy
    const {journey, track} = useSnapshot($editor)

    const _saveTimeoutRef = useRef(null)
    const isJourneyScopedSmoothing = (journey?.tracks?.size ?? 0) <= 1
    const smoothingSource = isJourneyScopedSmoothing
                            ? (journey?.renderSmoothing ?? track?.renderSmoothing)
                            : track?.renderSmoothing
    const smoothing = normalizeTrackRenderSmoothing(smoothingSource, defaultTrackRenderSmoothing())
    const renderStyle = normalizeTrackRenderStyle(track?.renderStyle, {
        color:     track?.color,
        thickness: track?.thickness,
    })

    useEffect(() => {
        if (!$editor.track) {
            TrackUtils.setTheTrack(false)
        }
    }, [$editor])

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

    const applyRenderStyle = (updates, {afterSave = null, keepPreset = false} = {}) => {
        const nextUpdates = keepPreset || updates.presetKey
                            ? updates
                            : {
                                ...updates,
                                presetKey: TRACK_RENDER_STYLE_CUSTOM_PRESET,
                            }
        if (assignTrackRenderStyle($editor, nextUpdates)) {
            scheduleTrackUpdate(afterSave)
        }
    }

    const handleColorInput = (color) => {
        const nextColor = toColorValue(color)
        const updates = {color: nextColor}

        if (renderStyle.dash.enabled) {
            updates.dash = {color: nextColor}
        }

        applyRenderStyle(
            updates,
            {afterSave: () => __.ui.profiler?.updateColor()},
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

    const handleUnderlayColorInput = color => {
        applyRenderStyle({
                             underlay: {
                                 color: toColorValue(color),
                             },
                         })
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
                                 color:   renderStyle.color,
                             },
                         })
    }

    const handleDashColorInput = color => handleColorInput(color)

    const handleDashGapColorInput = color => {
        applyRenderStyle({
                             dash: {
                                 gapColor: toColorValue(color),
                             },
                         })
    }

    const handleDashBiColor = event => {
        const biColor = event.target.checked
        applyRenderStyle({
                             dash: {
                                 biColor,
                                 color:    biColor ? renderStyle.dash.color : renderStyle.color,
                                 gapColor: biColor
                                           ? visibleTrackDashGapColor(renderStyle.dash.gapColor)
                                           : TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
                             },
                         })
    }

    const handleDashLengthInput = event => {
        applyRenderStyle({
                             dash: {
                                 dashLength: toNumber(event.target.value, renderStyle.dash.dashLength),
                             },
                         })
    }

    const handleDashGapLengthInput = event => {
        applyRenderStyle({
                             dash: {
                                 gapLength: toNumber(event.target.value, renderStyle.dash.gapLength),
                             },
                         })
    }

    const getPresetRenderStyle = preset => {
        const presetStyle = preset.style ?? {}
        const presetDash = presetStyle.dash ?? {}

        return mergeRenderStyle(renderStyle, {
            ...presetStyle,
            color:     renderStyle.color,
            presetKey: preset.key,
            dash:      {
                ...presetDash,
                color: renderStyle.color,
            },
        }, {
            color:     track?.color,
            thickness: track?.thickness,
        })
    }

    const handlePresetChange = event => {
        const presetKey = event.target.value
        if (presetKey === TRACK_RENDER_STYLE_CUSTOM_PRESET) {
            applyRenderStyle({presetKey}, {keepPreset: true})
            return
        }

        const preset = TRACK_RENDER_STYLE_PRESETS.find(item => item.key === presetKey)
        if (!preset) {
            return
        }

        applyRenderStyle(getPresetRenderStyle(preset),
                         {
                             afterSave:  () => __.ui.profiler?.updateColor(),
                             keepPreset: true,
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
    const selectedPresetKey = TRACK_RENDER_STYLE_PRESETS.some(preset => preset.key === renderStyle.presetKey)
                              ? renderStyle.presetKey
                              : TRACK_RENDER_STYLE_CUSTOM_PRESET
    const selectedPreset = TRACK_RENDER_STYLE_PRESETS.find(preset => preset.key === selectedPresetKey)
    const selectedPresetPreviewStyle = selectedPreset ? getPresetRenderStyle(selectedPreset) : renderStyle
    const dashLengthField = {
        key:     'dash-length',
        label:   'Dash length',
        unit:    'px',
        hint:    'Visible dash segment length.',
        min:     4,
        max:     96,
        step:    1,
        value:   renderStyle.dash.dashLength,
        onInput: handleDashLengthInput,
    }
    const gapLengthField = {
        key:     'gap-length',
        label:   'Gap Length',
        unit:    'px',
        hint:    'Gap segment length.',
        min:     4,
        max:     96,
        step:    1,
        value:   renderStyle.dash.gapLength,
        onInput: handleDashGapLengthInput,
    }

    if (!track?.visible) {
        return null
    }

    return (
        <div id="track-line-settings">
            {showTitle && <WaDivider/>}
            <section className="lgs--track-style-section">
                {showTitle && <h3 className="lgs--track-style-title">Track style</h3>}
                <WaSwitch
                    className="lgs--track-style-switch"
                    label-at-start
                    size="xs"
                    checked={smoothing.enabled}
                    onInput={handleSmoothingEnabled}
                >
                    <span>Smooth render</span>
                </WaSwitch>
                {smoothing.enabled && (
                    <div className="lgs--track-style-subsection">
                        <div className="lgs--track-style-field-grid is-single">
                            <TrackStyleNumberField
                                label="Step"
                                hint="Visual smoothing passes applied only to the rendered track."
                                min={TRACK_RENDER_SMOOTHING_MIN_STEP}
                                max={TRACK_RENDER_SMOOTHING_MAX_STEP}
                                step={1}
                                value={smoothing.step}
                                onInput={handleSmoothingStep}
                            />
                        </div>
                    </div>
                )}
                <WaDivider/>
                <TrackStyleField
                    label="Preset"
                    hint="Choose a starting style. Manual changes switch it to Custom."
                    className="lgs--track-style-preset-field"
                >
                    <WaSelect appearance="filled"
                        className="lgs--track-style-preset-select"
                        size="s"
                        value={selectedPresetKey}
                        onChange={handlePresetChange}
                    >
                        <div slot="start" className="lgs--track-style-preview-slot">
                            <TrackStylePreview track={track} renderStyle={selectedPresetPreviewStyle}/>
                        </div>
                        <WaOption value={TRACK_RENDER_STYLE_CUSTOM_PRESET}>
                            <div slot="start" className="lgs--track-style-preview-slot">
                                <TrackStylePreview track={track} renderStyle={renderStyle}/>
                            </div>
                            Custom
                        </WaOption>
                        {TRACK_RENDER_STYLE_PRESETS.map(preset => (
                            <WaOption key={preset.key} value={preset.key}>
                                <div slot="start" className="lgs--track-style-preview-slot">
                                    <TrackStylePreview track={track} renderStyle={getPresetRenderStyle(preset)}/>
                                </div>
                                {preset.label}
                            </WaOption>
                        ))}
                    </WaSelect>
                </TrackStyleField>
                <TrackStyleControlGroup
                    colorLabel="Color"
                    color={renderStyle.color}
                    onColorChange={handleColorInput}
                    fields={[
                        {
                            key:     'meter-width',
                            label:   'Width',
                            unit:    'm',
                            hint:    'Used once the projected width is wider than 2 px.',
                            min:     meterWidthMin,
                            max:     meterWidthMax,
                            step:    0.5,
                            value:   renderStyle.meterWidth,
                            onInput: handleMeterWidthInput,
                        },
                        {
                            key:     'far-pixel-width',
                            label:   'Far Width',
                            unit:    'px',
                            hint:    'Minimum width from far away.',
                            min:     1,
                            max:     12,
                            step:    0.5,
                            value:   renderStyle.farPixelWidth,
                            onInput: handleFarPixelWidthInput,
                        },
                    ]}
                />
                <WaDivider/>
                <WaSwitch
                    className="lgs--track-style-switch"
                    label-at-start
                    size="xs"
                    checked={renderStyle.underlay.enabled}
                    onInput={handleUnderlayEnabled}
                >
                    <span>Underlay</span>
                </WaSwitch>
                {renderStyle.underlay.enabled && (
                    <TrackStyleControlGroup
                        className="lgs--track-style-subsection"
                        colorLabel="Color"
                        color={renderStyle.underlay.color}
                        onColorChange={handleUnderlayColorInput}
                        fields={[
                            {
                                key:     'underlay-meter-width',
                                label:   'Width',
                                unit:    'm',
                                hint:    'Wider line below the main track.',
                                min:     meterWidthMin,
                                max:     8,
                                step:    0.5,
                                value:   renderStyle.underlay.meterWidth,
                                onInput: handleUnderlayMeterWidthInput,
                            },
                            {
                                key:     'underlay-pixel-width',
                                label:   'Far Width',
                                unit:    'px',
                                hint:    'Fallback underlay width from far away.',
                                min:     1,
                                max:     24,
                                step:    0.5,
                                value:   renderStyle.underlay.pixelWidth,
                                onInput: handleUnderlayPixelWidthInput,
                            },
                        ]}
                    />
                )}
                <WaDivider/>
                <WaSwitch
                    className="lgs--track-style-switch"
                    label-at-start
                    size="xs"
                    checked={renderStyle.dash.enabled}
                    onInput={handleDashEnabled}
                >
                    <span>Dashes</span>
                </WaSwitch>
                {renderStyle.dash.enabled && (
                    <div className="lgs--track-style-dash-grid lgs--track-style-subsection">
                        <div className="lgs--track-style-field-grid">
                            <TrackStyleNumberField {...dashLengthField}/>
                            <TrackStyleNumberField {...gapLengthField}/>
                        </div>
                        <WaSwitch
                            className="lgs--track-style-switch"
                            label-at-start
                            size="xs"
                            checked={renderStyle.dash.biColor}
                            onInput={handleDashBiColor}
                        >
                            <span>Bicolor</span>
                        </WaSwitch>
                        {renderStyle.dash.biColor && (
                            <div className="lgs--track-style-dash-colors">
                                <section className="lgs--track-style-dash-column">
                                    <TrackStyleColorField
                                        label="Dash"
                                        value={renderStyle.color}
                                        onChange={handleDashColorInput}
                                    />
                                </section>
                                <section className="lgs--track-style-dash-column">
                                    <TrackStyleColorField
                                        label="Gap"
                                        value={renderStyle.dash.gapColor}
                                        onChange={handleDashGapColorInput}
                                    />
                                </section>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
