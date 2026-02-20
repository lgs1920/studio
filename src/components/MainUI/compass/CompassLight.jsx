/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassLight.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import React from 'react'

/**
 * CompassLight component (React 19)
 * Priority: colors prop > CSS Class.
 * Simplified version focusing only on needle and center.
 */
export const CompassLight = ({
                                 width = '100%',
                                 height = '100%',
                                 colors = {},
                                 ref,
                             }) => {
    const _colors = colors || {}
    const _needle = _colors.needle || {}

    const dynamicStyle = {
        display:   'block',
        overflow:  'visible',
        transform: 'rotate(-45deg)',
        ...(_needle.north && {'--lgs-compass-needle-north': _needle.north}),
        ...(_needle.south && {'--lgs-compass-needle-south': _needle.south}),
        ...(_needle.center && {'--lgs-compass-needle-center': _needle.center}),
    }

    /**
     * Helper to return style only if the value exists.
     * Uses the CSS variable to ensure priority over classes when prop is set.
     */
    const forceFill = (value, variable) => {
        return value ? {style: {fill: `var(${variable})`}} : {}
    }

    return (
        <svg
            height={height}
            width={width}
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
            style={dynamicStyle}
        >
            <g>
                <g
                    className="lgs-compass-needle"
                    ref={ref}
                    style={{transform: 'scale(1.2)', transformOrigin: '256px 256px'}}
                >
                    <path
                        className="lgs-compass-needle-north"
                        {...forceFill(_needle.north, '--lgs-compass-needle-north')}
                        d="M296.327,296.354l-80.703-80.703l174.962-101.759c9.854-5.731,13.225-2.36,7.494,7.494 L296.327,296.354z"
                    />
                    <path
                        className="lgs-compass-needle-south"
                        {...forceFill(_needle.south, '--lgs-compass-needle-south')}
                        d="M296.327,296.354L121.36,398.108c-9.854,5.731-13.225,2.36-7.494-7.494l101.759-174.962 L296.327,296.354z"
                    />
                </g>

                <circle
                    className="lgs-compass-center"
                    {...forceFill(_needle.center, '--lgs-compass-needle-center')}
                    cx="255.973"
                    cy="256"
                    r="22.8"
                />
            </g>
        </svg>
    )
}