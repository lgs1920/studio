/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SloganSvg.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-08
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SLOGAN } from '@Core/constants'

export const SloganSvg = ({className = ''}) => {
    return (
        <svg
            className={className}
            viewBox="0 0 720 180"
            role="img"
            aria-label="LGS1920 slogan"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g transform="translate(360 90) rotate(-8) skewX(-14)">
                <text
                    className="welcome-slogan-stroke"
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="currentColor"
                    fontFamily="var(--lgs-slogan-font-family)"
                    fontSize="64"
                >
                    {SLOGAN}
                </text>
            </g>
        </svg>
    )
}
