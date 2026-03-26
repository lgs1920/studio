/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: duotoneIconUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-26
 * Last modified: 2026-03-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: duotoneIconUtils.js
 ******************************************************************************/

/**
 * Ensures duotone layers use WA CSS vars for both icon families and SVG sources.
 */
export const applyPOIDuotoneIconStyles = (event) => {
    const icon = event?.target
    if (!icon?.updateComplete) {
        return
    }

    icon.updateComplete.then(() => {
        const svg = icon.shadowRoot?.querySelector('[part="svg"]')
        if (!svg) {
            return
        }

        const primaryPaths = svg.querySelectorAll('path[data-duotone-primary], path.fa-primary')
        const secondaryPaths = svg.querySelectorAll('path[data-duotone-secondary], path.fa-secondary')

        primaryPaths.forEach(path => {
            path.style.color = 'var(--primary-color,currentColor)'
            path.style.fill = 'currentColor'
            path.style.opacity = 'var(--path-opacity,var(--primary-opacity,1))'
        })

        secondaryPaths.forEach(path => {
            path.style.color = 'var(--secondary-color,currentColor)'
            path.style.fill = 'currentColor'
            path.style.opacity = 'var(--path-opacity,var(--secondary-opacity,0.4))'
        })
    })
}
