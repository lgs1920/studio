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
    bannerMediaCatalog,
    getWelcomeBackgroundMedia,
    getBannerMediaSource,
    WELCOME_BACKGROUND_PLAYBACK_RATE,
}                                                               from '@Assets/media/welcome-background-media'
import { formatBuildInfo }                                    from '@Utils/BuildInfoUtils'
import {
    WaButton, WaFormatDate, WaIcon, WaProgressBar,
}                                                               from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useRef, useState }            from 'react'

const WELCOME_BACKGROUND_MEDIA = getWelcomeBackgroundMedia()
const WELCOME_VIDEO_CROSSFADE_DURATION = 2300
const WELCOME_VIDEO_CROSSFADE_LEAD_SECONDS = 3
const INITIALIZATION_PROGRESS_VALUES = [0, 10, 20, 40, 60, 80]
const INITIALIZATION_COMPLETION_DISPLAY_MS = 3000

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
                             initializationProgress = null,
                         }) => {
    const _welcomeVideo = useRef(null)
    const _incomingWelcomeVideo = useRef(null)
    const _crossfadeTimer = useRef(null)
    const _initializationCompletionTimer = useRef(null)
    const [activeVideoSlot, setActiveVideoSlot] = useState('primary')
    const [primaryVideoChoice, setPrimaryVideoChoice] = useState(() => backgroundMedia.id
        ? bannerMediaCatalog.outdoor.find(choice => choice.id === backgroundMedia.id)
        : null)
    const [secondaryVideoChoice, setSecondaryVideoChoice] = useState(null)
    const [videoTransitioning, setVideoTransitioning] = useState(false)
    const [incomingVideoReady, setIncomingVideoReady] = useState(false)
    const [videoState, setVideoState] = useState(
        backgroundMedia.videoSources.length > 0 ? 'loading' : 'unavailable'
    )
    const [imageState, setImageState] = useState(
        backgroundMedia.imageSources.length > 0 ? 'ready' : 'unavailable'
    )
    const [showInitializationProgress, setShowInitializationProgress] = useState(true)
    const readyToEnter = initComplete && appReady
    const initializationSteps = initializationProgress?.steps ?? []
    const activeInitializationStep = readyToEnter
        ? initializationSteps.length
        : Math.min(Math.max(initializationProgress?.activeStep ?? 0, 0), initializationSteps.length)
    const initializationPercentage = readyToEnter
        ? 100
        : INITIALIZATION_PROGRESS_VALUES[activeInitializationStep] ?? 0
    const videoReady = videoState === 'ready'
    const imageVisible = !videoReady && imageState === 'ready'
    const studioVersion = lgs.versions?.studio ?? 'Unknown version'
    const buildDate = lgs.build?.date ?? lgs.build?.buildTime
    const buildInfo = formatBuildInfo(lgs.build)
    const videoChoices = bannerMediaCatalog.outdoor.filter(choice => choice.type === 'video')
    const activeVideoChoice = activeVideoSlot === 'primary' ? primaryVideoChoice : secondaryVideoChoice
    const incomingVideoChoice = activeVideoSlot === 'primary' ? secondaryVideoChoice : primaryVideoChoice
    const currentVideoSource = activeVideoChoice
        ? getBannerMediaSource(activeVideoChoice)
        : backgroundMedia.videoSources[0]?.src
    const primaryVideoSource = activeVideoSlot === 'primary'
        ? currentVideoSource
        : getBannerMediaSource(primaryVideoChoice)
    const secondaryVideoSource = activeVideoSlot === 'secondary'
        ? currentVideoSource
        : getBannerMediaSource(secondaryVideoChoice)
    const canChangeVideo = videoChoices.length > 1 && Boolean(activeVideoChoice)

    const changeWelcomeVideo = useCallback(() => {
        if (!canChangeVideo || incomingVideoChoice) {
            const activeVideo = activeVideoSlot === 'primary'
                ? _welcomeVideo.current
                : _incomingWelcomeVideo.current
            activeVideo?.play()
            return
        }

        const currentIndex = videoChoices.findIndex(choice => choice.id === activeVideoChoice.id)
        const nextChoice = videoChoices[(currentIndex + 1) % videoChoices.length]
        if (activeVideoSlot === 'primary') {
            setSecondaryVideoChoice(nextChoice)
        } else {
            setPrimaryVideoChoice(nextChoice)
        }
        setIncomingVideoReady(false)
    }, [activeVideoChoice, activeVideoSlot, canChangeVideo, incomingVideoChoice, videoChoices])

    const handleWelcomeVideoTimeUpdate = useCallback(event => {
        const videoElement = event.currentTarget
        const remainingDuration = videoElement.duration - videoElement.currentTime
        if (Number.isFinite(videoElement.duration)
            && videoElement.duration > WELCOME_VIDEO_CROSSFADE_LEAD_SECONDS
            && remainingDuration > 0
            && remainingDuration <= WELCOME_VIDEO_CROSSFADE_LEAD_SECONDS) {
            changeWelcomeVideo()
        }
    }, [changeWelcomeVideo])

    const startWelcomeVideoCrossfade = useCallback(event => {
        if (_crossfadeTimer.current || !incomingVideoChoice) {
            return
        }

        setIncomingVideoReady(true)
        setVideoTransitioning(true)
        event.currentTarget.playbackRate = WELCOME_BACKGROUND_PLAYBACK_RATE
        event.currentTarget.currentTime = 0
        event.currentTarget.play().catch(() => {})
        _crossfadeTimer.current = window.setTimeout(() => {
            if (activeVideoSlot === 'primary') {
                setPrimaryVideoChoice(null)
            } else {
                setSecondaryVideoChoice(null)
            }
            setActiveVideoSlot(activeVideoSlot === 'primary' ? 'secondary' : 'primary')
            setIncomingVideoReady(false)
            setVideoTransitioning(false)
            _crossfadeTimer.current = null
        }, WELCOME_VIDEO_CROSSFADE_DURATION)
    }, [activeVideoSlot, incomingVideoChoice])

    useEffect(() => {
        if (!incomingVideoChoice) {
            return
        }

        const incomingVideo = activeVideoSlot === 'primary'
            ? _incomingWelcomeVideo.current
            : _welcomeVideo.current
        try {
            incomingVideo?.load()
        }
        catch {
            // jsdom and a few embedded browsers do not implement media loading.
        }
    }, [activeVideoSlot, incomingVideoChoice])

    useEffect(() => () => {
        if (_crossfadeTimer.current) {
            window.clearTimeout(_crossfadeTimer.current)
        }
    }, [])

    useEffect(() => {
        if (_initializationCompletionTimer.current) {
            window.clearTimeout(_initializationCompletionTimer.current)
            _initializationCompletionTimer.current = null
        }

        if (!readyToEnter) {
            return
        }

        _initializationCompletionTimer.current = window.setTimeout(() => {
            setShowInitializationProgress(false)
            _initializationCompletionTimer.current = null
        }, INITIALIZATION_COMPLETION_DISPLAY_MS)

        return () => {
            if (_initializationCompletionTimer.current) {
                window.clearTimeout(_initializationCompletionTimer.current)
                _initializationCompletionTimer.current = null
            }
        }
    }, [readyToEnter])

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

    /**
     * Renders the initialization progress shown while Studio is becoming ready.
     *
     * @returns {object|null} Initialization progress or nothing when no progress was provided.
     */
    const renderInitializationProgress = () => {
        if (initializationSteps.length === 0 || (readyToEnter && !showInitializationProgress)) {
            return null
        }

        return (
            <div className="welcome-initialization" aria-label="Studio initialization progress" aria-live="polite">
                <div className="welcome-initialization-header">
                    <span>{'Preparing Studio'}</span>
                    <span>{initializationPercentage}%</span>
                </div>
                <WaProgressBar
                    className="welcome-initialization-progress"
                    value={initializationPercentage}
                    label={`Studio initialization: ${initializationPercentage}%`}
                />
                <ol className="welcome-initialization-steps">
                    {initializationSteps.map((step, index) => {
                        const isComplete = index < activeInitializationStep
                        const isActive = index === activeInitializationStep
                        const status = isComplete ? 'Complete' : isActive ? 'In progress' : 'Waiting'

                        return (
                            <li
                                className={`welcome-initialization-step${isComplete ? ' is-complete' : ''}${isActive ? ' is-active' : ''}`}
                                aria-current={isActive ? 'step' : undefined}
                                key={step.id}
                            >
                                <WaIcon
                                    name={isComplete ? 'circle-check' : isActive ? 'gear' : 'circle'}
                                    variant="regular"
                                    animation={isActive ? 'spin' : ''}
                                    aria-hidden="true"
                                />
                                <span className="welcome-initialization-step-label">{step.label}</span>
                                <span className="welcome-initialization-step-status">{status}</span>
                            </li>
                        )
                    })}
                </ol>
            </div>
        )
    }

    return (
        <div id="welcome-hero"
             className={`lgs-theme${videoReady ? ' welcome-hero-video-ready' : ''}${imageVisible ? ' welcome-hero-image-visible' : ''}${videoTransitioning ? ' welcome-hero-video-transitioning' : ''}${incomingVideoReady ? ' welcome-hero-video-crossfade-ready' : ''}`}
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
                    <>
                    <video
                        ref={_welcomeVideo}
                        className={`welcome-hero-video ${activeVideoSlot === 'primary' ? 'welcome-hero-video-active' : 'welcome-hero-video-incoming'}`}
                        autoPlay={activeVideoSlot === 'primary'}
                        muted
                        loop={!canChangeVideo}
                        playsInline
                        preload="auto"
                        onEnded={activeVideoSlot === 'primary' ? changeWelcomeVideo : undefined}
                        onTimeUpdate={activeVideoSlot === 'primary' ? handleWelcomeVideoTimeUpdate : undefined}
                        onLoadedData={activeVideoSlot === 'primary' ? () => setVideoState('ready') : startWelcomeVideoCrossfade}
                        onCanPlay={activeVideoSlot === 'primary' ? () => setVideoState('ready') : startWelcomeVideoCrossfade}
                        onPlaying={activeVideoSlot === 'primary' ? () => setVideoState('ready') : undefined}
                        onError={activeVideoSlot === 'primary' ? () => setVideoState('failed') : undefined}
                    >
                        {primaryVideoSource && <source src={primaryVideoSource} type="video/mp4"/>}
                    </video>
                    <video
                        ref={_incomingWelcomeVideo}
                        className={`welcome-hero-video ${activeVideoSlot === 'secondary' ? 'welcome-hero-video-active' : 'welcome-hero-video-incoming'}`}
                        autoPlay={activeVideoSlot === 'secondary'}
                        muted
                        loop={!canChangeVideo}
                        playsInline
                        preload="auto"
                        onEnded={activeVideoSlot === 'secondary' ? changeWelcomeVideo : undefined}
                        onTimeUpdate={activeVideoSlot === 'secondary' ? handleWelcomeVideoTimeUpdate : undefined}
                        onLoadedData={activeVideoSlot === 'secondary' ? () => setVideoState('ready') : startWelcomeVideoCrossfade}
                        onCanPlay={activeVideoSlot === 'secondary' ? () => setVideoState('ready') : startWelcomeVideoCrossfade}
                        onPlaying={activeVideoSlot === 'secondary' ? () => setVideoState('ready') : undefined}
                        onError={activeVideoSlot === 'secondary' ? () => setVideoState('failed') : undefined}
                    >
                        {secondaryVideoSource && <source src={secondaryVideoSource} type="video/mp4"/>}
                    </video>
                    </>
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
                            <WaIcon
                                slot="start"
                                name={readyToEnter ? 'clapperboard-play' : 'gear'}
                                variant="regular"
                                animation={readyToEnter ? '' : 'spin'}
                                aria-hidden="true"
                            />
                            {'Enter Studio'}
                        </WaButton>
                    </div>
                    {renderInitializationProgress()}
                </section>
            </div>
        </div>
    )
}
