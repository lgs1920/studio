/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ResponsiveDevice.jsx
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

import { useEffect }     from 'react'
import { useMediaQuery } from 'react-responsive'

/**
 * Component that dynamically updates device and orientation classes on the <body> element
 * based on screen size and orientation using media queries
 * Only modifies relevant classes to preserve other <body> classes
 * @returns {null} Renders nothing
 */
const ResponsiveDevice = () => {
    // Detect device types
    const isMobile = useMediaQuery({maxWidth: 767})
    const isTablet = useMediaQuery({minWidth: 768, maxWidth: 991})
    const isDesktop = useMediaQuery({minWidth: 992})

    // Detect orientation
    const isPortrait = useMediaQuery({orientation: 'portrait'})
    const isLandscape = useMediaQuery({orientation: 'landscape'})

    useEffect(() => {
        // Define device and orientation classes
        const deviceClasses = ['mobile', 'tablet', 'desktop', 'unknown']
        const orientationClasses = ['portrait', 'landscape', 'unknown']

        // Determine current device class
        const currentDeviceClass = isMobile ? 'mobile' : isTablet ? 'tablet' : isDesktop ? 'desktop' : 'unknown'

        // Determine current orientation class
        const currentOrientationClass = isPortrait ? 'portrait' : isLandscape ? 'landscape' : 'unknown'

        // Remove only previous device and orientation classes
        document.body.classList.remove(...deviceClasses, ...orientationClasses)

        // Add current device and orientation classes
        document.body.classList.add(currentDeviceClass, currentOrientationClass)

        // Cleanup: Remove only managed classes on unmount
        return () => {
            document.body.classList.remove(...deviceClasses, ...orientationClasses)
        }
    }, [isMobile, isTablet, isDesktop, isPortrait, isLandscape])

    // Render nothing as this component only manages <body> classes
    return null
}

export default ResponsiveDevice