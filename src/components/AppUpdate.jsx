/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdate.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// **File: AppUpdate.jsx**

import {
    APP_STUDIO, BANNER_HIDE_DELAY, BANNER_HIDE_DELAY_INSTALL, BANNER_SHOW_DELAY, NAVIGATOR, OS_ICONS, SECOND,
}                                                               from '@Core/constants'
import { faHourglassHalf, faMobileArrowDown, faXmark, faCheck } from '@fortawesome/pro-regular-svg-icons'
import androidInstructions                                      from '@Locales/en/pwa-instructions/android.md?raw'
import chromeEdgeInstructions                                   from '@Locales/en/pwa-instructions/chrome-edge.md?raw'
import firefoxInstructions                                      from '@Locales/en/pwa-instructions/firefox.md?raw'
import iosInstructions                                          from '@Locales/en/pwa-instructions/ios.md?raw'
import otherInstructions                                        from '@Locales/en/pwa-instructions/other.md?raw'
import safariMacOSInstructions                                  from '@Locales/en/pwa-instructions/safari-macos.md?raw'
import { SlButton, SlDialog, SlIcon, SlSpinner } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                from '@Utils/FA2SL'
import classNames                                               from 'classnames'
import { useEffect, useState }                                  from 'react'
import ReactMarkdown          from 'react-markdown'
import { proxy, useSnapshot } from 'valtio'

// Define the custom event name for consistency
const CUSTOM_UPDATE_EVENT = 'lgs-update-available'

/**
 * Maps browser and OS details to the appropriate PWA installation instructions.
 * @returns {string} Markdown content for the detected browser/OS
 */
const getInstallInstructions = () => {
    // Prioritize mobile OS instructions
    if (__.device.isIOS) {
        return iosInstructions
    }
    if (__.device.isAndroid) {
        return androidInstructions
    }

    // Handle common desktop browsers
    if (__.device.browser === NAVIGATOR.chrome || __.device.browser === NAVIGATOR.edge) {
        return chromeEdgeInstructions
    }
    if (__.device.browser === NAVIGATOR.firefox) {
        return firefoxInstructions
    }
    if (__.device.browser === NAVIGATOR.safari) {
        return safariMacOSInstructions
    }

    // Fallback for all other environments
    return otherInstructions
}

/**
 * Component to manage PWA installation and update banners using Shoelace components.
 * Uses __.updater.store for AppUpdateManager state to handle install prompts and Service Worker updates.
 * @param {string} mode - The display mode ('banner' or other, which enables manual display)
 * @returns {JSX.Element} The AppUpdate component
 */
