/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BackgroundElement.jsx
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
import { useEffect, useRef } from 'react'
import { formatSliderPercent, sanitizeNumericControlValue } from './sliderUtils'

export const BackgroundElement = ({
                                      element,
                                      swatches,
                                      getColor,
                                      updateValue,
                                      sanitizeSliderValue = sanitizeNumericControlValue,
                                  }) => {
    const sliderRef = useRef(null)
    const opacityValue = sanitizeSliderValue(element.background?.opacity, 0.5, {min: 0, max: 1})

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

    useEffect(() => {
        if (sliderRef.current) {
            sliderRef.current.value = opacityValue
        }

        if (element.background?.opacity !== undefined && element.background?.opacity !== null && element.background?.opacity !== opacityValue) {
            updateValue('background.opacity', opacityValue)
        }
    }, [element.background?.opacity, opacityValue, updateValue])

    return (
        <div className="lgs-widget-background-element">
            <WaSwitch
                label-at-start
                size="xs"
                checked={element.background?.show ?? false}
                onInput={(e) => handleToggle(e.target.checked)}
            >
                <span>{'Background'}</span>
            </WaSwitch>

            {element.background?.show && (
                <div>
                    <WaColorPicker
                        size="s"
                        swatches={swatches}
                        value={getColor(element.background)}
                        onInput={(e) => updateValue('background.color', e.target.value)}
                    />
                    <div>
                        <WaSlider
                            ref={sliderRef}
                            half-width
                            label="Opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            label-at-start
                            placement="top"
                            size="s"
                            withTooltip
                            valueFormatter={formatSliderPercent}
                            defaultValue={opacityValue}
                            onInput={(e) => updateValue(
                                'background.opacity',
                                sanitizeSliderValue(e.target.value, 0.5, {min: 0, max: 1}),
                            )}
                        />
                        <WaSwitch
                            label-at-start
                            size="xs"
                            checked={element.background.blur ?? false}
                            onInput={(e) => updateValue('background.blur', e.target.checked)}
                        >
                            <span>{'Blur'}</span>
                        </WaSwitch>
                    </div>
                </div>
            )}
        </div>
    )
}
