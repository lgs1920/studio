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
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {SLOGAN} from '@Core/constants'
import {SLOGAN_FONT_METRICS, SLOGAN_GLYPH_PATHS} from './SloganSvgGlyphs'

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
                        {SLOGAN_GLYPH_PATHS.map(glyph => glyph.d && (
                            <path
                                key={glyph.name}
                                className="welcome-slogan-glyph"
                                d={glyph.d}
                                transform={`translate(${glyph.x} ${glyph.y})`}
                                fill="currentColor"
                            />
                        ))}
                    </g>
                </g>
            </g>
        </svg>
    )
}
