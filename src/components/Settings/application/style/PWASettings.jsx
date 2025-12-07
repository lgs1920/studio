/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PWASettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-07
 * Last modified: 2025-12-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { AppUpdate } from '@Components/AppUpdate'
import { SlDivider } from '@shoelace-style/shoelace/dist/react'
import React         from 'react'

export const PWASettings = () => {
    return (
        <>
            <span slot="summary">{'App installation'}</span>
            <SlDivider/>
            <AppUpdate mode="settings"/>
        </>
    )
}