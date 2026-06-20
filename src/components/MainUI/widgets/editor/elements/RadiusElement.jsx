/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RadiusElement.jsx
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

import { WIDGET_RADIUS }                           from '@Core/constants'
import { WaDivider, WaOption, WaSelect, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect }                               from 'react'
import { ScaleSwitchElement }                      from './ScaleSwitchElement'

const DEFAULT_RADIUS = 'medium'
const HIDDEN_RADIUS = 'none'

/**
 * Common border radius editor element.
 */
export const RadiusElement = ({
                                  element,
                                  updateValue,
                                  path = 'border',
                                  showPill = false,
                                  showScale = true,
                              }) => {
    const radius = element?.[path] ?? {}
    const rawRadius = radius.radius
    const isRadiusVisible = rawRadius !== HIDDEN_RADIUS
    const canSelectCurrentRadius = WIDGET_RADIUS.has(rawRadius)
        && rawRadius !== HIDDEN_RADIUS
        && (showPill || rawRadius !== 'pill')
    const currentRadius = canSelectCurrentRadius ? rawRadius : DEFAULT_RADIUS

    useEffect(() => {
        if (!isRadiusVisible || rawRadius === currentRadius) {
            return
        }

        updateValue(`${path}.radius`, currentRadius)
        updateValue(`${path}.pill`, currentRadius === 'pill')
    }, [currentRadius, isRadiusVisible, path, rawRadius, updateValue])

    const handleRadiusToggle = (checked) => {
        const value = checked ? currentRadius : HIDDEN_RADIUS

        updateValue(`${path}.radius`, value)
        updateValue(`${path}.pill`, value === 'pill')
    }

    const handleRadiusChange = (e) => {
        const value = Array.isArray(e.target.value) ? e.target.value[0] : e.target.value

        updateValue(`${path}.radius`, value)
        updateValue(`${path}.pill`, value === 'pill')
    }

    return (
        <div className="lgs-widget-radius-element">
            {isRadiusVisible && <WaDivider/>}
            <WaSwitch
                label-at-start
                size="xs"
                checked={isRadiusVisible}
                onInput={(e) => handleRadiusToggle(e.target.checked)}
            >
                <span>{'Radius'}</span>
            </WaSwitch>

            {isRadiusVisible && (
                <>
                    <WaSelect appearance="filled"
                        size="s"
                        label="Size"
                        label-at-start
                        value={currentRadius}
                        onChange={handleRadiusChange}
                    >
                        {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => {
                            if (_key === HIDDEN_RADIUS || (!showPill && _key === 'pill')) {
                                return null
                            }
                            return (
                                <WaOption key={_key} value={_key}>
                                    {_data.name}
                                </WaOption>
                            )
                        })}
                    </WaSelect>
                    {showScale && (
                        <ScaleSwitchElement
                            checked={radius.radiusScaled ?? false}
                            onChange={(checked) => updateValue(`${path}.radiusScaled`, checked)}
                        />
                    )}
                </>
            )}
        </div>
    )
}
