import { Math as CMath }     from 'cesium'
import { useEffect, useRef } from 'react'

export const Compass = () => {
    const svgRef = useRef(null) // Ref for the SVG image
    const isDraggingRef = useRef(false) // State for dragging
    const lastPositionRef = useRef({x: 0, y: 0}) // Last mouse/touch position
    const doubleTapTimeoutRef = useRef(null) // Timeout for double-tap detection

    useEffect(() => {

        // Function to update the SVG orientation based on the camera heading
        const updateSvgOrientation = () => {
            const heading = lgs.camera.heading // Current heading in radians
            const headingDegrees = CMath.toDegrees(heading) // Convert to degrees

            if (svgRef.current) {
                svgRef.current.style.transform = `rotate(${headingDegrees}deg)` // Apply rotation
                svgRef.current.style.transformOrigin = 'center' // Ensure rotation around the center
            }
        }

        // Attach camera change event listener to dynamically update SVG orientation
        lgs.camera.changed.addEventListener(updateSvgOrientation)

        const handleDragStart = (event) => {
            isDraggingRef.current = true
            const clientX = event.touches ? event.touches[0].clientX : event.clientX
            const clientY = event.touches ? event.touches[0].clientY : event.clientY
            lastPositionRef.current = {x: clientX, y: clientY}
        }

        const handleDragMove = (event) => {
            if (!isDraggingRef.current) {
                return
            }

            const clientX = event.touches ? event.touches[0].clientX : event.clientX
            const clientY = event.touches ? event.touches[0].clientY : event.clientY

            const {x, y} = lastPositionRef.current
            const deltaX = clientX - x
            const deltaY = clientY - y

            lastPositionRef.current = {x: clientX, y: clientY}

            // Adjust camera heading and pitch based on drag movement
            const newHeading = lgs.camera.heading - CMath.toRadians(deltaX * 0.1)
            const newPitch = lgs.camera.pitch + CMath.toRadians(deltaY * 0.1)

            // Constrain pitch to avoid flipping
            const constrainedPitch = Math.min(
                CMath.toRadians(90),
                Math.max(CMath.toRadians(-90), newPitch),
            )

            lgs.camera.setView({
                                   orientation: {
                                       heading: newHeading,
                                       pitch:   constrainedPitch,
                                       roll:    lgs.camera.roll, // Preserve current roll
                                   },
                               })
        }

        const handleDragEnd = () => {
            isDraggingRef.current = false
        }

        const handleDoubleClick = () => {
            // Reset camera heading to north while preserving current pitch and roll
            lgs.camera.setView({
                                   orientation: {
                                       heading: CMath.toRadians(0), // Set heading to north
                                       pitch:   lgs.camera.pitch, // Preserve current pitch
                                       roll:    lgs.camera.roll, // Preserve current roll
                                   },
                               })
        }

        const handleDoubleTap = () => {
            // Handle double-tap for touch devices
            if (doubleTapTimeoutRef.current) {
                clearTimeout(doubleTapTimeoutRef.current)
                doubleTapTimeoutRef.current = null

                // Reset camera heading to north
                lgs.camera.setView({
                                       orientation: {
                                           heading: CMath.toRadians(0), // Set heading to north
                                           pitch:   camera.pitch, // Preserve pitch
                                           roll:    camera.roll, // Preserve roll
                                       },
                                   })
            }
            else {
                // Detect single tap and wait for second
                doubleTapTimeoutRef.current = setTimeout(() => {
                    doubleTapTimeoutRef.current = null // Reset timeout after delay
                }, 300) // 300ms delay for double-tap detection
            }
        }

        // Add event listeners for both mouse and touch interactions
        window.addEventListener('mousedown', handleDragStart)
        window.addEventListener('mousemove', handleDragMove)
        window.addEventListener('mouseup', handleDragEnd)

        window.addEventListener('dblclick', handleDoubleClick) // Double-click for desktop
        window.addEventListener('touchstart', handleDragStart)
        window.addEventListener('touchmove', handleDragMove)
        window.addEventListener('touchend', handleDragEnd)
        window.addEventListener('touchend', handleDoubleTap) // Double-tap for touch devices

        // Cleanup event listeners on component unmount
        return () => {
            window.removeEventListener('mousedown', handleDragStart)
            window.removeEventListener('mousemove', handleDragMove)
            window.removeEventListener('mouseup', handleDragEnd)

            window.removeEventListener('dblclick', handleDoubleClick)
            window.removeEventListener('touchstart', handleDragStart)
            window.removeEventListener('touchmove', handleDragMove)
            window.removeEventListener('touchend', handleDragEnd)
            window.removeEventListener('touchend', handleDoubleTap)
        }
    }, [])

    return (
        <div className={'lgs-compass'}>
            {/* Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools */}
            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
                 viewBox="0 0 512 512" xmlSpace="preserve">

                <g>
                    <g>
                        <g>
                            <path className="lgs-compass-bg" d="M512,256c0,141.376-114.625,256-256,256c-40.96,0-79.698-9.605-113.99-26.751
				c-49.85-24.846-90.413-65.409-115.259-115.26C9.605,335.698,0,296.959,0,256c0-7.144,0.317-14.13,0.873-21.115
				C11.033,110.337,110.338,11.034,234.885,0.873C241.87,0.318,248.856,0,256,0c48.739,0,94.303,13.653,133.12,37.308
				c34.927,21.274,64.298,50.644,85.572,85.572C498.346,161.697,512,207.261,512,256z"/>
                            <path className="lgs-compass-over-bg" d="M437.026,74.974L75.004,436.996c19.478,19.479,42.081,35.829,67.006,48.253
		C176.302,502.395,215.04,512,256,512c141.375,0,256-114.624,256-256c0-48.739-13.654-94.303-37.309-133.12
		C464.055,105.417,451.393,89.341,437.026,74.974z"/>
                        </g>
                        <g className="lgs-compass-poles">
                            <path
                                d="M288.196,149.937H223.75l29.229-71.748c1.646-4.041,4.338-4.041,5.985,0L288.196,149.937z"/>
                            <path
                                d="M223.75,362.063h64.446l-29.229,71.748c-1.646,4.041-4.338,4.041-5.985,0L223.75,362.063z"/>
                            <path
                                d="M362.036,288.223v-64.446l71.748,29.229c4.041,1.646,4.041,4.338,0,5.985L362.036,288.223z"/>
                            <path
                                d="M149.91,223.777v64.446l-71.748-29.229c-4.041-1.646-4.041-4.338,0-5.985L149.91,223.777z"/>
                            <path className="lgs-compass-poles-circle" d="M368.64,226.471c-2.937-11.193-7.541-21.75-13.415-31.356
					c-9.605-15.638-22.782-28.815-38.341-38.34c-9.605-5.954-20.162-10.558-31.355-13.494c-9.446-2.461-19.369-3.81-29.529-3.81
					c-10.161,0-20.004,1.349-29.45,3.731h-0.079c-40.563,10.716-72.553,42.705-83.19,83.269c-2.461,9.446-3.81,19.368-3.81,29.529
					c0,10.161,1.349,20.083,3.81,29.529c2.937,11.272,7.462,21.829,13.415,31.434c9.605,15.559,22.782,28.736,38.341,38.262
					c9.684,5.954,20.242,10.557,31.434,13.574h0.079c9.446,2.382,19.289,3.731,29.45,3.731c10.16,0,20.083-1.349,29.529-3.81
					c40.563-10.637,72.474-42.627,83.111-83.19c2.461-9.446,3.81-19.368,3.81-29.529C372.45,245.839,371.101,235.917,368.64,226.471
					z M256,337.762c-8.494,0-16.67-1.35-24.37-3.81h-0.079c-25.481-7.938-45.643-28.101-53.581-53.581v-0.079
					c-2.461-7.701-3.731-15.876-3.731-24.291c0-45.087,36.674-81.762,81.762-81.762c8.494,0,16.67,1.27,24.37,3.731
					c25.401,7.938,45.564,28.101,53.581,53.581v0.079c2.461,7.7,3.731,15.876,3.731,24.37
					C337.682,301.087,301.008,337.762,256,337.762z"/>
                        </g>
                        <g className="lgs-compass-needle" ref={svgRef} style={{rotate: '-45deg'}}>
                            <path id="north" d="M296.327,296.354l-80.703-80.703l174.962-101.759c9.854-5.731,13.225-2.36,7.494,7.494
					L296.327,296.354z"/>
                            <path id="south" d="M296.327,296.354L121.36,398.108c-9.854,5.731-13.225,2.36-7.494-7.494l101.759-174.962
					L296.327,296.354z"/>
                        </g>
                        <circle className="center" cx="255.973" cy="256" r="22.8"/>
                    </g>


                    <g className="lgs-compass-text">
                        <path d="M265.605,15.955v25.481l-19.766-25.481h-8.732V57.55h9.764V31.99l19.845,25.56h8.653V15.955
				H265.605z"/>
                        <path d="M273.146,475.009c-0.635-1.509-1.588-2.778-2.937-3.731c-1.111-0.953-2.381-1.668-3.889-2.143
				c-1.508-0.476-3.334-0.873-5.636-1.191l-5.953-0.714c-1.111-0.159-1.984-0.317-2.778-0.635c-0.715-0.238-1.27-0.556-1.826-0.953
				c-0.476-0.476-0.873-0.872-1.111-1.428c-0.159-0.477-0.318-1.032-0.318-1.587c0-1.429,0.635-2.62,1.905-3.651
				c1.19-1.033,3.175-1.588,5.795-1.588c1.588,0,3.334,0.159,5.159,0.476c1.826,0.318,3.493,1.112,5.08,2.382l6.192-5.08
				c-2.223-1.746-4.525-3.016-7.144-3.731c-2.54-0.714-5.557-1.111-9.049-1.111c-2.699,0-5.159,0.318-7.303,0.953
				s-3.969,1.429-5.477,2.54c-1.429,1.112-2.62,2.461-3.413,4.048c-0.794,1.509-1.191,3.175-1.191,5.081
				c0,3.572,1.191,6.27,3.572,8.175c1.111,0.873,2.461,1.668,4.048,2.223c1.508,0.555,3.413,0.952,5.636,1.27l5.953,0.714
				c1.27,0.158,2.222,0.317,2.858,0.555c0.556,0.159,1.111,0.477,1.667,0.874c1.031,0.872,1.508,1.984,1.508,3.413
				c0,1.667-0.715,3.016-2.223,3.889c-1.508,0.873-3.731,1.349-6.668,1.349c-2.302,0-4.445-0.237-6.509-0.793
				c-2.064-0.477-3.89-1.429-5.477-2.7l-6.351,5.239c2.461,2.064,5.16,3.493,8.097,4.286c3.016,0.795,6.35,1.192,10.161,1.192
				c2.619,0,5.08-0.238,7.303-0.874c2.302-0.555,4.286-1.349,5.953-2.382c1.667-1.111,2.937-2.46,3.89-3.969
				c0.953-1.587,1.349-3.333,1.349-5.397C274.019,478.105,273.781,476.438,273.146,475.009z"/>
                        >
                        <path d="M486.678,245.125v-7.224h-32.863v41.595h32.863v-7.223h-23.1v-10.161h19.686v-7.224h-19.686
				v-9.764H486.678z"/>
                        <path d="M58.661,237.901L51.2,264.097l-8.652-26.196h-6.986l-8.732,26.196l-7.383-26.196H9.764
				l12.701,41.595h7.78l8.811-25.242l8.732,25.242h7.78l12.78-41.595H58.661z"/>
                    </g>
                </g>
            </svg>
        </div>
    )
}

