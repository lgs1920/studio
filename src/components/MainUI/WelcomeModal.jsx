/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { APP_EVENT, MILLIS, SECOND, SLOGAN }                 from '@Core/constants'
import { UIToast }                                           from '@Utils/UIToast'
import { WaButton, WaIcon, WaPopup, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StudioLogo }                                        from './StudioLogo'

const DEFAULT_WELCOME_DISPLAY_TIME = 6
const WELCOME_VIDEO_DESKTOP = '/assets/media/trekking-hero-desktop.mp4'
const WELCOME_VIDEO_MOBILE = '/assets/media/trekking-hero-mobile.mp4'
const WELCOME_FALLBACK_IMAGE = '/assets/images/welcome-splash.png'
const WELCOME_MAX_FOG_DURATION = 3 * MILLIS
const WELCOME_FOG_UPDATE_INTERVAL = 100
const WELCOME_EXIT_DURATION = 3000

const formatBuildInfo = build => {
    const rawBuild = build?.date ?? build?.buildTime ?? build?.id ?? build?.hash
    if (!rawBuild) {
        return new Date().toLocaleString()
    }

    const timestamp = Number(rawBuild)
    if (Number.isFinite(timestamp)) {
        return new Date(timestamp).toLocaleString()
    }

    return String(rawBuild)
}

