/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassFull.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * CompassFull UI
 * The full compass artwork rotates based on camera heading.
 */
export const CompassFull = ({width = '100%', height = '100%', ref}) => {
    return (
        <svg
            height={height}
            width={width}
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
            style={{display: 'block', overflow: 'visible'}}
        >
            <g ref={ref} style={{transformOrigin: '256px 256px'}}>
                <g>
                    <path
                        className="lgs-compass-background"
                        fill="var(--lgs-compass-background)"
                        d="M512,256c0,141.376-114.625,256-256,256c-40.96,0-79.698-9.605-113.99-26.751 c-49.85-24.846-90.413-65.409-115.259-115.26C9.605,335.698,0,296.959,0,256c0-7.144,0.317-14.13,0.873-21.115 C11.033,110.337,110.338,11.034,234.885,0.873C241.87,0.318,248.856,0,256,0c48.739,0,94.303,13.653,133.12,37.308 c34.927,21.274,64.298,50.644,85.572,85.572C498.346,161.697,512,207.261,512,256z"
                    />
                    <path
                        className="lgs-compass-over-background"
                        fill="var(--lgs-compass-overBackground)"
                        d="M437.026,74.974L75.004,436.996c19.478,19.479,42.081,35.829,67.006,48.253 C176.302,502.395,215.04,512,256,512c141.375,0,256-114.624,256-256c0-48.739-13.654-94.303-37.309-133.12 C464.055,105.417,451.393,89.341,437.026,74.974z"
                    />
                    <g className="lgs-compass-poles" fill="var(--lgs-compass-poles)">
                        <path d="M230,143 A115,115 0 0,1 282,143 L256,76 Z"/>
                        <path d="M282,369 A115,115 0 0,1 230,369 L256,436 Z"/>
                        <path d="M369,230 A115,115 0 0,1 369,282 L436,256 Z"/>
                        <path d="M143,282 A115,115 0 0,1 143,230 L76,256 Z"/>
                        <path
                            d="M368.64,226.471c-2.937-11.193-7.541-21.75-13.415-31.356 c-9.605-15.638-22.782-28.815-38.341-38.34c-9.605-5.954-20.162-10.558-31.355-13.494c-9.446-2.461-19.369-3.81-29.529-3.81 c-10.161,0-20.004,1.349-29.45,3.731h-0.079c-40.563,10.716-72.553,42.705-83.19,83.269c-2.461,9.446-3.81,19.368-3.81,29.529 c0,10.161,1.349,20.083,3.81,29.529c2.937,11.272,7.462,21.829,13.415,31.434c9.605,15.559,22.782,28.736,38.341,38.262 c9.684,5.954,20.242,10.557,31.434,13.574h0.079c9.446,2.382,19.289,3.731,29.45,3.731c10.16,0,20.083-1.349,29.529-3.81 c40.563-10.637,72.474-42.627,83.111-83.19c2.461-9.446,3.81-19.368,3.81-29.529C372.45,245.839,371.101,235.917,368.64,226.471 z M256,337.762c-8.494,0-16.67-1.35-24.37-3.81h-0.079c-25.481-7.938-45.643-28.101-53.581-53.581v-0.079 c-2.461-7.701-3.731-15.876-3.731-24.291c0-45.087,36.674-81.762,81.762-81.762c8.494,0,16.67,1.27,24.37,3.731 c25.401,7.938,45.564,28.101,53.581,53.581v0.079c2.461,7.7,3.731,15.876,3.731,24.37 C337.682,301.087,301.008,337.762,256,337.762z"/>
                    </g>
                    <g
                        className="lgs-compass-text"
                        fill="var(--lgs-compass-text)"
                        style={{
                            fontFamily: 'Arial, sans-serif',
                            fontWeight: 'bold',
                            fontSize:   '46px',
                            textAnchor: 'middle',
                        }}
                    >
                        <text x="256" y="52">N</text>
                        <text x="465" y="271">E</text>
                        <text x="256" y="492">S</text>
                        <text x="47" y="271">W</text>
                    </g>
                </g>
                <g className="lgs-compass-needle" style={{transformOrigin: '256px 256px'}}>
                    <path
                        className="lgs-compass-needle-north"
                        fill="var(--lgs-compass-needle-north)"
                        d="M216,256 L256,120 L296,256 Z"
                    />
                    <path
                        className="lgs-compass-needle-south"
                        fill="var(--lgs-compass-needle-south)"
                        d="M296,256 L256,392 L216,256 Z"
                    />
                    <circle
                        cx="256"
                        cy="256"
                        r="22.8"
                        className="lgs-compass-needle-center"
                        fill="var(--lgs-compass-needle-center)"
                    />
                </g>
            </g>
        </svg>
    )
}
