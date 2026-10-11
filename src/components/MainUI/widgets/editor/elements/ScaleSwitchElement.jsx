/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ScaleSwitchElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSwitch } from '@awesome.me/webawesome/dist/react'

export const ScaleSwitchElement = ({
                                       checked = false,
                                       onChange,
                                       className = '',
                                       switchStyle,
                                       widthAuto = false,
                                   }) => {
    const stopPropagation = event => event.stopPropagation()

    return (
            <WaSwitch
                className={`lgs-widget-scaled-switch ${className}`.trim()}
                style={switchStyle}
                label-at-start
                width-auto={widthAuto || undefined}
                size="xs"
                checked={checked}
                onClick={stopPropagation}
                onInput={(e) => {
                    e.stopPropagation()
                    onChange?.(e.target.checked)
                }}
                onPointerDown={stopPropagation}
            >
                <span>{'Scaled'}</span>
            </WaSwitch>
    )
}
