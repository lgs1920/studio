/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cameraAdjustmentWidgetPosition.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const CAMERA_ADJUSTMENT_CENTER_RETRY_DELAY = 50
const CAMERA_ADJUSTMENT_CENTER_RETRY_LIMIT = 12

const cameraAdjustmentSelector = widgetId => `[data-widget="${widgetId}"] .panorama-adjustment-widget-shell`

const getCameraAdjustmentElement = widgetId => {
    const manager = __.ui?.widgetManager
    return manager?.getElementById?.(widgetId) ?? document.querySelector(cameraAdjustmentSelector(widgetId))
}

export const scheduleCameraAdjustmentWidgetCenter = (widgetId, retries = CAMERA_ADJUSTMENT_CENTER_RETRY_LIMIT) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => {}
    }

    let cancelled = false
    let frameId = null
    let timerId = null
    let attempts = 0

    const clearScheduled = () => {
        if (frameId !== null) {
            window.cancelAnimationFrame(frameId)
            frameId = null
        }
        if (timerId !== null) {
            window.clearTimeout(timerId)
            timerId = null
        }
    }

    const schedule = () => {
        if (cancelled || frameId !== null) {
            return
        }
        frameId = window.requestAnimationFrame(center)
    }

    const retry = () => {
        attempts += 1
        if (attempts > retries) {
            return
        }
        timerId = window.setTimeout(() => {
            timerId = null
            schedule()
        }, CAMERA_ADJUSTMENT_CENTER_RETRY_DELAY)
    }

    function center() {
        frameId = null
        if (cancelled) {
            return
        }

        const manager = __.ui?.widgetManager
        const element = getCameraAdjustmentElement(widgetId)
        const elementId = element ? manager?.retrieveElementId?.(element) : null
        const config = elementId ? manager?.getWidgetConfig?.(elementId) : null

        if (!manager?.toCenter || !element || elementId !== widgetId || !config?.container || !config.runtimeReady) {
            retry()
            return
        }

        config.persist = false
        config.fromDB = false
        config.attachTo = 'center'
        manager.setConfig?.(elementId, config)
        manager.toCenter(element, 0)
    }

    schedule()

    return () => {
        cancelled = true
        clearScheduled()
    }
}
