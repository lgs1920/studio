/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeBranding.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-21
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SloganSvg } from '@Components/MainUI/SloganSvg'
import { LogoSvg } from '@Components/MainUI/LogoSvg'
import { WaSpinner } from '@awesome.me/webawesome/dist/react'
import { useLayoutEffect } from 'react'

/**
 * Renders the welcome branding while the startup splash and welcome actions are visible.
 *
 * @returns {JSX.Element} Welcome logo and slogan.
 */
export const WelcomeBranding = () => {
    useLayoutEffect(() => {
        const splashElement = document.querySelector('#lgs-boot-splash')
        splashElement?.classList.add('lgs-boot-splash-react-ready')

        return () => splashElement?.classList.remove('lgs-boot-splash-react-ready')
    }, [])

    return (
        <div className="welcome-branding" aria-label="LGS1920 Studio">
            <div className="welcome-branding-logo" role="img" aria-label="LGS1920 Studio logo">
                <LogoSvg src="/assets/logo/logo-horizontal.svg" className="welcome-branding-logo-horizontal"/>
                <LogoSvg src="/assets/logo/logo-vertical.svg" className="welcome-branding-logo-vertical"/>
            </div>
            <span className="welcome-branding-spinner" aria-hidden="true">
                <WaSpinner/>
            </span>
            <SloganSvg className="welcome-branding-slogan"/>
        </div>
    )
}
