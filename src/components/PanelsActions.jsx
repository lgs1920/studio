/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelsActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-08
 * Last modified: 2026-04-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import ThemeSelector        from '@Components/ThemeSelector'
import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React                from 'react'

/**
 * Panel Actions component
 * @returns {JSX.Element}
 */
const PanelActions = ({stackedPanel = false, children}) => {

    return (
        <div slot={'header-actions'}>
            {children}
            <ThemeSelector/>
            {stackedPanel &&
                <WaButton
                    size="small"
                    variant="brand"
                    appearance="plain"
                    data-drawer="close"
                >
                    <WaIcon name="chevrons-left" variant="regular"/>{'Back'}
                </WaButton>
            }
        </div>
    )
}

export default PanelActions