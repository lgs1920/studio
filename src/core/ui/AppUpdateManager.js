/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdateManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-16
 * Last modified: 2026-03-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export class AppUpdateManager {
    static automaticUpdateTimeout = 10_000
    static initialUpdateCheckTimeout = 5000
    static #instance = null
    static beforeInstallPromptEvent = 'beforeinstallprompt'
    static messageEvent = 'message'
    static newVersionMessage = 'NEW_VERSION'
    static skipWaitingMessage = 'SKIP_WAITING'
    static typeKey = 'type'
    static tagKey = 'tag'

    #store = null
    #installPrompt = null
    #installCallback = null
    #updateCallback = null
    #registration = null
    #reloadAfterControllerChange = false
    #hasReloadedForUpdate = false
    #automaticUpdateInProgress = false
    #automaticUpdateTimeoutId = null
    #lastUpdateCheck = 0

    constructor() {
        if (AppUpdateManager.#instance) {
            return AppUpdateManager.#instance
        }
        this.#initialize()
        AppUpdateManager.#instance = this
    }

    static get instance() {
        return AppUpdateManager.#instance || new AppUpdateManager()
    }

    get store() {
        return this.#store
    }

    #initialize = () => {
        if (typeof lgs?.stores?.ui?.appUpdate === 'undefined') {
            return
        }
        this.#store = lgs.stores.ui.appUpdate
        this.#store.isUpdateCheckPending = !lgs.pwa
        this.#store.isUpdateApplying = false
        this.#store.updateApplyError = null
        this.#store.promptInstall = this.promptInstall
        this.#store.applyUpdate = this.applyUpdate
        this.#store.applyUpdateWithCacheReset = this.applyUpdateWithCacheReset

        this.setInstallCallback(({isAvailable, outcome}) => {
            if (this.#store) {
                this.#store.isInstallPromptAvailable = isAvailable
                if (outcome) {
                    this.#store.installOutcome = outcome
                }
            }
        })

        this.setUpdateCallback(({isAvailable, tag}) => {
            if (this.#store) {
                this.#store.isUpdateAvailable = isAvailable
                this.#store.tag = tag
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('lgs-update-available', {detail: {tag, isAvailable}}))
                }
            }
        })

        this.#setupInstallPromptListener()
        this.#setupSWUpdateListener()
        this.#setupCacheEventListener()
    }

    setInstallCallback = callback => {
        this.#installCallback = callback
    }

    setUpdateCallback = callback => {
        this.#updateCallback = callback
    }

    /**
     * Handles a newly installed service worker according to the current app surface.
     *
     * Installed PWAs keep the explicit update dialog, while the browser webapp
     * activates and reloads the new worker automatically.
     *
     * @param {string} tag - Service worker update identifier.
     * @returns {void}
     */
    #handleUpdateAvailable = tag => {
        if (lgs.pwa) {
            this.#updateCallback?.({isAvailable: true, tag})
            return
        }

        if (this.#store) {
            this.#store.isAutomaticUpdateInProgress = true
            this.#store.automaticUpdateError = null
        }
        void this.#applyAutomaticUpdate()
    }

    /**
     * Applies a webapp service worker update without displaying PWA controls.
     *
     * @returns {Promise<void>}
     */
    #applyAutomaticUpdate = async () => {
        if (this.#automaticUpdateInProgress) {
            return
        }

        this.#automaticUpdateInProgress = true
        try {
            await this.applyUpdate()
        }
        catch (error) {
            this.#clearUpdateActivationTimeout()
            if (this.#store) {
                this.#store.isAutomaticUpdateInProgress = false
                this.#store.automaticUpdateError = error.message
            }
            this.#automaticUpdateInProgress = false
        }
    }

    /**
     * Marks the initial webapp service worker check as complete.
     *
     * @returns {void}
     */
    #completeInitialUpdateCheck = () => {
        if (this.#store) {
            this.#store.isUpdateCheckPending = false
        }
    }

    /**
     * Clears the fallback timer used while waiting for controllerchange.
     *
     * @returns {void}
     */
    #clearUpdateActivationTimeout = () => {
        if (this.#automaticUpdateTimeoutId !== null) {
            window.clearTimeout(this.#automaticUpdateTimeoutId)
            this.#automaticUpdateTimeoutId = null
        }
    }

    /**
     * Prevents a controllerchange stall from blocking the app indefinitely.
     *
     * @returns {void}
     */
    #scheduleUpdateActivationTimeout = () => {
        this.#clearUpdateActivationTimeout()
        this.#automaticUpdateTimeoutId = window.setTimeout(() => {
            this.#automaticUpdateTimeoutId = null
            if (!this.#reloadAfterControllerChange) {
                return
            }

            const registration = this.#registration
            if (registration?.waiting == null
                && registration?.active?.state === 'activated'
                && navigator.serviceWorker.controller) {
                this.#reloadPageForUpdate()
                return
            }

            this.#automaticUpdateInProgress = false
            this.#reloadAfterControllerChange = false
            if (this.#store) {
                this.#store.isUpdateApplying = false
                this.#store.updateApplyError = 'The update could not be activated automatically. Please reload Studio.'
                this.#store.isAutomaticUpdateInProgress = false
                if (!globalThis.lgs?.pwa) {
                    this.#store.automaticUpdateError = this.#store.updateApplyError
                }
            }
        }, AppUpdateManager.automaticUpdateTimeout)
    }

    #setupInstallPromptListener = () => {
        if (!window || !window.addEventListener) {
            return
        }

        if (window.deferredPrompt) {
            this.#installPrompt = window.deferredPrompt
            if (this.#store) {
                this.#store.isInstallPromptAvailable = true
            }
            this.#installCallback?.({isAvailable: true})
            return
        }

        window.addEventListener(AppUpdateManager.beforeInstallPromptEvent, e => {
            e.preventDefault()
            this.#installPrompt = e
            window.deferredPrompt = e
            if (this.#store) {
                this.#store.isInstallPromptAvailable = true
            }
            this.#installCallback?.({isAvailable: true})
        }, {once: false, passive: true})
    }

    promptInstall = async () => {
        if (!this.#installPrompt?.prompt) {
            return
        }

        try {
            await this.#installPrompt.prompt()
            const {outcome} = await this.#installPrompt.userChoice
            this.#installPrompt = null
            this.#installCallback?.({isAvailable: false, outcome})
        }
        catch (error) {
            this.#installCallback?.({isAvailable: false, outcome: 'error'})
        }
    }

    #setupSWUpdateListener = () => {
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.addEventListener) {
            this.#completeInitialUpdateCheck()
            return
        }

        navigator.serviceWorker.addEventListener(AppUpdateManager.messageEvent, event => {
            if (event.data?.[AppUpdateManager.typeKey] === AppUpdateManager.newVersionMessage) {
                this.#handleUpdateAvailable(event.data[AppUpdateManager.tagKey] || 'unknown')
            }
        }, {passive: true})

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!this.#reloadAfterControllerChange) {
                return
            }

            this.#reloadPageForUpdate()
        }, {passive: true})

        window.addEventListener('focus', () => {
            this.#checkForUpdates()
        }, {passive: true})

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.#checkForUpdates()
            }
        }, {passive: true})

        const registrationPromise = navigator.serviceWorker.register('/service-worker-pwa.js', {updateViaCache: 'none'})
            .catch(() => null)
        let timeoutId
        const timeoutPromise = new Promise(resolve => {
            timeoutId = window.setTimeout(() => resolve(null), AppUpdateManager.initialUpdateCheckTimeout)
        })

        Promise.race([registrationPromise, timeoutPromise])
            .then(registration => {
                window.clearTimeout(timeoutId)
                if (!registration) {
                    this.#completeInitialUpdateCheck()
                    return
                }

                this.#registration = registration
                this.#watchRegistration(registration)
                const checkTimeoutId = window.setTimeout(
                    this.#completeInitialUpdateCheck,
                    AppUpdateManager.initialUpdateCheckTimeout,
                )
                void this.#checkForUpdates({force: true}).finally(() => {
                    window.clearTimeout(checkTimeoutId)
                    this.#completeInitialUpdateCheck()
                })
            })
    }

    #watchRegistration = registration => {
        if (registration.waiting && navigator.serviceWorker.controller) {
            this.#handleUpdateAvailable('new-version-ready')
        }

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            newWorker?.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.#handleUpdateAvailable('new-version-ready')
                }
            }, {passive: true})
        }, {passive: true})
    }

    #checkForUpdates = async ({force = false} = {}) => {
        const now = Date.now()
        if (!force && now - this.#lastUpdateCheck < 60_000) {
            return
        }
        this.#lastUpdateCheck = now

        try {
            const registration = this.#registration || await navigator.serviceWorker.getRegistration()
            await registration?.update()
        }
        catch (error) {
        }
    }

    #reloadPageForUpdate = () => {
        if (this.#hasReloadedForUpdate) {
            return
        }

        this.#hasReloadedForUpdate = true
        this.#clearUpdateActivationTimeout()
        this.#automaticUpdateInProgress = false
        if (this.#store) {
            this.#store.isUpdateApplying = false
            this.#store.updateApplyError = null
            this.#store.isAutomaticUpdateInProgress = false
            this.#store.automaticUpdateError = null
        }
        this.#updateCallback?.({isAvailable: false})
        window.location.reload()
    }

    #setupCacheEventListener = () => {
        window.addEventListener('lgs:cache-cleared', () => {
            if (this.#store) {
                this.#store.isCachePurged = true
            }
        })
    }

    applyUpdate = async () => {
        if (this.#store) {
            this.#store.isUpdateApplying = true
            this.#store.updateApplyError = null
        }
        try {
            if (!('serviceWorker' in navigator)) {
                throw new Error('Service workers are not available in this browser')
            }

            const reg = this.#registration || await navigator.serviceWorker.getRegistration()
            await reg?.update()
            if (!reg?.waiting?.postMessage) {
                throw new Error('The new service worker is not ready yet')
            }

            this.#reloadAfterControllerChange = true
            reg.waiting.postMessage({[AppUpdateManager.typeKey]: AppUpdateManager.skipWaitingMessage})
            this.#scheduleUpdateActivationTimeout()
        }
        catch (error) {
            this.#clearUpdateActivationTimeout()
            this.#reloadAfterControllerChange = false
            const updateError = error instanceof Error ? error : new Error('Failed to apply the PWA update')
            if (this.#store) {
                this.#store.isUpdateApplying = false
                this.#store.updateApplyError = updateError.message
            }
            throw updateError
        }
    }

    applyUpdateWithCacheReset = async () => {
        // Purge Cesium tiles if they exist globally
        if (window.__?.app?.cesiumCache) {
            window.__.app.cesiumCache.clear()
        }

        await this.applyUpdate()
    }
}
