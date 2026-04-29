/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Style.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassSettings } from '@Components/Settings/application/style/CompassSettings'
import { EditorSettings } from '@Components/Settings/application/style/EditorSettings'
import { MenuSettings }      from '@Components/Settings/application/style/MenuSettings'
import { PWASettings } from '@Components/Settings/application/style/PWASettings'
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useRef } from 'react'
import { WelcomeModal }      from './WelcomeModal'

export const Style = memo(() => {
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
                       small
                       name="style-settings"
                       className="lgs--details-hoverable"
            >
                <WelcomeModal/>
            </WaDetails>

            <WaDetails id="ui-menu-settings"
                       small
                       name="style-settings"
                       className="lgs-theme lgs--details-hoverable"
                       onWaHide={handleClose}
            >
                <MenuSettings ref={_cantClose}/>
            </WaDetails>

            <WaDetails id="ui-compass-settings"
                       small
                       name="style-settings"
                       className="lgs-theme lgs--details-hoverable"
            >
                <CompassSettings/>
            </WaDetails>

            <WaDetails id="ui-editor-settings"
                       small
                       className="lgs--details-hoverable"
                       name="style-settings"
            >
                <EditorSettings/>
            </WaDetails>

            <WaDetails id="ui-pwa-settings"
                       small
                       className="lgs--details-hoverable"
                       name="style-settings"
            >
                <PWASettings/>
            </WaDetails>

        </div>

    )
})

Style.displayName = 'StyleSettings'
