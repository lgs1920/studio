/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWindRose.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * CompassWindRose UI
 * Transparent wind rose using the existing compass color classes and dimensions.
 */
export const CompassWindRose = ({width = '100%', height = '100%', ref}) => {
    return (
        <svg
            height={height}
            width={width}
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
            style={{display: 'block', overflow: 'visible'}}
        >
            <g ref={ref} style={{transformOrigin: '256px 256px'}}>
                <circle
                    cx="256"
                    cy="256"
                    r="150"
                    fill="none"
                    stroke="var(--lgs-compass-needle-center, var(--sl-color-amber-500))"
                    strokeWidth="10"
                />
                <g className="lgs-compass-poles" fill="var(--lgs-compass-poles)">
                    <path d="M386,126 L318,238 L286,229 L278,197 Z"/>
                    <path d="M386,386 L278,315 L286,283 L318,274 Z"/>
                    <path d="M126,386 L194,274 L226,283 L234,315 Z"/>
                    <path d="M126,126 L234,197 L226,229 L194,238 Z"/>
                </g>
                <g className="lgs-compass-poles" fill="var(--lgs-compass-poles)">
                    <path d="M474,256 L276,286 L306,256 L276,226 Z"/>
                    <path d="M38,256 L236,226 L206,256 L236,286 Z"/>
                </g>
                <g className="lgs-compass-poles" fill="var(--lgs-compass-poles)" stroke="none">
                    <path d="M256,56 L284,236 L256,214 L228,236 Z"/>
                    <path d="M256,456 L228,276 L256,298 L284,276 Z"/>
                </g>
                <g
                    className="lgs-compass-text"
                    fill="var(--lgs-compass-text)"
                    style={{
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold',
                        fontSize:   '36px',
                        textAnchor: 'middle',
                    }}
                >
                    <text x="256" y="22">N</text>
                    <text x="500" y="270">E</text>
                    <text x="256" y="510">S</text>
                    <text x="12" y="270">W</text>
                </g>
            </g>
            <g className="lgs-compass-needle" style={{transformOrigin: '256px 256px'}}>
                <circle
                    cx="256"
                    cy="256"
                    r="68"
                    className="lgs-compass-poles"
                    fill="var(--lgs-compass-poles)"
                    stroke="none"
                />
                <path
                    className="lgs-compass-needle-north"
                    fill="var(--lgs-compass-needle-north)"
                    stroke="none"
                    d="M256,32 L292,256 L220,256 Z"
                />
                <path
                    className="lgs-compass-needle-south"
                    fill="var(--lgs-compass-needle-south)"
                    stroke="none"
                    d="M256,480 L220,256 L292,256 Z"
                />
                <circle
                    cx="256"
                    cy="256"
                    r="24"
                    className="lgs-compass-needle-center"
                    fill="var(--lgs-compass-needle-center)"
                />
            </g>
        </svg>
    )
}
