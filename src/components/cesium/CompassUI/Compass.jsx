import { CompassFull }  from '@Components/cesium/CompassUI/CompassFull'
import { CompassLight } from '@Components/cesium/CompassUI/CompassLight'

import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath } from 'cesium'
import classNames                      from 'classnames'
import { useEffect, useRef }           from 'react'
import { useSnapshot }                 from 'valtio'

/**
 * Compass component that synchronizes with the camera heading.
 *
 * @returns {JSX.Element} Compass UI element.
 */
export const Compass = () => {
    const _needle = useRef(null)
    const _compass = useRef(null)
    const _doubleTapTimeout = useRef(null) 

    const compass = useSnapshot(lgs.settings.ui.compass) // Compass state

    useEffect(() => {
        /**
         * Synchronizes the compass needle with the camera's heading.
         */
        const rotateCompass = () => {
            if (_needle.current) {
                const headingDegrees = -CMath.toDegrees(lgs.camera.heading) % 360 // Convert heading to degrees
                _needle.current.style.transform = `rotate(${headingDegrees}deg)` // Rotate needle
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

        }

        const handleDoubleTap = () => {
            // Handle double-tap for touch devices
            if (!__.ui.cameraManager.isRotating()) {
                if (_doubleTapTimeout.current) {
                    clearTimeout(_doubleTapTimeout.current)
                    _doubleTapTimeout.current = null

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
                    _doubleTapTimeout.current = setTimeout(() => {
                        _doubleTapTimeout.current = null // Reset timeout after delay
                    }, 300) // 300ms delay for double-tap detection
                }
            }
        };
        // Add event listeners to the compass container
        const compassElement = _compass.current
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
                compassElement.removeEventListener('dblclick', handleDoubleClick)
                compassElement.removeEventListener('touchend', handleDoubleTap)
            }
            lgs.camera.changed.removeEventListener(rotateCompass)
        }
    }, [])

    const modes = ['', 'mode-full', 'mode-light']
    return (
        <div className={classNames('lgs-compass', modes[compass.mode])} ref={_compass}>
            {compass.mode.toString() === COMPASS_FULL.toString() && <CompassFull ref={_needle}/>}
            {compass.mode.toString() === COMPASS_LIGHT.toString() && <CompassLight ref={_needle}/>}
        </div>
    )
}