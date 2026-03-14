/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelsActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import ThemeSelector from '@Components/ThemeSelector'
import React         from 'react'

/**
 * Panel Actions component
 * @returns {JSX.Element}
 */
const PanelActions = ({children}) => {

    return (
        <div slot={'header-actions'}>
            {children}
            <ThemeSelector/>
        </div>
    )
}

export default PanelActions