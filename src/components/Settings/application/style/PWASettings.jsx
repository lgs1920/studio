/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PWASettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { AppUpdate } from '@Components/AppUpdate'
import { WaDivider } from '@web.awesome.me/webawesome-pro/dist/react'
import React         from 'react'

export const PWASettings = () => {
    return (
        <>
            <span slot="summary">{'App installation'}</span>
            <WaDivider/>
            <AppUpdate mode="settings"/>
        </>
    )
}