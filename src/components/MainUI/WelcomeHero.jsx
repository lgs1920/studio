/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHero.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SloganSvg }                                         from '@Components/MainUI/SloganSvg'
import { WaButton, WaIcon }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useState }                             from 'react'
import { LogoSvg }                                           from './LogoSvg'

const WELCOME_VIDEO_DESKTOP = '/assets/media/trekking-hero-desktop.mp4'
const WELCOME_VIDEO_MOBILE = '/assets/media/trekking-hero-mobile.mp4'

/**
 * Renders the persistent Studio welcome hero.
 *
 * @param {{initComplete?: boolean, appReady?: boolean, onEnter?: () => void}} props - Hero state and entry callback.
 * @returns {JSX.Element} Persistent welcome hero.
 */
export const WelcomeHero = ({initComplete = false, appReady = false, onEnter}) => {
    const [videoReady, setVideoReady] = useState(false)
    const readyToEnter = initComplete && appReady
    const websiteConfiguration = lgs.configuration?.website ?? {domain: 'lgs1920.fr', protocol: 'https'}
    const websiteUrl = globalThis.__?.app?.buildUrl?.(websiteConfiguration)
        ?? `${websiteConfiguration.protocol ?? 'https'}://${websiteConfiguration.domain}`

    const enterStudio = useCallback(() => {
        if (!readyToEnter) {
            return
        }

        document.activeElement?.blur()
        onEnter?.()
    }, [onEnter, readyToEnter])

    return (
        <div id="welcome-hero"
             className={`lgs-theme${videoReady ? ' welcome-hero-video-ready' : ''}`}
             aria-busy={!readyToEnter}>
            <div className="welcome-hero-media" aria-hidden="true">
                <video
                    className="welcome-hero-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onLoadedData={() => setVideoReady(true)}
                    onCanPlay={() => setVideoReady(true)}
                    onPlaying={() => setVideoReady(true)}
                >
                    <source src={WELCOME_VIDEO_MOBILE} media="(max-width: 700px)" type="video/mp4"/>
                    <source src={WELCOME_VIDEO_DESKTOP} type="video/mp4"/>
                </video>
            </div>
            <div className="welcome-hero-fog" aria-hidden="true"/>
            <div className="welcome-hero-scrim" aria-hidden="true"/>

            <div className="welcome-hero-shell">
                <section className="welcome-hero-content" aria-label="LGS1920 Studio launch">
                    <LogoSvg
                        src="/assets/logo/logo-vertical.svg"
                        primaryColor="#ffffff"
                        secondaryColor="#ffffff"
                        secondaryOpacity={0}
                        textPrimaryColor="#ffffff"
                        textSecondaryColor="#ffffff"
                        width="100%"
                        className="welcome-logo"
                        title="LGS1920 Studio logo"
                    />
                    <SloganSvg className="welcome-slogan"/>

                    <div className="welcome-enter-call-for-action">
                        <WaButton
                            className="welcome-site-button"
                            appearance="outlined"
                            variant="neutral"
                            size="m"
                            href={websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <WaIcon slot="start" name="globe-pointer" variant="regular"/>
                            {'Visit Our Site'}
                        </WaButton>
                        <WaButton
                            className="welcome-enter-button"
                            variant="brand"
                            size="m"
                            disabled={!readyToEnter}
                            onClick={enterStudio}
                        >
                            <WaIcon slot="start" name="mountains" variant="regular"/>
                            {'Enter Studio'}
                        </WaButton>
                    </div>
                </section>
            </div>
        </div>
    )
}
