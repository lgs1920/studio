/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdate.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-18
 * Last modified: 2025-08-18
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    APP_STUDIO,
    BANNER_SHOW_DELAY,
    BANNER_HIDE_DELAY,
    BANNER_HIDE_DELAY_INSTALL,
    NAVIGATOR,
    SECOND,
    OS_ICONS,
}                                     from '@Core/constants'
import { faMobileArrowDown, faXmark } from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton,
    SlDialog,
    SlIcon,
    SlSpinner,
}                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import ReactMarkdown                  from 'react-markdown'
import { useEffect, useState }        from 'react'
import { useSnapshot }                from 'valtio'

// Import Markdown instruction files
import iosInstructions         from '@Locales/en/pwa-instructions/ios.md?raw'
import androidInstructions     from '@Locales/en/pwa-instructions/android.md?raw'
import chromeEdgeInstructions  from '@Locales/en/pwa-instructions/chrome-edge.md?raw'
import firefoxInstructions     from '@Locales/en/pwa-instructions/firefox.md?raw'
import safariMacOSInstructions from '@Locales/en/pwa-instructions/safari-macos.md?raw'
import otherInstructions       from '@Locales/en/pwa-instructions/other.md?raw'

/**
 * Component to manage PWA installation and update banners using Shoelace components.
 * Uses __.updater for AppUpdateManager store to handle install prompts and Service Worker updates.
 * Shows an installation banner for non-installed PWAs, except on Firefox desktop, after BANNER_SHOW_DELAY,
 * which hides after BANNER_HIDE_DELAY. Shows an update banner when available, only if the app is installed
 * as a PWA, after BANNER_SHOW_DELAY, which hides after BANNER_HIDE_DELAY. Displays browser-specific
 * installation instructions from imported Markdown files in a dialog if prompt is unavailable.
 * Uses Shoelace icons for download, close, and refresh actions.
 * Displays current version in both install and update banners, with specific update message format in English.
 * @returns {JSX.Element} The AppUpdate component
 */
