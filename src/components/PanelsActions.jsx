/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelsActions.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import ThemeSelector        from '@Components/ThemeSelector'
import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'

/**
 * Panel Actions component
 * @returns {JSX.Element}
 */
const PanelActions = ({stackedPanel = false, onBack = null, children}) => {
    const backButtonProps = onBack ? {onClick: onBack} : {'data-drawer': 'close'}

    return (
        <div slot={'header-actions'}>
            {children}
            <ThemeSelector/>
            {stackedPanel &&
                <WaButton
                    size="small"
                    variant="brand"
                    appearance="plain"
                    {...backButtonProps}
                >
                    <WaIcon name="chevrons-left" variant="regular"/>{'Back'}
                </WaButton>
            }
        </div>
    )
}

export default PanelActions
