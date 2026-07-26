/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: mediaQuery.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified on: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Attaches a media query listener with a Safari-compatible fallback.
 *
 * @param {MediaQueryList} mediaQuery - Media query list to observe.
 * @param {Function} callback - Change handler to register.
 * @returns {Function} Cleanup function.
 */
export const attachMediaQueryChangeListener = (mediaQuery, callback) => {
    if (typeof mediaQuery?.addEventListener === 'function') {
        mediaQuery.addEventListener('change', callback)
        return () => {
            mediaQuery.removeEventListener('change', callback)
        }
    }

    if (typeof mediaQuery?.addListener === 'function') {
        mediaQuery.addListener(callback)
        return () => {
            mediaQuery.removeListener(callback)
        }
    }

    return () => {}
}
