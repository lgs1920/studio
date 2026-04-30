/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ScaleSwitchElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'

export const ScaleSwitchElement = ({
                                       checked = false,
                                       onChange,
                                       alignAfterColor = false,
                                       className = '',
                                       switchStyle,
                                       widthAuto = true,
                                   }) => {
    const stopPropagation = event => event.stopPropagation()

    return (
        <div className={`drawer-horizontal-line lgs-widget-scaled-line ${className}`.trim()}>
            {alignAfterColor && <div className="lgs-widget-scaled-color-spacer" aria-hidden="true"/>}
            <WaSwitch
                className="lgs-widget-scaled-switch"
                style={switchStyle}
                label-at-start
                width-auto={widthAuto || undefined}
                size="xsmall"
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
        </div>
    )
}
