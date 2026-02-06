/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-06
 * Last modified: 2026-02-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
 *
 * Author : LGS1920 Team
 *
 ******************************************************************************/

import { WIDGET_RADIUS }                                        from '@Core/constants'
import { SlColorPicker, SlOption, SlRange, SlSelect, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React                                                    from 'react'

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
                              }) => {
    const currentRadius = element.border?.radius ?? 'none'

    return (
        <>
            <SlSwitch align-right size="x-small" checked={element.border?.show ?? false}
                      onSlInput={(e) => updateValue('border.show', e.target.checked)}>
                <span>{'Border'}</span>
            </SlSwitch>

            {element.border?.show && (
                <>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker size="small" swatches={swatches}
                                           value={getColor(element.border)}
                                           onSlInput={(e) => updateValue('border.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Width" min="0" max="10" step="0.5" align-right tooltip="top"
                                     value={element.border.thickness ?? 1}
                                     onSlInput={(e) => updateValue('border.thickness', parseFloat(e.target.value))}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Opacity" min="0" max="1" step="0.05" align-right tooltip="top"
                                     tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                     value={element.border.opacity ?? 1}
                                     onSlInput={(e) => updateValue('border.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>

                    {showRadius && (
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element xlarge-element">
                                <SlSelect
                                    hoist
                                    size="small"
                                    label={'Radius'}
                                    align-right
                                    style={{marginLeft: 'auto', width: '10rem'}}
                                    value={currentRadius}
                                    onSlChange={(e) => {
                                        const val = Array.isArray(e.target.value) ? e.target.value[0] : e.target.value
                                        updateValue('border.radius', val)
                                    }}
                                >
                                    {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => {
                                        if (!showPill && _key === 'pill') {
                                            return null
                                        }
                                        return (
                                            <SlOption key={_key} value={_key}>
                                                {_data.name}
                                            </SlOption>
                                        )
                                    })}
                                </SlSelect>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    )
}