/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
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

import { WIDGET_RADIUS }               from '@Core/constants'
import { WaColorPicker, WaOption, WaSelect, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { ScaleSwitchElement }          from './ScaleSwitchElement'
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
                size="xs"
                checked={element.border?.show ?? false}
                onInput={(e) => updateValue('border.show', e.target.checked)}
            >
                <span>{'Border'}</span>
            </WaSwitch>

            {element.border?.show && (
                <>
                    <div className="lgs-widget-color-control-grid lgs-widget-border-control-grid">
                        <div className="lgs-widget-color-control-color">
                            <WaColorPicker
                                size="s"
                                swatches={swatches}
                                value={getColor(element.border)}
                                onInput={(e) => updateValue('border.color', e.target.value)}
                            />
                        </div>
                        <div className="lgs-widget-border-control-row">
                            <div className="drawer-horizontal-element lgs-widget-border-control">
                                <WaSlider
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
                            </div>
                            <div className="drawer-horizontal-element lgs-widget-border-control">
                                <WaSlider
                                    withTooltip
                                    size="s"
                                    label="Opacity"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    label-at-start
                                    placement="top"
                                    valueFormatter={formatSliderPercent}
                                    value={sanitizeSliderValue(element.border?.opacity, 1, {min: 0, max: 1})}
                                    onInput={(e) => updateValue(
                                        'border.opacity',
                                        sanitizeSliderValue(e.target.value, 1, {min: 0, max: 1}),
                                    )}
                                />
                            </div>
                        </div>
                        {showScale && (
                            <>
                                <div className="lgs-widget-color-control-spacer" aria-hidden="true"/>
                                <ScaleSwitchElement
                                    checked={element.border?.scaled ?? false}
                                    onChange={(checked) => updateValue('border.scaled', checked)}
                                    className="lgs-widget-color-control-scaled-line lgs-widget-border-scaled-line"
                                    widthAuto
                                />
                            </>
                        )}
                    </div>

                    {showRadius && (
                        <>
                            <div className="drawer-horizontal-line lgs-widget-border-radius-line">
                                <WaSelect
                                    size="s"
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
                            {showRadiusScale && (
                                <ScaleSwitchElement
                                    checked={element.border?.radiusScaled ?? false}
                                    onChange={(checked) => updateValue('border.radiusScaled', checked)}
                                    className="lgs-widget-radius-scaled-line lgs-widget-border-radius-scaled-line"
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}
