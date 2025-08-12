/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UpdateApp.js
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
 * Valtio store for managing PWA installation and update states
 * @module UpdateStore
 */
import { proxy } from 'valtio'

/**
 * Valtio store for update and installation state
 * @typedef {Object} UpdateStore
 * @property {boolean} isInstallPromptAvailable - Indicates if the install prompt is available
 * @property {boolean} isUpdateAvailable - Indicates if an update is available
 * @property {string|null} version - Current version from Service Worker
 * @property {string|null} build - Current build from Service Worker
 * @property {string|null} installOutcome - Outcome of the install prompt ('accepted', 'dismissed', or null)
 * @property {() => Promise<void>} promptInstall - Triggers the PWA installation
 * @property {() => Promise<void>} applyUpdate - Applies the Service Worker update
 * @property {(manager: import('./update-app-manager.js').UpdateAppManager) => void} initialize - Initializes the store
 *     with a manager
 */

/**
 * Creates the update store
 * @returns {UpdateStore} The Valtio store instance
 */
const createUpdateStore = () => {
    // Create the proxy store
    const store = proxy({
                            isInstallPromptAvailable: false,
                            isUpdateAvailable:        false,
                            version:                  null,
                            build:                    null,
                            installOutcome:           null,
                            promptInstall:            async () => {
                            }, // Placeholder
                            applyUpdate:              async () => {
                            }, // Placeholder
                            initialize:               manager => {
                                // Bind manager methods to the store
                                store.promptInstall = manager.promptInstall
                                store.applyUpdate = manager.applyUpdate

                                // Set up callbacks to update store state
                                manager.setInstallCallback(({isAvailable, outcome}) => {
                                    store.isInstallPromptAvailable = isAvailable
                                    if (outcome) {
                                        store.installOutcome = outcome
                                    }
                                })

                                manager.setUpdateCallback(({isAvailable, version, build}) => {
                                    store.isUpdateAvailable = isAvailable
                                    store.version = version
                                    store.build = build
                                })
                            },
                        })

    return store
}

// Export the singleton store
export const updateStore = createUpdateStore()