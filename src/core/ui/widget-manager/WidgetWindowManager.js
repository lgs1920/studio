/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetWindowManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { UIToast } from '@Utils/UIToast'
import {canDockWidget, dockWidget} from './WidgetDockManager'

const DETACHED_WINDOW_WIDTH = 480
const DETACHED_WINDOW_HEIGHT = 320
const DETACHED_WINDOW_MIN_WIDTH = 240
const DETACHED_WINDOW_MIN_HEIGHT = 160
const DETACHED_WINDOW_MAX_WIDTH = 1920
const DETACHED_WINDOW_MAX_HEIGHT = 1080
const DETACHED_WINDOW_POLL_DELAY = 250
const DETACHED_CONFIG_KEYS = [
    'attachTo',
    'centerRatio',
    'collapsed',
    'dimensions',
    'height',
    'left',
    'locked',
    'margin',
    'persist',
    'position',
    'ratio',
    'rotate',
    'savedRatios',
    'scale',
    'top',
    'translate',
    'visible',
    'width',
    'widgetsBoard',
]

/**
 * Check whether the browser exposes the Document Picture-in-Picture API.
 *
 * @returns {boolean} True when a Document Picture-in-Picture window can be requested.
 */
export const isDocumentPictureInPictureSupported = () => (
    typeof globalThis.documentPictureInPicture?.requestWindow === 'function'
)

/**
 * Owns the single detachable widget window and its lifecycle.
 */
export class WidgetWindowManager {
    #state = null
    #pollTimer = null
    #selectionFrame = null
    #initialized = false
    #opening = false

    /**
     * Register the application-close cleanup handler.
     *
     * @returns {void}
     */
    initialize = () => {
        if (this.#initialized || typeof window === 'undefined') {
            return
        }

        this.#initialized = true
        window.addEventListener('beforeunload', this.#handleApplicationClose)
    }

    /**
     * Check whether a widget is eligible for detachment and no other widget owns the window.
     *
     * @param {string|null|undefined} widgetId - Widget identifier.
     * @returns {boolean} True when the widget can be detached.
     */
    canDetachWidget = (widgetId) => {
        if (!widgetId || this.#state || this.#opening || lgs.stores.ui.widget.undocked?.id) {
            return false
        }

        const config = __.ui.widgetManager.getWidgetConfig(widgetId)
        const baseId = typeof widgetId === 'string' ? widgetId.split('#')[0] : widgetId
        const definition = globalThis.__?.widgets?.get?.(config?.group)?.widgets?.get?.(baseId)
        const canDetach = config?.contextMenu?.canDetach === true
                       || config?.canDetach === true
                       || definition?.canDetach === true
        return Boolean(canDetach && !config?.mandatory && !definition?.mandatory)
    }

    /**
     * Return the active detached widget window state used by the React portal.
     *
     * @param {string|null|undefined} widgetId - Optional widget identifier.
     * @returns {{window: Window, container: HTMLElement, mode: string}|null} Portal state.
     */
    getPortalState = (widgetId = null) => {
        if (!this.#state || (widgetId && this.#state.id !== widgetId)) {
            return null
        }

        return {
            window:    this.#state.window,
            container: this.#state.container,
            mode:      this.#state.mode,
        }
    }

    /**
     * Detach one widget into a Document Picture-in-Picture or popup window.
     *
     * @param {string|null|undefined} widgetId - Widget identifier.
     * @param {Object} [options] - Detachment options.
     * @param {boolean} [options.useConfigDimensions=false] - Use logical widget dimensions instead of the rendered rect.
     * @param {{width: number, height: number}|null} [options.dimensions] - Explicit initial dimensions, usually captured before docking.
     * @returns {Promise<boolean>} True when the external window was prepared.
     */
    detachWidget = async (widgetId, options = {}) => {
        if (!this.canDetachWidget(widgetId)) {
            return false
        }

        this.#opening = true
        try {
            const config = __.ui.widgetManager.getWidgetConfig(widgetId)
            const snapshot = this.#snapshotConfig(config)
            const dimensions = this.#resolveWindowDimensions(widgetId, config, options)
            const opened = await this.#openExternalWindow(dimensions)
            if (!opened) {
                UIToast.warning({caption: 'Widget window', text: 'The widget window could not be opened.'})
                return false
            }

            const container = this.#prepareDocument(opened.window, widgetId)
            if (!container) {
                void this.#closeWindow(opened.window, opened.mode)
                UIToast.warning({caption: 'Widget window', text: 'The widget window could not be prepared.'})
                return false
            }

            this.#state = {
                id:        widgetId,
                window:    opened.window,
                container,
                mode:      opened.mode,
                snapshot,
            }
            lgs.stores.ui.widget.undocked = {id: widgetId, mode: opened.mode}
            this.#watchWindow()
            return true
        }
        finally {
            this.#opening = false
        }
    }

