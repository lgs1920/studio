/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassModern.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-08-03
 * Last modified: 2026-08-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Renders the modern compass artwork.
 *
 * The complete artwork is kept under one rotation target so the north arrow
 * and the south arc always follow the camera heading together.
 *
 * @param {object} props - SVG rendering properties.
 * @param {string|number} props.width - SVG width.
 * @param {string|number} props.height - SVG height.
 * @param {object} props.ref - React ref attached to the rotation target.
 * @returns {JSX.Element} The modern compass SVG.
 */
export const CompassModern = ({width, height, ref}) => {
    return (
        <svg
            height={height ?? '100%'}
            width={width ?? '100%'}
            viewBox="4.5 0 122 122"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            style={{display: 'block', overflow: 'visible'}}
        >
            <g ref={ref} style={{transformOrigin: '65.5px 60px'}}>
                <g
                    className="lgs-compass-poles lgs-compass-poles-arcs"
                    fill="none"
                    stroke="var(--lgs-compass-poles)"
                    strokeLinecap="round"
                    strokeWidth="5"
                >
                    <path d="M20.6,48 A46.5,46.5 0 0,1 53.4,15" />
                    <path d="M77.6,15 A46.5,46.5 0 0,1 110.4,48" />
                    <path d="M110.4,72 A46.5,46.5 0 0,1 77.6,105" />
                    <path d="M53.4,105 A46.5,46.5 0 0,1 20.6,72" />
                </g>

                <g
                    className="lgs-compass-text"
                    fill="var(--lgs-compass-text)"
                    style={{
                        fontFamily: 'Arial, sans-serif',
                        fontWeight:   'bold',
                        fontSize:     '12px',
                        dominantBaseline: 'middle',
                        textAnchor:   'middle',
                    }}
                >
                    <text x="65.5" y="16">N</text>
                    <text x="115" y="64">E</text>
                    <text x="65.5" y="110">S</text>
                    <text x="16" y="64">W</text>
                </g>

                <path
                    className="lgs-compass-needle-north"
                    d="M65.5,24 C66.5,24 67.4,25.1 67.1,26.8 L76,69.5 C77,74 77,79 74,82 C70,86 61,86 57,82 C54,79 54,74 55,69.5 L63.9,26.8 C63.6,25.1 64.5,24 65.5,24 Z"
                    fill="var(--lgs-compass-needle-north)"
                />
                <path
                    className="lgs-compass-needle-south"
                    d="M59,77.5 C62.5,81.5 68.5,81.5 72,77.5"
                    fill="none"
                    stroke="var(--lgs-compass-needle-south)"
                    strokeLinecap="round"
                    strokeWidth="5"
                />
            </g>
        </svg>
    )
}
