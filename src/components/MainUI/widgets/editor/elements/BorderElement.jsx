/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
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

import { WIDGET_RADIUS }                                        from '@Core/constants'
import { SlColorPicker, SlOption, SlRange, SlSelect, SlSwitch }  from '@shoelace-style/shoelace/dist/react'
import { WaColorPicker, WaOption, WaSelect, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                                     from 'react'

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

/**
 * Common border & radius editor element
 * @param {Object} props
 * @param {boolean} [props.showRadius=true] - MUST be used to toggle visibility
 */
export const BorderElement = ({
                                  element,
                                  swatches,
                                  getColor,
                                  updateValue,
                                  showPill = false,
                                  showRadius = true,
                                  sanitizeSliderValue = fallbackSliderValue,
                              }) => {
    const currentRadius = element.border?.radius ?? 'none'

    /**
     * Handles radius selection and updates the pill flag.
     */
    const handleRadiusChange = (e) => {
        const val = Array.isArray(e.target.value) ? e.target.value[0] : e.target.value

        // Update the radius name (e.g., 'm', 'l', 'pill')
        updateValue('border.radius', val)

        // Update the pill boolean based on the selection
        updateValue('border.pill', val === 'pill')
    }

    return (
        <div>
            <WaSwitch
                label-at-start
                size="xsmall"
                checked={element.border?.show ?? false}
                onInput={(e) => updateValue('border.show', e.target.checked)}
            >
                <span>{'Border'}</span>
            </WaSwitch>

            {element.border?.show && (
                <>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <WaColorPicker
                                size="small"
                                swatches={swatches}
                                value={getColor(element.border)}
                                onInput={(e) => updateValue('border.color', e.target.value)}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <WaSlider
                                withTooltip
                                size="small"
                                label="Width"
                                min="0"
                                max="10"
                                step="0.5"
                                label-at-start
                                placement="top"
                                value={sanitizeSliderValue(element.border?.thickness, 1, {min: 0, max: 10})}
                                onInput={(e) => updateValue(
                                    'border.thickness',
                                    sanitizeSliderValue(e.target.value, 1, {min: 0, max: 10}),
                                )}
                            />
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <WaSlider
                                withTooltip
                                size="small"
                                label="Opacity"
                                min="0"
                                max="1"
                                step="0.05"
                                label-at-start
                                placement="top"
                                valueFormatter={value => `${Math.floor(value * 100)}%`}
                                value={sanitizeSliderValue(element.border?.opacity, 1, {min: 0, max: 1})}
                                onInput={(e) => updateValue(
                                    'border.opacity',
                                    sanitizeSliderValue(e.target.value, 1, {min: 0, max: 1}),
                                )}
                            />
                        </div>
                    </div>

                    {showRadius && (
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element xlarge-element">
                                <WaSelect
                                    size="small"
                                    label={'Radius'}
                                    label-at-start
                                    style={{marginLeft: 'auto', width: '10rem'}}
                                    value={currentRadius}
                                    onChange={handleRadiusChange}
                                >
                                    {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => {
                                        if (!showPill && _key === 'pill') {
                                            return null
                                        }
                                        return (
                                            <WaOption key={_key} value={_key}>
                                                {_data.name}
                                            </WaOption>
                                        )
                                    })}
                                </WaSelect>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
