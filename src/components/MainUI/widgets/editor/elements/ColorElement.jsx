/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ColorElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlColorPicker, SlRange } from '@shoelace-style/shoelace/dist/react'
import React                      from 'react'

/**
 * Standardized color and opacity control element.
 */
export const ColorElement = ({
                                 label,
                                 path,
                                 part,
                                 swatches,
                                 getColor,
                                 updateValue,
                             }) => {

    return (
        <React.Fragment>
            <div className="drawer-horizontal-line"><span>{label}</span></div>
            <div className="drawer-horizontal-line three-columns">
                <div className="drawer-horizontal-element">
                    <SlColorPicker
                        size="small"
                        swatches={swatches}
                        value={getColor(part)}
                        onSlInput={(e) => updateValue(`${path}.color`, e.target.value)}
                    />
                </div>
                <div className="drawer-horizontal-element xlarge-element"></div>
                <div className="drawer-horizontal-element xlarge-element">
                    <SlRange
                        label="Opacity"
                        min="0"
                        max="1"
                        step="0.05"
                        align-right
                        tooltip="top"
                        tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                        value={part.opacity ?? 1}
                        onSlInput={(e) => updateValue(`${path}.opacity`, parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </React.Fragment>
    )
}