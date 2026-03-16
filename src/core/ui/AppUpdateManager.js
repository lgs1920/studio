/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUpdateManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-16
 * Last modified: 2026-03-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export class AppUpdateManager {
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
            return
        }

        navigator.serviceWorker.addEventListener(AppUpdateManager.messageEvent, event => {
            if (event.data?.[AppUpdateManager.typeKey] === AppUpdateManager.newVersionMessage) {
                this.#updateCallback?.({
                                           isAvailable: true,
                                           tag: event.data[AppUpdateManager.tagKey] || 'unknown',
                                       })
            }
        }, {passive: true})

        navigator.serviceWorker.register('/service-worker-pwa.js')
            .then(registration => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            this.#updateCallback?.({isAvailable: true, tag: 'new-version-ready'})
                        }
                    }, {passive: true})
                }, {passive: true})
            })
            .catch(() => {
            })
    }

    #setupCacheEventListener = () => {
        window.addEventListener('lgs:cache-cleared', () => {
            if (this.#store) {
                this.#store.isCachePurged = true
            }
        })
    }

    applyUpdate = async () => {
        if (!('serviceWorker' in navigator)) {
            return
        }

        try {
            const reg = await navigator.serviceWorker.getRegistration()
            if (reg?.waiting?.postMessage) {
                reg.waiting.postMessage({[AppUpdateManager.typeKey]: AppUpdateManager.skipWaitingMessage})
                this.#updateCallback?.({isAvailable: false})
            }
        }
        catch (error) {
        }
    }

    applyUpdateWithCacheReset = async () => {
        await this.applyUpdate()

        // Purge Cesium tiles if they exist globally
        if (window.__?.app?.cesiumCache) {
            window.__.app.cesiumCache.clear()
        }

        // Force refresh to apply new assets
        window.location.reload()
    }
}