/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaColorPicker, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { RadiusElement }                     from './RadiusElement'
import { ScaleSwitchElement }                from './ScaleSwitchElement'
import { formatSliderPercent, sanitizeNumericControlValue } from './sliderUtils'

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
                                  showScale = true,
                                  showRadiusScale = true,
                                  sanitizeSliderValue = sanitizeNumericControlValue,
                              }) => {
    const borderOpacity = sanitizeSliderValue(element.border?.opacity, 1, {min: 0, max: 1})

    return (
        <div className="lgs-border-element">
            <WaSwitch
                label-at-start
                size="xs"
                checked={element.border?.show ?? false}
                onInput={(e) => updateValue('border.show', e.target.checked)}
            >
                <span>{'Border'}</span>
            </WaSwitch>

            {element.border?.show && (
                <div>
                    <WaColorPicker
                        size="s"
                        swatches={swatches}
                        value={getColor(element.border)}
                        onInput={(e) => updateValue('border.color', e.target.value)}
                    />
                    <div>
                        <WaSlider
                            half-width
                            withTooltip
                            size="s"
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
                        <WaSlider
                            half-width
                            withTooltip
                            size="s"
                            label="Opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            label-at-start
                            placement="top"
                            valueFormatter={formatSliderPercent}
                            value={borderOpacity}
                            onInput={(e) => updateValue(
                                'border.opacity',
                                sanitizeSliderValue(e.target.value, borderOpacity, {min: 0, max: 1}),
                            )}
                        />

                        {showScale && (
                            <ScaleSwitchElement
                                checked={element.border?.scaled ?? false}
                                onChange={(checked) => updateValue('border.scaled', checked)}
                            />
                        )}

                        {showRadius && (
                            <RadiusElement
                                element={element}
                                updateValue={updateValue}
                                showPill={showPill}
                                showScale={showRadiusScale}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
