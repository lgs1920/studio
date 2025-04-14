import { CompassFull }  from '@Components/cesium/CompassUI/CompassFull'
import { CompassLight } from '@Components/cesium/CompassUI/CompassLight'

import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath, Matrix4 } from 'cesium'
import classNames                      from 'classnames'
import { useEffect, useRef }           from 'react'
import { useSnapshot }                 from 'valtio'

/**
 * Compass component that synchronizes with the camera heading.
 *
 * @param {Object} props - Component properties.
 * @param {number} props.sensitivity - Mouse sensitivity for interaction.
 * @returns {JSX.Element} Compass UI element.
 */
export const Compass = ({sensitivity = 0.0}) => {
    const needleRef = useRef(null) // Reference for the compass needle
    const compassRef = useRef(null) // Reference for the compass container
    const doubleTapTimeoutRef = useRef(null) // Timeout for double-tap detection

    const compass = useSnapshot(lgs.settings.ui.compass) // Compass state

    useEffect(() => {
        /**
         * Synchronizes the compass needle with the camera's heading.
         */
        const rotateCompass = () => {
            if (needleRef.current) {
                const headingDegrees = -CMath.toDegrees(lgs.camera.heading) % 360 // Convert heading to degrees
                needleRef.current.style.transform = `rotate(${headingDegrees}deg)` // Rotate needle
            }
        }

        /*
         * Handles double-click events to reset camera heading to north.
         *
         * @param {MouseEvent} event - Double click event.
         */
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

        };


        /**
         * Handles double-tap events for resetting camera heading to north.
         *
         * @param {TouchEvent} event - Touch end event.
         */
        const handleDoubleTap = (event) => {
            event.preventDefault()
            if (doubleTapTimeoutRef.current) {
                clearTimeout(doubleTapTimeoutRef.current)
                doubleTapTimeoutRef.current = null

                lgs.camera.setView({
                                       destination: lgs.camera.positionCartographic,

                                       orientation: {
                                           heading: 0,
                                           pitch:   lgs.camera.pitch,
                                           roll:    lgs.camera.roll,
                                       },
                                   });
            }
            else {
                doubleTapTimeoutRef.current = setTimeout(() => {
                    doubleTapTimeoutRef.current = null // Reset timeout
                }, 300) // Double-tap threshold
            }
        };

        // Add event listeners to the compass container
        const compassElement = compassRef.current
        if (compassElement) {
            compassElement.addEventListener('dblclick', handleDoubleClick)
            compassElement.addEventListener('touchend', handleDoubleTap)
        }

        // Attach camera change listener to update compass
        lgs.camera.changed.addEventListener(rotateCompass)
        rotateCompass() // Initial synchronization

        // Cleanup event listeners
        return () => {
            if (compassElement) {
                compassElement.removeEventListener('mousedown', handleMouseDown)
                compassElement.removeEventListener('mousemove', handleMouseMove)
                compassElement.removeEventListener('mouseup', handleMouseUp)
                compassElement.removeEventListener('dblclick', handleDoubleClick)
                compassElement.removeEventListener('touchend', handleDoubleTap)
            }
            lgs.camera.changed.removeEventListener(rotateCompass)
        };
    }, [sensitivity]);

    const modes = ['', 'mode-full', 'mode-light']
    return (
        <div className={classNames('lgs-compass', modes[compass.mode])} ref={compassRef}>
            {compass.mode.toString() === COMPASS_FULL.toString() && <CompassFull ref={needleRef}/>}
            {compass.mode.toString() === COMPASS_LIGHT.toString() && <CompassLight ref={needleRef}/>}
        </div>
    );
};