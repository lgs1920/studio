/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StrokeElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-24
 * Last modified: 2026-02-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlColorPicker, SlRange, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { colord }                           from 'colord'
import React, { useMemo }                   from 'react'

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

    /**
     * Get the raw color and ensure it is treated as opaque for the picker.
     */
    const colorForPicker = useMemo(() => {
        const rawColor = getColor(stroke, 'text.stroke.color')
        return colord(rawColor).alpha(1).toHex()
    }, [stroke, getColor])

    return (
        <React.Fragment>
            <SlSwitch
                align-right
                size="x-small"
                checked={stroke.show ?? false}
                onSlInput={(e) => updateValue('text.stroke.show', e.target.checked)}
            >
                <span>Text Stroke</span>
            </SlSwitch>

            {stroke.show && (
                <React.Fragment>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker
                                size="small"
                                swatches={swatches}
                                value={colorForPicker}
                                onSlInput={(e) => {
                                    // Update color without alpha channel
                                    const newColor = colord(e.target.value).alpha(1).toHex()
                                    updateValue('text.stroke.color', newColor)
                                }}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange
                                label="Width"
                                min="0"
                                max="2"
                                step="0.1"
                                align-right
                                tooltip="top"
                                value={stroke.width ?? 0}
                                onSlInput={(e) => updateValue('text.stroke.width', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange
                                label="Opacity"
                                min="0"
                                max="1"
                                step="0.05"
                                align-right
                                tooltip="top"
                                tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                value={stroke.opacity ?? 1}
                                onSlInput={(e) => updateValue('text.stroke.opacity', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </React.Fragment>
            )}
        </React.Fragment>
    )
}