    /**
     * Reattach the active widget to its original board and position.
     *
     * @param {Object} [options] - Reattachment options.
     * @param {boolean} [options.closeWindow=true] - Close the external window when requested by the app.
     * @returns {Promise<boolean>} True when a widget was reattached.
     */
    reattachWidget = async ({closeWindow = true} = {}) => {
        const state = this.#state
        if (!state) {
            return false
        }

        this.#stopWatchingWindow()
        this.#restoreConfig(state.id, state.snapshot)
        this.#state = null
        const selectionRequest = lgs.stores.ui.widget.reattachSelection
        lgs.stores.ui.widget.reattachSelection = {
            id:      state.id,
            request: (selectionRequest?.request ?? 0) + 1,
        }
        lgs.stores.ui.widget.undocked = {id: null, mode: null}
        this.#selectWidgetWhenMounted(state.id)

        if (closeWindow) {
            await this.#closeWindow(state.window, state.mode)
        }
        return true
    }

    /**
     * Attach the active detached widget to the bottom dock drawer.
     *
     * @param {Object} [options] - Reattachment options.
     * @param {boolean} [options.closeWindow=true] - Close the external window after docking.
     * @returns {Promise<boolean>} True when the widget was attached to the drawer.
     */
    attachWidgetToDrawer = async ({closeWindow = true} = {}) => {
        const state = this.#state
        if (!state || !canDockWidget(state.id)) {
            return false
        }

        this.#stopWatchingWindow()
        this.#restoreConfig(state.id, state.snapshot)
        this.#state = null
        lgs.stores.ui.widget.undocked = {id: null, mode: null}

        if (!dockWidget(state.id)) {
            this.#state = state
            lgs.stores.ui.widget.undocked = {id: state.id, mode: state.mode}
            this.#watchWindow()
            return false
        }

        if (closeWindow) {
            await this.#closeWindow(state.window, state.mode)
        }
        return true
    }

