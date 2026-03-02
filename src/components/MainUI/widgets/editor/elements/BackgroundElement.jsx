/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BackgroundElement.jsx
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

import { SlColorPicker, SlRange, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React                                from 'react'

export const BackgroundElement = ({element, swatches, getColor, updateValue}) => {

    /**
     * Handle the main background toggle logic
     * @param {boolean} checked
     */
    const handleToggle = (checked) => {
        updateValue('background.show', checked)
        if (!checked) {
            updateValue('background.blur', false)
            updateValue('background.opacity', 0)
        }
    }

    return (
        <>
            <SlSwitch align-right size="x-small" checked={element.background?.show ?? false}
                      onSlInput={(e) => handleToggle(e.target.checked)}>
                <label>{'Background'}</label>
            </SlSwitch>

            {element.background?.show && (
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        <SlColorPicker size="small" swatches={swatches}
                                       value={getColor(element.background)}
                                       onSlInput={(e) => updateValue('background.color', e.target.value)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Blur'}&nbsp;
                        <SlSwitch align-right size="x-small" checked={element.background.blur ?? false}
                                  onSlChange={(e) => updateValue('background.blur', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element xlarge-element">
                        <SlRange label="Opacity" min="0" max="1" step="0.05" align-right tooltip="top"
                                 tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                 value={element.background.opacity ?? 0.5}
                                 onSlInput={(e) => updateValue('background.opacity', parseFloat(e.target.value))}/>
                    </div>
                </div>
            )}
        </>
    )
}