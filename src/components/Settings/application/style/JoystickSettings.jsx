/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JoystickSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-23
 * Last modified: 2026-11-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {UI_ACTIONS} from '@Core/ui/metadata/uiActionCatalog'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {WaDivider, WaSwitch} from '@awesome.me/webawesome/dist/react'

/** Edit the shared map joystick preferences in the persisted UI settings section. */
export const JoystickSettings = () => {
    const $ui = lgs.settings.ui
    const ui = useOptionalSnapshot($ui)
    const joystick = ui.joystick

    /** Store a boolean preference through the existing UI settings subscription. */
    const setPreference = (name, event) => {
        $ui.joystick ??= {visible: true, followPitch: false}
        $ui.joystick[name] = event.target.checked === true
    }

    return (
        <>
            <span slot="summary">Joystick</span>
            <WaDivider/>
            <div className="wa-stack wa-gap-s">
                <WaSwitch size="xs" label-at-start checked={joystick?.visible !== false}
                          onChange={event => setPreference('visible', event)}>
                    {UI_ACTIONS.showJoystick.label}
                </WaSwitch>
                <WaSwitch size="xs" label-at-start checked={joystick?.followPitch === true}
                          onChange={event => setPreference('followPitch', event)}>
                    {UI_ACTIONS.joystickFollowPitch.label}
                </WaSwitch>
            </div>
        </>
    )
}
