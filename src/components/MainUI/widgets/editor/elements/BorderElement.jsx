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

import { WaSwitch }                          from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef } from 'react'
import { LineElement }                       from './LineElement'
import { RadiusElement }                     from './RadiusElement'
import { sanitizeNumericControlValue }       from './sliderUtils'

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
    const widthRef = useRef(null)
    const borderWidth = sanitizeSliderValue(element.border?.thickness, 1, {min: 0, max: 10})
    const borderOpacity = sanitizeSliderValue(element.border?.opacity, 1, {min: 0, max: 1})

    useEffect(() => {
        if (widthRef.current) {
            widthRef.current.value = borderWidth
        }

        if (element.border?.thickness !== undefined &&
            element.border?.thickness !== null &&
            element.border?.thickness !== borderWidth) {
            updateValue('border.thickness', borderWidth)
        }
    }, [borderWidth, element.border?.thickness, updateValue])

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
                <LineElement
                    widthRef={widthRef}
                    swatches={swatches}
                    colorValue={getColor(element.border)}
                    onColorInput={(value) => updateValue('border.color', value)}
                    widthDefaultValue={borderWidth}
                    onWidthInput={(value) => updateValue(
                        'border.thickness',
                        sanitizeSliderValue(value, 1, {min: 0, max: 10}),
                    )}
                    opacityValue={borderOpacity}
                    onOpacityInput={(value) => updateValue(
                        'border.opacity',
                        sanitizeSliderValue(value, borderOpacity, {min: 0, max: 1}),
                    )}
                    showScale={showScale}
                    scaled={element.border?.scaled ?? false}
                    onScaleChange={(checked) => updateValue('border.scaled', checked)}
                >
                    {showRadius && (
                        <RadiusElement
                            element={element}
                            updateValue={updateValue}
                            showPill={showPill}
                            showScale={showRadiusScale}
                        />
                    )}
                </LineElement>
            )}
        </div>
    )
}
