/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassFlat.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-07-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * CompassFlat UI.
 * Displays a compact compass with cardinal and intercardinal marks.
 */
export const CompassFlat = ({width = '100%', height = '100%', ref}) => {
    return (
        <svg
            height={height}
            width={width}
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            style={{display: 'block', overflow: 'visible'}}
        >
            <g ref={ref} style={{transformOrigin: '100px 100px'}}>
                <circle
                    className="lgs-compass-background"
                    cx="100"
                    cy="100"
                    r="96"
                    fill="var(--lgs-compass-background)"
                />

                <g
                    className="lgs-compass-poles"
                    fill="none"
                    stroke="var(--lgs-compass-poles, var(--lgs-light-color-50))"
                    strokeLinecap="round"
                    strokeWidth="4"
                >
                    <line x1="100" y1="8" x2="100" y2="22" />
                    <line x1="100" y1="192" x2="100" y2="178" />
                    <line x1="8" y1="100" x2="22" y2="100" />
                    <line x1="192" y1="100" x2="178" y2="100" />
                    <line x1="165" y1="35" x2="155" y2="45" />
                    <line x1="35" y1="35" x2="45" y2="45" />
                    <line x1="35" y1="165" x2="45" y2="155" />
                    <line x1="165" y1="165" x2="155" y2="155" />
                </g>

                <g
                    className="lgs-compass-text"
                    fill="var(--lgs-compass-text)"
                    style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight:   '700',
                        textAnchor:   'middle',
                    }}
                >
                    <text x="100" y="140" fontSize="66.6667px">N</text>
                </g>

                <g className="lgs-compass-needle" style={{transformOrigin: '100px 100px'}}>
                    <polygon
                        className="lgs-compass-needle-north"
                        points="100,42 125,75.3333 75,75.3333"
                        fill="var(--lgs-compass-needle-north)"
                    />
                </g>
            </g>
        </svg>
    )
}
