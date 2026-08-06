/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Style.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassSettings } from '@Components/Settings/application/style/CompassSettings'
import { EditorSettings } from '@Components/Settings/application/style/EditorSettings'
import { MenuSettings }      from '@Components/Settings/application/style/MenuSettings'
import { PWASettings } from '@Components/Settings/application/style/PWASettings'
import { SETTINGS_EDITOR_DRAWER }  from '@Core/constants'
import { WaDetails } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useRef } from 'react'
import { useSnapshot }             from 'valtio'
import { WelcomeModal }      from './WelcomeModal'

const OPEN_COMPASS_SETTINGS_ACTION = 'open-compass-settings'

export const Style = memo(() => {
    const styleSettings = useRef(null)
    const _cantClose = useRef(false)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const handleClose = event => {
        if (_cantClose.current) {
            event.preventDefault()
        }

    }

    useEffect(() => {
        if (drawers.open !== SETTINGS_EDITOR_DRAWER || drawers.action !== OPEN_COMPASS_SETTINGS_ACTION) {
            return
        }

        const frame = requestAnimationFrame(() => {
            const root = styleSettings.current
            root?.querySelectorAll('wa-details').forEach(details => {
                details.open = details.id === 'ui-compass-settings'
            })
            __.ui.drawerManager.clean()
        })

        return () => cancelAnimationFrame(frame)
    }, [drawers.action, drawers.open])

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
