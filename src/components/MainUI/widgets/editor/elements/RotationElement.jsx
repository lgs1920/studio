/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaNumberInput, WaSlider } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useMemo }                       from 'react'

/**
 * Reusable rotation control element for widget editors.
 * @param {Object} props
 * @param {Object} props.element - The snapshot of the element
 * @param {number} props.localRotation - Current rotation state from parent
 * @param {Function} props.applyRotation - Function to update rotation
 * @param {number} [props.min=-180]
 * @param {number} [props.max=180]
 * @param {number} [props.step=1]
 */
export const RotationElement = ({
                                    localRotation,
                                    applyRotation,
                                    min = -90,
                                    max = 90,
                                    step = 1,
}) => {
    const sanitizeRotationValue = useCallback((rawValue) => {
        const numericValue = Number(rawValue)

        if (!Number.isFinite(numericValue)) {
            return 0
        }

        return Math.min(max, Math.max(min, numericValue))
    }, [max, min])

    const isRotated = Math.abs(Number(localRotation) || 0) > 0
    const displayValue = useMemo(() => sanitizeRotationValue(-localRotation), [localRotation, sanitizeRotationValue])
    const handleRotationInput = useCallback((rawValue) => {
        applyRotation(-sanitizeRotationValue(rawValue))
    }, [applyRotation, sanitizeRotationValue])

    return (
        <>
            <WaNumberInput
                appearance="filled"
                label-at-start
                className="half-width"
                size="s"
                type="number"
                value={displayValue}
                step={step}
                min={min}
                max={max}
                onInput={(e) => handleRotationInput(e.target.value)}
            >
                    <span slot="label">
                    {'Rotation (deg)'}
                        {isRotated && (
                            <WaButton size="s" appearance="plain" aria-label="Reset rotation"
                                      onClick={() => applyRotation(0)}>
                                <WaIcon size="s" name="arrow-rotate-left" variant="regular"/>
                            </WaButton>
                        )}
                </span>
            </WaNumberInput>
            <WaSlider
                label-at-start
                half-width
                size="s"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                placement="bottom"
                withTooltip
                style={{'--track-active-offset': '50%'}}
                onInput={(e) => handleRotationInput(e.target.value)}
            />
        </>


    )
}
