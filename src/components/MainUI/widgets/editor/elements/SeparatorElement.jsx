/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SeparatorElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified on: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaColorPicker, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useRef } from 'react'
import { formatSliderPercent, formatSliderPixels, sanitizeNumericControlValue } from './sliderUtils'

const SEPARATOR_SLIDERS = {
    opacity: {
        fallback: 1,
        max:      1,
        min:      0,
        step:     0.05,
        label:    'Opacity',
        format:   formatSliderPercent,
    },
    padding: {
        fallback: 0,
        max:      10,
        min:      0,
        step:     1,
        label:    'Padding',
        format:   formatSliderPixels,
    },
}

export const SeparatorElement = ({element, swatches, getColor, updateValue}) => {
    const opacityRef = useRef(null)
    const paddingRef = useRef(null)

    const resolveValue = useCallback((key) => {
        const config = SEPARATOR_SLIDERS[key]
        return sanitizeNumericControlValue(element.separator?.[key], config.fallback, config)
    }, [element.separator])

    const updateSlider = useCallback((key, rawValue) => {
        const config = SEPARATOR_SLIDERS[key]
        updateValue(`separator.${key}`, sanitizeNumericControlValue(rawValue, config.fallback, config))
    }, [updateValue])

    useEffect(() => {
        if (opacityRef.current) {
            opacityRef.current.value = resolveValue('opacity')
        }
        if (paddingRef.current) {
            paddingRef.current.value = resolveValue('padding')
        }
    }, [resolveValue])

    return (
        <div className="lgs-widget-separator-element">
            <WaSwitch
                label-at-start
                size="xs"
                checked={element.separator?.show ?? false}
                onInput={(e) => updateValue('separator.show', e.target.checked)}
            >
                <span>{'Separator'}</span>
            </WaSwitch>

            {element.separator?.show && (
                <div className="lgs-widget-separator-element-controls">
                    <div className="lgs-widget-separator-element-row">
                        <WaColorPicker
                            size="s"
                            swatches={swatches}
                            value={getColor(element.separator)}
                            onInput={(e) => updateValue('separator.color', e.target.value)}
                        />
                        <div className="lgs-widget-separator-element-sliders">
                            {Object.entries(SEPARATOR_SLIDERS).map(([key, config]) => (
                                <WaSlider
                                    key={key}
                                    ref={key === 'opacity' ? opacityRef : paddingRef}
                                    half-width
                                    size="s"
                                    label={config.label}
                                    min={config.min}
                                    max={config.max}
                                    step={config.step}
                                    label-at-start
                                    placement="top"
                                    withTooltip
                                    valueFormatter={config.format}
                                    defaultValue={resolveValue(key)}
                                    onInput={(e) => updateSlider(key, e.target.value)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
