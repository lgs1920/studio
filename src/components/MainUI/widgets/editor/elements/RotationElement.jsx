/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-06
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaNumberInput, WaSlider } from '@awesome.me/webawesome/dist/react'
import { useCallback, useMemo }                       from 'react'

/**
 * Reusable rotation control element for widget editors.
 * @param {Object} props
 * @param {Object} props.element - The snapshot of the element
 * @param {number} props.localRotation - Current rotation state from parent
 * @param {Function} props.applyRotation - Function to update rotation
 * @param {boolean} [props.showNumberInput=true] - Whether to show the numeric input above the slider.
 * @param {number} [props.min=-180]
 * @param {number} [props.max=180]
 * @param {number} [props.step=1]
 * @param {string} [props.label='Rotation (deg)']
 * @param {boolean} [props.showResetButton=false] - Whether to show a reset button beside the slider label.
 * @param {string} [props.labelClassName] - Optional class for a custom slider label.
 */
export const RotationElement = ({
                                    localRotation,
                                    applyRotation,
                                    showNumberInput = true,
                                    min = -90,
                                    max = 90,
                                    step = 1,
                                    label = 'Rotation (deg)',
                                    showResetButton = false,
                                    labelClassName,
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
            {showNumberInput && (
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
                        {label}
                        {isRotated && (
                            <WaButton size="s" appearance="plain" aria-label="Reset rotation"
                                      onClick={() => applyRotation(0)}>
                                <WaIcon size="s" name="arrow-rotate-left" variant="regular"/>
                            </WaButton>
                        )}
                    </span>
                </WaNumberInput>
            )}
            <WaSlider
                label-at-start
                label={showNumberInput || showResetButton ? undefined : label}
                className={showNumberInput ? 'half-width' : undefined}
                size="s"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                placement="bottom"
                withTooltip
                style={{'--track-active-offset': '50%'}}
                onInput={(e) => handleRotationInput(e.target.value)}
            >
                {!showNumberInput && showResetButton && (
                    <span slot="label" className={labelClassName}>
                        {label}
                        {isRotated && (
                            <WaButton
                                className="square-button small"
                                size="s"
                                appearance="plain"
                                aria-label="Reset rotation"
                                onClick={() => applyRotation(0)}
                            >
                                <WaIcon size="s" name="arrow-rotate-left" variant="regular"/>
                            </WaButton>
                        )}
                    </span>
                )}
            </WaSlider>
        </>


    )
}