export const AppUpdate = ({mode = 'banner'}) => {
    // Snapshot of the updater store for reactive access
    const $updaterStore = __.updater.store
    const updaterStore = useSnapshot($updaterStore)

    // Snapshot of the settings store
    let $pwa = lgs.settings.ui.pwa
    // We need to force pwa during update
    if (!$pwa) {
        lgs.settings.ui.pwa = proxy({canInstall: true})
    }
    const pwa = useSnapshot($pwa)

    // Local states for UI management (dialogs and temporary errors)
    const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
    const [showInstallingDialog, setShowInstallingDialog] = useState(false)
    const [showUnifiedBanner, setShowUnifiedBanner] = useState(false)
    const [installError, setInstallError] = useState(null)
    const [updateError, setUpdateError] = useState(null)
    const [browserInstructions] = useState(getInstallInstructions())

    // Determine conditions for displaying an action (install or update)
    // IMPORTANT: isInstallRequired now only applies to the automatic 'banner' flow
    const isInstallRequired = !lgs.pwa && pwa.canInstall && !(__.device.browser === NAVIGATOR.firefox && __.device.isDesktop)
    const isUpdateAvailable = lgs.pwa && updaterStore.isUpdateAvailable

    // The banner only needs to show if either action is required
    const shouldRenderBanner = isInstallRequired || isUpdateAvailable

    /**
     * Handles PWA installation: triggers prompt if available, otherwise shows instructions dialog.
     * @async
     */
    const handleInstall = async () => {
        // Hide the banner immediately upon interaction
        setShowUnifiedBanner(false)

        if (updaterStore.isInstallPromptAvailable) {
            setShowInstallingDialog(true)
            setInstallError(null)

            try {
                // Trigger the native browser installation prompt
                await $updaterStore.promptInstall()

                // Handle prompt outcome
                if (updaterStore.installOutcome !== 'accepted') {
                    setInstallError('Installation was cancelled by the user')
                }
                else {
                    setInstallError('Installation successful!')
                }

                // Hide the installing dialog after a delay
                setTimeout(() => setShowInstallingDialog(false), BANNER_HIDE_DELAY_INSTALL * SECOND)
            }
            catch (error) {
                // Set error and hide dialog
                setInstallError(error.message || 'Failed to install the application')
                setTimeout(() => setShowInstallingDialog(false), BANNER_HIDE_DELAY_INSTALL * SECOND)
            }
        }
        else {
            // Fallback to showing manual instructions
            setShowInstructionsDialog(true)
        }
    }

    /**
     * Applies the available PWA update and reloads the page.
     * @async
     */
    const handleApplyUpdate = async () => {
        setUpdateError(null)
        try {
            // Trigger service worker update and force a page reload
            await $updaterStore.applyUpdate()
            window.location.reload()
        }
        catch (error) {
            // Display error if update fails
            setUpdateError(error.message || 'Failed to apply update')
        }
    }

    /**
     * Permanently dismisses the install banner by updating the global settings.
     */
    const handleDismiss = () => {
        setShowUnifiedBanner(false)
        // Persist dismissal state in global store
        $pwa.canInstall = false
    }

    /**
     * Manages PWA status and auto-show/hide timers for the unified banner (only in 'banner' mode).
     */
    useEffect(() => {
        let timers = []

        /**
         * Sets up timers to automatically show and then hide the unified banner.
         */
        const setupBannerTimers = () => {
            timers.forEach(clearTimeout)
            timers = []

            // Show banner after a short delay
            timers.push(
                setTimeout(() => setShowUnifiedBanner(true), BANNER_SHOW_DELAY * SECOND),
            )
            // Automatically hide the banner after its display duration
            timers.push(
                setTimeout(
                    () => setShowUnifiedBanner(false),
                    (BANNER_SHOW_DELAY + BANNER_HIDE_DELAY) * SECOND,
                ),
            )
        }

        // Only set timers if in banner mode and an action is required
        if (mode === 'banner' && shouldRenderBanner) {
            setupBannerTimers()
        }

        // Custom event handler for immediate update availability notification
        const handleCustomUpdate = (event) => {
            // Re-trigger timers if PWA is installed and a new update is detected
            if (mode === 'banner' && event.detail.isAvailable && lgs.pwa) {
                setupBannerTimers()
            }
        }
        window.addEventListener(CUSTOM_UPDATE_EVENT, handleCustomUpdate)

        // Cleanup timers and event listener
        return () => {
            timers.forEach(clearTimeout)
            window.removeEventListener(CUSTOM_UPDATE_EVENT, handleCustomUpdate)
        }
    }, [isInstallRequired, isUpdateAvailable, mode])

    /**
     * Renders the Unified PWA Action Banner (Install or Update).
     * @returns {JSX.Element | null} The Unified Banner JSX
     */
    const renderUnifiedBanner = () => {
        // Determine if we are rendering in the standard banner flow
        const isStandardBannerFlow = mode === 'banner'

        // Determine if this banner relates to an update
        const isUpdate = isUpdateAvailable

        // --- Conditional Rendering Logic ---
        if (isStandardBannerFlow) {
            // In standard banner mode, use internal state and action flags
            if (!showUnifiedBanner || !shouldRenderBanner) {
                return null
            }
        }
        else {
            // In non-banner mode (forced display):
            // 1. If PWA is installed, return null (nothing to do manually).
            if (lgs.pwa) {
                return null
            }
            // 2. If PWA is not installed, we display the install message forcefully,
            //    regardless of the pwa.canInstall setting (which was set by 'Dismiss').
            //    The only action is to install/show instructions, which is available.
        }

        // --- Content Determination ---
        const contentText = isUpdate
                            ? updateError || `You are using ${APP_STUDIO} version ${lgs?.versions?.studio}. A new version ${updaterStore.buildTime ? `(${updaterStore.buildTime})` : ''} is ready to be installed.`
                            : `Install ${APP_STUDIO} version ${lgs?.versions?.studio} as an application for a better experience`

        const primaryActionText = isUpdate
                                  ? 'Update'
                                  : (updaterStore.isInstallPromptAvailable ? 'Install' : 'How to Install')

        const handlePrimaryAction = isUpdate
                                    ? handleApplyUpdate
                                    : handleInstall

        return (
            <div className={classNames('lgs-install-banner',
                                       // Apply card styles only for standard banner mode
                                       {'lgs-card on-map lgs-slide-in-from-top': isStandardBannerFlow},
            )}>
                <div className="lgs-install-banner-content">
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faMobileArrowDown)}/>
                        <span>{contentText}</span>
                    </div>
                    <div className="buttons-bar">
                        {/* Dismiss Button (Install only, in standard banner flow) */}
                        {!isUpdate && isStandardBannerFlow && (
                            <SlButton
                                size="small"
                                variant="default"
                                outline
                                onClick={handleDismiss} // Permanent dismissal for install
                            >
                                <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faXmark)}/>
                                {'Dismiss'}
                            </SlButton>
                        )}

                        {/* Later/Close Button (only in standard banner flow) */}
                        {isStandardBannerFlow && (
                            <SlButton
                                size="small"
                                variant="default"
                                outline
                                onClick={() => setShowUnifiedBanner(false)}
                            >
                                <SlIcon slot="prefix" size="small" library="fa"
                                        name={FA2SL.set(isUpdate ? faXmark : faHourglassHalf)}/>
                                {updateError ? 'Close' : 'Later'}
                            </SlButton>
                        )}

                        {/* Primary Action Button (Install or Update) */}
                        {!(isUpdate && updateError) && ( // Don't show update button if there's an update error
                            <SlButton
                                size="small"
                                onClick={handlePrimaryAction}
                                variant="primary"
                            >
                                <SlIcon slot="prefix" size="small" library="fa" name={FA2SL.set(faMobileArrowDown)}/>
                                {primaryActionText}
                            </SlButton>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    /**
     * Renders the Installing/Error Dialog.
     */
    const renderInstallingDialog = () => (
        <SlDialog
            open={showInstallingDialog}
            label="Installing LGS1920 Studio"
            noHeader className="app-installing-dialog"
            // Prevents closing on overlay click
            onSlRequestClose={(event) => event.detail.source === 'overlay' && event.preventDefault()}
        >
            <div className="installing-dialog signage-style" style={{textAlign: 'center'}}>
                {installError ? (
                    // Display error or success state
                    <>
                        <SlIcon library="fa" name={FA2SL.set(installError.includes('successful') ? faCheck : faXmark)}
                                style={{
                                    color:    installError.includes('successful') ? 'green' : 'red',
                                    fontSize: '2em',
                                }}/>
                        <p style={{
                            color:     installError.includes('successful') ? 'green' : 'red',
                            marginTop: '10px',
                        }}>{installError}</p>
                    </>
                ) : (
                     // Display spinner during installation
                     <>
                         <SlSpinner style={{fontSize: '2em', '--track-width': '5px'}}/>
                         <span>{`Installing ${APP_STUDIO} version ${lgs?.versions?.studio}... Please wait`}</span>
                     </>
                 )}
            </div>
        </SlDialog>
    )

    /**
     * Renders the Instructions Dialog.
     */
    const renderInstructionsDialog = () => (
        <SlDialog
            open={showInstructionsDialog}
            onSlAfterHide={() => setShowInstructionsDialog(false)}
        >
            <div slot="label">
                <SlIcon size="small" library="fa" name={FA2SL.set(OS_ICONS[__.device.os])}/>
                &nbsp;
                <span>{`How to Install ${APP_STUDIO}`}</span>
            </div>
            {/* Render browser-specific instructions from Markdown */}
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
    )

    // Render the unified action banner and dialogs
    return (
        <>
            {renderUnifiedBanner()}
            {renderInstructionsDialog()}
            {renderInstallingDialog()}
        </>
    )
}