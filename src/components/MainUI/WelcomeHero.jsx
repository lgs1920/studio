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
import { WelcomeHeroRoute }                                  from '@Components/MainUI/WelcomeHeroRoute'
import {
    getWelcomeBackgroundMedia,
    WELCOME_BACKGROUND_PLAYBACK_RATE,
}                                                               from '@Assets/media/welcome-background-media'
import { formatBuildInfo }                                    from '@Utils/BuildInfoUtils'
import { WaButton, WaFormatDate, WaIcon }                    from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useRef, useState }            from 'react'

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
    const _welcomeVideo = useRef(null)
    const [videoState, setVideoState] = useState(
        backgroundMedia.videoSources.length > 0 ? 'loading' : 'unavailable'
    )
    const [imageState, setImageState] = useState(
        backgroundMedia.imageSources.length > 0 ? 'loading' : 'unavailable'
    )
    const readyToEnter = initComplete && appReady
    const videoReady = videoState === 'ready'
    const imageVisible = !videoReady && imageState === 'ready'
    const studioVersion = lgs.versions?.studio ?? 'Unknown version'
    const buildDate = lgs.build?.date ?? lgs.build?.buildTime
    const buildInfo = formatBuildInfo(lgs.build)

    useEffect(() => {
        if (_welcomeVideo.current) {
            _welcomeVideo.current.playbackRate = WELCOME_BACKGROUND_PLAYBACK_RATE
        }
    }, [])

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
                        ref={_welcomeVideo}
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
            {backgroundMedia.credit?.label && backgroundMedia.credit?.url && (
                <div className="welcome-hero-media-credit">
                    <a
                        href={backgroundMedia.credit.url}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {backgroundMedia.credit.label}
                    </a>
                </div>
            )}
            <div
                className="welcome-hero-build-info"
                aria-label={`Studio version ${studioVersion}, build ${buildInfo}`}
            >
                <WaIcon name="code-branch" variant="regular" aria-hidden="true"/>
                <span>{studioVersion}</span>
                <span aria-hidden="true">·</span>
                <WaIcon name="calendar-days" variant="regular" aria-hidden="true"/>
                {buildDate ? (
                    <WaFormatDate
                        date={buildDate}
                        year="numeric"
                        month="short"
                        day="numeric"
                    />
                ) : (
                    <span>{buildInfo}</span>
                )}
            </div>
            <WelcomeHeroRoute/>
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
