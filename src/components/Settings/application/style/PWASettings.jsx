/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PWASettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-12-07
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { AppUpdate } from '@Components/AppUpdate'
import { WaDivider } from '@awesome.me/webawesome/dist/react'
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