/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShadowElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-23
 * Last modified: 2026-02-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlColorPicker, SlOption, SlRange, SlSelect, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React                                                    from 'react'

export const ShadowElement = ({element, swatches, getColor, updateValue}) => {
    return (
        <>
            <SlSwitch align-right size="x-small" checked={element.text?.shadow?.show ?? false}
                      onSlInput={(e) => updateValue('text.shadow.show', e.target.checked)}>
                <label>{'Text elevation'}</label>
            </SlSwitch>

            {element.text?.shadow?.show && (
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        <SlColorPicker size="small" swatches={swatches} value={element.text.shadow.color}
                                       onSlInput={(e) => updateValue('text.shadow.color', e.target.value)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        <SlSelect hoist size="small" value={element.text.shadow?.value ?? 'normal'}
                                  style={{marginLeft: 'auto', width: '6.5rem'}}
                                  onSlChange={(e) => updateValue('text.shadow.value', e.target.value)}>
                            <SlOption value="small">{'Small'}</SlOption>
                            <SlOption value="normal">{'Medium'}</SlOption>
                            <SlOption value="large">{'Large'}</SlOption>
                        </SlSelect>
                    </div>
                    <div className="drawer-horizontal-element xlarge-element">
                        <SlRange label="Opacity" align-right tooltip="top" min="0" max="1" step="0.05"
                                 tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                 value={element.text.shadow?.opacity ?? 1}
                                 onSlInput={(e) => updateValue('text.shadow.opacity', parseFloat(e.target.value))}/>
                    </div>
                </div>
            )}
        </>
    )
}