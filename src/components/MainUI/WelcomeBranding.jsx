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
 * Last modified: 2026-09-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SloganSvg } from '@Components/MainUI/SloganSvg'
import { WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
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
            <picture className="welcome-branding-logo">
                <source media="(max-width: 700px)" srcSet="/assets/logo/logo-vertical.png"/>
                <img src="/assets/logo/logo-horizontal.png" alt="LGS1920 Studio logo"/>
            </picture>
            <span className="welcome-branding-cog" aria-hidden="true">
                <WaIcon name="gear"
                        canvas="auto"
                        variant="regular"
                        animation="spin"/>
            </span>
            <SloganSvg className="welcome-branding-slogan"/>
        </div>
    )
}
