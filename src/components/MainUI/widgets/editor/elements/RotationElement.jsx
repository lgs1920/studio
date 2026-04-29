/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaInput, WaSlider } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

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
    const sliderRef = useRef(null)

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

    useEffect(() => {
        const slider = sliderRef.current
        const nextValue = sanitizeRotationValue(displayValue)

        if (!slider || Number(slider.value) === nextValue) {
            return
        }

        slider.value = nextValue
    }, [displayValue, sanitizeRotationValue])

    return (
        <div className="drawer-horizontal-line">
            <div className="drawer-horizontal-element">
                <label>{'Rotation'}</label>
                <WaInput
                    size="small"
                    type="number"
                    value={displayValue}
                    style={{marginLeft: 'auto', width: '5rem'}}
                    step={step}
                    min={min}
                    max={max}
                    onInput={(e) => handleRotationInput(e.target.value)}
                />
            </div>

            <div className="drawer-horizontal-element">
                <WaSlider
                    ref={sliderRef}
                    size="small"
                    min={min}
                    max={max}
                    step={step}
                    defaultValue={displayValue}
                    placement="bottom"
                    withTooltip
                    style={{'--track-active-offset': '50%'}}
                    onInput={(e) => handleRotationInput(e.target.value)}
                />
            </div>

            <div className="drawer-horizontal-element widget-editor-rotation-reset">
                {isRotated && (
                    <WaButton size="small" appearance="plain" aria-label="Reset rotation"
                              onClick={() => applyRotation(0)}>
                        <WaIcon size="small" name="arrow-rotate-left" variant="regular"/>
                    </WaButton>
                )}
            </div>
        </div>
    )
}
