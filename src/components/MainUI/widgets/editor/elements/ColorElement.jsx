/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ColorElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-10
 * Last modified: 2026-04-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaColorPicker, WaSlider }                        from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                                         from 'colord'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { sanitizeNumericControlValue }                    from './sliderUtils'

/**
 * Standardized color and opacity control element.
 */
export const ColorElement = ({
                                 label,
                                 path,
                                 part,
                                 swatches,
                                 getColor,
                                 updateValue,
                             }) => {
    const sliderRef = useRef(null)

    /**
     * Resolves the color via parent logic.
     * returns an RGBA string.
     */
    const resolvedColor = useMemo(() => getColor(part, path), [part, path, getColor])

    /**
     * Colord instance to extract data.
     */
    const colorObj = useMemo(() => colord(resolvedColor), [resolvedColor])

    /**
     * Extracts current opacity for the slider and for color updates.
     */
    const currentOpacity = useMemo(() => {
        if (part?.opacity !== undefined && part?.opacity !== null) {
            return sanitizeNumericControlValue(part.opacity, colorObj.alpha(), {min: 0, max: 1})
        }
        return sanitizeNumericControlValue(colorObj.alpha(), 1, {min: 0, max: 1})
    }, [part?.opacity, colorObj])

    /**
     * Color for the picker (forced to alpha 1 for display consistency).
     */
    const colorForPicker = useMemo(() => {
        return colorObj.isValid() ? colorObj.alpha(1).toHex() : resolvedColor
    }, [colorObj, resolvedColor])

    /**
     * Handles color change while preserving the current opacity.
     */
    const handleColorInput = useCallback((e) => {
        const newColor = e.target.value
        // We update the color but we also ensure the opacity is explicitly set
        // to prevent syncCSS from falling back to 1.
        updateValue(`${path}.color`, newColor)
        updateValue(`${path}.opacity`, currentOpacity)
    }, [path, updateValue, currentOpacity])

    useEffect(() => {
        if (sliderRef.current) {
            sliderRef.current.value = currentOpacity
        }

        if (part?.opacity !== undefined && part?.opacity !== null && part.opacity !== currentOpacity) {
            updateValue(`${path}.opacity`, currentOpacity)
        }
    }, [currentOpacity, part?.opacity, path, updateValue])

    return (
        <React.Fragment>
            <div className="drawer-horizontal-line"><span>{label}</span></div>
            <div className="drawer-horizontal-line three-columns">
                <div className="drawer-horizontal-element">
                    <WaColorPicker
                        size="small"
                        swatches={swatches}
                        value={colorForPicker}
                        onInput={handleColorInput}
                    />
                </div>
                <div className="drawer-horizontal-element xlarge-element"></div>
                <div className="drawer-horizontal-element xlarge-element">
                    <WaSlider
                        ref={sliderRef}
                        label="Opacity"
                        min="0"
                        max="1"
                        step="0.05"
                        label-at-start
                        placement="top"
                        withTooltip
                        valueFormatter={v => `${Math.floor(v * 100)}%`}
                        defaultValue={currentOpacity}
                        onInput={(e) => updateValue(
                            `${path}.opacity`,
                            sanitizeNumericControlValue(e.target.value, currentOpacity, {min: 0, max: 1}),
                        )}
                    />
                </div>
            </div>
        </React.Fragment>
    )
}
