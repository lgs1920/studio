/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackRenderStyle.js
 *
 ******************************************************************************/

export const TRACK_RENDER_WIDTH_UNITS = Object.freeze({
    PIXELS: 'pixels',
    METERS: 'meters',
})

export const TRACK_METER_WIDTHS = Object.freeze([0.5, 1, 1.5, 2])

export const TRACK_RENDER_STYLE_DEFAULT = Object.freeze({
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
        gapColor:    'rgba(255, 255, 255, 0)',
        dashLength:  16,
        dashPattern: 255,
    },
})

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max, fallback) => {
    const number = finiteNumber(value) ?? fallback
    return Math.min(max, Math.max(min, number))
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

    return {
        widthUnit:           style.widthUnit === TRACK_RENDER_WIDTH_UNITS.PIXELS
                             ? TRACK_RENDER_WIDTH_UNITS.PIXELS
                             : TRACK_RENDER_WIDTH_UNITS.METERS,
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
            gapColor:    dash.gapColor ?? defaultStyle.dash.gapColor,
            dashLength:  clamp(dash.dashLength, 4, 96, defaultStyle.dash.dashLength),
            dashPattern: clamp(dash.dashPattern, 1, 65535, defaultStyle.dash.dashPattern),
        },
    }
}

