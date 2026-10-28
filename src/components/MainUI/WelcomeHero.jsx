/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHero.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-13
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WelcomeHeroControls }                               from '@Components/MainUI/WelcomeHeroControls'
import { WelcomeHeroRoute }                                  from '@Components/MainUI/WelcomeHeroRoute'
import { stopWelcomeHeroRouteInSplash }                       from '@Components/MainUI/WelcomeHeroRouteBootstrap'
import {
    bannerMediaCatalog,
    getWelcomeBackgroundMedia,
    getBannerMediaSource,
    WELCOME_BACKGROUND_PLAYBACK_RATE,
}                                                               from '@Assets/media/welcome-background-media'
import { formatBuildInfo }                                    from '@Utils/BuildInfoUtils'
import {
    WaAnimation, WaButton, WaFormatDate, WaIcon,
}                                                               from '@awesome.me/webawesome/dist/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const WELCOME_BACKGROUND_MEDIA = getWelcomeBackgroundMedia()
const WELCOME_VIDEO_CROSSFADE_DURATION = 2300
const WELCOME_VIDEO_CROSSFADE_LEAD_SECONDS = 3
const WELCOME_READY_MESSAGE_DURATION = 5000
const WELCOME_READY_MESSAGE = 'LGS1920 Studio playground is ready...'
const WELCOME_LOGO_ANIMATION_DURATION = 1200
const WELCOME_LOGO_CLOSE_PROGRESS = 0.38
const CLAPPER_SOUND = {snapFrequency: 2300, snapLevel: 0.36, bodyFrequency: 175, bodyEndFrequency: 105, bodyLevel: 0.10, secondaryDelay: 0.018}

