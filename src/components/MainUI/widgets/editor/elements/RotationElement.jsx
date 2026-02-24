/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-24
 * Last modified: 2026-02-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlInput, SlRange, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React                          from 'react'

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

    const isRotated = localRotation !== 0
    const displayValue = -localRotation

    return (
        <div className="drawer-horizontal-line">
            <div className="drawer-horizontal-element">
                <label>{'Rotation'}</label>
                <SlInput
                    size="small"
                    type="number"
                    value={displayValue}
                    style={{marginLeft: 'auto', width: '5rem'}}
                    step={step}
                    min={min}
                    max={max}
                    onSlInput={(e) => applyRotation(-parseFloat(e.target.value) || 0)}
                />
            </div>

            <div className="drawer-horizontal-element">
                <SlRange
                    min={min}
                    max={max}
                    step={step}
                    value={displayValue}
                    tooltip="bottom"
                    style={{'--track-active-offset': '50%'}}
                    onSlInput={(e) => applyRotation(-parseFloat(e.target.value) || 0)}
                />
            </div>

            <div className="drawer-horizontal-element">
                <SlSwitch
                    align-right
                    size="x-small"
                    checked={isRotated}
                    disabled={!isRotated}
                    onSlChange={(e) => {
                        if (!e.target.checked) {
                            applyRotation(0)
                        }
                    }}
                />
            </div>
        </div>
    )
}