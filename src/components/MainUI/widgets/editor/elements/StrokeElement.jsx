/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StrokeElement.jsx
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

import { WaColorPicker, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                            from 'colord'
import React, { useEffect, useMemo, useRef } from 'react'
import { sanitizeNumericControlValue }       from './sliderUtils'

/**
 * Text Stroke editor element.
 * Cloned from BorderElement logic with strict separation of color and opacity.
 */
export const StrokeElement = ({
                                  element,
                                  swatches,
                                  getColor,
                                  updateValue,
                              }) => {
    const stroke = element.text?.stroke ?? {}
    const widthRef = useRef(null)
    const opacityRef = useRef(null)
    const strokeWidth = sanitizeNumericControlValue(stroke.width, 0, {min: 0, max: 2})
    const strokeOpacity = sanitizeNumericControlValue(stroke.opacity, 1, {min: 0, max: 1})

    /**
     * Get the raw color and ensure it is treated as opaque for the picker.
     */
    const colorForPicker = useMemo(() => {
        const rawColor = getColor(stroke, 'text.stroke.color')
        return colord(rawColor).alpha(1).toHex()
    }, [stroke, getColor])

    useEffect(() => {
        if (widthRef.current) {
            widthRef.current.value = strokeWidth
        }
        if (opacityRef.current) {
            opacityRef.current.value = strokeOpacity
        }

        if (stroke.width !== undefined && stroke.width !== null && stroke.width !== strokeWidth) {
            updateValue('text.stroke.width', strokeWidth)
        }
        if (stroke.opacity !== undefined && stroke.opacity !== null && stroke.opacity !== strokeOpacity) {
            updateValue('text.stroke.opacity', strokeOpacity)
        }
    }, [stroke.width, stroke.opacity, strokeWidth, strokeOpacity, updateValue])

    return (
        <React.Fragment>
            <WaSwitch
                label-at-start
                size="xsmall"
                checked={stroke.show ?? false}
                onInput={(e) => updateValue('text.stroke.show', e.target.checked)}
            >
                <span>Text Stroke</span>
            </WaSwitch>

            {stroke.show && (
                <React.Fragment>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <WaColorPicker
                                size="small"
                                swatches={swatches}
                                value={colorForPicker}
                                onInput={(e) => {
                                    // Update color without alpha channel
                                    const newColor = colord(e.target.value).alpha(1).toHex()
                                    updateValue('text.stroke.color', newColor)
                                }}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <WaSlider
                                ref={widthRef}
                                label="Width"
                                min="0"
                                max="2"
                                step="0.1"
                                label-at-start
                                placement="top"
                                withTooltip
                                defaultValue={strokeWidth}
                                onInput={(e) => updateValue(
                                    'text.stroke.width',
                                    sanitizeNumericControlValue(e.target.value, 0, {min: 0, max: 2}),
                                )}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <WaSlider
                                ref={opacityRef}
                                label="Opacity"
                                min="0"
                                max="1"
                                step="0.05"
                                label-at-start
                                placement="top"
                                withTooltip
                                valueFormatter={value => `${Math.floor(value * 100)}%`}
                                defaultValue={strokeOpacity}
                                onInput={(e) => updateValue(
                                    'text.stroke.opacity',
                                    sanitizeNumericControlValue(e.target.value, 1, {min: 0, max: 1}),
                                )}
                            />
                        </div>
                    </div>
                </React.Fragment>
            )}
        </React.Fragment>
    )
}