export const WelcomeModal = ({initComplete = false, appReady = false, settingsReady = false, onEnter}) => {
    const enterHandled = useRef(false)
    const exitTimerRef = useRef(null)
    const [elapsedMillis, setElapsedMillis] = useState(0)
    const [readyElapsedMillis, setReadyElapsedMillis] = useState(0)
    const [dismissed, setDismissed] = useState(false)
    const [exiting, setExiting] = useState(false)
    const [buildInfoOpen, setBuildInfoOpen] = useState(false)

    const welcomeSettings = settingsReady ? lgs.settings?.ui?.welcome : null
    const configuredDisplayTime = Number(welcomeSettings?.displayTime ?? DEFAULT_WELCOME_DISPLAY_TIME)
    const displayTime = Number.isFinite(configuredDisplayTime) ? configuredDisplayTime : DEFAULT_WELCOME_DISPLAY_TIME
    const displayDuration = Math.max(Math.ceil(displayTime), 1)
    const showIntro = welcomeSettings?.showIntro !== false
    const autoClose = welcomeSettings?.autoClose !== false
    const readyToEnter = initComplete && appReady
    const readyElapsedSeconds = Math.floor(readyElapsedMillis / MILLIS)
    const closure = showIntro && autoClose && readyToEnter ? Math.max(displayDuration - readyElapsedSeconds, 0) : 0
    const autoCloseReached = showIntro && autoClose && readyToEnter && closure <= 0
    const shouldAutoEnter = readyToEnter && (!showIntro || autoCloseReached)
    const studioVersion = settingsReady ? (lgs.versions?.studio ?? lgs.versions?.version) : null
    const buildInfo = settingsReady ? formatBuildInfo(lgs.build) : null
    const canShowFullLogo = settingsReady && Boolean(studioVersion)
    const fogDuration = Math.min(WELCOME_MAX_FOG_DURATION, displayDuration * MILLIS)
    const fogProgress = Math.min(elapsedMillis / fogDuration, 1)
    const fogStrength = Math.max(1 - fogProgress, 0)
    const welcomeStyle = {
        '--welcome-fog-opacity':      (fogStrength * .64).toFixed(3),
        '--welcome-video-blur':       `${(fogStrength * 4.5).toFixed(2)}px`,
        '--welcome-video-brightness': (0.92 + fogProgress * 0.08).toFixed(3),
        '--welcome-video-saturation': (0.82 + fogProgress * 0.18).toFixed(3),
        '--welcome-scrim-opacity':    (0.58 - fogProgress * 0.10).toFixed(3),
        '--welcome-exit-duration':    `${WELCOME_EXIT_DURATION}ms`,
        '--welcome-background-image': `url(${WELCOME_FALLBACK_IMAGE})`,
    }

    const hide = useCallback(({animate = true} = {}) => {
        if (!readyToEnter) {
            return
        }

        if (enterHandled.current) {
            return
        }

        enterHandled.current = true
        setExiting(true)
        setBuildInfoOpen(false)
        document.activeElement?.blur()

        if (settingsReady) {
            lgs.settings.app.firstVisit = false
        }

        lgs.stores.ui.show = true
        lgs.stores.ui.welcome.hidden = true
        lgs.stores.ui.welcome.modal = false
        document.body.classList.remove('lgs-app-booting')
        document.body.classList.add('lgs-app-visible')
        window.dispatchEvent(new CustomEvent(APP_EVENT.WELCOME.HIDE, {
            detail: {
                timestamp: Date.now(),
            },
        }))

        if (!animate) {
            setDismissed(true)
            onEnter?.()
            return
        }

        exitTimerRef.current = window.setTimeout(() => {
            exitTimerRef.current = null
            setDismissed(true)
            onEnter?.()
        }, WELCOME_EXIT_DURATION)
    }, [onEnter, readyToEnter, settingsReady])

    const enter = () => {
        hide()
    }

    const setShowModal = useCallback(() => {
        if (settingsReady) {
            lgs.settings.ui.welcome.showIntro = false
        }

        UIToast.notify({
                           caption: `The introduction will be hidden next time!`,
                           text:    `This can be changed later in the settings menu.`,
                       }, 5 * SECOND)

        if (readyToEnter) {
            hide()
        }
    }, [hide, readyToEnter, settingsReady])

    useEffect(() => {
        lgs.stores.ui.welcome.modal = true
        const startedAt = Date.now()

        const timer = setInterval(() => {
            setElapsedMillis(Date.now() - startedAt)
        }, WELCOME_FOG_UPDATE_INTERVAL)

        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        return () => {
            if (exitTimerRef.current !== null) {
                window.clearTimeout(exitTimerRef.current)
                exitTimerRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!readyToEnter) {
            return undefined
        }

        const startedAt = Date.now()

        const timer = setInterval(() => {
            setReadyElapsedMillis(Date.now() - startedAt)
        }, WELCOME_FOG_UPDATE_INTERVAL)

        return () => clearInterval(timer)
    }, [readyToEnter])

    useEffect(() => {
        if (shouldAutoEnter) {
            const frameId = requestAnimationFrame(() => hide({animate: showIntro}))
            return () => cancelAnimationFrame(frameId)
        }
        return undefined
    }, [hide, shouldAutoEnter, showIntro])

    const links = useMemo(() => {
        if (!settingsReady) {
            return null
        }

        return (
            <div id="welcome-links">
                <div id="welcome-links-do-not-show">
                    <WaButton size="small" appearance="plain" variant="neutral" onClick={setShowModal}>
                        {'Don\'t show intro anymore'}
                    </WaButton>
                </div>
            </div>
        )
    }, [settingsReady, setShowModal])

    if (dismissed) {
        return null
    }

    return (
        <div id="welcome-modal"
             className={`lgs-theme${exiting ? ' welcome-modal-exiting' : ''}`}
             aria-busy={!readyToEnter}
             style={welcomeStyle}>
            <div className="welcome-modal-media" aria-hidden="true">
                <video
                    className="welcome-modal-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster={WELCOME_FALLBACK_IMAGE}
                >
                    <source src={WELCOME_VIDEO_MOBILE} media="(max-width: 700px)" type="video/mp4"/>
                    <source src={WELCOME_VIDEO_DESKTOP} type="video/mp4"/>
                </video>
            </div>
            <div className="welcome-modal-fog" aria-hidden="true"/>
            <div className="welcome-modal-scrim" aria-hidden="true"/>

            {showIntro && autoClose && readyToEnter && closure > 0 && (
                <div className="welcome-modal-timer">{closure} s</div>
            )}

            <div className="welcome-modal-content">
                {canShowFullLogo ? (
                    <StudioLogo
                        width="100%"
                        slogan={SLOGAN}
                        addClassName="welcome-logo"
                    />
                ) : (
                     <div className="main-logo signage-style welcome-logo welcome-logo-bootstrap">
                         <img src="/assets/images/logo-lgs1920-studio.png" alt="LGS1920 Studio"/>
                         <span className="the-slogan">{SLOGAN}</span>
                     </div>
                 )}

                {showIntro && settingsReady && (
                    <div className="welcome-enter-call-for-action">
                        <WaButton
                            className="welcome-site-button"
                            appearance="outlined"
                            variant="brand"
                            href={__.app.buildUrl(lgs.configuration.website)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={enter}
                        >
                            <WaIcon slot="start" name="globe-pointer" variant="regular"/>
                            {'Visit our Site'}
                        </WaButton>
                        {readyToEnter ? (
                            <WaButton className="welcome-explore-button" variant="brand" onClick={enter}>
                                <WaIcon
                                    slot="start"
                                    name="mountains"
                                    variant="regular"
                                />
                                {'Replay your adventures'}
                            </WaButton>
                        ) : (
                             <div className="welcome-loading-indicator" role="status" aria-live="polite"
                                  aria-label="Loading">
                                 <span>{'Loading ...'}</span>
                                 <WaSpinner/>
                             </div>
                         )}
                    </div>
                )}
            </div>
            {links}
            {studioVersion && (
                <div id="welcome-build-info">
                    <WaButton
                        id="welcome-build-info-button"
                        className="welcome-build-info-button"
                        appearance="plain"
                        size="small"
                        aria-label="Version and build information"
                        onClick={(event) => {
                            event.stopPropagation()
                            setBuildInfoOpen(open => !open)
                        }}
                    >
                        <WaIcon name="circle-info" variant="regular"/>
                    </WaButton>
                    <WaPopup
                        active={buildInfoOpen}
                        anchor="welcome-build-info-button"
                        placement="top-end"
                        distance={lgs.gutter?.s ?? 8}
                        flip
                        shift
                    >
                        <div className="welcome-build-info-popup">
                            <div>
                                <span>{'Version'}</span>
                                <strong>{studioVersion}</strong>
                            </div>
                            <div>
                                <span>{'Build'}</span>
                                <strong>{buildInfo}</strong>
                            </div>
                        </div>
                    </WaPopup>
                </div>
            )}
        </div>
    )
}
