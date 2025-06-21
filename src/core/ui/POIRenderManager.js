/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIRenderManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-21
 * Last modified: 2025-06-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Manages deferred rendering of POIs to prevent accumulation of setTimeout calls
 * Uses a single timer to execute all render functions after a delay
 * Removes successfully rendered functions from the queue and retries failed ones
 */
export class POIRenderManager {
    /**
     * Constructor initializes the render queue and timer
     */

    /** @type POIRenderManager */
    static instance = null

    constructor() {
        if (POIRenderManager.instance) {
            return POIRenderManager.instance
        }

        this.renderQueue = []
        this.activeTimeouts = new Map() // Tracks active timeout IDs
        this.maxConcurrent = 10 // Maximum concurrent timeouts
        this.instance = this
    }

    /**
     * Adds a render function to the queue and schedules its timeout
     * @param {Function} renderFn - The render function to add
     */
    add(renderFn) {
        if (!this.renderQueue.find(item => item.fn === renderFn)) {
            this.renderQueue.push({fn: renderFn, attempts: 0})
            console.log('Added render function, queue size:', this.renderQueue.length)
            this.scheduleNext()
        }
    }

    /**
     * Removes a render function from the queue and cancels its timeout
     * @param {Function} renderFn - The render function to remove
     */
    remove(renderFn) {
        this.renderQueue = this.renderQueue.filter(item => item.fn !== renderFn)
        const timeoutId = this.activeTimeouts.get(renderFn)
        if (timeoutId) {
            clearTimeout(timeoutId)
            this.activeTimeouts.delete(renderFn)
            console.log('Removed render function, queue size:', this.renderQueue.length, 'active timeouts:', this.activeTimeouts.size)
            this.scheduleNext()
        }
    }

    /**
     * Schedules the next render function(s) if within maxConcurrent limit
     */
    scheduleNext() {
        if (this.activeTimeouts.size >= this.maxConcurrent) {
            return // Wait until some timeouts complete
        }

        const maxAttempts = 5
        const delay = __.app.uiInit ? 50 : 1000

        // Process items within maxConcurrent limit
        while (this.activeTimeouts.size < this.maxConcurrent && this.renderQueue.length > 0) {
            const item = this.renderQueue.shift()
            if (item.attempts >= maxAttempts) {
                console.error('Max attempts reached for render function:', item.fn)
                continue
            }

            const timeoutId = setTimeout(() => {
                requestAnimationFrame(() => {
                    try {
                        item.fn()
                        // Successful execution: remove from active timeouts
                        this.activeTimeouts.delete(item.fn)
                    }
                    catch (error) {
                        console.error('Error executing render function:', error)
                        if (item.attempts < maxAttempts) {
                            item.attempts += 1
                            this.renderQueue.push(item) // Retry later
                        }
                        this.activeTimeouts.delete(item.fn)
                    }
                    // Schedule next renders
                    this.scheduleNext()
                })
            }, delay)

            this.activeTimeouts.set(item.fn, timeoutId)
        }
    }
}

