/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Style.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
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
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef } from 'react'
import { WelcomeModal }      from './WelcomeModal'

export const Style = () => {
    const styleSettings = useRef(null)
    const _cantClose = useRef(false)
    const handleClose = event => {
        if (_cantClose.current) {
            event.preventDefault()
        }

    }

    return (

        <div ref={styleSettings} id="style-settings" className="lgs--details-list">
            <WaDetails id="ui-welcome-modal-settings"
                       small open={false}
                       name="style-settings"
                       className="lgs-theme"
            >
                <WelcomeModal/>
            </WaDetails>

            <WaDetails id="ui-menu-settings"
                       small open={false}
                       className="lgs-theme"
                       name="style-settings"
                       onWaHide={handleClose}
            >
                <MenuSettings ref={_cantClose}/>
            </WaDetails>

            <WaDetails id="ui-compass-settings"
                       small open={false}
                       className="lgs-theme"
                       name="style-settings"
            >
                <CompassSettings/>
            </WaDetails>

            <WaDetails id="ui-editor-settings"
                       small open={false}
                       className="lgs-theme"
                       name="style-settings"
            >
                <EditorSettings/>
            </WaDetails>

            <WaDetails id="ui-pwa-settings"
                       small open={false}
                       className="lgs-theme"
                       name="style-settings"
            >
                <PWASettings/>
            </WaDetails>

        </div>

    )
}