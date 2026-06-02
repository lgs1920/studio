/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackRenderStyle.js
 *
 ******************************************************************************/

import { colord } from 'colord'

export const TRACK_RENDER_WIDTH_UNITS = Object.freeze({
    PIXELS: 'pixels',
    METERS: 'meters',
})

export const TRACK_METER_WIDTHS = Object.freeze([0.5, 1, 1.5, 2])
export const TRACK_RENDER_STYLE_CUSTOM_PRESET = 'custom'
export const TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR = 'rgba(255, 255, 255, 0)'
export const TRACK_RENDER_STYLE_DEFAULT_GAP_COLOR = 'rgba(255, 255, 255, 1)'

export const TRACK_RENDER_STYLE_DEFAULT = Object.freeze({
    presetKey:           TRACK_RENDER_STYLE_CUSTOM_PRESET,
    widthUnit:           TRACK_RENDER_WIDTH_UNITS.METERS,
    meterWidth:          1,
    farPixelWidth:       2,
    meterPixelThreshold: 2,
    underlay:            {
        enabled:    false,
        color:      'rgba(0, 0, 0, 0.45)',
        meterWidth: 2,
        pixelWidth: 6,
    },
    dash:                {
        enabled:     false,
        biColor:     false,
        gapColor:    TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
        dashLength:  16,
        gapLength:   16,
        dashPattern: 255,
    },
})

export const TRACK_RENDER_STYLE_PRESETS = Object.freeze([
    {
        key:   'solid',
        label: 'Solid',
        style: {
            meterWidth:    1,
            farPixelWidth: 2,
            underlay:      {
                enabled: false,
            },
            dash:          {
                enabled: false,
            },
        },
    },
    {
        key:   'outlined',
        label: 'Outlined',
        style: {
            meterWidth:    1,
            farPixelWidth: 2,
            underlay:      {
                enabled:    true,
                color:      'rgba(0, 0, 0, 0.55)',
                meterWidth: 2,
                pixelWidth: 6,
            },
            dash:          {
                enabled: false,
            },
        },
    },
    {
        key:   'soft',
        label: 'Soft',
        style: {
            meterWidth:    1,
            farPixelWidth: 2,
            underlay:      {
                enabled:    true,
                color:      'rgba(255, 255, 255, 0.35)',
                meterWidth: 2.5,
                pixelWidth: 7,
            },
            dash:          {
                enabled: false,
            },
        },
    },
    {
        key:   'dashed',
        label: 'Dashed',
        style: {
            meterWidth:    1,
            farPixelWidth: 3,
            underlay:      {
                enabled:    false,
                color:      'rgba(0, 0, 0, 0.45)',
                meterWidth: 2,
                pixelWidth: 6,
            },
            dash:          {
                enabled:    true,
                biColor:    false,
                gapColor:   TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
                dashLength: 18,
                gapLength:  18,
            },
        },
    },
    {
        key:   'alternating',
        label: 'Two tones',
        style: {
            meterWidth:    1,
            farPixelWidth: 3,
            underlay:      {
                enabled:    true,
                color:      'rgba(0, 0, 0, 0.45)',
                meterWidth: 2.5,
                pixelWidth: 7,
            },
            dash:          {
                enabled:    true,
                biColor:    true,
                gapColor:   'rgba(30, 144, 255, 0.85)',
                dashLength: 16,
                gapLength:  16,
            },
        },
    },
])

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max, fallback) => {
    const number = finiteNumber(value) ?? fallback
    return Math.min(max, Math.max(min, number))
}

export const getTrackDashPattern = (dashLength, gapLength) => {
    const dash = Math.max(1, finiteNumber(dashLength) ?? TRACK_RENDER_STYLE_DEFAULT.dash.dashLength)
    const gap = Math.max(1, finiteNumber(gapLength) ?? TRACK_RENDER_STYLE_DEFAULT.dash.gapLength)
    const enabledBits = Math.min(16, Math.max(1, Math.round((dash / (dash + gap)) * 16)))

    return enabledBits >= 16 ? 65535 : (1 << enabledBits) - 1
}

export const isTransparentTrackColor = value => {
    if (value === null || value === undefined || value === '' || value === 'transparent') {
        return true
    }

    const color = colord(value)
    return !color.isValid() || color.alpha() <= 0
}

export const visibleTrackDashGapColor = value => {
    const color = colord(value ?? '')
    return color.isValid() && color.alpha() > 0 ? color.toRgbString() : TRACK_RENDER_STYLE_DEFAULT_GAP_COLOR
}

export const normalizeTrackRenderStyle = (value = undefined, legacy = {}) => {
    const style = value && typeof value === 'object' ? value : {}
    const defaultStyle = TRACK_RENDER_STYLE_DEFAULT
    const color = style.color ?? legacy.color ?? '#ffffff'
    const farPixelWidth = clamp(
        style.farPixelWidth ?? style.pixelWidth ?? legacy.thickness,
        1,
        20,
        defaultStyle.farPixelWidth,
    )
    const meterWidth = clamp(style.meterWidth, 0.1, 20, defaultStyle.meterWidth)
    const underlay = style.underlay && typeof style.underlay === 'object' ? style.underlay : {}
    const dash = style.dash && typeof style.dash === 'object' ? style.dash : {}
    const dashLength = clamp(dash.dashLength, 4, 96, defaultStyle.dash.dashLength)
    const gapLength = clamp(dash.gapLength, 4, 96, defaultStyle.dash.gapLength)
    const rawGapColor = dash.gapColor ?? defaultStyle.dash.gapColor
    const legacyBiColor = dash.biColor === undefined && !isTransparentTrackColor(rawGapColor)
    const biColor = dash.biColor === true || legacyBiColor

    return {
        widthUnit:           style.widthUnit === TRACK_RENDER_WIDTH_UNITS.PIXELS
                             ? TRACK_RENDER_WIDTH_UNITS.PIXELS
                             : TRACK_RENDER_WIDTH_UNITS.METERS,
        presetKey:           typeof style.presetKey === 'string' ? style.presetKey : defaultStyle.presetKey,
        color,
        meterWidth,
        farPixelWidth,
        meterPixelThreshold: clamp(style.meterPixelThreshold, 0.5, 8, defaultStyle.meterPixelThreshold),
        underlay:            {
            enabled:    underlay.enabled === true,
            color:      underlay.color ?? defaultStyle.underlay.color,
            meterWidth: Math.max(
                meterWidth,
                clamp(underlay.meterWidth, 0.1, 30, Math.max(defaultStyle.underlay.meterWidth, meterWidth + 1)),
            ),
            pixelWidth: Math.max(
                farPixelWidth,
                clamp(underlay.pixelWidth, 1, 32, Math.max(defaultStyle.underlay.pixelWidth, farPixelWidth + 4)),
            ),
        },
        dash:                {
            enabled:     dash.enabled === true,
            biColor,
            color,
            gapColor:    biColor ? visibleTrackDashGapColor(rawGapColor) : TRACK_RENDER_STYLE_TRANSPARENT_GAP_COLOR,
            dashLength,
            gapLength,
            dashPattern: getTrackDashPattern(dashLength, gapLength),
        },
    }
}