export const AppUpdate = () => {
    // Snapshot of the updater store
    const _updaterStore = useSnapshot(__.updater.store)

    // Local states for UI management
    const [showInstallBanner, setShowInstallBanner] = useState(false)
    const [showUpdateBanner, setShowUpdateBanner] = useState(false)
    const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
    const [showInstallingDialog, setShowInstallingDialog] = useState(false)
    const [installError, setInstallError] = useState(null)
    const [updateError, setUpdateError] = useState(null)
    const [browserInstructions, setBrowserInstructions] = useState('')

    /**
     * Determines the appropriate Markdown instruction file based on browser and OS
     * @returns {string} Markdown content for the detected browser/OS
     */
    const getInstallInstructions = () => {
        if (__.device.isIOS) {
            return iosInstructions
        }
        if (__.device.isAndroid) {
            return androidInstructions
        }
        if (__.device.browser === NAVIGATOR.chrome || __.device.browser === NAVIGATOR.edge) {
            return chromeEdgeInstructions
        }
        if (__.device.browser === NAVIGATOR.firefox) {
            return firefoxInstructions
        }
        if (__.device.browser === NAVIGATOR.safari) {
            return safariMacOSInstructions
        }
        return otherInstructions
    }

    /**
     * Manages PWA status, banners, and auto-show/hide timers
     */
    useEffect(() => {
        // Set browser-specific instructions
        setBrowserInstructions(getInstallInstructions())

        // Timers for banners
        let timers = []

        // Show install banner if not installed and not Firefox desktop
        if (!lgs.pwa && !(__.device.browser === NAVIGATOR.firefox && __.device.isDesktop)) {
            timers.push(
                setTimeout(() => setShowInstallBanner(true), BANNER_SHOW_DELAY * SECOND),
                setTimeout(
                    () => setShowInstallBanner(false),
                    (BANNER_SHOW_DELAY + BANNER_HIDE_DELAY) * SECOND,
                ),
            )
        }

        // Show update banner if app is installed and update is available
        if (lgs.pwa && _updaterStore.isUpdateAvailable) {
            timers.push(
                setTimeout(() => setShowUpdateBanner(true), BANNER_SHOW_DELAY * SECOND),
                setTimeout(
                    () => setShowUpdateBanner(false),
                    (BANNER_SHOW_DELAY + BANNER_HIDE_DELAY) * SECOND,
                ),
            )
        }

        // Handle custom update event
        const handleCustomUpdate = (event) => {
            if (event.detail.isAvailable && lgs.pwa) {
                timers.push(
                    setTimeout(() => setShowUpdateBanner(true), BANNER_SHOW_DELAY * SECOND),
                    setTimeout(
                        () => setShowUpdateBanner(false),
                        (BANNER_SHOW_DELAY + BANNER_HIDE_DELAY) * SECOND,
                    ),
                )
            }
        }
        window.addEventListener('lgs-update-available', handleCustomUpdate)

        // Cleanup timers and event listener
        return () => {
            timers.forEach(clearTimeout)
            window.removeEventListener('lgs-update-available', handleCustomUpdate)
        }
    }, [_updaterStore.isInstallPromptAvailable, _updaterStore.isUpdateAvailable, _updaterStore.buildTime])

    /**
     * Handles PWA installation: triggers prompt if available, otherwise shows instructions dialog
     * Manages installing dialog visibility and error handling
     * @async
     */
    const handleInstall = async () => {
        if (_updaterStore.isInstallPromptAvailable) {
            setShowInstallBanner(false)
            setShowInstallingDialog(true)
            setInstallError(null)

            try {
                await _updaterStore.promptInstall()
                if (_updaterStore.installOutcome !== 'accepted') {
                    setInstallError('Installation was cancelled by the user')
                }
                setTimeout(() => setShowInstallingDialog(false), BANNER_HIDE_DELAY_INSTALL * SECOND)
            }
            catch (error) {
                setInstallError(error.message || 'Failed to install the application')
                setTimeout(() => setShowInstallingDialog(false), BANNER_HIDE_DELAY_INSTALL * SECOND)
            }
        }
        else {
            setShowInstallBanner(false)
            setShowInstructionsDialog(true)
        }
    }

    /**
     * Applies the available PWA update and reloads the page
     * @async
     */
    const handleApplyUpdate = async () => {
        setUpdateError(null)
        try {
            await _updaterStore.applyUpdate()
            window.location.reload()
        }
        catch (error) {
            setUpdateError(error.message || 'Failed to apply update')
        }
    }

    // Prevent the dialog from closing when the user clicks on the overlay
    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }

    return (
        <>
            {/* Install banner (not shown on Firefox desktop) */}
            {showInstallBanner && (
                <div className="lgs-install-banner lgs-card on-map lgs-slide-in-from-top">
                    <div className="lgs-install-banner-content">
                        <div>
                            <SlIcon library="fa" name={FA2SL.set(faMobileArrowDown)}/>
                            <span>Install {APP_STUDIO} version {lgs?.versions?.studio} as an application for a better experience</span>
                        </div>
                        <div className="buttons-bar">
                            <SlButton
                                size="small"
                                variant="default"
                                outline
                                onClick={() => setShowInstallBanner(false)}
                            >
                                <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faXmark)}/>
                                Later
                            </SlButton>
                            <SlButton
                                size="small"
                                onClick={handleInstall}
                                variant="primary"
                            >
                                <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faMobileArrowDown)}/>
                                {_updaterStore.isInstallPromptAvailable ? 'Install' : 'How to Install'}
                            </SlButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Instructions dialog with ReactMarkdown */}
            <SlDialog
                open={showInstructionsDialog}
                onSlAfterHide={() => setShowInstructionsDialog(false)}
            >
                <div slot="label">
                    <SlIcon size="small" library="fa" name={FA2SL.set(OS_ICONS[__.device.os])}/>
                    &nbsp;
                    <span>How to Install {APP_STUDIO}</span>
                </div>
                <ReactMarkdown>{browserInstructions}</ReactMarkdown>
                <SlButton
                    slot="footer"
                    variant="primary"
                    onClick={() => setShowInstructionsDialog(false)}
                >
                    <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faXmark)}/>
                    Close
                </SlButton>
            </SlDialog>

            {/* Installing in progress or error dialog */}
            <SlDialog
                open={showInstallingDialog}
                label="Installing LGS1920 Studio"
                noHeader className="app-installing-dialog"
                onSlRequestClose={handleRequestClose}
            >
                <div className="installing-dialog signage-style" style={{textAlign: 'center'}}>
                    {installError ? (
                        <p style={{color: 'red'}}>{installError}</p>
                    ) : (
                         <>
                             <SlSpinner/>
                             <span>{`Installing ${APP_STUDIO} version ${lgs?.versions?.studio}... Please wait`}</span>
                         </>
                     )}
                </div>
            </SlDialog>

            {/* Update banner (shown only if app is installed as PWA) */}
            {showUpdateBanner && (
                <div className="lgs-install-banner lgs-card on-map lgs-slide-in-from-top">
                    <div className="lgs-install-banner-content">
                        <div>
                            <SlIcon library="fa" name={FA2SL.set(faMobileArrowDown)}/>
                            <span>
                                {updateError || `You are using ${APP_STUDIO} version ${lgs?.versions?.studio}. A new version ${_updaterStore.buildTime ? `(${_updaterStore.buildTime})` : ''} is ready to be installed.`}
                            </span>
                        </div>
                        <div className="buttons-bar">
                            <SlButton
                                size="small"
                                variant="default"
                                outline
                                onClick={() => setShowUpdateBanner(false)}
                            >
                                <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faXmark)}/>
                                {updateError ? 'Close' : 'Later'}
                            </SlButton>
                            {!updateError && (
                                <SlButton
                                    size="small"
                                    onClick={handleApplyUpdate}
                                    variant="primary"
                                >
                                    <SlIcon slot="prefix" size="small" library="fa"
                                            name={FA2SL.set(faMobileArrowDown)}/>
                                    Update
                                </SlButton>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}