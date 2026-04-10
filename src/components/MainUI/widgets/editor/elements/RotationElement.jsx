/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-10
 * Last modified: 2026-04-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaInput, WaSlider, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useCallback, useMemo } from 'react'

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
                                    element,
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

    const isRotated = localRotation !== 0
    const displayValue = useMemo(() => sanitizeRotationValue(-localRotation), [localRotation, sanitizeRotationValue])
    const handleRotationInput = useCallback((rawValue) => {
        applyRotation(-sanitizeRotationValue(rawValue))
    }, [applyRotation, sanitizeRotationValue])

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

            <div className="drawer-horizontal-element">
                <WaSwitch
                    size="xsmall"
                    label-at-start
                    checked={isRotated}
                    disabled={!isRotated}
                    onInput={(e) => {
                        if (!e.target.checked) {
                            applyRotation(0)
                        }
                    }}
                />
            </div>
        </div>
    )
}
