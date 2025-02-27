/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Style.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MenuSettings }      from '@Components/Settings/application/style/MenuSettings'
import { SlDetails }         from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef } from 'react'
import { WelcomeModal }      from './WelcomeModal'

export const Style = () => {
    const styleSettings = useRef(null)

    useEffect(() => {
        __.ui.ui.initDetailsGroup(styleSettings.current)
    }, [])

    const checkClose = (event) => {
        // If we're over the drawer, ok else, stop event
        if (window.isOK(event) && __.ui.drawerManager.over) {
            return
        }
        event.preventDefault()
    }


    return (

        <div ref={styleSettings} id={'style-settings'}>
            <SlDetails id={'ui-welcome-modal-settings'}
                       small open={false}
                       className={'lgs-theme'}
                       onSlHide={checkClose}
            >
                <WelcomeModal/>

            </SlDetails>

            <SlDetails id={'ui-menu-settings'}
                       small open={false}
                       className={'lgs-theme'}
                       onSlHide={checkClose}
            >
                <MenuSettings/>
            </SlDetails>



        </div>

    )
}