/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useManagedStylesheet.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect } from 'react'
import { CSSUtils }  from '@Utils/CSSUtils'

const DEFAULT_STYLESHEET_ATTRIBUTES = {}

/**
 * Mounts a stylesheet for the lifetime of the component using a shared refcount.
 *
 * @param {string} id - Stable stylesheet owner/key
 * @param {string} href - Stylesheet URL
 * @param {Object} attributes - Optional link attributes
 */
export const useManagedStylesheet = (id, href, attributes = DEFAULT_STYLESHEET_ATTRIBUTES) => {
    useEffect(() => {
        if (!href) {
            return undefined
        }

        return CSSUtils.mountStylesheet(id, href, attributes)
    }, [id, href, attributes])
}
