/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RecordingTimeToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-08
 * Last modified: 2025-07-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SlAnimation, SlPopup } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }          from 'valtio'

export const RecordingTimeToolbar = (props) => {
    const $settings = lgs.settings.ui.video
    const settings = useSnapshot($settings)

    return (
        <SlPopup active={settings.recording}
                 className={'lgs-theme'}
                 anchor="trigger-video-recording"
                 placement={props.tooltip}
                 distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-xs'))}
        >
            <SlAnimation>
                <div className={'lgs-one-line-card on-map small'}>coucou</div>
            </SlAnimation>
        </SlPopup>
    )
}