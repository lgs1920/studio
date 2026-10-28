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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {SLOGAN} from '@Core/constants'
import {SLOGAN_FONT_METRICS, SLOGAN_GLYPH_PATHS} from './SloganSvgGlyphs'

// Leaves a short pause after each glyph finishes its outline trace.
const SLOGAN_GLYPH_STAGGER_MS = 220

/** Renders the welcome slogan as font-independent vector outlines. */
export const SloganSvg = ({className = ''}) => {
    const fontScale = 64 / SLOGAN_FONT_METRICS.unitsPerEm
    const centeredStart = -SLOGAN_FONT_METRICS.advanceWidth / 2
    const centralBaseline = -SLOGAN_FONT_METRICS.centralBaseline

    return (
        <svg
            className={className}
            viewBox="0 0 720 180"
            role="img"
            aria-label={SLOGAN}
            xmlns="http://www.w3.org/2000/svg"
        >
            <g transform="translate(360 90)">
                <g className="welcome-slogan-transform">
                    <g transform={`scale(${fontScale} ${-fontScale}) translate(${centeredStart} ${centralBaseline})`}>
                        {SLOGAN_GLYPH_PATHS.map((glyph, index) => glyph.d && (
                            <path
                                key={glyph.name}
                                className="welcome-slogan-outline"
                                d={glyph.d}
                                transform={`translate(${glyph.x} ${glyph.y})`}
                                pathLength="1"
                                style={{animationDelay: `${index * SLOGAN_GLYPH_STAGGER_MS}ms`}}
                                fill="currentColor"
                            />
                        ))}
                    </g>
                </g>
            </g>
        </svg>
    )
}
