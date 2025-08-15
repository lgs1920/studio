/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DeviceManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-15
 * Last modified: 2025-08-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DEVICE_TYPE, NAVIGATOR, ORIENTATION } from '@Core/constants'

/**
 * DeviceManager class to detect device type, orientation, and browser from <body> classes and user agent.
 * Implements singleton pattern to ensure a single instance.
 * Provides getters for device type, orientation, OS, and browser detection.
 * Includes method to listen for <body> class changes with debounced callbacks.
 * @module DeviceManager
 */
export class DeviceManager {
    // Private static field for singleton instance
    static #instance

    // user agent
    #ua

    // debounce timeout
    #timeout
    /**
     * Creates or returns the singleton instance of DeviceManager
     * @returns {DeviceManager} The singleton instance
     */
    constructor() {
        // Return existing instance if available
        if (DeviceManager.#instance) {
            return DeviceManager.#instance
        }

        // Initialize user agent
        this.#ua = navigator.userAgent.toLowerCase()

        // Set singleton instance
        DeviceManager.#instance = this
    }

    /**
     * Checks if the device is mobile based on <body> class
     * @returns {boolean} True if <body> has 'mobile' class
     */
    get isMobile() {
        return lgs.stores.ui.device.mobile
    }

    /**
     * Checks if the device is a tablet based on <body> class
     * @returns {boolean} True if <body> has 'tablet' class
     */
    get isTablet() {
        return lgs.stores.ui.device.tablet
    }

    /**
     * Checks if the device is a desktop based on <body> class
     * @returns {boolean} True if <body> has 'desktop' class
     */
    get isDesktop() {
        return lgs.stores.ui.device.desktop
    }

    /**
     * Checks if the device is in portrait orientation based on <body> class
     * @returns {boolean} True if <body> has 'portrait' class
     */
    get isPortrait() {
        return lgs.stores.ui.device.portrait
    }

    /**
     * Checks if the device is in landscape orientation based on <body> class
     * @returns {boolean} True if <body> has 'landscape' class
     */
    get isLandscape() {
        return lgs.stores.ui.device.landscape
    }

    /**
     * Checks if the device is running iOS
     * @returns {boolean} True if user agent matches iOS
     */
    get isIOS() {
        return /ipad|iphone|ipod/.test(this.#ua)
    }

    /**
     * Checks if the device is running Android
     * @returns {boolean} True if user agent matches Android
     */
    get isAndroid() {
        return /android/.test(this.#ua)
    }

    /**
     * Checks if the device is running Linux
     * @returns {boolean} True if user agent matches Linux
     */
    get isLinux() {
        return /linux/.test(this.#ua)
    }

    /**
     * Checks if the device is running Windows
     * @returns {boolean} True if user agent matches Windows
     */
    get isWindows() {
        return /windows/.test(this.#ua)
    }

    /**
     * Identifies the browser based on user agent
     * @returns {string} Browser name from NAVIGATOR constants or 'unknown'
     */
    get browser() {
        const rules = [
            {test: ua => ua.includes('edg/'), browser: NAVIGATOR.edge},
            {test: ua => ua.includes('chrome/') && !ua.includes('edg/'), browser: NAVIGATOR.chrome},
            {test: ua => ua.includes('firefox/'), browser: NAVIGATOR.firefox},
            {test: ua => ua.includes('safari/') && !ua.includes('chrome/'), browser: NAVIGATOR.safari},
        ]

        return rules.find(rule => rule.test(this.#ua))?.browser ?? NAVIGATOR.unknown
    }

    /**
     * Gets the current device type based on <body> classes
     * @returns {string} Device type from DEVICE_TYPE constants or 'unknown'
     */
    getDeviceType = () => {
        const rules = [
            {test: () => this.isMobile, type: DEVICE_TYPE.mobile},
            {test: () => this.isTablet, type: DEVICE_TYPE.tablet},
            {test: () => this.isDesktop, type: DEVICE_TYPE.desktop},
        ]

        return rules.find(rule => rule.test())?.type ?? DEVICE_TYPE.unknown
    }

    /**
     * Gets the current orientation based on <body> classes
     * @returns {string} Orientation from ORIENTATION constants or 'unknown'
     */
    getOrientation = () => {
        const rules = [
            {test: () => this.isPortrait, type: ORIENTATION.portrait},
            {test: () => this.isLandscape, type: ORIENTATION.landscape},
        ]

        return rules.find(rule => rule.test())?.type ?? ORIENTATION.unknown
    }

    /**
     * Listens for <body> class changes and invokes callback with device type and orientation
     * Uses MutationObserver with debouncing to prevent excessive calls
     * @param {({device: string, orientation: string}) => void} callback - Callback with device and orientation
     * @returns {() => void} Function to remove the listener
     */
    onDeviceChange = callback => {
        // Monitor <body> class changes
        const observer = new MutationObserver(() => {
            // Debounce callback to avoid rapid firing
            clearTimeout(this.#timeout)
            this.#timeout = setTimeout(
                () => callback({
                                   device:      this.getDeviceType(),
                                   orientation: this.getOrientation(),
                               }),
                100,
            )
        })

        // Observe class attribute changes
        observer.observe(document.body, {
            attributes:      true,
            attributeFilter: ['class'],
        })

        // Return cleanup function
        return () => {
            clearTimeout(this.#timeout)
            observer.disconnect()
        }
    }

}