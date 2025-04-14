import { CompassFull }  from '@Components/cesium/CompassUI/CompassFull'
import { CompassLight } from '@Components/cesium/CompassUI/CompassLight'

import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath }               from 'cesium'
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

    const isPressingRef = useRef(false) // Tracks if the mouse is pressed
    const previousMousePositionRef = useRef({x: 0, y: 0}) // Previous mouse position
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
                console.log(`Compass updated: Heading ${headingDegrees}°`)
            }
        };

        /**
         * Rotates the camera by applying heading and pitch deltas.
         *
         * @param {number} headingDelta - Change in heading (degrees).
         * @param {number} pitchDelta - Change in pitch (degrees).
         */
        const rotateCamera = (headingDelta, pitchDelta) => {
            const newHeading = lgs.camera.heading + CMath.toRadians(headingDelta)
            const newPitch = lgs.camera.pitch + CMath.toRadians(pitchDelta)

            const clampedPitch = Math.max(CMath.toRadians(-89), Math.min(CMath.toRadians(89), newPitch))

            lgs.camera.setView({
                                   orientation: {
                                       heading: newHeading,
                                       pitch:   clampedPitch,
                                       roll:    lgs.camera.roll, // Preserve roll
                                   },
                               });
        };

        /**
         * Handles mouse down events for starting drag interactions.
         *
         * @param {MouseEvent} event - Mouse down event.
         */
        const handleMouseDown = (event) => {
            event.preventDefault()
            isPressingRef.current = true
            previousMousePositionRef.current = {x: event.clientX, y: event.clientY} // Store initial position
        };

        /**
         * Handles mouse move events for dragging interactions.
         *
         * @param {MouseEvent} event - Mouse move event.
         */
        const handleMouseMove = (event) => {
            if (!isPressingRef.current) {
                return;
            }

            const deltaX = (event.clientX - previousMousePositionRef.current.x) * sensitivity
            const deltaY = (event.clientY - previousMousePositionRef.current.y) * sensitivity

            previousMousePositionRef.current = {x: event.clientX, y: event.clientY} // Update position

            rotateCamera(deltaX, -deltaY) // Apply rotation deltas
        };

        /**
         * Handles mouse up events to end drag interactions.
         *
         * @param {MouseEvent} event - Mouse up event.
         */
        const handleMouseUp = (event) => {
            event.preventDefault()
            isPressingRef.current = false // Stop tracking movement
        };

        /**
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
            compassElement.addEventListener('mousedown', handleMouseDown)
            compassElement.addEventListener('mousemove', handleMouseMove)
            compassElement.addEventListener('mouseup', handleMouseUp)
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