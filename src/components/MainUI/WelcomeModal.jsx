/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-09
 * Last modified: 2026-07-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSPopup }                                          from '@Components/LGSPopup'
import { SloganSvg }                                         from '@Components/MainUI/SloganSvg'
import { APP_EVENT, MILLIS, SECOND } from '@Core/constants'
import { formatBuildInfo }                                   from '@Utils/BuildInfoUtils'
import { UIToast }                                           from '@Utils/UIToast'
import { WaButton, WaIcon, WaSpinner }                       from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogoSvg }                                           from './LogoSvg'

const DEFAULT_WELCOME_DISPLAY_TIME = 6
const WELCOME_VIDEO_DESKTOP = '/assets/media/trekking-hero-desktop.mp4'
const WELCOME_VIDEO_MOBILE = '/assets/media/trekking-hero-mobile.mp4'
const WELCOME_MAX_FOG_DURATION = 3 * MILLIS
const WELCOME_FOG_UPDATE_INTERVAL = 100
const WELCOME_EXIT_DURATION = 3000

export const WelcomeModal = ({initComplete = false, appReady = false, settingsReady = false, onEnter}) => {
    const enterHandled = useRef(false)
    const exitTimerRef = useRef(null)
    const countdownTimerRef = useRef(null)
    const [elapsedMillis, setElapsedMillis] = useState(0)
    const [countdownSeconds, setCountdownSeconds] = useState(null)
    const [replayArmed, setReplayArmed] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const [exiting, setExiting] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [buildInfoOpen, setBuildInfoOpen] = useState(false)

    const welcomeSettings = settingsReady ? lgs.settings?.ui?.welcome : null
    const configuredDisplayTime = Number(welcomeSettings?.displayTime ?? DEFAULT_WELCOME_DISPLAY_TIME)
    const displayTime = Number.isFinite(configuredDisplayTime) ? configuredDisplayTime : DEFAULT_WELCOME_DISPLAY_TIME
    const displayDuration = Math.max(Math.ceil(displayTime), 1)
    const showIntro = welcomeSettings?.showIntro !== false
    const autoClose = welcomeSettings?.autoClose !== false
    const readyToEnter = initComplete && appReady
    const replayAvailable = replayArmed && showIntro && autoClose && countdownSeconds !== null
    const studioVersion = settingsReady ? (lgs.versions?.studio ?? lgs.versions?.version) : null
    const buildInfo = settingsReady ? formatBuildInfo(lgs.build) : null
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
    }

    const hide = useCallback(({animate = true} = {}) => {
        if (!readyToEnter && !replayArmed) {
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
    }, [onEnter, readyToEnter, replayArmed, settingsReady])

    const triggerReplay = useCallback(() => {
        hide({animate: showIntro})
    }, [hide, showIntro])

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
            if (countdownTimerRef.current !== null) {
                window.clearTimeout(countdownTimerRef.current)
                countdownTimerRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!readyToEnter || !showIntro || !autoClose) {
            setCountdownSeconds(null)
            setReplayArmed(false)
            if (countdownTimerRef.current !== null) {
                window.clearTimeout(countdownTimerRef.current)
                countdownTimerRef.current = null
            }
            return undefined
        }

        setReplayArmed(true)
        let remainingSeconds = displayDuration
        let cancelled = false

        const stopCountdown = () => {
            if (countdownTimerRef.current !== null) {
                window.clearTimeout(countdownTimerRef.current)
                countdownTimerRef.current = null
            }
        }

        const stepCountdown = () => {
            if (cancelled) {
                return
            }

            setCountdownSeconds(remainingSeconds)

            if (remainingSeconds <= 0) {
                stopCountdown()
                triggerReplay()
                return
            }

            countdownTimerRef.current = window.setTimeout(() => {
                remainingSeconds -= 1
                stepCountdown()
            }, MILLIS)
        }

        stepCountdown()

        return () => {
            cancelled = true
            stopCountdown()
        }
    }, [autoClose, displayDuration, readyToEnter, showIntro, triggerReplay])

    const links = useMemo(() => {
        if (!settingsReady) {
            return null
        }

        return (
            <div id="welcome-links">
                <div id="welcome-links-do-not-show">
                    <WaButton size="s" appearance="plain" variant="neutral" onClick={setShowModal}>
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
             className={`lgs-theme${exiting ? ' welcome-modal-exiting' : ''}${videoReady ? ' welcome-modal-video-ready' : ''}`}
             aria-busy={!readyToEnter}
             style={welcomeStyle}>
            <div className="welcome-modal-media" aria-hidden="true">
                <video
                    className="welcome-modal-video"
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
            <div className="welcome-modal-fog" aria-hidden="true"/>
            <div className="welcome-modal-scrim" aria-hidden="true"/>

            {replayAvailable && countdownSeconds > 0 && (
                <div className="welcome-modal-timer">{countdownSeconds} s</div>
            )}

            <div className="welcome-modal-content">
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

                {showIntro && (
                    <div className="welcome-enter-call-for-action">
                        {settingsReady && (
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
                        )}
                        {replayAvailable ? (
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
                        size="s"
                        aria-label="Version and build information"
                        onClick={(event) => {
                            event.stopPropagation()
                            setBuildInfoOpen(open => !open)
                        }}
                    >
                        <WaIcon name="circle-info" variant="regular"/>
                    </WaButton>
                    <LGSPopup
                        active={buildInfoOpen}
                        anchor="welcome-build-info-button"
                        onRequestClose={() => setBuildInfoOpen(false)}
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
                    </LGSPopup>
                </div>
            )}
        </div>
    )
}
