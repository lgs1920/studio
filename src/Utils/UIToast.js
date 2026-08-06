/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UIToast.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    LGS_ERROR_TOAST, LGS_INFORMATION_TOAST, LGS_SUCCESS_TOAST, LGS_TOAST_DURATION, LGS_WARNING_TOAST, showToast,
} from '@Components/Toast'

export {
    LGS_ERROR_TOAST,
    LGS_INFORMATION_TOAST,
    LGS_SUCCESS_TOAST,
    LGS_WARNING_TOAST,
}

/**
 * UIToast handles application-wide notifications through the shared React toast stack.
 */
export class UIToast {

    /** @type {number} Default display duration */
    static DURATION = LGS_TOAST_DURATION

    /**
     * Internal notification logic.
     * @private
     * @param {string|Object} message
     * @param {string} type
     * @param {number} duration
     */
    static #notify = (message, type = LGS_INFORMATION_TOAST, duration = UIToast.DURATION) => {
        showToast(message, type, duration)
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
}
