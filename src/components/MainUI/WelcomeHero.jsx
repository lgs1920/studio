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
import { WelcomeHeroControls }                               from '@Components/MainUI/WelcomeHeroControls'
import { getWelcomeBackgroundMedia }                         from '@Assets/media/welcome-background-media'
import { WaButton, WaIcon }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useState }                             from 'react'

const WELCOME_BACKGROUND_MEDIA = getWelcomeBackgroundMedia()

/**
 * Renders the persistent Studio welcome hero.
 *
 * @param {{initComplete?: boolean, appReady?: boolean, onEnter?: () => void, backgroundMedia?: object}} props - Hero state, entry callback, and resolved background media.
 * @returns {JSX.Element} Persistent welcome hero.
 */
export const WelcomeHero = ({
                             initComplete = false,
                             appReady = false,
                             onEnter,
                             backgroundMedia = WELCOME_BACKGROUND_MEDIA,
                         }) => {
    const [videoState, setVideoState] = useState(
        backgroundMedia.videoSources.length > 0 ? 'loading' : 'unavailable'
    )
    const [imageState, setImageState] = useState(
        backgroundMedia.imageSources.length > 0 ? 'loading' : 'unavailable'
    )
    const readyToEnter = initComplete && appReady
    const videoReady = videoState === 'ready'
    const imageVisible = !videoReady && imageState === 'ready'
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
             className={`lgs-theme${videoReady ? ' welcome-hero-video-ready' : ''}${imageVisible ? ' welcome-hero-image-visible' : ''}`}
             aria-busy={!readyToEnter}>
            <div className="welcome-hero-media"
                 style={{backgroundColor: backgroundMedia.fallbackColor}}
                 aria-hidden="true">
                {backgroundMedia.imageSources[0] && (
                    <img
                        className="welcome-hero-image"
                        src={backgroundMedia.imageSources[0].src}
                        alt=""
                        onLoad={() => setImageState('ready')}
                        onError={() => setImageState('unavailable')}
                    />
                )}
                {backgroundMedia.videoSources.length > 0 && (
                    <video
                        className="welcome-hero-video"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onLoadedData={() => setVideoState('ready')}
                        onCanPlay={() => setVideoState('ready')}
                        onPlaying={() => setVideoState('ready')}
                        onError={() => setVideoState('failed')}
                    >
                        {backgroundMedia.videoSources.map(source => (
                            <source key={`${source.type}:${source.src}`} src={source.src} type={source.type}/>
                        ))}
                    </video>
                )}
            </div>
            <div className="welcome-hero-scrim" aria-hidden="true"/>
            <WelcomeHeroControls/>

            <div className="welcome-hero-shell">
                <section className="welcome-hero-content" aria-label="LGS1920 Studio launch">
                    <picture className="welcome-logo">
                        <source media="(max-width: 700px)" srcSet="/assets/logo/logo-vertical.png"/>
                        <img src="/assets/logo/logo-horizontal.png" alt="LGS1920 Studio logo"/>
                    </picture>
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
