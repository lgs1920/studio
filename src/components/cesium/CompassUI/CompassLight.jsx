/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassLight.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const CompassLight = ({width = '100%', height = '100%', ref}) => {


    return (

        // Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools

        <svg height={height} width={width} xmlns="http://www.w3.org/2000/svg"
             xmlnsXlink="http://www.w3.org/1999/xlink"
             viewBox="0 0 512 512" xmlSpace="preserve" style={{transform: 'rotate(-45deg)'}}>
            <g>
                <g className="lgs-compass-needle" ref={ref}
                   style={{transform: 'scale(1.2)', transformOrigin: 'center'}}>
                    <path className="lgs-compass-needle-north" d="M296.327,296.354l-80.703-80.703l174.962-101.759c9.854-5.731,13.225-2.36,7.494,7.494
					L296.327,296.354z"/>
                    <path className="lgs-compass-needle-south" d="M296.327,296.354L121.36,398.108c-9.854,5.731-13.225,2.36-7.494-7.494l101.759-174.962
					L296.327,296.354z"/>
                </g>
                <circle className="lgs-compass-center" cx="255.973" cy="256" r="22.8"/>
            </g>
        </svg>
    )
}