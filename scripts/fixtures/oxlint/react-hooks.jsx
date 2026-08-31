/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: react-hooks.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-29
 * Last modified: 2026-07-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useState } from 'react'

export const InvalidHooksFixture = () => {
    if (Math.random() > 0.5) {
        useState(0)
    }

    return null
}
