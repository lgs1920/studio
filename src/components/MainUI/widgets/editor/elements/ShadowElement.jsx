/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShadowElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaColorPicker, WaOption, WaSelect, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef } from 'react'
import { formatSliderPercent, sanitizeNumericControlValue }      from './sliderUtils'

export const ShadowElement = ({element, swatches, updateValue}) => {
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
        <>
            <WaSwitch label-at-start
                      size="xs"
                      checked={element.text?.shadow?.show ?? false}
                      onInput={(e) => updateValue('text.shadow.show', e.target.checked)}>
                <label>{'Text elevation'}</label>
            </WaSwitch>

            {element.text?.shadow?.show && (
                <>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <WaColorPicker size="s" swatches={swatches} value={element.text.shadow.color}
                                           onInput={(e) => updateValue('text.shadow.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            <WaSelect size="s" value={element.text.shadow?.value ?? 'normal'}
                                      label-at-start
                                      style={{marginLeft: 'auto', width: '6.5rem'}}
                                      onChange={(e) => updateValue('text.shadow.value', e.target.value)}>
                                <WaOption value="small">{'Small'}</WaOption>
                                <WaOption value="normal">{'Medium'}</WaOption>
                                <WaOption value="large">{'Large'}</WaOption>
                            </WaSelect>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <WaSlider ref={sliderRef}
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
                                      )}/>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
