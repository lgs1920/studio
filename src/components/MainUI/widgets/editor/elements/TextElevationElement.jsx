/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextElevationElement.jsx
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

import { WaColorPicker, WaOption, WaSelect, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef }                                     from 'react'
import { formatSliderPercent, sanitizeNumericControlValue }      from './sliderUtils'

export const TextElevationElement = ({element, swatches, updateValue}) => {
    const sliderRef = useRef(null)
    const opacityValue = sanitizeNumericControlValue(element.text?.shadow?.opacity, 1, {min: 0, max: 1})

    useEffect(() => {
        if (sliderRef.current) {
            sliderRef.current.value = opacityValue
        }

        if (element.text?.shadow?.opacity !== undefined && element.text?.shadow?.opacity !== null && element.text?.shadow?.opacity !== opacityValue) {
            updateValue('text.shadow.opacity', opacityValue)
        }
    }, [element.text?.shadow?.opacity, opacityValue, updateValue])

    return (
        <div className="lgs-widget-text-elevation-element">
            <WaSwitch
                label-at-start
                size="xs"
                checked={element.text?.shadow?.show ?? false}
                onInput={(e) => updateValue('text.shadow.show', e.target.checked)}
            >
                <span>{'Text shadow'}</span>
            </WaSwitch>

            {element.text?.shadow?.show && (
                <div>
                    <WaColorPicker
                        size="s"
                        swatches={swatches}
                        value={element.text.shadow.color}
                        onInput={(e) => updateValue('text.shadow.color', e.target.value)}
                    />
                    <div>
                        <WaSelect
                            label = {'Elevation'}
                            className="half-width"
                            size="s"
                            value={element.text.shadow?.value ?? 'normal'}
                            label-at-start
                            onChange={(e) => updateValue('text.shadow.value', e.target.value)}
                        >
                            <WaOption value="small">{'Small'}</WaOption>
                            <WaOption value="normal">{'Medium'}</WaOption>
                            <WaOption value="large">{'Large'}</WaOption>
                        </WaSelect>
                        <WaSlider
                            ref={sliderRef}
                            half-width
                            size="s"
                            label="Opacity"
                            min="0"
                            max="1"
                            step="0.05"
                            label-at-start
                            placement="top"
                            withTooltip
                            valueFormatter={formatSliderPercent}
                            defaultValue={opacityValue}
                            onInput={(e) => updateValue(
                                'text.shadow.opacity',
                                sanitizeNumericControlValue(e.target.value, 1, {min: 0, max: 1}),
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
