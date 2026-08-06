/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StrokeElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSwitch }                    from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                      from 'colord'
import { useEffect, useMemo, useRef }  from 'react'
import { LineElement }                 from './LineElement'
import { sanitizeNumericControlValue } from './sliderUtils'

/**
 * Text Stroke editor element.
 * Uses LineElement while keeping stroke-specific color normalization.
 */
export const StrokeElement = ({
                                  element,
                                  swatches,
                                  getColor,
                                  updateValue,
                              }) => {
    const stroke = useMemo(() => element.text?.stroke ?? {}, [element.text?.stroke])
    const widthRef = useRef(null)
    const opacityRef = useRef(null)
    const strokeWidth = sanitizeNumericControlValue(stroke.width, 0, {min: 0, max: 2})
    const strokeOpacity = sanitizeNumericControlValue(stroke.opacity, 1, {min: 0, max: 1})

    /**
     * Get the raw color and ensure it is treated as opaque for the picker.
     */
    const colorForPicker = useMemo(() => {
        const rawColor = getColor(stroke, 'text.stroke.color')
        return colord(rawColor).alpha(1).toHex()
    }, [stroke, getColor])

    useEffect(() => {
        if (widthRef.current) {
            widthRef.current.value = strokeWidth
        }
        if (opacityRef.current) {
            opacityRef.current.value = strokeOpacity
        }

        if (stroke.width !== undefined && stroke.width !== null && stroke.width !== strokeWidth) {
            updateValue('text.stroke.width', strokeWidth)
        }
        if (stroke.opacity !== undefined && stroke.opacity !== null && stroke.opacity !== strokeOpacity) {
            updateValue('text.stroke.opacity', strokeOpacity)
        }
    }, [stroke.width, stroke.opacity, strokeWidth, strokeOpacity, updateValue])

    return (
        <>
            <WaSwitch
                label-at-start
                size="xs"
                checked={stroke.show ?? false}
                onInput={(e) => updateValue('text.stroke.show', e.target.checked)}
            >
                <span>Text Stroke</span>
            </WaSwitch>

            {stroke.show && (
                <LineElement
                    swatches={swatches}
                    colorValue={colorForPicker}
                    onColorInput={(value) => updateValue('text.stroke.color', colord(value).alpha(1).toHex())}
                    widthRef={widthRef}
                    widthMax={2}
                    widthStep={0.1}
                    widthDefaultValue={strokeWidth}
                    onWidthInput={(value) => updateValue(
                        'text.stroke.width',
                        sanitizeNumericControlValue(value, 0, {min: 0, max: 2}),
                    )}
                    opacityRef={opacityRef}
                    opacityDefaultValue={strokeOpacity}
                    onOpacityInput={(value) => updateValue(
                        'text.stroke.opacity',
                        sanitizeNumericControlValue(value, 1, {min: 0, max: 1}),
                    )}
                />
            )}
        </>
    )
}
