/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DeviceManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-17
 * Last modified: 2025-07-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * DeviceManager class to detect device type and orientation from <body> classes.
 * Singleton pattern ensures one instance.
 * Offers getters for mobile, tablet, desktop, portrait, landscape checks.
 * Includes method to listen for <body> class changes.
 * @module DeviceManager
 */
export class DeviceManager {
    // Private static field to store the singleton instance
    static #instance

    /**
     * Constructor for DeviceManager
     * Returns the existing instance if it exists, otherwise creates a new one
     * @returns {DeviceManager} The singleton instance
     */
    constructor() {
        // Check if instance already exists
        if (DeviceManager.#instance) {
            return DeviceManager.#instance
        }

        // Assign this instance to the private static field at the end
        DeviceManager.#instance = this
    }

    /**
     * Checks if the <body> element has the 'mobile' class
     * @returns {boolean} True if the <body> has the 'mobile' class, false otherwise
     */
    get isMobile() {
        // Check for 'mobile' class on the <body> element
        return document.body.classList.contains('mobile')
    }

    /**
     * Checks if the <body> element has the 'tablet' class
     * @returns {boolean} True if the <body> has the 'tablet' class, false otherwise
     */
    get isTablet() {
        // Check for 'tablet' class on the <body> element
        return document.body.classList.contains('tablet')
    }

    /**
     * Checks if the <body> element has the 'desktop' class
     * @returns {boolean} True if the <body> has the 'desktop' class, false otherwise
     */
    get isDesktop() {
        // Check for 'desktop' class on the <body> element
        return document.body.classList.contains('desktop')
    }

    /**
     * Checks if the <body> element has the 'portrait' class
     * @returns {boolean} True if the <body> has the 'portrait' class, false otherwise
     */
    get isPortrait() {
        // Check for 'portrait' class on the <body> element
        return document.body.classList.contains('portrait')
    }

    /**
     * Checks if the <body> element has the 'landscape' class
     * @returns {boolean} True if the <body> has the 'landscape' class, false otherwise
     */
    get isLandscape() {
        // Check for 'landscape' class on the <body> element
        return document.body.classList.contains('landscape')
    }

    /**
     * Gets the current device type based on the <body> element's class
     * @returns {string} The device type ('mobile', 'tablet', 'desktop', or 'unknown')
     */
    getDeviceType() {
        // Return the device type based on class presence
        if (this.isMobile) {
            return 'mobile'
        }
        if (this.isTablet) {
            return 'tablet'
        }
        if (this.isDesktop) {
            return 'desktop'
        }
        // Fallback if no known device class is found
        return 'unknown'
    }

    /**
     * Gets the current orientation based on the <body> element's class
     * @returns {string} The orientation ('portrait', 'landscape', or 'unknown')
     */
    getOrientation() {
        // Return the orientation based on class presence
        if (this.isPortrait) {
            return 'portrait'
        }
        if (this.isLandscape) {
            return 'landscape'
        }
        // Fallback if no known orientation class is found
        return 'unknown'
    }

    /**
     * Adds a listener for changes to the <body> element's class attribute
     * The callback is invoked with the current device type and orientation whenever the class changes
     * Includes debouncing to prevent excessive callback invocations
     * @param {function({device: string, orientation: string}): void} callback - Function to call with the device type
     *     and orientation
     * @returns {function(): void} Function to remove the listener
     */
    onDeviceChange(callback) {
        // Initialize a MutationObserver to watch for changes to the <body> class
        const observer = new MutationObserver(() => {
            // Debounce the callback to avoid rapid firing during frequent updates
            clearTimeout(this.timeout)
            this.timeout = setTimeout(() => callback({
                                                         device:      this.getDeviceType(),
                                                         orientation: this.getOrientation(),
                                                     }), 100)
        })

        // Configure the observer to monitor class attribute changes
        observer.observe(document.body, {
            attributes:      true,
            attributeFilter: ['class'],
        })

        // Return a cleanup function to disconnect the observer
        return () => {
            clearTimeout(this.timeout)
            observer.disconnect()
        }
    }
}
