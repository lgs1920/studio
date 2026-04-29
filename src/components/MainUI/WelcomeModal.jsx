/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { APP_EVENT, MILLIS, SECOND, SLOGAN }                 from '@Core/constants'
import { UIToast }                                           from '@Utils/UIToast'
import { WaButton, WaIcon }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StudioLogo }                                        from './StudioLogo'

const DEFAULT_WELCOME_DISPLAY_TIME = 6
const WELCOME_VIDEO_DESKTOP = '/assets/media/trekking-hero-desktop.mp4'
const WELCOME_VIDEO_MOBILE = '/assets/media/trekking-hero-mobile.mp4'
const WELCOME_FALLBACK_IMAGE = '/assets/images/menu-thumbnail.png'
const WELCOME_MAX_FOG_DURATION = 3 * MILLIS
const WELCOME_FOG_UPDATE_INTERVAL = 100

export const WelcomeModal = ({initComplete = false, settingsReady = false, onEnter}) => {
    const enterHandled = useRef(false)
    const [elapsedMillis, setElapsedMillis] = useState(0)

    const welcomeSettings = settingsReady ? lgs.settings?.ui?.welcome : null
    const configuredDisplayTime = Number(welcomeSettings?.displayTime ?? DEFAULT_WELCOME_DISPLAY_TIME)
    const displayTime = Number.isFinite(configuredDisplayTime) ? configuredDisplayTime : DEFAULT_WELCOME_DISPLAY_TIME
    const displayDuration = Math.max(Math.ceil(displayTime), 1)
    const showIntro = welcomeSettings?.showIntro !== false
    const autoClose = welcomeSettings?.autoClose !== false
    const elapsedSeconds = Math.floor(elapsedMillis / MILLIS)
    const closure = showIntro && autoClose ? Math.max(displayDuration - elapsedSeconds, 0) : 0
    const counterReached = !showIntro || !autoClose || closure <= 0
    const canShowFullLogo = settingsReady && Boolean(lgs.build?.date) && Boolean(lgs.versions?.studio)
    const fogDuration = Math.min(WELCOME_MAX_FOG_DURATION, displayDuration * MILLIS)
    const fogProgress = Math.min(elapsedMillis / fogDuration, 1)
    const fogStrength = Math.max(1 - fogProgress, 0)
    const welcomeStyle = {
        '--welcome-fog-opacity':      (fogStrength * .64).toFixed(3),
        '--welcome-video-blur':       `${(fogStrength * 4.5).toFixed(2)}px`,
        '--welcome-video-brightness': (0.92 + fogProgress * 0.08).toFixed(3),
        '--welcome-video-saturation': (0.82 + fogProgress * 0.18).toFixed(3),
        '--welcome-scrim-opacity':    (0.58 - fogProgress * 0.10).toFixed(3),
    }

    const hide = useCallback(() => {
        if (!initComplete) {
            return
        }

        if (enterHandled.current) {
            return
        }

        enterHandled.current = true
        document.activeElement?.blur()

        if (settingsReady) {
            lgs.settings.app.firstVisit = false
        }

        lgs.stores.ui.show = true
        lgs.stores.ui.welcome.hidden = true
        lgs.stores.ui.welcome.modal = false
        window.dispatchEvent(new CustomEvent(APP_EVENT.WELCOME.HIDE, {
            detail: {
                timestamp: Date.now(),
            },
        }))

        onEnter?.()
    }, [initComplete, onEnter, settingsReady])

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

        if (initComplete) {
            hide()
        }
    }, [hide, initComplete, settingsReady])

    useEffect(() => {
        lgs.stores.ui.welcome.modal = true
        const startedAt = Date.now()

        const timer = setInterval(() => {
            setElapsedMillis(Date.now() - startedAt)
        }, WELCOME_FOG_UPDATE_INTERVAL)

        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (initComplete && counterReached) {
            hide()
        }
    }, [counterReached, hide, initComplete])

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

    return (
        <div id="welcome-modal" className="lgs-theme" aria-busy={!initComplete} style={welcomeStyle}>
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

            {showIntro && autoClose && closure > 0 && (
                <div className="welcome-modal-timer">{closure} s</div>
            )}

            <div className="welcome-modal-content">
                {canShowFullLogo ? (
                    <StudioLogo
                        width="100%"
                        version
                        slogan={SLOGAN}
                        addClassName="welcome-logo"
                    />
                ) : (
                     <div className="main-logo signage-style welcome-logo welcome-logo-bootstrap">
                         <img src="/assets/images/logo-lgs1920-studio.png" alt="LGS1920 Studio"/>
                         <span className="the-slogan">{SLOGAN}</span>
                     </div>
                 )}

                {initComplete && !counterReached && (
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
                            {'Site'}
                        </WaButton>
                        <WaButton className="welcome-explore-button" variant="brand" onClick={enter}>
                            <WaIcon
                                slot="start"
                                name="mountains"
                                variant="regular"
                            />
                            {'Explore'}
                        </WaButton>
                    </div>
                )}
            </div>
            {links}
        </div>
    )
}
