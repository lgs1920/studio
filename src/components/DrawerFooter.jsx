/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerFooter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-08
 * Last modified: 2026-07-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { INFO_CHANGELOG_TAB, INFO_DRAWER } from '@Core/constants'
import { LogoSvg }                         from '@Components/MainUI/LogoSvg'
import { WaButton, WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React                           from 'react'

const openChangelog = () => {
    __.ui.drawerManager.open(INFO_DRAWER, {
        tab:     INFO_CHANGELOG_TAB,
        stacked: true,
    })
}

// Memoized component for performance
const DrawerFooter = React.memo(() => (
    <>
        <WaDivider/>
        <div className="drawer-pane-footer credits-pane-footer" slot="footer">

            <div className="drawer-footer-studio">

                <strong>{lgs?.servers?.studio?.shortname || 'Studio'}</strong>
                <span>{lgs?.versions?.studio || 'N/A'}</span>
            </div>
            <div>
                <strong>{lgs?.servers?.backend?.shortname || 'Backend'}</strong>
                <span>{lgs?.versions?.backend || 'N/A'}</span>
            </div>
            <div className="drawer-footer-url">
                <WaButton appearance="plain" variant="brand"
                          onClick={openChangelog}
                          title={'Changelog'}>
                    <WaIcon name="circle-info" variant="regular"/>
                </WaButton>

                <WaButton appearance="plain" variant={'brand'}
                          target="_blank"
                          href={__.app.buildUrl(lgs?.configuration?.website || 'https://lgs1920.fr')}
                          title={'LGS1920 project Web site'}>
                    <WaIcon name="globe-pointer" variant="regular"/>
                </WaButton>

                <WaButton appearance="plain" variant="brand"
                          target="_blank"
                          href={lgs?.configuration?.githubURL || 'https://github.com/lgs1920'}
                          title={'Our Github repos'}>
                    <WaIcon name="github" family="brands"/>
                </WaButton>
            </div>
        </div>
    </>
))

export default DrawerFooter
