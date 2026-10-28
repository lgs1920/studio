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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SloganSvg } from '@Components/MainUI/SloganSvg'
import { LogoSvg } from '@Components/MainUI/LogoSvg'
import { WaSpinner } from '@awesome.me/webawesome/dist/react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

/** Selects the compact logo for narrow screens. */
const getWelcomeLogoVariant = () => globalThis.matchMedia?.('(max-width: 700px)').matches ? 'vertical' : 'horizontal'

/**
 * Renders the welcome branding while the startup splash and welcome actions are visible.
 *
 * @returns {JSX.Element} Welcome logo and slogan.
 */
export const WelcomeBranding = () => {
    const [logoVariant, setLogoVariant] = useState(getWelcomeLogoVariant)
    const [svgLogoReady, setSvgLogoReady] = useState(false)
    const markSvgLogoReady = useCallback(() => setSvgLogoReady(true), [])

    useEffect(() => {
        const mediaQuery = globalThis.matchMedia?.('(max-width: 700px)')
        if (!mediaQuery) {
            return undefined
        }

        /** Updates the mounted SVG when the viewport crosses the mobile breakpoint. */
        const updateLogoVariant = () => setLogoVariant(mediaQuery.matches ? 'vertical' : 'horizontal')
        mediaQuery.addEventListener?.('change', updateLogoVariant)

        return () => mediaQuery.removeEventListener?.('change', updateLogoVariant)
    }, [])

    useLayoutEffect(() => {
        if (!svgLogoReady) {
            return undefined
        }

        const splashElement = document.querySelector('#lgs-boot-splash')
        splashElement?.classList.add('lgs-boot-splash-react-ready')

        return () => splashElement?.classList.remove('lgs-boot-splash-react-ready')
    }, [svgLogoReady])

    return (
        <div className="welcome-branding" aria-label="LGS1920 Studio">
            <div className="welcome-branding-logo" role="img" aria-label="LGS1920 Studio logo">
                <LogoSvg
                    src={`/assets/logo/logo-${logoVariant}.svg`}
                    className={`welcome-branding-logo-${logoVariant}`}
                    onLoaded={markSvgLogoReady}
                />
            </div>
            <span className="welcome-branding-spinner" aria-hidden="true">
                <WaSpinner/>
            </span>
            <SloganSvg className="welcome-branding-slogan"/>
        </div>
    )
}
