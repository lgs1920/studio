/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LineElement.jsx
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

import { WaColorPicker, WaSlider } from '@web.awesome.me/webawesome-pro/dist/react'
import { ScaleSwitchElement }      from './ScaleSwitchElement'
import { formatSliderPercent }     from './sliderUtils'

const getSliderValueProps = (value, defaultValue) => {
    if (value !== undefined) {
        return {value}
    }

    if (defaultValue !== undefined) {
        return {defaultValue}
    }

    return {}
}

export const LineElement = ({
                                swatches,
                                colorValue,
                                onColorInput,
                                reserveColorColumn = false,
                                widthRef,
                                widthLabel = 'Width',
                                widthMin = 0,
                                widthMax = 10,
                                widthStep = 0.5,
                                widthValue,
                                widthDefaultValue,
                                onWidthInput,
                                showOpacity = true,
                                opacityRef,
                                opacityLabel = 'Opacity',
                                opacityMin = 0,
                                opacityMax = 1,
                                opacityStep = 0.05,
                                opacityValue,
                                opacityDefaultValue,
                                onOpacityInput,
                                showScale = false,
                                scaled = false,
                                onScaleChange,
                            children,
                            }) => {
    return (
        <div className="lgs-widget-line-element">
            {reserveColorColumn ? (
                <div className="lgs-widget-line-element-spacer" aria-hidden="true"/>
            ) : (
                <WaColorPicker
                    size="s"
                    swatches={swatches}
                    value={colorValue}
                    onInput={(e) => onColorInput?.(e.target.value, e)}
                />
            )}
            <div>
                <WaSlider
                    ref={widthRef}
                    half-width
                    withTooltip
                    size="s"
                    label={widthLabel}
                    min={widthMin}
                    max={widthMax}
                    step={widthStep}
                    label-at-start
                    placement="top"
                    {...getSliderValueProps(widthValue, widthDefaultValue)}
                    onInput={(e) => onWidthInput?.(e.target.value, e)}
                />
                {showOpacity && (
                    <WaSlider
                        ref={opacityRef}
                        half-width
                        withTooltip
                        size="s"
                        label={opacityLabel}
                        min={opacityMin}
                        max={opacityMax}
                        step={opacityStep}
                        label-at-start
                        placement="top"
                        valueFormatter={formatSliderPercent}
                        {...getSliderValueProps(opacityValue, opacityDefaultValue)}
                        onInput={(e) => onOpacityInput?.(e.target.value, e)}
                    />
                )}
                {showScale && (
                    <ScaleSwitchElement
                        checked={scaled}
                        onChange={onScaleChange}
                    />
                )}
                {children}
            </div>
        </div>
    )
}