/** Plays one wooden impact and resolves after its final audio source has ended. */
const playClapperCue = (audioContext) => {
    const variant = CLAPPER_SOUND
    const now = audioContext.currentTime
    let finishCue
    const completion = new Promise(resolve => { finishCue = resolve })
    const noiseDuration = 0.1
    const frameCount = Math.ceil(audioContext.sampleRate * noiseDuration)
    const noiseBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)

    for (let frame = 0; frame < frameCount; frame++) {
        const elapsed = frame / audioContext.sampleRate
        const envelope = Math.exp(-elapsed / (elapsed < 0.008 ? 0.0025 : 0.032))
        noiseData[frame] = (Math.random() * 2 - 1) * envelope
    }

    const playNoiseHit = ({filterType, frequency, level, duration, delay = 0}) => {
        const source = audioContext.createBufferSource()
        const filter = audioContext.createBiquadFilter()
        const gain = audioContext.createGain()
        source.buffer = noiseBuffer
        filter.type = filterType
        filter.frequency.value = frequency
        filter.Q.value = 0.8
        gain.gain.setValueAtTime(level, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
        source.connect(filter)
        filter.connect(gain)
        gain.connect(audioContext.destination)
        source.onended = () => {
            source.disconnect?.()
            filter.disconnect?.()
            gain.disconnect?.()
        }
        source.start(now + delay)
        source.stop(now + delay + duration)
    }

    playNoiseHit({filterType: 'highpass', frequency: variant.snapFrequency, level: variant.snapLevel, duration: 0.035})
    playNoiseHit({filterType: 'bandpass', frequency: 760, level: 0.13, duration: 0.08})
    playNoiseHit({
        filterType: 'bandpass',
        frequency: variant.snapFrequency * 0.92,
        level: variant.snapLevel * 0.36,
        duration: 0.045,
        delay: variant.secondaryDelay,
    })

    const bodyOscillator = audioContext.createOscillator()
    const bodyGain = audioContext.createGain()
    bodyOscillator.type = 'triangle'
    bodyOscillator.frequency.setValueAtTime(variant.bodyFrequency, now)
    bodyOscillator.frequency.exponentialRampToValueAtTime(variant.bodyEndFrequency, now + 0.065)
    bodyGain.gain.setValueAtTime(variant.bodyLevel, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
    bodyOscillator.connect(bodyGain)
    bodyGain.connect(audioContext.destination)
    bodyOscillator.start()
    bodyOscillator.stop(now + 0.11)
    bodyOscillator.onended = () => {
        bodyOscillator.disconnect?.()
        bodyGain.disconnect?.()
        finishCue()
    }
    return completion
}

/** Returns the visible logo clapper and its synchronized flap and mountain animations. */
const getVisibleClapperAnimation = () => {
    const clappers = [...document.querySelectorAll('.welcome-branding-logo .lgs--logo-clapper')]
    if (clappers.length === 0) {
        return null
    }

    const clapper = clappers.find(candidate => {
        const svg = candidate.closest('svg')
        const responsiveLogo = candidate.closest('.welcome-branding-logo-horizontal, .welcome-branding-logo-vertical')
        const visibleElement = responsiveLogo ?? svg
        return !visibleElement || globalThis.getComputedStyle?.(visibleElement)?.display !== 'none'
    }) ?? clappers[0]
    const logo = clapper.closest('.welcome-branding-logo')
    const synchronizedAnimations = [...(logo?.querySelectorAll(
        '.lgs--logo-clapper, .lgs--logo-clapper-occlusion',
    ) ?? [])].flatMap(element => element.getAnimations?.() ?? [])
        .filter(candidate => candidate.animationName === 'lgs-logo-clapper-close')
    const animation = synchronizedAnimations.find(candidate => candidate.effect?.target === clapper)
        ?? clapper.getAnimations?.()[0]
        ?? null

    return {animation, clapper, logo, synchronizedAnimations}
}

/** Maps startup phases to clear welcome-screen status messages. */
const INITIALIZATION_MESSAGES = {
    application: 'Starting Studio services…',
    map:         'Preparing the map and tools…',
    journey:     'Loading your current journey…',
    camera:      'Positioning the map…',
    scene:       'Finalizing the map view…',
}

/**
 * Renders the persistent Studio welcome hero.
 *
 * @param {{initComplete?: boolean, appReady?: boolean, initializationStep?: string, updateInProgress?: boolean, onEnter?: () => void, backgroundMedia?: object, showMedia?: boolean}} props - Hero state, startup progress, entry callback, resolved background media, and media visibility.
 * @returns {JSX.Element} Persistent welcome hero.
 */
export const WelcomeHero = ({
                             initComplete = false,
                             appReady = false,
                             initializationStep = 'application',
                             updateInProgress = false,
                             onEnter,
                             backgroundMedia = WELCOME_BACKGROUND_MEDIA,
                             showMedia = true,
                         }) => {
    const _welcomeVideo = useRef(null)
    const _incomingWelcomeVideo = useRef(null)
    const _ctaAnimation = useRef(null)
    const _crossfadeTimer = useRef(null)
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
    const [showReadyMessage, setShowReadyMessage] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
        globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    ))
    const readyToEnter = initComplete && appReady
    const initializationMessage = updateInProgress
        ? 'Applying the Studio update…'
        : INITIALIZATION_MESSAGES[initializationStep] ?? INITIALIZATION_MESSAGES.application
    const videoReady = showMedia && videoState === 'ready'
    const imageVisible = showMedia && !videoReady && imageState === 'ready'
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

    useEffect(() => {
        const reducedMotionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
        if (!reducedMotionQuery) {
            return undefined
        }

        /** Keep the CTA animation aligned with the user's current motion preference. */
        const updateReducedMotionPreference = () => setPrefersReducedMotion(reducedMotionQuery.matches)
        updateReducedMotionPreference()
        reducedMotionQuery.addEventListener?.('change', updateReducedMotionPreference)

        return () => reducedMotionQuery.removeEventListener?.('change', updateReducedMotionPreference)
    }, [])

    useEffect(() => {
        if (!prefersReducedMotion && _ctaAnimation.current) {
            _ctaAnimation.current.play = true
        }
    }, [prefersReducedMotion])

    useEffect(() => {
        const splashElement = document.querySelector('#lgs-boot-splash')
        splashElement?.classList.toggle('lgs-boot-splash-cta-ready', readyToEnter)

        return () => splashElement?.classList.remove('lgs-boot-splash-cta-ready')
    }, [readyToEnter])

    useEffect(() => {
        if (!readyToEnter || prefersReducedMotion) {
            return undefined
        }

        const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext
        if (!AudioContextConstructor) {
            return undefined
        }

        let active = true
        let cueTimer = null
        let holdingClosed = false
        let heldAnimations = []
        let animatedLogo = null
        let clapperObserver = null
        let hasPlayedCue = false
        let audioContext
        try {
            audioContext = new AudioContextConstructor()
        }
        catch {
            return undefined
        }

        /** Clears the pending single clapper sound timer. */
        const clearCueTimer = () => {
            if (cueTimer !== null) {
                window.clearTimeout(cueTimer)
                cueTimer = null
            }
        }
        /** Resumes the one-shot animation after the impact finishes or audio is unavailable. */
        const finishClapperCue = () => {
            if (!holdingClosed) {
                return
            }

            heldAnimations.forEach(candidate => candidate.play?.())
            heldAnimations = []
            holdingClosed = false
        }

        /** Schedules the one clapper impact at the close point of the active logo animation. */
        const scheduleClapperCue = () => {
            if (!active || hasPlayedCue || cueTimer !== null || document.hidden) {
                return
            }

            animatedLogo = document.querySelector('.welcome-branding-logo')
            animatedLogo?.classList.add('welcome-branding-logo-animated')
            const {animation, logo, synchronizedAnimations = []} = getVisibleClapperAnimation() ?? {}
            if (!animation || !logo) {
                return
            }

            const duration = Number(animation.effect?.getTiming?.().duration) || WELCOME_LOGO_ANIMATION_DURATION
            const currentTime = Number(animation.currentTime) || 0
            const closeTime = duration * WELCOME_LOGO_CLOSE_PROGRESS
            const delay = Math.max(0, closeTime - currentTime)
            cueTimer = window.setTimeout(() => {
                cueTimer = null
                if (!active || hasPlayedCue) {
                    return
                }

                holdingClosed = true
                hasPlayedCue = true
                clapperObserver?.disconnect()
                heldAnimations = [...new Set([animation, ...synchronizedAnimations])]
                heldAnimations.forEach(candidate => {
                    candidate.currentTime = duration * WELCOME_LOGO_CLOSE_PROGRESS
                    candidate.pause?.()
                })

                if (audioContext.state !== 'running') {
                    finishClapperCue()
                    return
                }

                void playClapperCue(audioContext).then(finishClapperCue).catch(finishClapperCue)
            }, delay)
        }

        scheduleClapperCue()
        if (!hasPlayedCue) {
            clapperObserver = new MutationObserver(scheduleClapperCue)
            clapperObserver.observe(animatedLogo ?? document.body, {childList: true, subtree: true})
        }
        if (audioContext.state !== 'running') {
            void audioContext.resume().catch(() => {})
        }

        return () => {
            active = false
            clearCueTimer()
            finishClapperCue()
            clapperObserver?.disconnect()
            animatedLogo?.classList.remove('welcome-branding-logo-animated')
            if (audioContext.state !== 'closed') {
                void audioContext.close().catch(() => {})
            }
        }
    }, [readyToEnter, prefersReducedMotion])

    useLayoutEffect(() => {
        const splashStatusElement = document.querySelector('#lgs-boot-splash-status')
        if (splashStatusElement) {
            splashStatusElement.textContent = initializationMessage
        }
    }, [initializationMessage])

    useEffect(() => {
        if (!readyToEnter) {
            setShowReadyMessage(false)
            return
        }

        setShowReadyMessage(true)
        const readyMessageTimer = window.setTimeout(() => {
            setShowReadyMessage(false)
        }, WELCOME_READY_MESSAGE_DURATION)

        return () => window.clearTimeout(readyMessageTimer)
    }, [readyToEnter])

    useEffect(() => () => {
        const stop = () => {
            if (document.body.classList.contains('lgs-app-booting')) {
                return
            }

            stopWelcomeHeroRouteInSplash()
        }
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(stop)
            return
        }

        void Promise.resolve().then(stop)
    }, [])

    const changeWelcomeVideo = useCallback(() => {
        if (!canChangeVideo || incomingVideoChoice) {
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

    const callToActionButtons = (
        <div id="welcome-enter-call-for-action" className="welcome-enter-call-for-action">
            <div className="welcome-enter-call-for-action-inner">
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
                    <WaIcon slot="start"
                            name="clapperboard-play"
                            variant="regular"
                            aria-hidden="true"/>
                    {'Enter Studio'}
                </WaButton>
            </div>
        </div>
    )

    return (
        <div id="welcome-hero"
             className={`lgs-theme${videoReady ? ' welcome-hero-video-ready' : ''}${imageVisible ? ' welcome-hero-image-visible' : ''}${videoTransitioning ? ' welcome-hero-video-transitioning' : ''}${incomingVideoReady ? ' welcome-hero-video-crossfade-ready' : ''}`}
             aria-busy={!readyToEnter}>
            {showMedia && <div className="welcome-hero-media"
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
            </div>}
            {showMedia && backgroundMedia.credit?.label && backgroundMedia.credit?.url && (
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
            {showMedia && <div
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
            </div>}
            <WelcomeHeroRoute mountInSplash/>
            <WelcomeHeroControls/>

            <div className="welcome-hero-shell">
                <section className="welcome-hero-content" aria-label="LGS1920 Studio launch">
                    {prefersReducedMotion ? callToActionButtons : (
                        <WaAnimation
                            ref={_ctaAnimation}
                            name="fadeInUp"
                            duration={650}
                            easing="ease-out"
                            fill="both"
                            iterations={1}
                        >
                            {callToActionButtons}
                        </WaAnimation>
                    )}
                    {(!readyToEnter || showReadyMessage) && (
                        <p className="welcome-initialization-message welcome-initialization-callout" role="status">
                            {readyToEnter ? WELCOME_READY_MESSAGE : initializationMessage}
                        </p>
                    )}
                </section>
            </div>
        </div>
    )
}
