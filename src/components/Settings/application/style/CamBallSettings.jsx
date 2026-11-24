/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CamBallSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-24
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {UI_ACTIONS} from '@Core/ui/metadata/uiActionCatalog'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {WaDivider, WaSwitch} from '@awesome.me/webawesome/dist/react'

/** Edit the shared map CamBall preferences in the persisted UI settings section. */
export const CamBallSettings = () => {
    const $ui = lgs.settings.ui
    const ui = useOptionalSnapshot($ui)
    const camBall = ui.camBall

    /** Store a boolean preference through the existing UI settings subscription. */
    const setPreference = (name, event) => {
        $ui.camBall ??= {visible: true, followPitch: false}
        $ui.camBall[name] = event.target.checked === true
    }

    return (
        <>
            <span slot="summary">CamBall</span>
            <WaDivider/>
            <div className="wa-stack wa-gap-s">
                <WaSwitch size="xs" label-at-start checked={camBall?.visible !== false}
                          onChange={event => setPreference('visible', event)}>
                    {UI_ACTIONS.showCamBall.label}
                </WaSwitch>
                <WaSwitch size="xs" label-at-start checked={camBall?.followPitch === true}
                          onChange={event => setPreference('followPitch', event)}>
                    {UI_ACTIONS.camBallFollowPitch.label}
                </WaSwitch>
            </div>
        </>
    )
}
