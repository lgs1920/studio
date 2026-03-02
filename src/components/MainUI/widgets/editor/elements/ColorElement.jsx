/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ColorElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-22
 * Last modified: 2026-02-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlColorPicker, SlRange } from '@shoelace-style/shoelace/dist/react'
import { colord }         from 'colord'
import React, { useMemo, useCallback } from 'react'

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
            return part.opacity
        }
        return colorObj.alpha()
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

    return (
        <React.Fragment>
            <div className="drawer-horizontal-line"><span>{label}</span></div>
            <div className="drawer-horizontal-line three-columns">
                <div className="drawer-horizontal-element">
                    <SlColorPicker
                        size="small"
                        swatches={swatches}
                        value={colorForPicker}
                        onSlInput={handleColorInput}
                    />
                </div>
                <div className="drawer-horizontal-element xlarge-element"></div>
                <div className="drawer-horizontal-element xlarge-element">
                    <SlRange
                        label="Opacity"
                        min="0"
                        max="1"
                        step="0.05"
                        align-right
                        tooltip="top"
                        tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                        value={currentOpacity}
                        onSlInput={(e) => updateValue(`${path}.opacity`, parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </React.Fragment>
    )
}