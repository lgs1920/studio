import { CompassFull }  from '@Components/cesium/CompassUI/CompassFull'
import { CompassLight } from '@Components/cesium/CompassUI/CompassLight'

import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath }               from 'cesium'
import classNames                      from 'classnames'
import { useEffect, useRef }           from 'react'
import { useSnapshot }                 from 'valtio'

export const Compass = ({sensitivity = 0.1}) => {
    const _needle = useRef(null) // Ref for the SVG compass
    const _compass = useRef(null) // Ref for the SVG compass

    const isPressingRef = useRef(false) // State to track if the mouse/touch is held
    const currentAngleRef = useRef(0) // Ref for the current camera heading
    const doubleTapTimeoutRef = useRef(null) // Timeout for double-tap detection

    const compass = useSnapshot(lgs.settings.ui.compass)

    useEffect(() => {

        // Function to update the needle orientation based on the camera heading
        const rotateCompass = () => {
            if (_needle.current) {
                // we inverse rotation
                _needle.current.style.transform = `rotate(${-CMath.toDegrees(lgs.camera.heading)}deg)`
            }
        }

        // Attach camera change event listener to dynamically update SVG orientation
        lgs.camera.changed.addEventListener(rotateCompass)


        const rotateCamera = (angle) => {
            // Rotate the camera in Cesium based on the angle
            lgs.camera.setView({
                                   orientation: {
                                       heading: CMath.toRadians(angle),
                                       pitch:   lgs.camera.pitch, // Preserve pitch
                                       roll:    lgs.camera.roll, // Preserve roll
                                   },
                               })
        }

        const handleMouseDown = (event) => {
            isPressingRef.current = true
            console.log('handleMouseDown', event)

            // Get the center of the compass
            const compassBounds = _compass.current.getBoundingClientRect()
            const centerX = compassBounds.left + compassBounds.width / 2
            const centerY = compassBounds.top + compassBounds.height / 2

            // Get the position of the mouse click
            const clickX = event.clientX
            const clickY = event.clientY

            // Calculate the angle from the center to the click position
            const deltaX = clickX - centerX
            const deltaY = clickY - centerY
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) // Convert to degrees

            currentAngleRef.current = angle // Update the angle reference
            rotateCamera(currentAngleRef.current) // Rotate the camera initially
        }

        const handleMouseMove = (event) => {
            if (!isPressingRef.current) {
                return
            }
            console.log('handleMouseMove', event)

            // Get the center of the compass
            const compassBounds = _compass.current.getBoundingClientRect()
            const centerX = compassBounds.left + compassBounds.width / 2
            const centerY = compassBounds.top + compassBounds.height / 2

            // Get the position of the mouse movement
            const moveX = event.clientX
            const moveY = event.clientY

            // Calculate the angle from the center to the movement position
            const deltaX = moveX - centerX
            const deltaY = moveY - centerY
            // Convert to degrees
            currentAngleRef.current = Math.atan2(deltaY, deltaX) * (180 / Math.PI) // Update the angle reference
            rotateCamera(currentAngleRef.current) // Continuously rotate the camera
        }

        const handleMouseUp = (event) => {
            isPressingRef.current = false // Stop rotation when the mouse is released
        }

        const handleDoubleClick = () => {
            // Reset camera heading to north while preserving current pitch and roll
            if (!__.ui.cameraManager.isRotating()) {
                const camera = lgs.mainProxy.components.camera
                camera.position.heading = CMath.toRadians(0)

                __.ui.sceneManager.focus(camera.target, {
                    heading:    camera.position.heading,
                    pitch:      camera.position.pitch,
                    roll:       camera.position.roll,
                    range:      camera.position.range,
                    infinite:   true,
                    rotate:     false,
                    flyingTime: 0,
                    target:     null,
                })
            }

        }

        const handleDoubleTap = () => {
            // Handle double-tap for touch devices
            if (!__.ui.cameraManager.isRotating()) {
                if (doubleTapTimeoutRef.current) {
                    clearTimeout(doubleTapTimeoutRef.current)
                    doubleTapTimeoutRef.current = null

                    const camera = lgs.mainProxy.components.camera
                    camera.position.heading = CMath.toRadians(0)

                    __.ui.sceneManager.focus(camera.target, {
                        heading:    camera.position.heading,
                        pitch:      camera.position.pitch,
                        roll:       camera.position.roll,
                        range:      camera.position.range,
                        infinite:   true,
                        rotate:     false,
                        flyingTime: 0,
                        target:     null,
                    })
                }
                else {
                    // Detect single tap and wait for second
                    doubleTapTimeoutRef.current = setTimeout(() => {
                        doubleTapTimeoutRef.current = null // Reset timeout after delay
                    }, 300) // 300ms delay for double-tap detection
                }
            }
        }

        // Add event listeners for both mouse and touch interactions

        _compass.current.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('dblclick', handleDoubleClick)
        window.addEventListener('touchend', handleDoubleTap)


        // Cleanup event listeners on component unmount
        return () => {
            lgs.camera.changed.removeEventListener(rotateCompass)
            _compass.current.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('dblclick', handleDoubleClick)
            window.removeEventListener('touchend', handleDoubleTap)

        }
    }, [])

    const modes = ['', 'mode-full', 'mode-light']
    return (
        <div className={classNames('lgs-compass', modes[compass.mode])} ref={_compass}>
            {compass.mode === COMPASS_FULL.toString() &&
                <CompassFull ref={_needle}/>
            }

            {compass.mode === COMPASS_LIGHT.toString() &&
                <CompassLight ref={_needle}/>
            }
        </div>
    )
}

