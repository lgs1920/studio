/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerFooter.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-04
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { INFO_CHANGELOG_TAB, INFO_DRAWER } from '@Core/constants'
import { LogoSvg }                         from '@Components/MainUI/LogoSvg'
import { WaButton, WaDivider, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
import React                           from 'react'

const openChangelog = () => {
    __.ui.drawerManager.open(INFO_DRAWER, {
        tab:     INFO_CHANGELOG_TAB,
        stacked: true,
    })
}

// Memoized component for performance
const DrawerFooter = React.memo(() => {
    const rawTooltipId = React.useId()
    const tooltipIdPrefix = `drawer-footer-${rawTooltipId.replace(/:/g, '')}`

    return (
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
                <WaButton id={`${tooltipIdPrefix}-changelog`} appearance="plain" variant="brand"
                          onClick={openChangelog}
                          aria-label="Changelog">
                    <WaIcon name="circle-info" variant="regular"/>
                </WaButton>
                <WaTooltip for={`${tooltipIdPrefix}-changelog`}>{'Changelog'}</WaTooltip>

                <WaButton id={`${tooltipIdPrefix}-website`} appearance="plain" variant={'brand'}
                          target="_blank"
                          href={__.app.buildUrl(lgs?.configuration?.website || 'https://lgs1920.fr')}
                          aria-label="LGS1920 project Web site">
                    <WaIcon name="globe-pointer" variant="regular"/>
                </WaButton>
                <WaTooltip for={`${tooltipIdPrefix}-website`}>{'LGS1920 project Web site'}</WaTooltip>

                <WaButton id={`${tooltipIdPrefix}-github`} appearance="plain" variant="brand"
                          target="_blank"
                          href={lgs?.configuration?.githubURL || 'https://github.com/lgs1920'}
                          aria-label="Our Github repos">
                    <WaIcon name="github" family="brands"/>
                </WaButton>
                <WaTooltip for={`${tooltipIdPrefix}-github`}>{'Our Github repos'}</WaTooltip>
            </div>
        </div>
        </>
    )
})

export default DrawerFooter
