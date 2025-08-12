/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdate.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-11
 * Last modified: 2025-08-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * React component to handle update and installation popups
 * @module UpdatePopup
 */
import { useEffect }        from 'react'
import { useSnapshot }      from 'valtio'
import { UpdateAppManager } from './update-app-manager.js'

/**
 * Component to manage update and installation popups
 * @returns {JSX.Element} The popup UI
 */
const UpdatePopup = () => {
    // Get the Valtio store snapshot
    const {
              isInstallPromptAvailable,
              isUpdateAvailable,
              version,
              build,
              installOutcome,
              promptInstall,
              applyUpdate,
          } = useSnapshot(UpdateAppManager.store)

    // Handle installation prompt
    useEffect(() => {
        if (isInstallPromptAvailable) {
            // TODO: Show installation popup (e.g., using Material-UI Dialog)
            console.log('Show install popup')
            // Example: <Dialog open={true} onConfirm={promptInstall}>Install the app?</Dialog>
        }
    }, [isInstallPromptAvailable])

    // Handle update availability
    useEffect(() => {
        if (isUpdateAvailable) {
            // TODO: Show update popup with version and build
            console.log(`Show update popup for version ${version}, build ${build}`)
            // Example: <Dialog open={true} onConfirm={applyUpdate}>New version {version} available!</Dialog>
        }
    }, [isUpdateAvailable, version, build])

    // Handle installation outcome
    useEffect(() => {
        if (installOutcome) {
            // TODO: Show confirmation or error popup based on outcome
            console.log(`Installation outcome: ${installOutcome}`)
            // Example: <Dialog open={true}>Installation {installOutcome === 'accepted' ? 'successful' :
            // 'cancelled'}</Dialog>
        }
    }, [installOutcome])

    return null // No UI rendered directly, use your popup library
}

export default UpdatePopup