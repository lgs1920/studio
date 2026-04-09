/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BackgroundElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-09
 * Last modified: 2026-04-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaColorPicker, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                 from 'react'

const fallbackSliderValue = (rawValue, fallback, options = {}) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    const min = Number(options.min)
    const max = Number(options.max)
    let finalValue = numericValue

    if (Number.isFinite(min)) {
        finalValue = Math.max(min, finalValue)
    }

    if (Number.isFinite(max)) {
        finalValue = Math.min(max, finalValue)
    }

    return finalValue
}

export const BackgroundElement = ({
                                      element,
                                      swatches,
                                      getColor,
                                      updateValue,
                                      sanitizeSliderValue = fallbackSliderValue,
                                  }) => {

    /**
     * Handle the main background toggle logic
     * @param {boolean} checked
     */
    const handleToggle = (checked) => {
        updateValue('background.show', checked)
        if (!checked) {
            updateValue('background.blur', false)
            updateValue('background.opacity', 0)
        }
    }

    return (
        <>
            <WaSwitch label-at-start size="xsmall" checked={element.background?.show ?? false}
                      onInput={(e) => handleToggle(e.target.checked)}>
                <label>{'Background'}</label>
            </WaSwitch>

            {element.background?.show && (
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        <WaColorPicker size="small" swatches={swatches}
                                       value={getColor(element.background)}
                                       onInput={(e) => updateValue('background.color', e.target.value)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Blur'}&nbsp;
                        <WaSwitch label-at-start size="xsmall" checked={element.background.blur ?? false}
                                  onChange={(e) => updateValue('background.blur', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element xlarge-element">
                        <WaSlider label="Opacity"
                                  min="0" max="1" step="0.05"
                                  label-at-start
                                  placement="top"
                                  size="small"
                                  withTooltip
                                  valueFormatter={value => `${Math.floor(value * 100)}%`}
                                  value={sanitizeSliderValue(element.background?.opacity, 0.5, {min: 0, max: 1})}
                                  onInput={(e) => updateValue(
                                      'background.opacity',
                                      sanitizeSliderValue(e.target.value, 0.5, {min: 0, max: 1}),
                                  )}/>
                    </div>
                </div>
            )}
        </>
    )
}
