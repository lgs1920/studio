/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ResponsiveDevice.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-18
 * Last modified: 2025-07-18
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useEffect } from 'react'
import { useMediaQuery } from 'react-responsive'

/**
 * Updates device and orientation classes on the <body> element and toggles
 * device info in lgs.stores.ui.device based on screen size and orientation.
 * Preserves other <body> classes and renders nothing.
 * @returns {null} Renders nothing
 */
const ResponsiveDevice = () => {
    // Configuration for device and orientation groups with media queries
    const groups = {
        platform:    {
            keys:    ['mobile', 'tablet', 'desktop'],
            queries: {
                mobile:  useMediaQuery({maxWidth: 767}),
                tablet:  useMediaQuery({minWidth: 768, maxWidth: 991}),
                desktop: useMediaQuery({minWidth: 992}),
            },
        },
        orientation: {
            keys:    ['portrait', 'landscape'],
            queries: {
                portrait:  useMediaQuery({orientation: 'portrait'}),
                landscape: useMediaQuery({orientation: 'landscape'}),
            },
        },
    }

    /**
     * Sets a single key to true in lgs.stores.ui.device and others to false within the same group
     * @param {string} key - The key to set to true (e.g., 'mobile', 'portrait')
     */
    const setDeviceInfo = key => {
        // Iterate through groups to find the matching group for the key
        for (let group in groups) {
            if (groups[group].keys.includes(key)) {
                // Set all keys in the group to false, except the specified key
                groups[group].keys.forEach(k => {
                    lgs.stores.ui.device[k] = k === key
                })
                break
            }
        }
    }

    useEffect(() => {
        // Determine active keys for each group (default to 'unknown' if none match)
        const updates = Object.keys(groups).map(group => {
            const {keys, queries} = groups[group]
            const activeKey = keys.find(key => queries[key]) || 'unknown'
            // Update store with exclusive booleans
            setDeviceInfo(activeKey)
            return activeKey
        })

        // Collect all keys for class management, including 'unknown'
        const allClasses = Object.values(groups).flatMap(g => g.keys).concat('unknown')

        // Remove previous device and orientation classes from <body>
        document.body.classList.remove(...allClasses)
        // Add current classes, excluding 'unknown'
        document.body.classList.add(...updates.filter(cls => cls !== 'unknown'))

        // Cleanup: Remove managed classes on unmount
        return () => {
            document.body.classList.remove(...allClasses)
        }
    }, [
                  groups.platform.queries.mobile,
                  groups.platform.queries.tablet,
                  groups.platform.queries.desktop,
                  groups.orientation.queries.portrait,
                  groups.orientation.queries.landscape,
              ])

    // Render nothing as this component only manages <body> classes and device info
    return null
}

export default ResponsiveDevice