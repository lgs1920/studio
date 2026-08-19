/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdate.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// **File: AppUpdate.jsx**

import {
    APP_STUDIO, BANNER_HIDE_DELAY_INSTALL, NAVIGATOR, OS_ICONS, SECOND,
}                              from '@Core/constants'
import { ErrorDiagnosticDetails } from '@Components/Modals/ErrorDiagnosticDetails'
import androidInstructions     from '@Locales/en/pwa-instructions/android.md?raw'
import chromeEdgeInstructions  from '@Locales/en/pwa-instructions/chrome-edge.md?raw'
import firefoxInstructions     from '@Locales/en/pwa-instructions/firefox.md?raw'
import iosInstructions         from '@Locales/en/pwa-instructions/ios.md?raw'
import otherInstructions       from '@Locales/en/pwa-instructions/other.md?raw'
import safariMacOSInstructions from '@Locales/en/pwa-instructions/safari-macos.md?raw'
import { WaButton, WaCallout, WaDialog, WaIcon, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import {
    collectErrorDiagnostic, formatErrorDiagnostic, sanitizeErrorHtml,
} from '@Utils/ErrorDiagnosticUtils'
import { useEffect, useState } from 'react'
import ReactMarkdown           from 'react-markdown'
import { proxy, useSnapshot }  from 'valtio'

const fallbackPwaStore = proxy({canInstall: false})
const INSTALL_PROMPT_DISMISSED_KEY = 'lgs-install-prompt-dismissed'

/**
 * Checks whether the user dismissed the installation dialog.
 *
 * @returns {boolean} Whether the installation dialog was dismissed.
 */
const isInstallPromptDismissed = () => {
    try {
        return globalThis.localStorage?.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true'
    }
    catch {
        return false
    }
}

/**
 * Maps browser and OS details to the appropriate PWA installation instructions.
 * @param {object} device - Browser and operating system details.
 * @returns {string} Markdown content for the detected browser/OS
 */
const getInstallInstructions = (device = globalThis.__?.device ?? {}) => {
    // Prioritize mobile OS instructions
    if (device.isIOS) {
        return iosInstructions
    }
    if (device.isAndroid) {
        return androidInstructions
    }

    // Handle common desktop browsers
    if (device.browser === NAVIGATOR.chrome || device.browser === NAVIGATOR.edge) {
        return chromeEdgeInstructions
    }
    if (device.browser === NAVIGATOR.firefox) {
        return firefoxInstructions
    }
    if (device.browser === NAVIGATOR.safari) {
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
    const $updaterStore = globalThis.__?.updater?.store
        ?? globalThis.lgs?.stores?.ui?.appUpdate
    const updaterStore = useSnapshot($updaterStore)
    const appContext = globalThis.lgs ?? {}
    const device = globalThis.__?.device ?? {}

    // Snapshot of the settings store. AppUpdate is mounted during bootstrap,
    // so the asynchronous application settings may not exist on first render.
    const pwaSettings = globalThis.lgs?.settings?.ui
    let $pwa = pwaSettings?.pwa ?? fallbackPwaStore
    // We need to force pwa during update
    if (pwaSettings && !pwaSettings.pwa) {
        pwaSettings.pwa = proxy({canInstall: true})
        $pwa = pwaSettings.pwa
    }
    const pwa = useSnapshot($pwa)

    // Local states for UI management (dialogs and temporary errors)
    const [showInstructionsDialog, setShowInstructionsDialog] = useState(false)
    const [showInstallingDialog, setShowInstallingDialog] = useState(false)
    const [showInstallDialog, setShowInstallDialog] = useState(false)
    const [showUpdateDialog, setShowUpdateDialog] = useState(false)
    const [installError, setInstallError] = useState(null)
    const [updateError, setUpdateError] = useState(null)
    const [dismissedUpdateTag, setDismissedUpdateTag] = useState(null)
    const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
    const browserInstructions = getInstallInstructions(device)

    // Determine conditions for displaying an action (install or update)
    // IMPORTANT: isInstallRequired now only applies to the automatic 'banner' flow
    const isInstallRequired = !appContext.pwa
        && pwa.canInstall
        && !isInstallPromptDismissed()
        && !(device.browser === NAVIGATOR.firefox && device.isDesktop)
    const isUpdateAvailable = appContext.pwa && updaterStore.isUpdateAvailable
    const isUpdateApplying = !updaterStore.updateApplyError
        && (isApplyingUpdate || Boolean(updaterStore.isUpdateApplying))

    const updateTag = updaterStore.tag || 'unknown'
    const updateMessage = updateError
        || updaterStore.updateApplyError
        || `You are using ${APP_STUDIO} version ${appContext.versions?.studio}. A new version ${updaterStore.buildTime ? `(${updaterStore.buildTime})` : ''} is ready to be installed.`
    const updateDiagnostic = updateError || updaterStore.updateApplyError
        ? collectErrorDiagnostic({
            error:        new Error(updateError || updaterStore.updateApplyError),
            suggestedFix: 'Retry the update. If the problem persists, reload Studio and try again.',
        })
        : null
    const installDiagnostic = installError && !installError.includes('successful') && !installError.includes('cancelled')
        ? collectErrorDiagnostic({
            error:        new Error(installError),
            suggestedFix: 'Retry the installation. If the problem persists, install Studio from the browser menu.',
        })
        : null

    if (updateDiagnostic) {
        updateDiagnostic.details = formatErrorDiagnostic(updateDiagnostic)
    }
    if (installDiagnostic) {
        installDiagnostic.details = formatErrorDiagnostic(installDiagnostic)
    }

    /**
     * Handles PWA installation: triggers prompt if available, otherwise shows instructions dialog.
     * @async
     */
    const handleInstall = async () => {
        setShowInstallDialog(false)

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
     * Applies the available PWA update.
     * @async
     */
    const handleApplyUpdate = async () => {
        setUpdateError(null)
        setIsApplyingUpdate(true)
        try {
            // Trigger service worker update; AppUpdateManager reloads on controllerchange.
            await $updaterStore.applyUpdate()
        }
        catch (error) {
            // Display error if update fails
            setIsApplyingUpdate(false)
            setUpdateError(error.message || 'Failed to apply update')
        }
    }

    /**
     * Closes the update dialog until a different service worker update is reported.
     */
    const handleDismissUpdate = () => {
        setShowUpdateDialog(false)
        setDismissedUpdateTag(updateTag)
    }

    /**
     * Dismisses the installation dialog until the user re-enables installation.
     */
    const handleDismissInstall = () => {
        setShowInstallDialog(false)
        $pwa.canInstall = false
        try {
            globalThis.localStorage?.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true')
        }
        catch {
            // Ignore storage restrictions and keep the dismissal for this session.
        }
    }

    /**
     * Reloads Studio after an automatic update could not be completed.
     */
    const handleRelaunchStudio = () => {
        window.location.reload()
    }

    /**
     * Opens the installation dialog for the automatic webapp flow.
     */
    useEffect(() => {
        if (mode === 'banner' && isInstallRequired) {
            setShowInstallDialog(true)
        }
    }, [isInstallRequired, mode])

    useEffect(() => {
        if (!isUpdateAvailable) {
            setShowUpdateDialog(false)
            setDismissedUpdateTag(null)
            setUpdateError(null)
            setIsApplyingUpdate(false)
            return
        }

        if (dismissedUpdateTag !== updateTag) {
            setShowUpdateDialog(true)
            setUpdateError(null)
            setIsApplyingUpdate(false)
        }
    }, [dismissedUpdateTag, isUpdateAvailable, updateTag])

    /**
     * Renders the persistent service worker update dialog.
     *
     * @returns {JSX.Element|null} The update dialog when an update is available.
     */
    const renderUpdateDialog = () => {
        if (!isUpdateAvailable) {
            return null
        }

        return (
            <WaDialog
                open={showUpdateDialog}
                label={`${APP_STUDIO} update available`}
                className="lgs-theme lgs-error-dialog app-update-dialog"
                onWaRequestClose={handleDismissUpdate}
            >
                <p>{isUpdateApplying ? 'The update is being installed. Please wait.' : updateMessage}</p>
                <p>{'The application will restart once the update is complete.'}</p>
                {updateDiagnostic && !isUpdateApplying && (
                    <ErrorDiagnosticDetails
                        diagnostic={updateDiagnostic}
                        id="app-update-error-details"
                    />
                )}
                {isUpdateApplying ? (
                    <div className="app-update-progress" role="status">
                        <WaSpinner/>
                        <span>{'Installing update...'}</span>
                    </div>
                ) : (
                    <>
                        <WaButton slot="footer" variant="brand" outline onClick={handleDismissUpdate}>
                            <WaIcon slot="start" name="hourglass-half" variant="regular"/>
                            {'Later'}
                        </WaButton>
                        <WaButton slot="footer" variant="brand" onClick={handleApplyUpdate}>
                            <WaIcon slot="start" name="arrows-rotate" variant="regular"/>
                            {'Update'}
                        </WaButton>
                    </>
                )}
            </WaDialog>
        )
    }

    /**
     * Renders the installation dialog without using a persistent banner.
     *
     * @returns {JSX.Element|null} The installation dialog when requested.
     */
    const renderInstallDialog = () => {
        if (appContext.pwa || !showInstallDialog) {
            return null
        }

        const primaryActionText = updaterStore.isInstallPromptAvailable ? 'Install' : 'How to Install'

        return (
            <WaDialog
                open
                label={`Install ${APP_STUDIO}`}
                className="lgs-theme app-install-dialog"
                onWaRequestClose={handleDismissInstall}
            >
                <p>{`Install ${APP_STUDIO} as an application for a better experience.`}</p>
                <p>{'You can close this dialog and install it later from your browser address bar or menu.'}</p>
                <WaButton slot="footer" variant="brand" outline onClick={handleDismissInstall}>
                    <WaIcon slot="start" name="hourglass-half" variant="regular"/>
                    {'Later'}
                </WaButton>
                <WaButton slot="footer" variant="brand" onClick={handleInstall}>
                    <WaIcon slot="start" name="mobile-arrow-down" variant="regular"/>
                    {primaryActionText}
                </WaButton>
            </WaDialog>
        )
    }

    /**
     * Renders the webapp update status while the service worker is checked or replaced.
     *
     * @returns {JSX.Element|null} The webapp update status callout when relevant.
     */
    const renderWebAppUpdateStatus = () => {
        const isWebApp = !appContext.pwa
        const isChecking = Boolean(updaterStore.isUpdateCheckPending)
        const isUpdating = Boolean(updaterStore.isAutomaticUpdateInProgress)
        const automaticUpdateError = updaterStore.automaticUpdateError

        if (!isWebApp || (!isChecking && !isUpdating && !automaticUpdateError)) {
            return null
        }

        const message = automaticUpdateError
            ? `The latest version could not be installed automatically. ${automaticUpdateError}`
            : isUpdating
                ? 'A new version is being installed. The application will restart once the update is complete.'
                : 'Checking for a newer version before opening Studio.'

        return (
            <WaCallout
                className="lgs-webapp-update-callout"
                open
                variant={automaticUpdateError ? 'warning' : 'info'}
                appearance="filled-outlined"
                role="status"
                aria-live="polite"
            >
                <WaIcon slot="icon" name={automaticUpdateError ? 'triangle-exclamation' : 'arrows-rotate'} variant="regular"/>
                <div className="lgs-webapp-update-callout-content">
                    <span dangerouslySetInnerHTML={{__html: sanitizeErrorHtml(message)}}/>
                    {automaticUpdateError && (
                        <WaButton size="s" variant="brand" onClick={handleRelaunchStudio}>
                            <WaIcon slot="start" name="arrows-rotate" variant="regular"/>
                            {'Relaunch Studio'}
                        </WaButton>
                    )}
                </div>
            </WaCallout>
        )
    }

    /**
     * Renders the Installing/Error Dialog.
     */
    const renderInstallingDialog = () => (
        <WaDialog
            open={showInstallingDialog}
            label="Installing LGS1920 Studio"
            noHeader className="lgs-error-dialog app-installing-dialog"
        >
            <div className="installing-dialog signage-style" style={{textAlign: 'center'}}>
                {installError ? (
                    // Display error or success state
                    <>
                        <WaIcon name={installError.includes('successful') ? 'check' : 'xmark'}
                                variant="regular"
                                style={{
                                    color:    installError.includes('successful') ? 'green' : 'red',
                                    fontSize: '2em',
                                }}/>
                        <p style={{
                            color:     installError.includes('successful') ? 'green' : 'red',
                            marginTop: '10px',
                        }}>{installError}</p>
                        {installDiagnostic && (
                            <ErrorDiagnosticDetails
                                diagnostic={installDiagnostic}
                                id="app-install-error-details"
                            />
                        )}
                    </>
                ) : (
                     // Display spinner during installation
                     <>
                         <WaSpinner style={{fontSize: '2em', '--track-width': '5px'}}/>
        <span>{`Installing ${APP_STUDIO} version ${appContext.versions?.studio}... Please wait`}</span>
                     </>
                 )}
            </div>
        </WaDialog>
    )

    /**
     * Renders the Instructions Dialog.
     */
    const renderInstructionsDialog = () => (
        <WaDialog
            open={showInstructionsDialog}
            onSlAfterHide={() => setShowInstructionsDialog(false)}
        >
            <div slot="label">
                <WaIcon name={(OS_ICONS[device.os] ?? OS_ICONS.unknown)[0]} family={(OS_ICONS[device.os] ?? OS_ICONS.unknown)[1]} variant="regular"/>
                <span>{`How to Install ${APP_STUDIO}`}</span>
            </div>
            <ReactMarkdown>{browserInstructions}</ReactMarkdown>
            <WaButton
                slot="footer"
                variant="brand"
                onClick={() => setShowInstructionsDialog(false)}
            >
                <WaIcon slot="start" name="xmark" variant="regular"/>{'Close'}
            </WaButton>
        </WaDialog>
    )

    // Render the unified action banner and dialogs
    return (
        <>
            {renderWebAppUpdateStatus()}
            {mode === 'settings' && !appContext.pwa && (
                <WaButton variant="brand" onClick={() => setShowInstallDialog(true)}>
                    <WaIcon slot="start" name="mobile-arrow-down" variant="regular"/>
                    {'Open installation dialog'}
                </WaButton>
            )}
            {renderInstallDialog()}
            {renderUpdateDialog()}
            {renderInstructionsDialog()}
            {renderInstallingDialog()}
        </>
    )
}
