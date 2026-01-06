/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Style.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraSettings } from '@Components/Settings/application/general/CameraSettings'
import { CompassSettings } from '@Components/Settings/application/style/CompassSettings'
import { EditorSettings } from '@Components/Settings/application/style/EditorSettings'
import { MenuSettings }      from '@Components/Settings/application/style/MenuSettings'
import { PWASettings } from '@Components/Settings/application/style/PWASettings'
import { SlDetails }         from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef } from 'react'
import { WelcomeModal }      from './WelcomeModal'

export const Style = () => {
    const styleSettings = useRef(null)

    useEffect(() => {
        __.ui.ui.initDetailsGroup(styleSettings.current)
    }, [])

    return (

        <div ref={styleSettings} id="style-settings">
            <SlDetails id="ui-welcome-modal-settings"
                       small open={false}
                       className="lgs-theme"
            >
                <WelcomeModal/>
            </SlDetails>

            <SlDetails id="ui-menu-settings"
                       small open={false}
                       className="lgs-theme"
            >
                <MenuSettings/>
            </SlDetails>

            <SlDetails id="ui-compass-settings"
                       small open={false}
                       className="lgs-theme"
            >
                <CompassSettings/>
            </SlDetails>

            <SlDetails id="ui-editor-settings"
                       small open={false}
                       className="lgs-theme"
            >
                <EditorSettings/>
            </SlDetails>

            <SlDetails id="ui-pwa-settings"
                       small open={false}
                       className="lgs-theme"
            >
                <PWASettings/>
            </SlDetails>

        </div>

    )
}