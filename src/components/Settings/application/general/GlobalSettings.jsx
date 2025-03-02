/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalSettings.jsx
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

import { CameraSettings }      from '@Components/Settings/application/general/CameraSettings'
import { UnitsSystemSettings } from '@Components/Settings/application/general/UnitsSystemSettings'
import { SlDetails }           from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef }   from 'react'

export const GlobalSettings = () => {
    const generalTools = useRef(null)

    useEffect(() => {
        __.ui.ui.initDetailsGroup(generalTools.current)
    }, [])

    const checkClose = (event) => {
        // If we're over the drawer, ok else, stop event
        if (window.isOK(event) && __.ui.drawerManager.over) {
            return
        }
        event.preventDefault()
    }


    return (

        <div ref={generalTools} id={'style-settings'}>
            <SlDetails id={'tools-unit-system'}
                       small open={false}
                       className={'lgs-theme'}
                       onSlHide={checkClose}
            >
                <UnitsSystemSettings/>
            </SlDetails>

            <SlDetails id={'ui-camera-settings'}
                       small open={false}
                       className={'lgs-theme'}
                       onSlHide={checkClose}
            >
                <CameraSettings/>
            </SlDetails>

        </div>

    )
}