    /**
     * Select the widget again after its scene host has been restored.
     *
     * @param {string} widgetId - Widget identifier.
     * @returns {void}
     */
    #selectWidget = (widgetId) => {
        const config = __.ui.widgetManager.getWidgetConfig(widgetId)
        const rotation = Number(config?.rotate)
        lgs.stores.ui.widget.current = {
            ...(lgs.stores.ui.widget.current ?? {}),
            id:     widgetId,
            rotate: Number.isFinite(rotation) ? rotation : 0,
        }
    }

    /**
     * Select the widget after React has mounted its scene host again.
     *
     * @param {string} widgetId - Widget identifier.
     * @returns {void}
     */
    #selectWidgetWhenMounted = (widgetId) => {
        if (this.#selectionFrame) {
            window.cancelAnimationFrame(this.#selectionFrame)
            this.#selectionFrame = null
        }

        const select = () => {
            this.#selectionFrame = null
            const widgetStore = globalThis.lgs?.stores?.ui?.widget
            if (!widgetStore) {
                return
            }

            if (!this.#state && widgetStore.undocked?.id !== widgetId) {
                this.#selectWidget(widgetId)
            }
        }
        const scheduleSelection = () => {
            this.#selectionFrame = window.requestAnimationFrame(select)
        }
        this.#selectionFrame = window.requestAnimationFrame(scheduleSelection)
    }

    /**
     * Close the external window when the application is unloading.
     *
     * @returns {void}
     */
    #handleApplicationClose = () => {
        const state = this.#state
        if (state) {
            this.#stopWatchingWindow()
            void this.#closeWindow(state.window, state.mode)
        }
    }

    /**
     * Capture the layout values that must survive an external-window remount.
     *
     * @param {Object|null|undefined} config - Runtime widget configuration.
     * @returns {Object} Serializable layout snapshot.
     */
    #snapshotConfig = (config) => Object.fromEntries(
        DETACHED_CONFIG_KEYS
            .filter(key => config?.[key] !== undefined)
            .map(key => [key, this.#cloneValue(config[key])]),
    )

    /**
     * Clone plain widget configuration values without copying DOM resources.
     *
     * @param {*} value - Value to clone.
     * @returns {*} Cloned value.
     */
    #cloneValue = (value) => {
        if (Array.isArray(value)) {
            return value.map(item => this.#cloneValue(item))
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.#cloneValue(item)]))
        }
        return value
    }

    /**
     * Restore the saved layout on the manager runtime configuration.
     *
     * @param {string} widgetId - Widget identifier.
     * @param {Object} snapshot - Saved widget configuration values.
     * @returns {void}
     */
    #restoreConfig = (widgetId, snapshot) => {
        const config = __.ui.widgetManager.getWidgetConfig(widgetId)
        if (!config) {
            return
        }

        Object.assign(config, snapshot)
        __.ui.widgetManager.setConfig(widgetId, config)
    }

    /**
     * Open a Document Picture-in-Picture window and fall back to a resizable popup.
     *
     * @param {{width: number, height: number}} dimensions - Initial window dimensions.
     * @returns {Promise<{window: Window, mode: string}|null>} Opened window details.
     */
    #openExternalWindow = async ({width, height}) => {
        if (isDocumentPictureInPictureSupported()) {
            try {
                const externalWindow = await globalThis.documentPictureInPicture.requestWindow({
                    height,
                    width,
                })
                return {window: externalWindow, mode: 'pip'}
            }
            catch {
                // A user gesture may have expired, so use the browser popup fallback below.
            }
        }

        if (typeof window?.open !== 'function') {
            return null
        }

        const externalWindow = window.open(
            '',
            'lgs1920-detached-widget',
            `popup=yes,resizable=yes,scrollbars=yes,width=${width},height=${height}`,
        )
        return externalWindow ? {window: externalWindow, mode: 'window'} : null
    }

    /**
     * Resolve the initial external-window size from the rendered widget.
     *
     * @param {string} widgetId - Widget identifier.
     * @param {Object|null|undefined} config - Runtime widget configuration.
     * @returns {{width: number, height: number}} Initial window dimensions.
     */
    #resolveWindowDimensions = (widgetId, config, {useConfigDimensions = false, dimensions = null} = {}) => {
        const element = __.ui.widgetManager.getElementById?.(widgetId)
        const rect = element?.getBoundingClientRect?.()
        const scaleX = Number(config?.scale?.x)
        const scaleY = Number(config?.scale?.y)
        const normalizedScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1
        const normalizedScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1
        const configuredWidth = Number(config?.dimensions?.width) * normalizedScaleX
        const configuredHeight = Number(config?.dimensions?.height) * normalizedScaleY
        const explicitWidth = Number(dimensions?.width)
        const explicitHeight = Number(dimensions?.height)
        const width = explicitWidth > 0
                      ? explicitWidth
                      : useConfigDimensions && configuredWidth > 0
                      ? configuredWidth
                      : (rect?.width > 0
                         ? rect.width
                         : config?.width ?? config?.dimensions?.width ?? DETACHED_WINDOW_WIDTH)
        const height = explicitHeight > 0
                       ? explicitHeight
                       : useConfigDimensions && configuredHeight > 0
                       ? configuredHeight
                       : (rect?.height > 0
                          ? rect.height
                          : config?.height ?? config?.dimensions?.height ?? DETACHED_WINDOW_HEIGHT)

        return {
            width:  this.#clampDimension(width, DETACHED_WINDOW_MIN_WIDTH, DETACHED_WINDOW_MAX_WIDTH, DETACHED_WINDOW_WIDTH),
            height: this.#clampDimension(height, DETACHED_WINDOW_MIN_HEIGHT, DETACHED_WINDOW_MAX_HEIGHT, DETACHED_WINDOW_HEIGHT),
        }
    }

    /**
     * Normalize one external-window dimension.
     *
     * @param {*} value - Candidate dimension.
     * @param {number} min - Minimum accepted dimension.
     * @param {number} max - Maximum accepted dimension.
     * @param {number} fallback - Fallback dimension.
     * @returns {number} Normalized dimension.
     */
    #clampDimension = (value, min, max, fallback) => {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return fallback
        }
        return Math.round(Math.min(Math.max(numericValue, min), max))
    }

    /**
     * Prepare the external document and return its content container.
     *
     * @param {Window} externalWindow - External browser window.
     * @param {string} widgetId - Widget identifier.
     * @returns {HTMLElement|null} External content container.
     */
    #prepareDocument = (externalWindow, widgetId) => {
        const externalDocument = externalWindow?.document
        if (!externalDocument) {
            return null
        }

        externalDocument.documentElement.className = document.documentElement.className
        Object.entries(document.documentElement.dataset).forEach(([key, value]) => {
            externalDocument.documentElement.dataset[key] = value
        })
        externalDocument.title = `LGS1920 - ${widgetId.split('#')[0]}`
        externalDocument.head.replaceChildren()

        const base = externalDocument.createElement('base')
        base.href = document.baseURI
        externalDocument.head.appendChild(base)

        document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(source => {
            externalDocument.head.appendChild(source.cloneNode(true))
        })

        externalDocument.body.replaceChildren()
        externalDocument.body.className = ''
        externalDocument.body.style.margin = '0'
        externalDocument.body.style.width = '100%'
        externalDocument.body.style.height = '100%'
        externalDocument.body.style.overflow = 'hidden'
        Object.entries(document.body.dataset).forEach(([key, value]) => {
            externalDocument.body.dataset[key] = value
        })
        const container = externalDocument.createElement('main')
        container.className = 'lgs-detached-window-container'
        container.dataset.widgetWindow = widgetId
        externalDocument.body.appendChild(container)
        return container
    }

    /**
     * Attach close listeners and a polling fallback to the external window.
     *
     * @returns {void}
     */
    #watchWindow = () => {
        const state = this.#state
        if (!state) {
            return
        }

        const handleClosed = () => {
            void this.reattachWidget({closeWindow: false})
        }
        state.handleClosed = handleClosed
        state.window.addEventListener?.('pagehide', handleClosed, {once: true})
        state.window.addEventListener?.('unload', handleClosed, {once: true})
        this.#pollTimer = window.setInterval(() => {
            if (this.#state?.window?.closed) {
                handleClosed()
            }
        }, DETACHED_WINDOW_POLL_DELAY)
    }

    /**
     * Remove external-window listeners and polling.
     *
     * @returns {void}
     */
    #stopWatchingWindow = () => {
        if (this.#pollTimer) {
            window.clearInterval(this.#pollTimer)
            this.#pollTimer = null
        }

        const state = this.#state
        if (state?.handleClosed) {
            state.window.removeEventListener?.('pagehide', state.handleClosed)
            state.window.removeEventListener?.('unload', state.handleClosed)
        }
    }

    /**
     * Close a Picture-in-Picture or popup window safely.
     *
     * @param {Window|null} externalWindow - Window to close.
     * @param {string} mode - Window mode.
     * @returns {Promise<void>} Completion of the close operation.
     */
    #closeWindow = async (externalWindow, mode) => {
        if (!externalWindow || externalWindow.closed) {
            return
        }

        if (mode === 'pip') {
            externalWindow.close?.()
            return
        }

        externalWindow.close?.()
    }
}
