/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UIToast.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-07
 * Last modified: 2026-03-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SECOND } from '@Core/constants'

/**
 * Toast notification variants mapping to Web Awesome variants
 */
export const LGS_INFORMATION_TOAST = 'primary'
export const LGS_SUCCESS_TOAST = 'success'
export const LGS_WARNING_TOAST = 'warning'
export const LGS_ERROR_TOAST = 'danger'

/**
 * UIToast handles application-wide notifications using Web Awesome components.
 * It interfaces with the <wa-toast> container rendered in the React tree.
 */
export class UIToast {

    /** @type {number} Default display duration */
    static DURATION = 4000 * SECOND
    /** * @type {Object} Icon mapping using standard Font Awesome names.
     * Web Awesome 3 resolves these names via the registered icon library.
     */
    static LGS_TOAST_ICONS = {
        [LGS_INFORMATION_TOAST]: 'circle-info',
        [LGS_SUCCESS_TOAST]:     'circle-check',
        [LGS_WARNING_TOAST]:     'triangle-exclamation',
        [LGS_ERROR_TOAST]:       'bomb',
    }

    /**
     * Getter to dynamically retrieve the toast container from the DOM.
     * This avoids null references if called before React mount.
     * @private
     * @returns {HTMLElement|null}
     */
    static get #container() {
        return document.querySelector('wa-toast')
    }

    /**
     * Internal notification logic.
     * Creates a 'wa-toast-item' and appends it to the global 'wa-toast' container.
     * @private
     * @param {string|Object} message - Message content
     * @param {string} type - Variant type
     * @param {number} duration - Visibility duration
     */
    static #notify = (message, type = LGS_INFORMATION_TOAST, duration = this.DURATION) => {
        if (typeof message === 'string') {
            message = {caption: message}
        }

        const container = UIToast.#container

        if (!container) {
            // Production log to warn if the UI container is missing
            console.warn('UIToast: wa-toast container not found in DOM. Message dropped:', message.caption)
            return
        }

        const toastItem = Object.assign(document.createElement('wa-toast-item'), {
            variant: type,
            closable: true,
            duration: duration,
            innerHTML: `
                <wa-icon slot="icon" name="${UIToast.LGS_TOAST_ICONS[type]} size="small"></wa-icon>
                ${(UIToast.#setNotificationContent(message))}
            `
        })

        // Web Awesome 3 handles the stack management automatically via append
        container.append(toastItem)
    }

    /** @public */
    static notify = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_INFORMATION_TOAST, duration)
    }

    /** @public */
    static success = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_SUCCESS_TOAST, duration)
    }

    /** @public */
    static warning = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_WARNING_TOAST, duration)
    }

    /** @public */
    static error = (message, duration = UIToast.DURATION) => {
        UIToast.#notify(message, LGS_ERROR_TOAST, duration)
    }

    /**
     * Builds the HTML content for the notification.
     * @private
     * @param {Object} message
     * @returns {string} HTML string with spacing markers
     */
    static #setNotificationContent = (message = {}) => {
        let content = message.caption ? `<div class="toast-caption">${message.caption}</div>` : ''
        content += message.text ? `<div class="toast-text">${message.text}</div>` : ''

        let errors = message.errors ?? []
        if (!Array.isArray(errors)) {
            errors = [errors]
        }

        return content
    }
}